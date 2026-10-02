import { sleep } from "workflow";
export async function runJob(id: string) {
  "use workflow";
  for (let wait = 0; wait < 60; wait++) {
    const status = await claimStep(id);
    if (status === "skip") return;
    if (status === "claimed") {
      await executeStep(id);
      return;
    }
    await sleep("10s");
  }
  await timeoutStep(id);
}
async function claimStep(id: string) {
  "use step";
  const { claim } = await import("./service");
  return claim(id);
}
async function executeStep(id: string) {
  "use step";
  const { execute } = await import("./service");
  await execute(id);
}
executeStep.maxRetries = 0;
async function timeoutStep(id: string) {
  "use step";
  const { query } = await import("@/lib/db");
  await query(
    "UPDATE jobs SET status='failed',error='Attente de capacité expirée : relance possible.',finished_at=now() WHERE id=$1 AND status='pending'",
    [id],
  );
}
