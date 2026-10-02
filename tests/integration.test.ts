import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { Pool } from "pg";
import { randomUUID, createHash, createHmac } from "node:crypto";
import { POST as receiveWebhook } from "@/app/api/webhooks/shopify/route";
import { readFile, readdir } from "node:fs/promises";
import sharp from "sharp";
import { pool, query } from "@/lib/db";
import { saveProduct, approveProduct } from "@/modules/inventory/service";
import {
  applyOrder,
  externalSale,
  completeTask,
  type IncomingOrder,
  shipExternalOrder,
} from "@/modules/commerce/orders";
import {
  saveAsset,
  compose,
  validateImage,
  processImage,
} from "@/modules/studio/engine";
import { readPrivate } from "@/modules/studio/storage";
import { archiveVariant } from "@/modules/studio/archive";
import { enqueue, claim, execute, recover } from "@/modules/jobs/service";
import { type User } from "@/modules/auth/server";
import { publishProduct } from "@/modules/commerce/publish";
vi.mock("@/modules/studio/storage", async (original) => ({
  ...(await original<typeof import("@/modules/studio/storage")>()),
  publishBytes: vi.fn(
    async (key: string) =>
      `https://fixture.public.blob.vercel-storage.com/${key}`,
  ),
}));
const dbName = `spotlight_test_${randomUUID().replaceAll("-", "")}`;
let admin: Pool;
let user: User;
beforeAll(async () => {
  const base =
    process.env.TEST_DATABASE_URL ??
    "postgresql://spotlight:local-test-only@127.0.0.1:5433/spotlight";
  if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
    throw new Error("Integration tests require disposable local PostgreSQL");
  admin = new Pool({ connectionString: base });
  await admin.query(`CREATE DATABASE ${dbName}`);
  const u = new URL(base);
  u.pathname = `/${dbName}`;
  process.env.DATABASE_URL = u.toString();
  process.env.DATABASE_ENV = "development";
  process.env.DEMO_SEED = "false";
  process.env.STORAGE_DRIVER = "local";
  for (const name of (await readdir("migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await pool().query(await readFile(`migrations/${name}`, "utf8"));
  const [a] = await query(
    "INSERT INTO users(email,name,role,password_hash) VALUES('test@test.invalid','Test','admin','test-only') RETURNING id",
  );
  user = { id: a.id, email: "test@test.invalid", name: "Test", role: "admin" };
});
afterAll(async () => {
  await pool().end();
  await admin.query(`DROP DATABASE ${dbName}`);
  await admin.end();
  vi.unstubAllGlobals();
});
async function piece() {
  return saveProduct(
    {
      title: "SYNTHETIC Integration Test",
      brand: "Fixture",
      category: "Veste",
      description: "Pièce synthétique, aucune publication réelle",
      condition: "good",
      price_minor: 5000,
      purchase_minor: 1000,
    },
    user,
  );
}
function order(sku: string, id = randomUUID()): IncomingOrder {
  return {
    id,
    name: "TEST Order",
    financial: "pending",
    fulfillment: "unfulfilled",
    currency: "EUR",
    totalMinor: 5000,
    test: true,
    cancelled: false,
    updatedAt: new Date().toISOString(),
    lines: [{ id: "line-" + id, sku, quantity: 1, priceMinor: 5000 }],
  };
}
describe("PostgreSQL integration, no external API proof", () => {
  it("preserves a mocked marketing scene as marketing and applies the Ad format without cropping", async () => {
    const p = await piece(),
      bytes = await sharp({
        create: { width: 320, height: 240, channels: 4, background: "#bbaa99" },
      })
        .png()
        .toBuffer();
    const source = await saveAsset(p.id, bytes, "original", null);
    const provider = {
      name: "synthetic-test-provider",
      capabilities: () => ({
        composition: true,
        backgroundRemoval: true,
        marketingScene: true,
      }),
      scene: async () => bytes,
      removeBackground: async () => bytes,
    };
    const out = await processImage(
      source,
      {
        assetIds: [source.id],
        preset: "Ad",
        format: "9:16",
        background: "#fffFFF",
        margin: 0.2,
        shadow: false,
        removeBackground: false,
      },
      randomUUID(),
      provider,
    );
    expect(out.kind).toBe("marketing");
    expect(out.width).toBe(900);
    expect(out.height).toBe(1600);
    expect(out.source_id).toBe(source.id);
    expect(out.review).toBe("pending");
    await expect(
      processImage(
        out,
        {
          assetIds: [out.id],
          preset: "Clean",
          format: "1:1",
          background: "#ffffff",
          margin: 0.1,
          shadow: false,
          removeBackground: false,
        },
        randomUUID(),
        provider,
      ),
    ).rejects.toThrow("original documentaire");
  });
  it("archives only an unused variant and preserves immutable originals", async () => {
    const p = await piece(),
      bytes = await sharp({
        create: { width: 100, height: 100, channels: 4, background: "#fff" },
      })
        .png()
        .toBuffer();
    const original = await saveAsset(p.id, bytes, "original", null),
      variant = await saveAsset(p.id, bytes, "variant", original.id);
    await expect(archiveVariant(original.id, user.id)).rejects.toThrow(
      "originaux",
    );
    await query(
      "UPDATE assets SET selected=true,review='approved' WHERE id=$1",
      [variant.id],
    );
    await expect(archiveVariant(variant.id, user.id)).rejects.toThrow(
      "sélectionnée",
    );
    await query(
      "UPDATE assets SET selected=false,public_url='https://fixture.invalid/published' WHERE id=$1",
      [variant.id],
    );
    await expect(archiveVariant(variant.id, user.id)).rejects.toThrow(
      "publiée",
    );
    await query("UPDATE assets SET public_url=null WHERE id=$1", [variant.id]);
    await archiveVariant(variant.id, user.id);
    await archiveVariant(variant.id, user.id);
    expect(
      (
        await query(
          "SELECT * FROM assets WHERE product_id=$1 AND deleted_at IS NULL",
          [p.id],
        )
      ).map((a) => a.id),
    ).toEqual([original.id]);
    expect(await readPrivate(original.storage_key)).toEqual(bytes);
  });
  it("records external shipment once without changing stock and keeps Shopify authoritative", async () => {
    const p = await piece(),
      sale = await externalSale(p.id, "vinted", 4200, user.id);
    await shipExternalOrder(
      sale.id,
      { carrier: "Test carrier", tracking: "SYNTHETIC-001" },
      user.id,
    );
    expect(
      (
        await shipExternalOrder(
          sale.id,
          { carrier: "Test carrier", tracking: "SYNTHETIC-001" },
          user.id,
        )
      ).alreadyShipped,
    ).toBe(true);
    expect(
      (
        await query("SELECT fulfillment_status FROM orders WHERE id=$1", [
          sale.id,
        ])
      )[0].fulfillment_status,
    ).toBe("fulfilled");
    expect(
      (await query("SELECT stock FROM products WHERE id=$1", [p.id]))[0].stock,
    ).toBe("sold");
    const p2 = await piece(),
      o = order(p2.sku);
    await applyOrder(o);
    await expect(
      shipExternalOrder(
        o.id,
        { carrier: "Test", tracking: "fixture" },
        user.id,
      ),
    ).rejects.toThrow("Shopify Admin");
  });
  it("accepts a signed synthetic webhook, applies discounts, deduplicates, and rejects tampering", async () => {
    const p = await piece();
    process.env.SHOPIFY_WEBHOOK_SECRET = "fixture-hmac-secret";
    process.env.SHOPIFY_SHOP_DOMAIN = "fixture.myshopify.com";
    const body = JSON.stringify({
      id: "424242",
      name: "TEST SIGNED",
      currency: "EUR",
      financial_status: "pending",
      total_price: "45.00",
      test: true,
      updated_at: new Date().toISOString(),
      line_items: [
        {
          id: "101",
          sku: p.sku,
          quantity: 1,
          price: "50.00",
          discount_allocations: [{ amount: "5.00" }],
        },
      ],
    });
    const headers = {
      "x-shopify-hmac-sha256": createHmac("sha256", "fixture-hmac-secret")
        .update(body)
        .digest("base64"),
      "x-shopify-shop-domain": "fixture.myshopify.com",
      "x-shopify-event-id": randomUUID(),
      "x-shopify-topic": "orders/create",
    };
    const req = (raw = body) =>
      new Request("http://localhost/api/webhooks/shopify", {
        method: "POST",
        headers,
        body: raw,
      });
    expect((await receiveWebhook(req())).status).toBe(200);
    expect((await receiveWebhook(req())).status).toBe(200);
    expect((await receiveWebhook(req(body + " "))).status).toBe(401);
    expect(
      (await query("SELECT stock FROM products WHERE id=$1", [p.id]))[0].stock,
    ).toBe("committed");
    const lines = await query(
      "SELECT price_minor FROM order_lines WHERE product_id=$1",
      [p.id],
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].price_minor).toBe(4500);
  });
  it("quarantines two separate order lines for the same unique SKU", async () => {
    const p = await piece(),
      o = order(p.sku);
    o.lines.push({ ...o.lines[0], id: "duplicate-second-line" });
    await applyOrder(o);
    expect(
      (await query("SELECT stock FROM products WHERE id=$1", [p.id]))[0].stock,
    ).toBe("quarantine");
  });
  it("assigns stable unique SKUs and rejects direct mutation", async () => {
    const [a, b] = await Promise.all([piece(), piece()]);
    expect(a.sku).not.toBe(b.sku);
    await expect(
      query("UPDATE products SET sku=$2 WHERE id=$1", [a.id, "illegal"]),
    ).rejects.toThrow("SKU is immutable");
  });
  it("uses optimistic locking on edits", async () => {
    const p = await piece();
    await saveProduct({ ...p, title: "Updated" }, user, p.id, p.revision);
    await expect(
      saveProduct({ ...p, title: "Stale" }, user, p.id, p.revision),
    ).rejects.toThrow("changé");
  });
  it("creates unknown costs and restricts approvals to admins", async () => {
    const p = await piece();
    const costs = await query("SELECT * FROM costs WHERE product_id=$1", [
      p.id,
    ]);
    expect(costs).toHaveLength(8);
    expect(costs.every((c) => !c.known && c.amount_minor === null)).toBe(true);
    await expect(
      approveProduct(p.id, { ...user, role: "operator" }),
    ).rejects.toThrow("administrateur");
    await expect(approveProduct(p.id, user)).rejects.toThrow("Compléter");
  });
  it("engages stock before payment and makes withdrawal tasks once", async () => {
    const p = await piece();
    await query(
      "INSERT INTO listings(product_id,channel,status) VALUES($1,'vinted','published'),($1,'vestiaire','published')",
      [p.id],
    );
    const o = order(p.sku);
    await Promise.all([applyOrder(o), applyOrder(o)]);
    const [updated] = await query("SELECT stock FROM products WHERE id=$1", [
      p.id,
    ]);
    expect(updated.stock).toBe("committed");
    expect(
      await query("SELECT * FROM tasks WHERE product_id=$1", [p.id]),
    ).toHaveLength(2);
  });
  it("never restocks on paid/cancelled/refunded/late unpaid events", async () => {
    const p = await piece();
    const o = order(p.sku);
    await applyOrder({ ...o, financial: "paid" });
    await applyOrder({ ...o, financial: "refunded", cancelled: true });
    await applyOrder({ ...o, updatedAt: "2020-01-01T00:00:00Z" });
    expect(
      (await query("SELECT stock FROM products WHERE id=$1", [p.id]))[0].stock,
    ).toBe("sold");
    expect(
      await query(
        "SELECT * FROM tasks WHERE product_id=$1 AND kind='return_review'",
        [p.id],
      ),
    ).toHaveLength(1);
  });
  it("quarantines competing orders instead of making stock available", async () => {
    const p = await piece();
    await Promise.all([applyOrder(order(p.sku)), applyOrder(order(p.sku))]);
    expect(
      (await query("SELECT stock FROM products WHERE id=$1", [p.id]))[0].stock,
    ).toBe("quarantine");
  });
  it("serializes two external sales; exactly one succeeds", async () => {
    const p = await piece();
    const result = await Promise.allSettled([
      externalSale(p.id, "vinted", 5000, user.id),
      externalSale(p.id, "vestiaire", 5000, user.id),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await query("SELECT * FROM jobs WHERE product_id=$1", [p.id]),
    ).toHaveLength(1);
  });
  it("completing a withdrawal records operator confirmation", async () => {
    const p = await piece();
    await query(
      "INSERT INTO listings(product_id,channel,status) VALUES($1,'vinted','published')",
      [p.id],
    );
    await applyOrder(order(p.sku));
    const [t] = await query("SELECT * FROM tasks WHERE product_id=$1", [p.id]);
    await completeTask(t.id, user.id);
    expect(
      (
        await query("SELECT status FROM listings WHERE product_id=$1", [p.id])
      )[0].status,
    ).toBe("withdrawn");
  });
  it("keeps source bytes immutable and produces properly sized variants", async () => {
    const p = await piece();
    const bytes = await sharp({
      create: { width: 140, height: 180, channels: 4, background: "#123456" },
    })
      .png()
      .toBuffer();
    const a = await saveAsset(p.id, bytes, "original", null);
    const before = createHash("sha256")
      .update(await readPrivate(a.storage_key))
      .digest("hex");
    const b = await compose(bytes, {
      format: "4:5",
      background: "#ffffff",
      margin: 0.12,
      shadow: true,
    });
    const variant = await saveAsset(p.id, b, "variant", a.id);
    expect(variant.width).toBe(1200);
    expect(variant.height).toBe(1500);
    expect(variant.source_id).toBe(a.id);
    expect(
      createHash("sha256")
        .update(await readPrivate(a.storage_key))
        .digest("hex"),
    ).toBe(before);
    await expect(
      query("UPDATE assets SET storage_key=$2 WHERE id=$1", [
        a.id,
        "overwritten",
      ]),
    ).rejects.toThrow("immutable");
  });
  it("rejects invalid and oversized image files", async () => {
    await expect(validateImage(Buffer.from("<svg/>"))).rejects.toThrow();
    await expect(
      validateImage(Buffer.alloc(4 * 1024 * 1024 + 1)),
    ).rejects.toThrow("volumineuse");
  });
  it("deduplicates and claims a job once under contention", async () => {
    const p = await piece();
    const key = randomUUID();
    const [a, b] = await Promise.all([
      enqueue("pricing", p.id, {}, key),
      enqueue("pricing", p.id, {}, key),
    ]);
    expect(a.id).toBe(b.id);
    const claims = await Promise.all([claim(a.id), claim(a.id)]);
    expect(claims.sort()).toEqual(["claimed", "skip"]);
    await execute(a.id);
    expect(
      (await query("SELECT status,error FROM jobs WHERE id=$1", [a.id]))[0],
    ).toMatchObject({ status: "failed" });
  });
  it("executes a real deterministic studio job and replays without duplicating variants", async () => {
    const p = await piece();
    const bytes = await sharp({
      create: { width: 100, height: 150, channels: 4, background: "#aaaaff" },
    })
      .png()
      .toBuffer();
    const a = await saveAsset(p.id, bytes, "original", null);
    const job = await enqueue(
      "studio",
      p.id,
      {
        assetIds: [a.id],
        preset: "Clean",
        format: "1:1",
        background: "#fffFFF",
        margin: 0.1,
        shadow: false,
        removeBackground: false,
      },
      randomUUID(),
    );
    await claim(job.id);
    await execute(job.id);
    await execute(job.id);
    expect(
      (await query("SELECT status FROM jobs WHERE id=$1", [job.id]))[0].status,
    ).toBe("completed");
    expect(
      await query(
        "SELECT * FROM assets WHERE product_id=$1 AND kind='variant'",
        [p.id],
      ),
    ).toHaveLength(1);
  });
  it("marks interrupted paid requests ambiguous instead of silently re-spending", async () => {
    const p = await piece(),
      job = await enqueue("pricing", p.id, {}, randomUUID());
    await query(
      "UPDATE jobs SET status='processing',lease_until=now()-interval '1 minute' WHERE id=$1",
      [job.id],
    );
    await recover();
    expect(
      (await query("SELECT * FROM jobs WHERE id=$1", [job.id]))[0],
    ).toMatchObject({ status: "failed" });
  });
  it("forbids demo publication before any external calls", async () => {
    const p = await piece();
    await query(
      "UPDATE products SET is_demo=true,preparation='approved' WHERE id=$1",
      [p.id],
    );
    await expect(publishProduct(p.id, p.revision)).rejects.toThrow(
      "démonstration",
    );
  });
  it("reconciles a lost Shopify response without recreating variants or restoring stock", async () => {
    const p = await piece(),
      bytes = await sharp({
        create: { width: 100, height: 150, channels: 4, background: "#aabbcc" },
      })
        .png()
        .toBuffer();
    const a = await saveAsset(p.id, bytes, "original", null);
    await query(
      "UPDATE assets SET review='approved',selected=true WHERE id=$1",
      [a.id],
    );
    await query(
      "UPDATE products SET preparation='approved',authenticity='{\"status\":\"reviewed\"}' WHERE id=$1",
      [p.id],
    );
    Object.assign(process.env, {
      SHOPIFY_SHOP_DOMAIN: "fixture.myshopify.com",
      SHOPIFY_ADMIN_ACCESS_TOKEN: "fixture-token",
      SHOPIFY_LOCATION_ID: "gid://shopify/Location/1",
      SHOPIFY_PUBLICATION_ID: "gid://shopify/Publication/1",
    });
    const calls: string[] = [];
    let remoteCreated = false,
      activated = false,
      lostResponse = true,
      available = 1;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        const { query: q, variables } = JSON.parse(init.body);
        calls.push(q);
        let data;
        if (q.includes("query Context"))
          data = { shop: { currencyCode: "EUR" } };
        else if (q.includes("query Existing"))
          data = {
            productByIdentifier: remoteCreated
              ? {
                  id: "gid://shopify/Product/100",
                  tags: ["spotlight"],
                  variants: {
                    nodes: [
                      {
                        id: "gid://shopify/ProductVariant/100",
                        sku: p.sku,
                        inventoryItem: {
                          id: "gid://shopify/InventoryItem/100",
                          inventoryLevel: activated
                            ? {
                                quantities: [
                                  { name: "available", quantity: available },
                                  { name: "committed", quantity: 0 },
                                ],
                              }
                            : null,
                        },
                      },
                    ],
                  },
                }
              : null,
          };
        else if (q.includes("mutation Upsert")) {
          if (remoteCreated)
            expect(variables.input.variants[0].id).toBe(
              "gid://shopify/ProductVariant/100",
            );
          remoteCreated = true;
          expect(variables.input.variants[0]).not.toHaveProperty(
            "inventoryQuantities",
          );
          data = {
            productSet: {
              product: {
                id: "gid://shopify/Product/100",
                variants: {
                  nodes: [
                    {
                      id: "gid://shopify/ProductVariant/100",
                      inventoryItem: { id: "gid://shopify/InventoryItem/100" },
                    },
                  ],
                },
              },
              userErrors: [],
            },
          };
        } else if (q.includes("mutation Activate")) {
          activated = true;
          data = { inventoryActivate: { userErrors: [] } };
        } else {
          if (lostResponse) {
            lostResponse = false;
            throw new Error("Simulated lost response");
          }
          data = { publishablePublish: { userErrors: [] } };
        }
        return new Response(JSON.stringify({ data }), { status: 200 });
      }),
    );
    await expect(publishProduct(p.id, p.revision)).rejects.toThrow();
    expect(
      (
        await query("SELECT shopify_product_id FROM products WHERE id=$1", [
          p.id,
        ])
      )[0].shopify_product_id,
    ).toBeNull();
    await publishProduct(p.id, p.revision);
    await publishProduct(p.id, p.revision);
    expect(calls.filter((c) => c.includes("mutation Activate"))).toHaveLength(
      1,
    );
    available = 0;
    await expect(publishProduct(p.id, p.revision)).rejects.toThrow(
      "Disponibilité Shopify modifiée",
    );
    vi.unstubAllGlobals();
  });
});
