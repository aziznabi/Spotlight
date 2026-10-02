import { timingSafeEqual } from "node:crypto";
import { dispatchPending } from "@/modules/jobs/dispatch";
import { enqueue } from "@/modules/jobs/service";
export const maxDuration = 300;
export async function GET(req: Request) {
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET ?? ""}`),
    got = Buffer.from(req.headers.get("authorization") ?? "");
  if (
    !process.env.CRON_SECRET ||
    got.length !== expected.length ||
    !timingSafeEqual(got, expected)
  )
    return new Response("Unauthorized", { status: 401 });
  if (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN)
    await enqueue(
      "reconcile",
      null,
      {},
      `daily-reconcile:${new Date().toISOString().slice(0, 10)}`,
    );
  return Response.json({ dispatched: await dispatchPending() });
}
