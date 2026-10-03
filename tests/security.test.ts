import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { validSignature } from "@/modules/commerce/orders";
import {
  hashPassword,
  verifyPassword,
  tokenHash,
} from "@/modules/auth/password";
import { productInput } from "@/modules/inventory/types";
import { publicCart, type Cart } from "@/modules/commerce/storefront";
describe("security boundaries", () => {
  it("checks HMAC over raw bytes and rejects mutations or malformed signatures", () => {
    const body = '{"id":42}',
      key = "fixture-key",
      sig = createHmac("sha256", key).update(body).digest("base64");
    expect(validSignature(body, sig, key)).toBe(true);
    expect(validSignature(body + " ", sig, key)).toBe(false);
    expect(validSignature(body, "bad", key)).toBe(false);
    expect(validSignature(body, sig, "")).toBe(false);
  });
  it("salts password hashes and hashes session tokens", () => {
    const a = hashPassword("private-password-fixture"),
      b = hashPassword("private-password-fixture");
    expect(a).not.toBe(b);
    expect(verifyPassword("private-password-fixture", a)).toBe(true);
    expect(verifyPassword("incorrect", a)).toBe(false);
    expect(tokenHash("secret")).not.toBe("secret");
  });
  it("validates prices and discards forbidden stock fields", () => {
    expect(
      productInput.parse({
        title: "Test",
        stock: "available",
        sku: "injected",
      }),
    ).not.toHaveProperty("stock");
    expect(() =>
      productInput.parse({ title: "Test", price_minor: -3 }),
    ).toThrow();
  });
  it("public cart DTO omits the Shopify cart secret and arbitrary private fields", () => {
    const cart = {
      id: "gid://shopify/Cart/token?key=SECRET",
      checkoutUrl: "https://checkout.shopify.com/test",
      totalQuantity: 0,
      cost: { totalAmount: { amount: "0", currencyCode: "EUR" } },
      lines: { nodes: [] },
      internal_notes: "secret",
    } as Cart;
    const response = JSON.stringify(publicCart(cart));
    expect(response).not.toContain("SECRET");
    expect(response).not.toContain("internal_notes");
  });
});
