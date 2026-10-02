import "server-only";
import { query, transaction } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { productInput, type Product, type Asset } from "./types";
import { type User } from "@/modules/auth/server";
import { capabilities } from "@/modules/studio/presets";
import { margin } from "@/modules/pricing/margin";
export async function products(search = "", stock = "", stage = "") {
  return query<Product>(
    "SELECT p.*, (SELECT id FROM assets WHERE product_id=p.id ORDER BY selected DESC,position,id LIMIT 1) AS thumbnail_id FROM products p WHERE ($1='' OR p.title ILIKE '%'||$1||'%' OR p.sku ILIKE '%'||$1||'%' OR p.brand ILIKE '%'||$1||'%') AND ($2='' OR p.stock=$2) AND ($3='' OR p.preparation=$3) ORDER BY p.created_at DESC LIMIT 200",
    [search.slice(0, 100), stock, stage],
  );
}
export async function detail(id: string) {
  const [product] = await query<Product>("SELECT * FROM products WHERE id=$1", [
    id,
  ]);
  if (!product) throw new AppError("Pièce introuvable", 404);
  const [assets, costs, benchmarks, listings, jobs, audit, suggestions] =
    await Promise.all([
      query<Asset>(
        "SELECT * FROM assets WHERE product_id=$1 ORDER BY position,created_at",
        [id],
      ),
      query("SELECT * FROM costs WHERE product_id=$1 ORDER BY created_at", [
        id,
      ]),
      query(
        "SELECT * FROM benchmarks WHERE product_id=$1 ORDER BY created_at DESC LIMIT 10",
        [id],
      ),
      query("SELECT * FROM listings WHERE product_id=$1", [id]),
      query(
        "SELECT * FROM jobs WHERE product_id=$1 ORDER BY created_at DESC LIMIT 30",
        [id],
      ),
      query(
        "SELECT event,details,created_at FROM audit WHERE product_id=$1 ORDER BY created_at DESC LIMIT 30",
        [id],
      ),
      query(
        "SELECT * FROM suggestions WHERE product_id=$1 ORDER BY created_at DESC LIMIT 10",
        [id],
      ),
    ]);
  return {
    capabilities: capabilities(),
    product,
    assets,
    costs,
    benchmarks,
    listings,
    jobs,
    audit,
    suggestions,
  };
}
export async function saveProduct(
  raw: unknown,
  user: User,
  id?: string,
  revision?: number,
) {
  const p = productInput.parse(raw);
  return transaction(async (c) => {
    const keys = Object.keys(p) as (keyof typeof p)[];
    const values = keys.map((k) =>
      typeof p[k] === "object" && p[k] !== null ? JSON.stringify(p[k]) : p[k],
    );
    let result: Product;
    if (id) {
      const {
        rows: [current],
      } = await c.query<Product>(
        "SELECT * FROM products WHERE id=$1 FOR UPDATE",
        [id],
      );
      if (!current) throw new AppError("Pièce introuvable", 404);
      if (current.revision !== revision)
        throw new AppError(
          "La pièce a changé. Rechargez avant d’enregistrer.",
          409,
        );
      const { rows } = await c.query<Product>(
        `UPDATE products SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(",")},preparation='draft',approved_at=null,approved_by=null,revision=revision+1,updated_at=now() WHERE id=$${keys.length + 1} RETURNING *`,
        [...values, id],
      );
      result = rows[0];
    } else {
      const { rows } = await c.query<Product>(
        `INSERT INTO products(${keys.join(",")},is_demo) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")},$${keys.length + 1}) RETURNING *`,
        [...values, process.env.DEMO_SEED === "true"],
      );
      result = rows[0];
      for (const kind of [
        "transport",
        "preparation",
        "authentification",
        "commission",
        "paiement",
        "livraison",
        "retours",
        "publicite",
      ])
        await c.query(
          "INSERT INTO costs(product_id,kind,currency) VALUES($1,$2,'EUR')",
          [result.id, kind],
        );
    }
    await c.query(
      "INSERT INTO audit(actor_id,product_id,event) VALUES($1,$2,$3)",
      [user.id, result.id, id ? "product.updated" : "product.created"],
    );
    return result;
  });
}
export async function approveProduct(id: string, user: User) {
  if (user.role !== "admin")
    throw new AppError("Validation administrateur requise", 403);
  return transaction(async (c) => {
    const {
      rows: [p],
    } = await c.query<Product>(
      "SELECT * FROM products WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!p || p.stock !== "available")
      throw new AppError("Pièce indisponible", 409);
    const { rows } = await c.query<Asset>(
      "SELECT * FROM assets WHERE product_id=$1 AND review='approved' AND selected AND kind<>'marketing'",
      [id],
    );
    if (
      !p.price_minor ||
      !p.brand ||
      !p.category ||
      !p.description ||
      p.condition === "unknown" ||
      !rows.length ||
      p.authenticity.status !== "reviewed"
    )
      throw new AppError(
        "Compléter marque, catégorie, état, description, prix, contrôle humain et photo documentaire validée.",
      );
    await c.query(
      "UPDATE products SET preparation='approved',approved_at=now(),approved_by=$2 WHERE id=$1",
      [id, user.id],
    );
    await c.query(
      "INSERT INTO audit(actor_id,product_id,event) VALUES($1,$2,'product.approved')",
      [user.id, id],
    );
    return { approved: true };
  });
}
export async function overview() {
  const [stock] = await query(
    "SELECT count(*)::int AS total,count(*) FILTER(WHERE stock='available')::int AS available,count(*) FILTER(WHERE stock='committed')::int AS committed,count(*) FILTER(WHERE stock='sold')::int AS sold,count(*) FILTER(WHERE preparation<>'approved' AND stock='available')::int AS preparing,count(*) FILTER(WHERE is_demo)::int AS demo FROM products",
  );
  const [tasks] = await query(
    "SELECT count(*)::int AS open FROM tasks WHERE status='open'",
  );
  const [orders] = await query(
    "SELECT count(*)::int AS preparing FROM orders WHERE NOT cancelled AND fulfillment_status NOT IN ('fulfilled','FULFILLED')",
  );
  const [sales] = await query(
    "SELECT count(*)::int AS count, sum(total_minor) FILTER(WHERE currency='EUR') AS eur FROM orders WHERE financial_status='paid' AND NOT test AND NOT cancelled AND created_at>=now()-interval '30 days'",
  );
  const sold = await query<
    Product & {
      realized_minor: number | null;
      costs: Parameters<typeof margin>[3];
    }
  >(
    `SELECT p.*,l.price_minor AS realized_minor,coalesce((SELECT json_agg(c) FROM costs c WHERE c.product_id=p.id),'[]') AS costs
    FROM products p JOIN orders o ON o.id=p.stock_order_id JOIN order_lines l ON l.order_id=o.id AND l.product_id=p.id
    WHERE p.stock='sold' AND NOT p.is_demo AND o.financial_status='paid' AND NOT o.test AND NOT o.cancelled AND o.currency='EUR' AND o.created_at>=now()-interval '30 days'`,
  );
  const margins = sold.map((p) =>
    p.realized_minor === null
      ? null
      : margin(
          p.realized_minor,
          p.purchase_minor,
          p.purchase_currency,
          p.costs,
          p.purchase_fx_rate,
        ),
  );
  const known = margins.filter((m) => m?.afterKnownVariableCosts != null);
  const reporting = {
    pieces: sold.length,
    assessable: known.length,
    afterKnownCosts: known.length
      ? known.reduce((s, m) => s + m!.afterKnownVariableCosts!, 0)
      : null,
    incomplete: margins.filter((m) => !m?.complete).length,
  };
  return { stock, tasks, orders, sales, reporting };
}
