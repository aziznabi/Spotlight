// Local-only regression: prepare, stop/start Next, then verify. See docs/dependency-audit.md.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import pg from "pg";

const mode = process.argv[2];
assert(["prepare", "verify"].includes(mode), "Expected prepare or verify");
const dbUrl = new URL(process.env.DATABASE_URL);
assert(["localhost", "127.0.0.1"].includes(dbUrl.hostname), "Local DB only");
assert.equal(process.env.DATABASE_ENV, "development");
assert.equal(process.env.DEMO_SEED, "true");
assert.equal(process.env.STORAGE_DRIVER, "local");
assert(!process.env.OPENAI_API_KEY, "Pricing failure test requires no API key");
const origin = "http://localhost:3000";
const directory = ".local/workflow-restart";
const stateFile = `${directory}/state.json`;
await mkdir(directory, { recursive: true });
const db = new pg.Client({ connectionString: dbUrl.href });
await db.connect();

try {
  const auth = await fetch(`${origin}/api/auth`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({
      email: "admin@spotlight.test",
      password: "Spotlight-demo-2026!",
    }),
  });
  assert.equal(auth.status, 200);
  const cookie = auth.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  const post = (path, data) =>
    fetch(origin + path, {
      method: "POST",
      headers: { origin, cookie, "content-type": "application/json" },
      body: JSON.stringify(data),
    });
  const row = async (id) =>
    (
      await db.query("SELECT id,status,attempts,run_id FROM jobs WHERE id=$1", [
        id,
      ])
    ).rows[0];
  async function until(check) {
    for (let i = 0; i < 60; i++) {
      if (await check()) return;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("Workflow assertion timed out after 60 seconds");
  }

  if (mode === "prepare") {
    const {
      rows: [asset],
    } = await db.query(
      "SELECT a.id,a.product_id FROM assets a JOIN products p ON p.id=a.product_id WHERE a.kind='original' AND p.is_demo=true LIMIT 1",
    );
    assert(asset, "Run the local demo seed first");
    const history = (
      await db.query("SELECT id,status,attempts,result FROM jobs ORDER BY id")
    ).rows;
    assert(
      !history.some((j) => ["pending", "processing"].includes(j.status)),
      "Finish existing jobs before preparing the test",
    );
    const state = {
      asset,
      history,
      blockers: [],
      jobs: [],
      runs: [],
      prepared: false,
    };
    const save = () => writeFile(stateFile, JSON.stringify(state, null, 2));
    await save();
    try {
      for (let i = 0; i < 4; i++) {
        const {
          rows: [blocker],
        } = await db.query(
          "INSERT INTO jobs(kind,status,input,dedupe_key,lease_until) VALUES('studio','processing','{}',$1,now()+interval '45 minutes') RETURNING id",
          [`restart-test:${crypto.randomUUID()}`],
        );
        state.blockers.push(blocker.id);
        await save();
      }
      for (let i = 0; i < 2; i++) {
        const response = await post(
          `/api/erp/products/${asset.product_id}/jobs`,
          {
            kind: "studio",
            requestId: crypto.randomUUID(),
            input: {
              assetIds: [asset.id],
              preset: "Clean",
              removeBackground: false,
            },
          },
        );
        assert.equal(response.status, 202);
        state.jobs.push((await response.json())[0].id);
        await save();
      }
      state.runs = await Promise.all(
        state.jobs.map(async (id) => (await row(id)).run_id),
      );
      assert(state.runs.every(Boolean));
      // A persisted wait proves the original workflow actually ran before shutdown.
      await until(async () => {
        const { readdir } = await import("node:fs/promises");
        const files = await readdir(".next/workflow-data/waits");
        return state.runs.every((id) =>
          files.some((name) => name.startsWith(id + "-")),
        );
      });
      state.prepared = true;
      await save();
      console.log(
        "Two durable runs are waiting. Stop/start Next without deleting .next/workflow-data, then run verify.",
      );
    } catch (error) {
      await db.query(
        "UPDATE jobs SET status='cancelled',lease_until=null WHERE id=ANY($1::uuid[])",
        [state.blockers],
      );
      await db.query(
        "UPDATE jobs SET status='cancelled' WHERE id=ANY($1::uuid[]) AND status='pending'",
        [state.jobs],
      );
      throw error;
    }
  } else {
    const state = JSON.parse(await readFile(stateFile, "utf8"));
    assert(state.prepared, "Preparation must finish first");
    try {
      assert.equal(
        (await post(`/api/erp/jobs/${state.blockers[0]}`, { action: "cancel" }))
          .status,
        409,
      );
      assert.equal(
        (await post(`/api/erp/jobs/${state.jobs[1]}`, { action: "cancel" }))
          .status,
        200,
      );
    } finally {
      await db.query(
        "UPDATE jobs SET status='cancelled',lease_until=null,finished_at=now() WHERE id=ANY($1::uuid[])",
        [state.blockers],
      );
    }
    await until(async () => (await row(state.jobs[0])).status === "completed");
    const jobs = await Promise.all(state.jobs.map(row));
    assert.deepEqual(
      jobs.map((j) => j.run_id),
      state.runs,
      "No new durable run may replace an old one",
    );
    assert.deepEqual(
      jobs.map((j) => [j.status, j.attempts]),
      [
        ["completed", 1],
        ["cancelled", 0],
      ],
    );
    await until(async () => {
      const run = JSON.parse(
        await readFile(
          `.next/workflow-data/runs/${state.runs[1]}.json`,
          "utf8",
        ),
      );
      return run.status === "completed"; // Application cancellation resumes as a harmless skip.
    });
    const variants = (
      await db.query(
        "SELECT parameters->>'jobId' AS job_id,count(*)::int AS n FROM assets WHERE parameters->>'jobId'=ANY($1::text[]) GROUP BY 1",
        [state.jobs],
      )
    ).rows;
    assert.deepEqual(variants, [{ job_id: state.jobs[0], n: 1 }]);
    assert.deepEqual(
      (
        await db.query(
          "SELECT id,status,attempts,result FROM jobs WHERE id=ANY($1::uuid[]) ORDER BY id",
          [state.history.map((j) => j.id)],
        )
      ).rows,
      state.history,
    );
    const response = await post(
      `/api/erp/products/${state.asset.product_id}/jobs`,
      {
        kind: "pricing",
        requestId: crypto.randomUUID(),
        input: { refresh: true },
      },
    );
    assert.equal(response.status, 202);
    const pricing = await response.json();
    await until(async () => (await row(pricing.id)).status === "failed");
    assert.equal(
      (await post(`/api/erp/jobs/${pricing.id}`, { action: "retry" })).status,
      400,
    );
    assert.equal(
      (
        await post(`/api/erp/jobs/${pricing.id}`, {
          action: "retry",
          acknowledgePossibleCharge: true,
        })
      ).status,
      200,
    );
    await until(async () => {
      const j = await row(pricing.id);
      return j.status === "failed" && j.attempts === 2;
    });
    console.log(
      JSON.stringify(
        {
          jobs,
          variants,
          preservedJobs: state.history.length,
          retryAttempts: 2,
        },
        null,
        2,
      ),
    );
    console.log(
      "Restart, cancellation, idempotence, retained history and retry verified locally.",
    );
  }
} finally {
  await db.end();
}
