import { createHash } from "node:crypto";
import { toEurMinor } from "@/lib/currency";
export const VERSION = "market-v1.0";
export const fields = [
  "brand",
  "category",
  "model",
  "gender",
  "size",
  "color",
  "condition",
  "material",
  "pattern",
  "variant",
] as const;
export type Field = (typeof fields)[number];
export type Fingerprint = Record<
  Field,
  { original: string | null; normalized: string | null }
>;
const aliases: Record<string, string> = {
  noir: "black",
  black: "black",
  blanc: "white",
  white: "white",
  gris: "gray",
  grey: "gray",
  bleu: "blue",
  rouge: "red",
  vert: "green",
  homme: "male",
  men: "male",
  mens: "male",
  femme: "female",
  women: "female",
  womens: "female",
  unisexe: "unisex",
  neuf: "new",
  "tres bon etat": "excellent",
  "bon etat": "good",
  coton: "cotton",
  laine: "wool",
  pull: "sweater",
  sweatshirt: "sweat",
  pantalon: "trousers",
  "t shirt": "tshirt",
};
export function normalize(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ");
  return !s || ["unknown", "inconnu", "n/a", "non renseigne"].includes(s)
    ? null
    : (aliases[s] ?? s);
}
export function fingerprint(input: Record<string, unknown>): Fingerprint {
  return Object.fromEntries(
    fields.map((k) => [
      k,
      {
        original: typeof input[k] === "string" ? (input[k] as string) : null,
        normalized: normalize(input[k]),
      },
    ]),
  ) as Fingerprint;
}
export const defaultConfig = {
  weights: {
    brand: 25,
    category: 20,
    model: 14,
    gender: 8,
    size: 8,
    color: 4,
    condition: 8,
    material: 5,
    pattern: 3,
    variant: 5,
  },
  minSimilarity: 0.6,
  minCount: 5,
  cacheHours: 24,
  maxAgeDays: 30,
  outlierIqr: 1.5,
  primaryMarket: "vinted" as const,
};
export type Config = typeof defaultConfig;
export type Comparable = {
  marketplace: "vinted" | "vestiaire";
  url: string;
  title: string;
  attributes: Partial<Record<Field, string | null>>;
  priceMinor: number;
  currency: string;
  priceType: "asking" | "sold";
  feesMinor: number | null;
  status: "active" | "sold" | "unknown";
  source: string;
  retrievedAt: string;
  verifiedAt: string | null;
  accessibility: "verified" | "snippet_only" | "inaccessible";
  evidence: string;
  missingFields: string[];
  fx?: { rate: number; source: string; date: string };
  similarity?: number;
  excluded?: string;
  normalizedPrice?: number;
  outlier?: boolean;
};
export function canonicalUrl(raw: string, market: Comparable["marketplace"]) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password || u.port)
      return null;
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    const good =
      market === "vinted"
        ? /^vinted\.(fr|com|co\.uk|de|it|es|be|nl)$/.test(h)
        : h === "vestiairecollective.com" ||
          h.endsWith(".vestiairecollective.com");
    if (!good) return null;
    u.search = "";
    u.hash = "";
    u.hostname = h;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
export function percentile(sorted: number[], p: number) {
  if (!sorted.length) return null;
  const at = (sorted.length - 1) * p;
  const low = Math.floor(at);
  return sorted[low] + (sorted[Math.ceil(at)] - sorted[low]) * (at - low);
}
export function statistics(items: { value: number; weight: number }[]) {
  if (!items.length) return null;
  const rows = [...items].sort((a, b) => a.value - b.value),
    values = rows.map((r) => r.value),
    sum = rows.reduce((a, r) => a + r.weight, 0);
  let acc = 0,
    median = rows[0].value;
  for (const r of rows) {
    acc += r.weight;
    if (acc >= sum / 2) {
      median = r.value;
      break;
    }
  }
  return {
    count: rows.length,
    min: values[0],
    max: values.at(-1)!,
    p25: percentile(values, 0.25)!,
    p75: percentile(values, 0.75)!,
    median: percentile(values, 0.5)!,
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    weightedMean: sum
      ? rows.reduce((a, r) => a + r.value * r.weight, 0) / sum
      : 0,
    weightedMedian: median,
  };
}
export function score(fp: Fingerprint, c: Comparable, config = defaultConfig) {
  let numerator = 0,
    denominator = 0;
  for (const k of fields) {
    const a = fp[k].normalized,
      b = normalize(c.attributes[k]);
    if (a) {
      denominator += config.weights[k];
      if (a === b && b !== null) numerator += config.weights[k];
    }
  }
  return denominator ? numerator / denominator : 0;
}
export function benchmark(
  fp: Fingerprint,
  raw: Comparable[],
  config = defaultConfig,
  now = new Date(),
) {
  const seen = new Set<string>();
  const rows = raw.map((c) => {
    const url = canonicalUrl(c.url, c.marketplace),
      similarity = score(fp, c, config);
    let excluded: string | undefined;
    if (!url) excluded = "URL marketplace invalide";
    else if (seen.has(url)) excluded = "Doublon";
    else seen.add(url);
    for (const k of ["brand", "category", "gender", "variant"] as const) {
      const a = fp[k].normalized,
        b = normalize(c.attributes[k]);
      if (a && b && a !== b) excluded = `${k} différent`;
    } // Compare variant before outliers.
    if (!Number.isSafeInteger(c.priceMinor) || c.priceMinor <= 0)
      excluded = "Prix invalide";
    if (!c.evidence.trim()) excluded = "Justificatif absent";
    if (c.accessibility === "inaccessible") excluded = "URL inaccessible";
    if (
      !Number.isFinite(Date.parse(c.retrievedAt)) ||
      Date.parse(c.retrievedAt) > +now + 60000 ||
      +now - Date.parse(c.retrievedAt) > config.maxAgeDays * 86400000
    )
      excluded = "Donnée périmée ou date invalide";
    if (c.priceType !== "asking") excluded = "Prix vendu : série distincte";
    if (similarity < config.minSimilarity)
      excluded = "Comparabilité insuffisante";
    let normalizedPrice = c.priceMinor;
    if (c.currency !== "EUR") {
      if (
        !c.fx ||
        !Number.isFinite(c.fx.rate) ||
        c.fx.rate <= 0 ||
        !c.fx.source ||
        !Number.isFinite(Date.parse(c.fx.date))
      )
        excluded = "Taux de change documenté manquant";
      else normalizedPrice = toEurMinor(c.priceMinor, c.currency, c.fx.rate);
    }
    return { ...c, url: url ?? c.url, similarity, normalizedPrice, excluded };
  });
  const markets = Object.fromEntries(
    (["vinted", "vestiaire"] as const).map((m) => {
      let selected = rows.filter((c) => c.marketplace === m && !c.excluded);
      const initial = statistics(
        selected.map((c) => ({
          value: c.normalizedPrice,
          weight: c.similarity,
        })),
      );
      if (initial && selected.length >= 8) {
        const iqr = initial.p75 - initial.p25;
        if (iqr > 0)
          for (const c of selected) {
            if (
              c.normalizedPrice < initial.p25 - config.outlierIqr * iqr ||
              c.normalizedPrice > initial.p75 + config.outlierIqr * iqr
            )
              c.excluded = "Valeur aberrante IQR (après matching)";
          }
        selected = selected.filter((c) => !c.excluded);
      }
      const stats = statistics(
        selected.map((c) => ({
          value: c.normalizedPrice,
          weight: c.similarity,
        })),
      );
      const similarity = selected.length
        ? selected.reduce((a, c) => a + c.similarity, 0) / selected.length
        : 0;
      const dispersion =
        stats && stats.median ? (stats.p75 - stats.p25) / stats.median : null;
      const verified = selected.filter(
        (c) => c.verifiedAt && c.accessibility === "verified",
      ).length;
      const ageDays = selected.length
        ? Math.max(
            ...selected.map(
              (c) => (+now - Date.parse(c.retrievedAt)) / 86400000,
            ),
          )
        : null;
      const missingRatio = selected.length
        ? selected.reduce(
            (sum, c) =>
              sum +
              fields.filter((k) => !normalize(c.attributes[k])).length /
                fields.length,
            0,
          ) / selected.length
        : 1;
      const targetKnown = fields.filter((k) => fp[k].normalized).length;
      const quality =
        !stats ||
        stats.count < 10 ||
        similarity < 0.75 ||
        dispersion === null ||
        dispersion > 0.6 ||
        (ageDays ?? Infinity) > 7 ||
        missingRatio > 0.4 ||
        targetKnown < 5 ||
        verified < selected.length / 2
          ? "faible"
          : "modérée";
      return [
        m,
        {
          raw: rows.filter((c) => c.marketplace === m).length,
          stats,
          similarity,
          dispersion,
          verified,
          ageDays,
          missingRatio,
          quality,
          recommendations:
            stats && stats.count >= config.minCount
              ? {
                  quick: Math.round(stats.p25),
                  recommended: Math.round(stats.weightedMedian),
                  maximum: Math.round(stats.p75),
                }
              : null,
        },
      ];
    }),
  ) as Record<
    "vinted" | "vestiaire",
    {
      raw: number;
      stats: ReturnType<typeof statistics>;
      similarity: number;
      dispersion: number | null;
      verified: number;
      ageDays: number | null;
      missingRatio: number;
      quality: string;
      recommendations: {
        quick: number;
        recommended: number;
        maximum: number;
      } | null;
    }
  >;
  const selectedMarket = markets.vinted.recommendations
    ? "vinted"
    : markets.vestiaire.recommendations
      ? "vestiaire"
      : null;
  return {
    version: VERSION,
    rawCount: raw.length,
    retainedCount: rows.filter((c) => !c.excluded).length,
    markets,
    selectedMarket,
    recommendations: selectedMarket
      ? markets[selectedMarket].recommendations
      : null,
    comparables: rows,
    explanation:
      "Prix demandés accessibles, non preuves de ventes. Séries séparées par marketplace. État intégré une seule fois dans le matching; aucun ajustement multiplicatif. Coût d’achat utilisé uniquement pour contrôler la marge. Échantillon web potentiellement biaisé.",
  };
}
export function cacheKey(fp: Fingerprint, config = defaultConfig) {
  return createHash("sha256")
    .update(JSON.stringify({ fp, config, market: "FR/EUR", version: VERSION }))
    .digest("hex");
}
