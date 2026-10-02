import { cookies } from "next/headers";
import { z } from "zod";
import { checkOrigin } from "@/modules/auth/server";
import { shopify, checkUserErrors } from "@/modules/commerce/client";
import { STOREFRONT } from "@/modules/commerce/operations";
import { type Cart, publicCart } from "@/modules/commerce/storefront";
import { AppError, message } from "@/lib/errors";
const options = {
  httpOnly: true,
  secure:
    process.env.VERCEL === "1" || process.env.SESSION_COOKIE_SECURE === "true",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 86400 * 10,
};
async function handle(req: Request) {
  try {
    const c = await cookies(),
      cartId = c.get("spotlight_cart")?.value;
    const ip = process.env.VERCEL
      ? req.headers.get("x-vercel-forwarded-for")?.split(",")[0]
      : undefined;
    if (req.method === "GET") {
      if (!cartId) return Response.json({ cart: null });
      const r = await shopify<{ cart: Cart | null }>(
        "storefront",
        STOREFRONT.cart,
        { id: cartId },
        ip,
      );
      return Response.json(
        { cart: r.cart ? publicCart(r.cart) : null },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    checkOrigin(req);
    const b = z
      .object({
        action: z.enum(["add", "remove"]),
        variantId: z.string().max(300).optional(),
        lineId: z.string().max(1000).optional(),
      })
      .parse(await req.json());
    let operation: keyof typeof STOREFRONT,
      variables: Record<string, unknown>,
      key: string;
    if (b.action === "remove") {
      if (!cartId || !b.lineId) throw new AppError("Panier ou ligne absent");
      operation = "remove";
      key = "cartLinesRemove";
      variables = { cartId, lineIds: [b.lineId] };
    } else {
      if (!b.variantId?.startsWith("gid://shopify/ProductVariant/"))
        throw new AppError("Variante invalide");
      const eligible = await shopify<{
        node: null | {
          availableForSale?: boolean;
          product?: { tags: string[] };
        };
      }>("storefront", STOREFRONT.eligibility, { id: b.variantId }, ip);
      if (
        !eligible.node?.availableForSale ||
        !eligible.node.product?.tags.includes("spotlight")
      )
        throw new AppError(
          "Cette pièce n’est plus disponible dans la collection Spotlight.",
          409,
        );
      if (cartId) {
        const existing = await shopify<{ cart: Cart | null }>(
          "storefront",
          STOREFRONT.cart,
          { id: cartId },
          ip,
        );
        if (
          existing.cart?.lines.nodes.some(
            (l) => l.merchandise.id === b.variantId,
          )
        )
          return Response.json({
            cart: publicCart(existing.cart),
            warnings: ["Cette pièce unique est déjà dans votre panier."],
          });
        if (existing.cart) {
          operation = "add";
          key = "cartLinesAdd";
          variables = {
            cartId,
            lines: [{ merchandiseId: b.variantId, quantity: 1 }],
          };
        } else {
          operation = "create";
          key = "cartCreate";
          variables = {
            input: { lines: [{ merchandiseId: b.variantId, quantity: 1 }] },
          };
        }
      } else {
        operation = "create";
        key = "cartCreate";
        variables = {
          input: { lines: [{ merchandiseId: b.variantId, quantity: 1 }] },
        };
      }
    }
    const response = await shopify<
      Record<
        string,
        {
          cart: Cart;
          userErrors: { message: string }[];
          warnings: { message: string }[];
        }
      >
    >("storefront", STOREFRONT[operation], variables, ip);
    const result = response[key];
    checkUserErrors(result);
    if (!result.cart) throw new AppError("Panier indisponible", 502);
    c.set("spotlight_cart", result.cart.id, options);
    return Response.json(
      {
        cart: publicCart(result.cart),
        warnings: result.warnings.map((w) => w.message),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return Response.json(
      { error: message(e) },
      { status: e instanceof AppError ? e.status : 400 },
    );
  }
}
export const GET = handle;
export const POST = handle;
