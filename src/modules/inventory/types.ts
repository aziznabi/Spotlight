import { z } from "zod";
const short = z.string().trim().max(200).default("");
export const attributesSchema = z.object({
  model: short,
  gender: z.enum(["femme", "homme", "unisexe", "unknown"]).default("unknown"),
  size: short,
  color: short,
  material: short,
  pattern: short,
  variant: short,
  measurements: z.string().max(2000).default(""),
});
export const productInput = z
  .object({
    title: z.string().trim().min(2).max(180),
    brand: short,
    category: short,
    attributes: attributesSchema.default({
      model: "",
      gender: "unknown",
      size: "",
      color: "",
      material: "",
      pattern: "",
      variant: "",
      measurements: "",
    }),
    condition: z
      .enum(["new", "excellent", "good", "fair", "unknown"])
      .default("unknown"),
    defects: z.string().max(4000).default(""),
    purchase_minor: z.number().int().nonnegative().nullable().default(null),
    purchase_currency: z.enum(["EUR", "TND", "USD", "GBP"]).default("EUR"),
    purchase_fx_rate: z.number().positive().nullable().default(null),
    purchase_fx_source: z.string().trim().max(300).nullable().default(null),
    purchase_fx_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .default(null),
    purchased_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .default(null),
    source: short,
    location: short,
    internal_notes: z.string().max(8000).default(""),
    price_minor: z.number().int().positive().nullable().default(null),
    currency: z.literal("EUR").default("EUR"),
    description: z.string().max(8000).default(""),
    tags: z.array(z.string().max(60)).max(30).default([]),
  })
  .refine(
    (p) =>
      !p.purchase_fx_rate || (!!p.purchase_fx_source && !!p.purchase_fx_date),
    {
      message: "Source et date du taux d’achat requises",
      path: ["purchase_fx_rate"],
    },
  );
export type ProductInput = z.infer<typeof productInput>;
export type Product = ProductInput & {
  id: string;
  sku: string;
  stock: "available" | "committed" | "sold" | "quarantine";
  stock_order_id: string | null;
  preparation: string;
  revision: number;
  is_demo: boolean;
  approved_at: string | null;
  authenticity: {
    status: string;
    observations: string;
    certificateUrl: string;
  };
  shopify_product_id: string | null;
  shopify_variant_id: string | null;
  shopify_inventory_id: string | null;
  shopify_activated: boolean;
  created_at: string;
  updated_at: string;
};
export type Asset = {
  id: string;
  product_id: string;
  source_id: string | null;
  kind: "original" | "variant" | "marketing";
  storage_key: string;
  sha256: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  review: "pending" | "approved" | "rejected";
  selected: boolean;
  position: number;
  public_url: string | null;
  parameters: Record<string, unknown>;
};
export type Job = {
  id: string;
  product_id: string;
  kind: string;
  status: string;
  input: Record<string, unknown>;
  attempts: number;
  error: string | null;
  created_at: string;
  cost_minor: number | null;
  latency_ms: number | null;
  run_id: string | null;
};
