import "server-only";
import { shopify } from "./client";
import { ADMIN } from "./operations";
import { applyOrder } from "./orders";
import { AppError } from "@/lib/errors";
import { toMinor } from "@/lib/currency";
type AdminOrder = {
  id: string;
  name: string;
  updatedAt: string;
  cancelledAt: string | null;
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  test: boolean;
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  lineItems: {
    nodes: {
      id: string;
      sku: string;
      quantity: number;
      discountedUnitPriceAfterAllDiscountsSet: {
        shopMoney: { amount: string };
      };
    }[];
    pageInfo: { hasNextPage: boolean };
  };
};
export async function reconcile() {
  let after: string | null = null,
    count = 0;
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  for (let page = 0; page < 20; page++) {
    const data: {
      orders: {
        nodes: AdminOrder[];
        pageInfo: { hasNextPage: boolean; endCursor: string };
      };
    } = await shopify("admin", ADMIN.orders, {
      after,
      query: `updated_at:>='${since}'`,
    });
    for (const o of data.orders.nodes) {
      if (o.lineItems.pageInfo.hasNextPage)
        throw new AppError(
          "Commande avec plus de 100 lignes : rapprochement manuel requis.",
          409,
        );
      await applyOrder({
        id: o.id,
        name: o.name,
        updatedAt: o.updatedAt,
        financial: o.displayFinancialStatus.toLowerCase(),
        fulfillment: o.displayFulfillmentStatus.toLowerCase(),
        test: o.test,
        cancelled: !!o.cancelledAt,
        totalMinor: toMinor(
          Number(o.totalPriceSet.shopMoney.amount),
          o.totalPriceSet.shopMoney.currencyCode,
        ),
        currency: o.totalPriceSet.shopMoney.currencyCode,
        lines: o.lineItems.nodes.map((l) => ({
          id: l.id.split("/").at(-1)!,
          sku: l.sku,
          quantity: l.quantity,
          priceMinor: toMinor(
            Number(l.discountedUnitPriceAfterAllDiscountsSet.shopMoney.amount),
            o.totalPriceSet.shopMoney.currencyCode,
          ),
        })),
      });
      count++;
    }
    if (!data.orders.pageInfo.hasNextPage) return { count, since };
    after = data.orders.pageInfo.endCursor;
  }
  throw new AppError(
    "Limite de 500 commandes atteinte; rapprochement incomplet signalé.",
    409,
  );
}
