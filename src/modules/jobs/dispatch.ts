import "server-only";
import { start } from "workflow/api";
import { runJob } from "./workflow";
import { query } from "@/lib/db";
import { recover } from "./service";
export async function dispatch(id: string) {
  try {
    const run = await start(runJob, [id]);
    await query("UPDATE jobs SET run_id=$2 WHERE id=$1", [id, run.runId]);
    return run.runId;
  } catch {
    await query(
      "UPDATE jobs SET error='Lancement durable indisponible. Le job reste en attente de réexpédition.' WHERE id=$1 AND status='pending'",
      [id],
    );
    return null;
  }
}
export async function dispatchPending() {
  const jobs = await recover();
  for (const j of jobs) await dispatch(j.id);
  return jobs.length;
}
