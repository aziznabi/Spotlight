import "server-only";
import { required, AppError } from "@/lib/errors";
export function shopDomain() {
  const domain = required("SHOPIFY_SHOP_DOMAIN");
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain))
    throw new AppError("Domaine Shopify invalide", 503);
  return domain;
}
export async function shopify<T>(
  api: "admin" | "storefront",
  query: string,
  variables: Record<string, unknown> = {},
  buyerIp?: string,
): Promise<T> {
  const token = required(
    api === "admin"
      ? "SHOPIFY_ADMIN_ACCESS_TOKEN"
      : "SHOPIFY_STOREFRONT_ACCESS_TOKEN",
  );
  const version = process.env.SHOPIFY_API_VERSION ?? "2026-10";
  if (!/^\d{4}-(01|04|07|10)$/.test(version))
    throw new AppError("Version API Shopify invalide", 503);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [api === "admin"
      ? "X-Shopify-Access-Token"
      : "Shopify-Storefront-Private-Token"]: token,
  };
  if (buyerIp && api === "storefront")
    headers["Shopify-Storefront-Buyer-IP"] = buyerIp;
  const response = await fetch(
    `https://${shopDomain()}/${api === "admin" ? "admin/api" : "api"}/${version}/graphql.json`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    },
  );
  if (!response.ok)
    throw new AppError(`Shopify indisponible (${response.status}).`, 502);
  const body = await response.json();
  if (body.errors?.length)
    throw new AppError(
      "Shopify refuse cette opération. Vérifiez les scopes et la version API.",
      502,
    );
  if (!body.data) throw new AppError("Réponse Shopify vide", 502);
  return body.data as T;
}
export function checkUserErrors(result: {
  userErrors?: { message: string }[];
}) {
  if (result.userErrors?.length)
    throw new AppError(
      result.userErrors.map((e) => e.message).join(" · "),
      422,
    );
}
