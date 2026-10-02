import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { type PoolClient } from "pg";
import { transaction, query } from "@/lib/db";
import { AppError } from "@/lib/errors";
export function validSignature(raw: string, signature: string, secret: string) {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const actual = Buffer.from(signature, "base64");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export type IncomingOrder = {
  id: string;
  name: string;
  financial: string;
  fulfillment: string;
  totalMinor: number | null;
  currency: string;
  test: boolean;
  cancelled: boolean;
  updatedAt: string;
  lines: {
    id: string;
    sku: string;
    quantity: number;
    priceMinor: number | null;
  }[];
};
export async function task(
  c: PoolClient,
  productId: string | null,
  kind: string,
  title: string,
  key: string,
) {
  await c.query(
    "INSERT INTO tasks(product_id,kind,title,priority,dedupe_key) VALUES($1,$2,$3,0,$4) ON CONFLICT(dedupe_key) DO NOTHING",
    [productId, kind, title, key],
  );
}
export async function retireListings(
  c: PoolClient,
  productId: string,
  saleChannel: string,
) {
  const { rows: listings } = await c.query(
    "UPDATE listings SET status='withdrawal_pending' WHERE product_id=$1 AND channel<>$2 AND status='published' RETURNING channel",
    [productId, saleChannel],
  );
  for (const l of listings) {
    await task(
      c,
      productId,
      "withdraw",
      `Retirer l’annonce ${l.channel}`,
      `withdraw:${productId}:${l.channel}`,
    );
  }
  if (saleChannel !== "shopify")
    await c.query(
      "INSERT INTO jobs(product_id,kind,input,dedupe_key) VALUES($1,'withdraw','{}',$2) ON CONFLICT(dedupe_key) DO NOTHING",
      [productId, `withdraw:${productId}`],
    );
}
export async function applyOrder(order: IncomingOrder, eventId?: string) {
  return transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(815230)");
    if (eventId) {
      const {
        rows: [event],
      } = await c.query(
        "SELECT status FROM webhook_events WHERE id=$1 FOR UPDATE",
        [eventId],
      );
      if (event?.status === "completed") return { duplicate: true };
    }
    const {
      rows: [old],
    } = await c.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
      order.id,
    ]);
    const fresh = !old || +new Date(order.updatedAt) >= +new Date(old.event_at);
    if (fresh)
      await c.query(
        "INSERT INTO orders(id,channel,name,financial_status,fulfillment_status,total_minor,currency,test,cancelled,event_at) VALUES($1,'shopify',$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET financial_status=$3,fulfillment_status=$4,total_minor=$5,cancelled=orders.cancelled OR $8,event_at=$9",
        [
          order.id,
          order.name,
          order.financial,
          order.fulfillment,
          order.totalMinor,
          order.currency,
          order.test,
          order.cancelled,
          order.updatedAt,
        ],
      );
    for (const line of [...order.lines].sort((a, b) =>
      a.sku.localeCompare(b.sku),
    )) {
      const {
        rows: [p],
      } = await c.query("SELECT * FROM products WHERE sku=$1 FOR UPDATE", [
        line.sku,
      ]);
      if (!p) {
        await task(
          c,
          null,
          "unmatched_order",
          `Associer le SKU ${line.sku || "inconnu"} de ${order.name}`,
          `unmatched:${order.id}:${line.id}`,
        );
        continue;
      }
      await c.query(
        "INSERT INTO order_lines(order_id,line_id,product_id,sku,quantity,price_minor) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(order_id,line_id) DO UPDATE SET price_minor=CASE WHEN $7 THEN EXCLUDED.price_minor ELSE order_lines.price_minor END",
        [
          order.id,
          line.id,
          p.id,
          line.sku,
          line.quantity,
          line.priceMinor,
          fresh,
        ],
      );
      const conflict =
        (p.stock_order_id && p.stock_order_id !== order.id) ||
        order.lines
          .filter((l) => l.sku === line.sku)
          .reduce((s, l) => s + l.quantity, 0) !== 1 ||
        p.stock === "quarantine";
      if (conflict) {
        await task(
          c,
          p.id,
          "stock_conflict",
          `Conflit de stock : ${p.sku} / ${order.name}`,
          `conflict:${order.id}:${p.id}`,
        );
        await c.query(
          "UPDATE products SET stock='quarantine',revision=revision+1 WHERE id=$1",
          [p.id],
        );
      } else {
        const paid =
          ["paid", "partially_refunded", "refunded"].includes(
            order.financial,
          ) || p.stock === "sold";
        await c.query(
          "UPDATE products SET stock=$2,stock_order_id=$3,revision=revision+1,updated_at=now() WHERE id=$1",
          [p.id, paid ? "sold" : "committed", order.id],
        );
      }
      await retireListings(c, p.id, "shopify");
      if (
        order.cancelled ||
        ["refunded", "partially_refunded"].includes(order.financial)
      )
        await task(
          c,
          p.id,
          "return_review",
          `Contrôler retour/annulation : ${p.sku}`,
          `return:${order.id}:${p.id}`,
        );
    }
    if (eventId)
      await c.query(
        "UPDATE webhook_events SET status='completed',processed_at=now(),error=null WHERE id=$1",
        [eventId],
      );
    return { processed: true };
  });
}
export async function externalSale(
  productId: string,
  channel: "vinted" | "vestiaire",
  priceMinor: number,
  actorId: string,
) {
  return transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(815230)");
    const {
      rows: [p],
    } = await c.query("SELECT * FROM products WHERE id=$1 FOR UPDATE", [
      productId,
    ]);
    if (!p || p.stock !== "available")
      throw new AppError("Pièce déjà engagée ou indisponible.", 409);
    const id = `external:${p.id}`;
    await c.query(
      "INSERT INTO orders(id,channel,name,financial_status,fulfillment_status,total_minor,currency,event_at,test) VALUES($1,$2,$3,'paid','unfulfilled',$4,'EUR',now(),$5)",
      [id, channel, p.sku, priceMinor, p.is_demo],
    );
    await c.query(
      "INSERT INTO order_lines(order_id,line_id,product_id,sku,quantity,price_minor) VALUES($1,$2,$3,$4,1,$5)",
      [id, p.id, p.id, p.sku, priceMinor],
    );
    await c.query(
      "UPDATE products SET stock='sold',stock_order_id=$2,revision=revision+1,updated_at=now() WHERE id=$1",
      [p.id, id],
    );
    await c.query(
      "UPDATE listings SET status='sold',confirmed_at=now() WHERE product_id=$1 AND channel=$2",
      [p.id, channel],
    );
    await retireListings(c, p.id, channel);
    await c.query(
      "INSERT INTO audit(actor_id,product_id,event,details) VALUES($1,$2,'external.sale',$3)",
      [actorId, p.id, { channel, priceMinor }],
    );
    return { id };
  });
}
export async function completeTask(id: string, actor: string) {
  return transaction(async (c) => {
    const {
      rows: [t],
    } = await c.query("SELECT * FROM tasks WHERE id=$1 FOR UPDATE", [id]);
    if (!t) throw new AppError("Tâche introuvable", 404);
    if (t.kind === "stock_conflict" || t.kind === "return_review")
      throw new AppError(
        "Résolution manuelle du stock requise; cette V1 ne réassort pas automatiquement.",
        409,
      );
    await c.query(
      "UPDATE tasks SET status='done',completed_at=now(),completed_by=$2 WHERE id=$1",
      [id, actor],
    );
    if (t.kind === "withdraw") {
      const channel = t.dedupe_key.split(":").at(-1);
      if (channel === "shopify") {
        const {
          rows: [l],
        } = await c.query(
          "SELECT status FROM listings WHERE product_id=$1 AND channel='shopify'",
          [t.product_id],
        );
        if (l?.status !== "withdrawn")
          throw new AppError(
            "Le retrait Shopify doit être confirmé par API.",
            409,
          );
      } else
        await c.query(
          "UPDATE listings SET status='withdrawn',confirmed_at=now() WHERE product_id=$1 AND channel=$2",
          [t.product_id, channel],
        );
    }
    await c.query(
      "INSERT INTO audit(actor_id,product_id,event,details) VALUES($1,$2,'task.completed',$3)",
      [actor, t.product_id, { taskId: id }],
    );
    return { ok: true };
  });
}
export async function listOrders() {
  return query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 100");
}
