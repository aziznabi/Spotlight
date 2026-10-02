import { describe, it, expect } from "vitest";
import {
  benchmark,
  fingerprint,
  normalize,
  percentile,
  statistics,
  canonicalUrl,
  score,
  defaultConfig,
  type Comparable,
} from "@/modules/pricing/engine";
import { margin } from "@/modules/pricing/margin";
import { toMinor, toEurMinor } from "@/lib/currency";
it("uses Tunisian millimes and explicit FX without inventing a conversion", () => {
  expect(toMinor(12.345, "TND")).toBe(12345);
  expect(toEurMinor(12345, "TND", 0.3)).toBe(370);
  expect(
    margin(
      3000,
      12345,
      "TND",
      [{ known: true, amount_minor: 1000, currency: "TND", fx_rate: 0.3 }],
      0.3,
    ).afterKnownVariableCosts,
  ).toBe(2600);
});
const now = new Date("2026-10-02T12:00:00Z");
const fp = fingerprint({
  brand: "Test Brand",
  category: "Veste",
  size: "M",
  color: "Noir",
  condition: "good",
  variant: "basic",
});
const comparable = (
  price: number,
  i = 1,
  extra: Partial<Comparable> = {},
): Comparable => ({
  marketplace: "vinted",
  url: `https://www.vinted.fr/items/${i}-fixture`,
  title: "SYNTHETIC TEST ONLY",
  attributes: {
    brand: "Test Brand",
    category: "Veste",
    size: "M",
    color: "black",
    condition: "good",
    variant: "basic",
  },
  priceMinor: price,
  currency: "EUR",
  priceType: "asking",
  feesMinor: null,
  status: "unknown",
  source: "test fixture (not real market)",
  retrievedAt: now.toISOString(),
  verifiedAt: null,
  accessibility: "snippet_only",
  evidence: "Synthetic fixture, no real listing asserted",
  missingFields: [],
  ...extra,
});
describe("pricing math and provenance", () => {
  it("preserves originals and leaves unknowns unknown", () => {
    const f = fingerprint({ color: "Noir", size: "unknown" });
    expect(f.color).toEqual({ original: "Noir", normalized: "black" });
    expect(f.size.normalized).toBeNull();
    expect(f.model.normalized).toBeNull();
  });
  it("normalizes aliases and accents", () => {
    expect(normalize(" Très bon état ")).toBe("excellent");
    expect(normalize("GREY")).toBe("gray");
  });
  it("uses linear interpolation R7", () => {
    expect(percentile([10, 20, 30, 40], 0.25)).toBe(17.5);
    expect(percentile([], 0.5)).toBeNull();
    expect(percentile([8], 0.75)).toBe(8);
  });
  it("computes weighted median and averages deterministically", () => {
    expect(
      statistics([
        { value: 10, weight: 1 },
        { value: 20, weight: 1 },
        { value: 100, weight: 8 },
      ]),
    ).toMatchObject({
      median: 20,
      mean: 130 / 3,
      weightedMedian: 100,
      weightedMean: 83,
      min: 10,
      max: 100,
      p25: 15,
      p75: 60,
    });
  });
  it("does not reward missing attributes", () => {
    const a = comparable(1000);
    expect(score(fp, { ...a, attributes: {} })).toBe(0);
    expect(score(fp, a)).toBe(1);
  });
  it("deduplicates canonical URLs and excludes the duplicate", () => {
    const result = benchmark(
      fp,
      [
        comparable(2000),
        comparable(2000, 2, {
          url: "https://vinted.fr/items/1-fixture?tracking=foo#top",
        }),
      ],
      defaultConfig,
      now,
    );
    expect(result.retainedCount).toBe(1);
    expect(result.comparables[1].excluded).toBe("Doublon");
  });
  it("rejects attacker domains, userinfo, ports and HTTP", () => {
    for (const url of [
      "https://vinted.fr.evil.test/items/1",
      "https://evil-vinted.fr/items/1",
      "https://a@vinted.fr/items/1",
      "http://vinted.fr/items/1",
      "https://vinted.fr:444/items/1",
    ])
      expect(canonicalUrl(url, "vinted")).toBeNull();
  });
  it("excludes mismatched brands/category/variant before outliers", () => {
    const r = benchmark(
      fp,
      [
        comparable(100000, 1, {
          attributes: { brand: "Other", category: "Veste" },
        }),
        comparable(300000, 2, {
          attributes: {
            brand: "Test Brand",
            category: "Veste",
            variant: "rare",
          },
        }),
      ],
      defaultConfig,
      now,
    );
    expect(r.retainedCount).toBe(0);
    expect(r.comparables.every((c) => !!c.excluded)).toBe(true);
  });
  it("does not recommend from a small sample", () => {
    const r = benchmark(
      fp,
      [1, 2, 3, 4].map((v, i) => comparable(v * 1000, i)),
      defaultConfig,
      now,
    );
    expect(r.recommendations).toBeNull();
    expect(r.markets.vinted.quality).toBe("faible");
  });
  it("never mixes marketplaces into a fictitious average", () => {
    const a = [1, 2, 3, 4, 5].map((v, i) => comparable(2000 + v * 100, i));
    const b = a.map((c, i) => ({
      ...c,
      marketplace: "vestiaire" as const,
      url: `https://vestiairecollective.com/fixture-${i}.shtml`,
      priceMinor: c.priceMinor * 3,
    }));
    const r = benchmark(fp, [...a, ...b], defaultConfig, now);
    expect(r.selectedMarket).toBe("vinted");
    expect(r.recommendations?.recommended).toBe(2300);
    expect(r.markets.vestiaire.recommendations?.recommended).toBe(6900);
  });
  it("flags outliers only for adequate sample size and positive IQR", () => {
    const r = benchmark(
      fp,
      [1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500, 50000].map((v, i) =>
        comparable(v, i),
      ),
      defaultConfig,
      now,
    );
    expect(r.retainedCount).toBe(8);
    expect(r.comparables.at(-1)?.excluded).toContain("aberrante");
  });
  it("rejects stale, inaccessible, sold-series and missing-rate observations", () => {
    const rows = [
      comparable(1000, 1, { retrievedAt: "2025-01-01" }),
      comparable(1000, 2, { accessibility: "inaccessible" }),
      comparable(1000, 3, { priceType: "sold" }),
      comparable(1000, 4, { currency: "GBP" }),
    ];
    expect(benchmark(fp, rows, defaultConfig, now).retainedCount).toBe(0);
  });
  it("records conversion without treating unknown fees as zero", () => {
    const r = benchmark(
      fp,
      [
        comparable(1000, 1, {
          currency: "GBP",
          fx: { rate: 1.2, source: "fixture rate", date: "2026-10-01" },
        }),
      ],
      defaultConfig,
      now,
    );
    expect(r.comparables[0].normalizedPrice).toBe(1200);
    expect(r.comparables[0].feesMinor).toBeNull();
  });
  it("purchase cost cannot change market value", () => {
    const rows = [1000, 2000, 3000, 4000, 5000].map((v, i) => comparable(v, i));
    const r = benchmark(fp, rows, defaultConfig, now);
    expect(r.recommendations?.recommended).toBe(3000);
    expect(margin(3000, 9000, "EUR", []).saleLessPurchase).toBe(-6000);
  });
  it("unknown costs and purchase FX never become zero", () => {
    expect(
      margin(6000, 1000, "EUR", [
        { amount_minor: null, currency: "EUR", known: false },
      ]),
    ).toMatchObject({
      afterKnownVariableCosts: 5000,
      unknownCosts: 1,
      complete: false,
    });
    expect(margin(6000, 1000, "TND", []).saleLessPurchase).toBeNull();
  });
  it("configured similarity weights affect matching, condition applied once", () => {
    const c = comparable(1000, 1, {
      attributes: { ...comparable(1000).attributes, condition: "fair" },
    });
    const result = benchmark(
      fp,
      [c],
      { ...defaultConfig, minSimilarity: 0 },
      now,
    );
    expect(result.comparables[0].normalizedPrice).toBe(1000);
    expect(result.comparables[0].similarity).toBeLessThan(1);
  });
});
