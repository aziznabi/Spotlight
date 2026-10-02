import { z } from "zod";
export const studioInput = z.object({
  assetIds: z.array(z.string().uuid()).min(1).max(6),
  preset: z.enum(["Clean", "Marketplace", "Luxury", "Lifestyle", "Ad"]),
  format: z.enum(["1:1", "4:5", "9:16"]).default("4:5"),
  background: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#f4f3ef"),
  margin: z.number().min(0.05).max(0.3).default(0.12),
  shadow: z.boolean().default(false),
  removeBackground: z.boolean().default(true),
});
export type StudioInput = z.infer<typeof studioInput>;
export const presets = {
  Clean: {
    version: 1,
    background: "#ffffff",
    format: "1:1",
    margin: 0.12,
    shadow: false,
    marketing: false,
  },
  Marketplace: {
    version: 1,
    background: "#f4f3ef",
    format: "4:5",
    margin: 0.1,
    shadow: false,
    marketing: false,
  },
  Luxury: {
    version: 1,
    background: "#171717",
    format: "4:5",
    margin: 0.16,
    shadow: true,
    marketing: false,
  },
  Lifestyle: {
    version: 1,
    background: "#f4f3ef",
    format: "4:5",
    margin: 0.12,
    shadow: true,
    marketing: true,
  },
  Ad: {
    version: 1,
    background: "#ffffff",
    format: "9:16",
    margin: 0.2,
    shadow: true,
    marketing: true,
  },
} as const;
export function capabilities() {
  return {
    composition: true,
    backgroundRemoval: !!process.env.PHOTOROOM_API_KEY,
    marketingScene:
      !!process.env.PHOTOROOM_API_KEY &&
      process.env.PHOTOROOM_EDIT_ENABLED === "true",
  };
}
