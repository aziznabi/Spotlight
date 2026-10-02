import nextEnv from "@next/env";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pool } from "../src/lib/db";
nextEnv.loadEnvConfig(process.cwd());
if (
  process.env.DATABASE_ENV === "production" &&
  process.env.ALLOW_PRODUCTION_MIGRATION !== "true"
)
  throw new Error("Migration production: approbation explicite requise.");
const c = await pool().connect();
try {
  await c.query("SELECT pg_advisory_lock(817231)");
  await c.query("CREATE SCHEMA IF NOT EXISTS spotlight");
  await c.query(
    "CREATE TABLE IF NOT EXISTS spotlight.migrations (name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz DEFAULT now())",
  );
  for (const name of (await readdir("migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(`migrations/${name}`, "utf8");
    const hash = createHash("sha256").update(sql).digest("hex");
    const old = await c.query(
      "SELECT checksum FROM spotlight.migrations WHERE name=$1",
      [name],
    );
    if (old.rows.length) {
      if (old.rows[0].checksum !== hash)
        throw new Error(`Checksum différent: ${name}`);
      continue;
    }
    await c.query("BEGIN");
    try {
      await c.query(sql);
      await c.query(
        "INSERT INTO spotlight.migrations(name,checksum) VALUES($1,$2)",
        [name, hash],
      );
      await c.query("COMMIT");
      console.log(`Applied ${name}`);
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    }
  }
} finally {
  await c.query("SELECT pg_advisory_unlock(817231)");
  c.release();
  await pool().end();
}
