import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { GET, POST } from "@/app/api/cart/route";
const jar = vi.hoisted(() => new Map<string, string>());
const cookieSet = vi.hoisted(() =>
  vi.fn((key: string, value: string) => jar.set(key, value)),
);
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: cookieSet,
  }),
}));
const variantId = "gid://shopify/ProductVariant/42";
const cart = {
  id: "gid://shopify/Cart/42?key=PRIVATE_CART_KEY",
  checkoutUrl: "https://fixture.myshopify.com/checkouts/test-only",
  totalQuantity: 1,
  cost: { totalAmount: { amount: "30.00", currencyCode: "EUR" } },
  lines: {
    nodes: [
      {
        id: "line42",
        quantity: 1,
        merchandise: {
          id: variantId,
          title: "Unique",
          availableForSale: true,
          price: { amount: "30.00", currencyCode: "EUR" },
          product: { title: "Synthetic", handle: "fixture" },
        },
      },
    ],
  },
};
beforeEach(() => {
  jar.clear();
  cookieSet.mockClear();
  process.env.APP_URL = "http://localhost:3000";
  process.env.SHOPIFY_SHOP_DOMAIN = "fixture.myshopify.com";
  process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = "fixture-token";
});
afterEach(() => vi.unstubAllGlobals());
const request = (data: unknown, origin = "http://localhost:3000") =>
  new Request("http://localhost:3000/api/cart", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
it("creates a mocked Storefront cart, keeps secret cookie private, avoids duplicates and removes a line", async () => {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init) => {
      const { query: q, variables } = JSON.parse(init.body);
      calls.push(q);
      expect(init.headers["Shopify-Storefront-Private-Token"]).toBe(
        "fixture-token",
      );
      let data;
      if (q.includes("query Eligibility"))
        data = {
          node: { availableForSale: true, product: { tags: ["spotlight"] } },
        };
      else if (q.includes("query Cart")) data = { cart };
      else if (q.includes("mutation CreateCart")) {
        expect(variables.input.lines).toEqual([
          { merchandiseId: variantId, quantity: 1 },
        ]);
        data = { cartCreate: { cart, userErrors: [], warnings: [] } };
      } else
        data = {
          cartLinesRemove: {
            cart: { ...cart, totalQuantity: 0, lines: { nodes: [] } },
            userErrors: [],
            warnings: [],
          },
        };
      return Response.json({ data });
    }),
  );
  const added = await POST(request({ action: "add", variantId }));
  expect(added.status).toBe(200);
  const text = await added.text();
  expect(text).not.toContain("PRIVATE_CART_KEY");
  expect(text).toContain(cart.checkoutUrl);
  expect(cookieSet.mock.calls[0][1]).toBe(cart.id);
  const duplicate = await POST(request({ action: "add", variantId }));
  expect((await duplicate.json()).warnings[0]).toContain("déjà");
  expect(calls.filter((q) => q.includes("mutation CreateCart"))).toHaveLength(
    1,
  );
  const removed = await POST(request({ action: "remove", lineId: "line42" }));
  expect((await removed.json()).cart.totalQuantity).toBe(0);
  expect(
    (await GET(new Request("http://localhost:3000/api/cart"))).headers.get(
      "Cache-Control",
    ),
  ).toContain("no-store");
});
it("rejects unavailable or non-Spotlight variants, and cross-origin requests", async () => {
  const fetcher = vi.fn(async () =>
    Response.json({
      data: { node: { availableForSale: true, product: { tags: ["other"] } } },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  expect((await POST(request({ action: "add", variantId }))).status).toBe(409);
  expect(
    (
      await POST(
        request({ action: "add", variantId }, "https://attacker.invalid"),
      )
    ).status,
  ).toBe(403);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
