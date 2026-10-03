import "server-only";
import { shopify } from "./client";
import { STOREFRONT } from "./operations";
export type StoreProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  vendor: string;
  productType: string;
  tags: string[];
  availableForSale: boolean;
  images: {
    nodes: {
      url: string;
      altText: string | null;
      width: number;
      height: number;
    }[];
  };
  variants: {
    nodes: {
      id: string;
      availableForSale: boolean;
      price: { amount: string; currencyCode: string };
      selectedOptions: { name: string; value: string }[];
    }[];
  };
};
export type Cart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { totalAmount: { amount: string; currencyCode: string } };
  lines: {
    nodes: {
      id: string;
      quantity: number;
      merchandise: {
        id: string;
        title: string;
        availableForSale: boolean;
        price: { amount: string; currencyCode: string };
        product: { title: string; handle: string };
      };
    }[];
  };
};
export type PublicCart = Omit<Cart, "id">;
export function publicCart(cart: Cart): PublicCart {
  return {
    checkoutUrl: cart.checkoutUrl,
    totalQuantity: cart.totalQuantity,
    cost: cart.cost,
    lines: cart.lines,
  };
}
export async function catalog(search = "", category = "", after?: string) {
  const escape = (s: string) => s.replace(/[\\"():]/g, " ").slice(0, 100);
  const query = `tag:spotlight${search ? ` AND title:"${escape(search)}"` : ""}${category ? ` AND product_type:"${escape(category)}"` : ""}`;
  const d = await shopify<{
    products: {
      nodes: StoreProduct[];
      pageInfo: { hasNextPage: boolean; endCursor: string };
    };
  }>("storefront", STOREFRONT.catalog, { query, after });
  return {
    ...d.products,
    nodes: d.products.nodes.filter((p) => p.tags.includes("spotlight")),
  };
}
export async function storeProduct(handle: string) {
  const d = await shopify<{ product: StoreProduct | null }>(
    "storefront",
    STOREFRONT.product,
    { handle },
  );
  return d.product?.tags.includes("spotlight") ? d.product : null;
}
