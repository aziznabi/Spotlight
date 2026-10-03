import "server-only";
import { query, transaction } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { type Job, type Product, type Asset } from "@/modules/inventory/types";
import {
  fingerprint,
  benchmark,
  cacheKey,
  defaultConfig,
  VERSION,
} from "@/modules/pricing/engine";
import { searchMarket } from "@/modules/pricing/provider";
import { processImage } from "@/modules/studio/engine";
import { studioInput } from "@/modules/studio/presets";
import { publishProduct, withdrawProduct } from "@/modules/commerce/publish";
import { reconcile } from "@/modules/commerce/reconcile";
export async function enqueue(
  kind: string,
  productId: string | null,
  input: Record<string, unknown>,
  key: string,
) {
  const [job] = await query<Job>(
    "INSERT INTO jobs(kind,product_id,input,dedupe_key) VALUES($1,$2,$3,$4) ON CONFLICT(dedupe_key) DO UPDATE SET dedupe_key=EXCLUDED.dedupe_key RETURNING *",
    [kind, productId, input, key],
  );
  return job;
}
export async function claim(id: string) {
  return transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(815231)");
    const {
      rows: [job],
    } = await c.query<Job>("SELECT * FROM jobs WHERE id=$1 FOR UPDATE", [id]);
    if (!job || job.status !== "pending") return "skip" as const;
    const {
      rows: [running],
    } = await c.query(
      "SELECT count(*)::int AS n FROM jobs WHERE status='processing' AND lease_until>now()",
    );
    if (
      running.n >=
      Math.min(4, Math.max(1, Number(process.env.JOBS_MAX_CONCURRENCY) || 2))
    )
      return "wait" as const;
    await c.query(
      "UPDATE jobs SET status='processing',attempts=attempts+1,started_at=now(),lease_until=now()+interval '5 minutes' WHERE id=$1",
      [id],
    );
    return "claimed" as const;
  });
}
export async function execute(id: string) {
  const [job] = await query<Job>("SELECT * FROM jobs WHERE id=$1", [id]);
  if (!job || job.status !== "processing") return;
  const started = Date.now();
  try {
    let result: unknown;
    const [p] = job.product_id
      ? await query<Product>("SELECT * FROM products WHERE id=$1", [
          job.product_id,
        ])
      : [];
    if (job.kind === "pricing") {
      if (!p) throw new AppError("Pièce absente");
      const fp = fingerprint({
        ...p.attributes,
        brand: p.brand,
        category: p.category,
        condition: p.condition,
      });
      const config = {
        ...defaultConfig,
        cacheHours: Number(process.env.PRICING_CACHE_HOURS) || 24,
      };
      const key = cacheKey(fp, config);
      const cached = job.input.refresh
        ? []
        : await query(
            "SELECT result,id FROM benchmarks WHERE cache_key=$1 AND product_id=$3 AND created_at>now()-($2 * interval '1 hour') ORDER BY created_at DESC LIMIT 1",
            [key, config.cacheHours, p.id],
          );
      if (cached.length) {
        result = { cached: true, benchmarkId: cached[0].id };
      } else {
        const search = await searchMarket(fp);
        const calculated = benchmark(fp, search.comparables, config);
        const [snapshot] = await query(
          "INSERT INTO benchmarks(product_id,job_id,fingerprint,cache_key,parameters,result,provider,calculation_version,cost_minor,latency_ms) VALUES($1,$2,$3,$4,$5,$6,'openai',$7,null,$8) ON CONFLICT(job_id) DO UPDATE SET job_id=EXCLUDED.job_id RETURNING id",
          [
            p.id,
            id,
            fp,
            key,
            { ...config, queries: search.queries, usage: search.usage },
            calculated,
            VERSION,
            search.latencyMs,
          ],
        );
        await query("UPDATE jobs SET provider_id=$2 WHERE id=$1", [
          id,
          search.providerIds.join(","),
        ]);
        result = {
          benchmarkId: snapshot.id,
          retained: calculated.retainedCount,
        };
      }
    } else if (job.kind === "studio") {
      const input = studioInput.parse(job.input);
      if (input.assetIds.length !== 1)
        throw new AppError("Chaque image doit avoir son propre job durable.");
      const [asset] = await query<Asset>(
        "SELECT * FROM assets WHERE id=$1 AND product_id=$2",
        [input.assetIds[0], job.product_id],
      );
      if (!asset) throw new AppError("Image absente");
      const existing = await query(
        "SELECT id FROM assets WHERE parameters->>'jobId'=$1",
        [id],
      );
      result = existing[0] ?? (await processImage(asset, input, id));
    } else if (job.kind === "publish") {
      if (!p) throw new AppError("Pièce absente");
      result = await publishProduct(p.id, Number(job.input.revision));
    } else if (job.kind === "withdraw")
      result = await withdrawProduct(job.product_id, id);
    else if (job.kind === "reconcile") result = await reconcile();
    else if (job.kind === "identify") {
      const { identify } = await import("@/modules/inventory/identify");
      if (!p) throw new AppError("Pièce absente");
      result = await identify(p, id);
    } else throw new AppError("Type de traitement inconnu");
    await query(
      "UPDATE jobs SET status='completed',result=$2,finished_at=now(),lease_until=null,latency_ms=$3,error=null WHERE id=$1 AND status='processing'",
      [id, result, Date.now() - started],
    );
  } catch (error) {
    await query(
      "UPDATE jobs SET status='failed',error=$2,finished_at=now(),lease_until=null,latency_ms=$3 WHERE id=$1",
      [
        id,
        error instanceof AppError
          ? error.message
          : "Traitement interrompu ou réponse fournisseur invalide. Vérifier avant relance pour éviter une double dépense.",
        Date.now() - started,
      ],
    );
  }
}
export async function recover() {
  await query(
    "UPDATE jobs SET status='failed',error='Interruption : résultat fournisseur potentiellement facturé. Contrôle humain requis avant relance.',finished_at=now() WHERE status='processing' AND lease_until<now()",
  );
  return query<Job>(
    "SELECT * FROM jobs WHERE status='pending' ORDER BY created_at LIMIT 20",
  );
}
