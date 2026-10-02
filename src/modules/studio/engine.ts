import "server-only";
import sharp, { type OverlayOptions } from "sharp";
import { createHash, randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import { AppError, required } from "@/lib/errors";
import { type Asset } from "@/modules/inventory/types";
import { storePrivate, readPrivate } from "./storage";
import { type StudioInput, presets, capabilities } from "./presets";
export async function validateImage(bytes: Buffer) {
  if (bytes.length > 4 * 1024 * 1024)
    throw new AppError("Image trop volumineuse : maximum 4 Mo.");
  const meta = await sharp(bytes, { limitInputPixels: 24_000_000 }).metadata();
  if (
    !["jpeg", "png", "webp"].includes(meta.format ?? "") ||
    !meta.width ||
    !meta.height ||
    meta.width < 64 ||
    meta.height < 64 ||
    (meta.pages && meta.pages > 1)
  )
    throw new AppError(
      "Image JPEG, PNG ou WebP statique requise, minimum 64 px.",
    );
  return {
    width: meta.width,
    height: meta.height,
    mime: `image/${meta.format}`,
  };
}
export async function saveAsset(
  productId: string,
  bytes: Buffer,
  kind: Asset["kind"],
  sourceId: string | null,
  parameters: Record<string, unknown> = {},
) {
  const info = await validateImage(bytes);
  const id = randomUUID(),
    key = `${productId}/${id}.${info.mime.split("/")[1]}`;
  await storePrivate(key, bytes, info.mime);
  const [asset] = await query<Asset>(
    "INSERT INTO assets(id,product_id,source_id,kind,storage_key,sha256,mime,width,height,bytes,provider,operation,parameters) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *",
    [
      id,
      productId,
      sourceId,
      kind,
      key,
      createHash("sha256").update(bytes).digest("hex"),
      info.mime,
      info.width,
      info.height,
      bytes.length,
      parameters.provider ?? null,
      parameters.operation ?? null,
      parameters,
    ],
  );
  return asset;
}
export async function compose(
  bytes: Buffer,
  input: Pick<StudioInput, "format" | "background" | "margin" | "shadow">,
) {
  const [w, h] =
    input.format === "1:1"
      ? [1200, 1200]
      : input.format === "9:16"
        ? [900, 1600]
        : [1200, 1500];
  const product = await sharp(bytes, { limitInputPixels: 24_000_000 })
    .rotate()
    .resize({
      width: Math.floor(w * (1 - 2 * input.margin)),
      height: Math.floor(h * (1 - 2 * input.margin)),
      fit: "inside",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();
  const layers: OverlayOptions[] = [];
  if (input.shadow) {
    const svg = Buffer.from(
      `<svg width="${w}" height="${h}"><ellipse cx="${w / 2}" cy="${h * (1 - input.margin)}" rx="${w * 0.22}" ry="${h * 0.016}" fill="#000" opacity="0.12"/></svg>`,
    );
    const shadow = await sharp(svg).blur(14).png().toBuffer();
    layers.push({ input: shadow });
  }
  layers.push({ input: product, gravity: "centre" });
  return sharp({
    create: { width: w, height: h, channels: 4, background: input.background },
  })
    .composite(layers)
    .jpeg({ quality: 92 })
    .toBuffer();
}
export interface ImageProvider {
  readonly name: string;
  capabilities(): ReturnType<typeof capabilities>;
  removeBackground(bytes: Buffer): Promise<Buffer>;
  scene(bytes: Buffer): Promise<Buffer>;
}
const scenePrompt =
  "Neutral warm studio interior, subtle natural daylight, no props covering the product. Preserve the source garment exactly: logos, color, seams, texture, defects. Do not invent angles.";
export const photoroom: ImageProvider = {
  name: "photoroom",
  capabilities,
  async removeBackground(bytes) {
    const form = new FormData();
    form.set("image_file", new Blob([new Uint8Array(bytes)]), "source.png");
    form.set("format", "png");
    const r = await fetch("https://sdk.photoroom.com/v1/segment", {
      method: "POST",
      headers: { "x-api-key": required("PHOTOROOM_API_KEY") },
      body: form,
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok)
      throw new AppError(`Détourage PhotoRoom : HTTP ${r.status}`, 502);
    return Buffer.from(await r.arrayBuffer());
  },
  async scene(bytes) {
    if (!capabilities().marketingScene)
      throw new AppError(
        "Mise en scène indisponible : accès PhotoRoom Edit non validé.",
        503,
      );
    const form = new FormData();
    form.set("imageFile", new Blob([new Uint8Array(bytes)]), "source.png");
    form.set("background.prompt", scenePrompt);
    form.set("outputSize", "1200x1500");
    const r = await fetch("https://image-api.photoroom.com/v2/edit", {
      method: "POST",
      headers: { "x-api-key": required("PHOTOROOM_API_KEY") },
      body: form,
      signal: AbortSignal.timeout(90000),
    });
    if (!r.ok)
      throw new AppError(`Mise en scène PhotoRoom : HTTP ${r.status}`, 502);
    return Buffer.from(await r.arrayBuffer());
  },
};
export async function processImage(
  asset: Asset,
  input: StudioInput,
  jobId?: string,
  provider: ImageProvider = photoroom,
) {
  const preset = presets[input.preset];
  if (asset.kind !== "original")
    throw new AppError(
      "Le Studio travaille uniquement depuis un original documentaire.",
      409,
    );
  const source = await readPrivate(asset.storage_key);
  let bytes: Buffer = source;
  if (preset.marketing)
    bytes = await compose(await provider.scene(source), {
      ...input,
      shadow: false,
    });
  else {
    if (input.removeBackground) bytes = await provider.removeBackground(source);
    bytes = await compose(bytes, input);
  }
  return saveAsset(
    asset.product_id,
    bytes,
    preset.marketing ? "marketing" : "variant",
    asset.id,
    {
      ...input,
      jobId,
      presetVersion: preset.version,
      prompt: preset.marketing ? scenePrompt : null,
      provider:
        input.removeBackground || preset.marketing ? provider.name : "sharp",
      model: preset.marketing
        ? "edit-v2"
        : input.removeBackground
          ? "segment-v1"
          : "sharp",
      operation: preset.marketing ? "marketing_scene" : "studio_composition",
      costMinor: null,
      humanReviewRequired: true,
    },
  );
}
