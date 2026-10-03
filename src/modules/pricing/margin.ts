import { toEurMinor } from "@/lib/currency";
export function margin(
  saleMinor: number,
  purchaseMinor: number | null,
  purchaseCurrency: string,
  costs: {
    amount_minor: number | null;
    currency: string;
    known: boolean;
    fx_rate?: number | null;
  }[],
  purchaseFxRate?: number | null,
) {
  const purchase =
    purchaseMinor === null
      ? null
      : purchaseCurrency === "EUR"
        ? purchaseMinor
        : Number(purchaseFxRate) > 0
          ? toEurMinor(purchaseMinor, purchaseCurrency, Number(purchaseFxRate))
          : null;
  const known = costs.filter(
    (c) =>
      c.known &&
      c.amount_minor !== null &&
      (c.currency === "EUR" || Number(c.fx_rate) > 0),
  );
  const total = known.reduce(
    (s, c) =>
      s +
      toEurMinor(
        c.amount_minor!,
        c.currency,
        c.currency === "EUR" ? 1 : Number(c.fx_rate),
      ),
    0,
  );
  const missing = costs.length - known.length;
  return {
    saleLessPurchase: purchase === null ? null : saleMinor - purchase,
    afterKnownVariableCosts:
      purchase === null ? null : saleMinor - purchase - total,
    knownCosts: total,
    unknownCosts: missing + (purchase === null ? 1 : 0),
    complete: missing === 0 && purchase !== null,
  };
}
