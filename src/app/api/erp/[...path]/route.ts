import { z, ZodError } from "zod";
import { query, transaction } from "@/lib/db";
import { AppError, message } from "@/lib/errors";
import { requireUser, checkOrigin } from "@/modules/auth/server";
import {
  products,
  detail,
  saveProduct,
  approveProduct,
  overview,
} from "@/modules/inventory/service";
import { saveAsset } from "@/modules/studio/engine";
import { studioInput, capabilities } from "@/modules/studio/presets";
import { enqueue } from "@/modules/jobs/service";
import { dispatch, dispatchPending } from "@/modules/jobs/dispatch";
import {
  completeTask,
  externalSale,
  listOrders,
} from "@/modules/commerce/orders";
import { type Product, type Job } from "@/modules/inventory/types";
import { canonicalUrl } from "@/modules/pricing/engine";
export const runtime = "nodejs";
export const maxDuration = 300;
type Context = { params: Promise<{ path: string[] }> };
const uuid = z.string().uuid();
async function handle(req: Request, ctx: Context) {
  try {
    const user = await requireUser();
    const { path } = await ctx.params;
    const [section, id, action] = path;
    if (req.method !== "GET") checkOrigin(req);
    if (
      id &&
      ["products", "assets", "tasks", "jobs", "costs"].includes(section)
    )
      uuid.parse(id);
    if (req.method === "GET") {
      if (section === "me") return Response.json(user);
      if (section === "overview") return Response.json(await overview());
      if (section === "products") {
        if (id) return Response.json(await detail(id));
        const q = new URL(req.url).searchParams;
        return Response.json(
          await products(
            q.get("q") ?? "",
            q.get("stock") ?? "",
            q.get("stage") ?? "",
          ),
        );
      }
      if (section === "tasks")
        return Response.json(
          await query(
            "SELECT t.*,p.sku FROM tasks t LEFT JOIN products p ON p.id=t.product_id ORDER BY t.status DESC,t.priority,t.created_at DESC LIMIT 200",
          ),
        );
      if (section === "orders") return Response.json(await listOrders());
      if (section === "jobs")
        return Response.json(
          await query(
            "SELECT j.*,p.sku FROM jobs j LEFT JOIN products p ON p.id=j.product_id ORDER BY j.created_at DESC LIMIT 100",
          ),
        );
      if (section === "settings") {
        await requireUser(true);
        return Response.json({
          capabilities: capabilities(),
          services: [
            {
              name: "Neon / PostgreSQL",
              ready: !!process.env.DATABASE_URL,
              keys: ["DATABASE_URL"],
            },
            {
              name: "Recherche marché / analyse",
              ready: !!process.env.OPENAI_API_KEY && !!process.env.OPENAI_MODEL,
              keys: ["OPENAI_API_KEY", "OPENAI_MODEL"],
            },
            {
              name: "PhotoRoom détourage",
              ready: !!process.env.PHOTOROOM_API_KEY,
              keys: ["PHOTOROOM_API_KEY"],
            },
            {
              name: "Stockage privé durable",
              ready: !!process.env.BLOB_READ_WRITE_TOKEN,
              keys: ["BLOB_READ_WRITE_TOKEN"],
            },
            {
              name: "Images publiées",
              ready: !!process.env.BLOB_PUBLIC_READ_WRITE_TOKEN,
              keys: ["BLOB_PUBLIC_READ_WRITE_TOKEN"],
            },
            {
              name: "Shopify Admin",
              ready: !!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
              keys: [
                "SHOPIFY_ADMIN_ACCESS_TOKEN",
                "SHOPIFY_LOCATION_ID",
                "SHOPIFY_PUBLICATION_ID",
              ],
            },
            {
              name: "Boutique Storefront",
              ready: !!process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN,
              keys: ["SHOPIFY_STOREFRONT_ACCESS_TOKEN"],
            },
            {
              name: "Webhooks",
              ready: !!process.env.SHOPIFY_WEBHOOK_SECRET,
              keys: ["SHOPIFY_WEBHOOK_SECRET"],
            },
            {
              name: "Rapprochement périodique",
              ready: !!process.env.CRON_SECRET,
              keys: ["CRON_SECRET"],
            },
          ],
          storage: process.env.STORAGE_DRIVER ?? "blob",
          databaseEnvironment: process.env.DATABASE_ENV ?? "non configuré",
          apiVersion: process.env.SHOPIFY_API_VERSION ?? "2026-10",
        });
      }
    }
    if (section === "products" && !id && req.method === "POST")
      return Response.json(await saveProduct(await req.json(), user), {
        status: 201,
      });
    if (section === "products" && id) {
      if (!action && req.method === "PUT") {
        const b = await req.json();
        return Response.json(await saveProduct(b, user, id, b.revision));
      }
      const [p] = await query<Product>("SELECT * FROM products WHERE id=$1", [
        id,
      ]);
      if (!p) throw new AppError("Pièce introuvable", 404);
      if (action === "upload") {
        if (Number(req.headers.get("content-length")) > 4.3 * 1024 * 1024)
          throw new AppError("Fichier trop volumineux", 413);
        const form = await req.formData();
        const f = form.get("file");
        if (!(f instanceof File) || f.size > 4 * 1024 * 1024)
          throw new AppError("Photo requise, maximum 4 Mo", 413);
        const asset = await saveAsset(
          id,
          Buffer.from(await f.arrayBuffer()),
          "original",
          null,
        );
        await query(
          "UPDATE products SET preparation='draft',approved_at=null,approved_by=null,revision=revision+1 WHERE id=$1",
          [id],
        );
        return Response.json(asset, { status: 201 });
      }
      if (action === "approve")
        return Response.json(await approveProduct(id, user));
      if (action === "authenticity") {
        const b = z
          .object({
            status: z.enum(["unreviewed", "reviewed", "concern"]),
            observations: z.string().max(4000),
            certificateUrl: z.union([
              z.literal(""),
              z.string().url().startsWith("https://"),
            ]),
          })
          .parse(await req.json());
        await query(
          "UPDATE products SET authenticity=$2,preparation='draft',approved_at=null,approved_by=null,revision=revision+1 WHERE id=$1",
          [id, b],
        );
        await query(
          "INSERT INTO audit(actor_id,product_id,event,details) VALUES($1,$2,'authenticity.review',$3)",
          [user.id, id, b],
        );
        return Response.json({ ok: true });
      }
      if (action === "listing") {
        const b = z
          .object({
            channel: z.enum(["vinted", "vestiaire"]),
            status: z.enum(["draft", "published", "withdrawn"]),
            url: z.string().max(2000).default(""),
            priceMinor: z.number().int().positive().nullable(),
            title: z.string().max(180),
            description: z.string().max(8000),
          })
          .parse(await req.json());
        if (b.url && !canonicalUrl(b.url, b.channel))
          throw new AppError("URL marketplace invalide");
        await transaction(async (c) => {
          const {
            rows: [current],
          } = await c.query(
            "SELECT stock FROM products WHERE id=$1 FOR UPDATE",
            [id],
          );
          if (b.status === "published" && current.stock !== "available")
            throw new AppError("Pièce indisponible", 409);
          await c.query(
            "INSERT INTO listings(product_id,channel,status,external_url,price_minor,title,description,confirmed_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()) ON CONFLICT(product_id,channel) DO UPDATE SET status=$3,external_url=$4,price_minor=$5,title=$6,description=$7,confirmed_at=now()",
            [
              id,
              b.channel,
              b.status,
              b.url || null,
              b.priceMinor,
              b.title,
              b.description,
            ],
          );
          await c.query(
            "INSERT INTO audit(actor_id,product_id,event,details) VALUES($1,$2,'listing.confirmed',$3)",
            [user.id, id, b],
          );
        });
        return Response.json({ ok: true });
      }
      if (action === "sale") {
        const b = z
          .object({
            channel: z.enum(["vinted", "vestiaire"]),
            priceMinor: z.number().int().positive(),
          })
          .parse(await req.json());
        const sale = await externalSale(id, b.channel, b.priceMinor, user.id);
        await dispatchPending();
        return Response.json(sale);
      }
      if (action === "jobs") {
        const b = z
          .object({
            kind: z.enum(["pricing", "studio", "identify", "publish"]),
            requestId: z.string().uuid(),
            input: z.record(z.string(), z.unknown()).default({}),
          })
          .parse(await req.json());
        if (b.kind === "publish") {
          await requireUser(true);
          if (p.preparation !== "approved")
            throw new AppError("Validation humaine requise");
          if (p.is_demo)
            throw new AppError(
              "Démonstration : publication Shopify interdite.",
              403,
            );
        }
        if (b.kind === "studio") {
          const input = studioInput.parse(b.input);
          const jobs = [];
          for (const assetId of input.assetIds) {
            const [a] = await query(
              "SELECT id FROM assets WHERE id=$1 AND product_id=$2 AND kind='original'",
              [assetId, id],
            );
            if (!a) throw new AppError("Image étrangère à la pièce", 403);
            const job = await enqueue(
              "studio",
              id,
              { ...input, assetIds: [assetId] },
              `${b.requestId}:${assetId}`,
            );
            await dispatch(job.id);
            jobs.push(job);
          }
          return Response.json(jobs, { status: 202 });
        }
        const job = await enqueue(
          b.kind,
          id,
          { ...b.input, revision: p.revision },
          b.requestId,
        );
        await dispatch(job.id);
        return Response.json(job, { status: 202 });
      }
    }
    if (section === "assets" && id && req.method === "PATCH") {
      const b = z
        .object({
          review: z.enum(["pending", "approved", "rejected"]),
          selected: z.boolean(),
          position: z.number().int().min(0).max(100),
        })
        .parse(await req.json());
      if (b.selected && b.review !== "approved")
        throw new AppError("Valider avant de sélectionner.");
      return Response.json(
        await transaction(async (c) => {
          const {
            rows: [owner],
          } = await c.query("SELECT product_id FROM assets WHERE id=$1", [id]);
          if (!owner) throw new AppError("Image absente", 404);
          await c.query("SELECT id FROM products WHERE id=$1 FOR UPDATE", [
            owner.product_id,
          ]);
          const {
            rows: [a],
          } = await c.query("SELECT * FROM assets WHERE id=$1 FOR UPDATE", [
            id,
          ]);
          if (!a) throw new AppError("Image absente", 404);
          if (a.public_url && b.review !== "approved")
            throw new AppError(
              "Image publiée : retirer la publication avant de la rejeter.",
              409,
            );
          await c.query(
            "UPDATE assets SET review=$2,selected=$3,position=$4 WHERE id=$1",
            [id, b.review, b.selected, b.position],
          );
          await c.query(
            "UPDATE products SET preparation='draft',approved_at=null,approved_by=null,revision=revision+1 WHERE id=$1",
            [a.product_id],
          );
          await c.query(
            "INSERT INTO audit(actor_id,product_id,event,details) VALUES($1,$2,'asset.review',$3)",
            [user.id, a.product_id, { assetId: id, ...b }],
          );
          return { ok: true };
        }),
      );
    }
    if (section === "costs" && id && req.method === "PATCH") {
      const b = z
        .object({
          known: z.boolean(),
          amount_minor: z.number().int().nonnegative().nullable(),
          currency: z.enum(["EUR", "TND", "USD", "GBP"]),
          fx_rate: z.number().positive().nullable(),
          fx_source: z.string().max(300).nullable(),
          fx_date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .nullable(),
        })
        .parse(await req.json());
      if (b.known && b.amount_minor === null)
        throw new AppError("Montant connu requis");
      if (b.fx_rate && (!b.fx_source || !b.fx_date))
        throw new AppError("Source et date du taux requises");
      await query(
        "UPDATE costs SET known=$2,amount_minor=$3,currency=$4,fx_rate=$5,fx_source=$6,fx_date=$7 WHERE id=$1",
        [
          id,
          b.known,
          b.known ? b.amount_minor : null,
          b.currency,
          b.fx_rate,
          b.fx_source,
          b.fx_date,
        ],
      );
      return Response.json({ ok: true });
    }
    if (section === "tasks" && id)
      return Response.json(await completeTask(id, user.id));
    if (section === "jobs" && id) {
      const b = z
        .object({
          action: z.enum(["retry", "cancel"]),
          acknowledgePossibleCharge: z.boolean().default(false),
        })
        .parse(await req.json());
      const [j] = await query<Job>("SELECT * FROM jobs WHERE id=$1", [id]);
      if (!j) throw new AppError("Job absent", 404);
      if (j.kind === "publish" || j.kind === "reconcile")
        await requireUser(true);
      if (b.action === "cancel") {
        const rows = await query(
          "UPDATE jobs SET status='cancelled',finished_at=now() WHERE id=$1 AND status='pending' RETURNING id",
          [id],
        );
        if (!rows.length)
          throw new AppError(
            "Annulation disponible uniquement avant le début du traitement.",
            409,
          );
      } else {
        if (!b.acknowledgePossibleCharge)
          throw new AppError(
            "Confirmez le risque de double facturation avant relance.",
          );
        const rows = await query(
          "UPDATE jobs SET status='pending',run_id=null,error=null WHERE id=$1 AND status='failed' AND attempts<3 RETURNING id",
          [id],
        );
        if (!rows.length)
          throw new AppError(
            "Job non relançable ou trois tentatives atteintes.",
            409,
          );
        await dispatch(id);
      }
      return Response.json({ ok: true });
    }
    if (section === "reconcile") {
      await requireUser(true);
      const j = await enqueue(
        "reconcile",
        null,
        {},
        `reconcile:${crypto.randomUUID()}`,
      );
      await dispatch(j.id);
      return Response.json(j, { status: 202 });
    }
    if (section === "dispatch") {
      await requireUser(true);
      return Response.json({ dispatched: await dispatchPending() });
    }
    throw new AppError("Route introuvable", 404);
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof ZodError
            ? "Données invalides : " +
              e.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")
            : message(e),
      },
      {
        status:
          e instanceof AppError ? e.status : e instanceof ZodError ? 400 : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
