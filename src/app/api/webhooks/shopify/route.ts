import { z } from "zod";
import { query } from "@/lib/db";
import { validSignature, applyOrder } from "@/modules/commerce/orders";
import { toMinor } from "@/lib/currency";
export const runtime = "nodejs";
const orderSchema = z.object({
  id: z.union([z.number().int(), z.string()]),
  name: z.string().default("Commande Shopify"),
  financial_status: z.string().default("pending"),
  fulfillment_status: z.string().nullable().default(null),
  currency: z.string(),
  total_price: z.string().nullable().default(null),
  test: z.boolean().default(false),
  cancelled_at: z.string().nullable().default(null),
  updated_at: z.string(),
  line_items: z.array(
    z.object({
      id: z.union([z.number(), z.string()]),
      sku: z.string().nullable(),
      quantity: z.number().int().positive(),
      price: z.string().nullable().default(null),
      discount_allocations: z
        .array(z.object({ amount: z.string() }))
        .default([]),
    }),
  ),
});
export async function POST(req: Request) {
  if (Number(req.headers.get("content-length")) > 1024 * 1024)
    return new Response("Too large", { status: 413 });
  const raw = await req.text();
  if (raw.length > 1024 * 1024)
    return new Response("Too large", { status: 413 });
  if (
    !validSignature(
      raw,
      req.headers.get("x-shopify-hmac-sha256") ?? "",
      process.env.SHOPIFY_WEBHOOK_SECRET ?? "",
    )
  )
    return new Response("Invalid signature", { status: 401 });
  const shop = req.headers.get("x-shopify-shop-domain");
  if (shop !== process.env.SHOPIFY_SHOP_DOMAIN)
    return new Response("Wrong shop", { status: 403 });
  const id =
      req.headers.get("x-shopify-event-id") ??
      req.headers.get("x-shopify-webhook-id"),
    topic = req.headers.get("x-shopify-topic") ?? "";
  if (!id) return new Response("Event ID required", { status: 400 });
  if (
    ![
      "orders/create",
      "orders/updated",
      "orders/paid",
      "orders/cancelled",
      "orders/fulfilled",
    ].includes(topic)
  )
    return new Response("Ignored", { status: 200 });
  try {
    const data = orderSchema.parse(JSON.parse(raw));
    const [event] = await query(
      "INSERT INTO webhook_events(id,topic,shop,payload) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET id=EXCLUDED.id RETURNING status",
      [id, topic, shop, data],
    );
    if (event.status === "completed") return Response.json({ duplicate: true });
    await applyOrder(
      {
        id: `gid://shopify/Order/${data.id}`,
        name: data.name,
        financial: data.financial_status,
        fulfillment: data.fulfillment_status ?? "unfulfilled",
        currency: data.currency,
        totalMinor:
          data.total_price === null
            ? null
            : toMinor(Number(data.total_price), data.currency),
        test: data.test,
        cancelled: !!data.cancelled_at,
        updatedAt: data.updated_at,
        lines: data.line_items.map((l) => ({
          id: String(l.id),
          sku: l.sku ?? "",
          quantity: l.quantity,
          priceMinor:
            l.price === null
              ? null
              : Math.max(
                  0,
                  toMinor(
                    Number(l.price) -
                      l.discount_allocations.reduce(
                        (s, d) => s + Number(d.amount),
                        0,
                      ) /
                        l.quantity,
                    data.currency,
                  ),
                ),
        })),
      },
      id,
    );
    return Response.json({ ok: true });
  } catch {
    await query(
      "UPDATE webhook_events SET status='failed',error='Traitement échoué : Shopify doit réessayer ou lancer un rapprochement.' WHERE id=$1",
      [id],
    ).catch(() => {});
    return new Response("Retry required", { status: 500 });
  }
}
