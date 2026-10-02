import "server-only";
import { transaction, query } from "@/lib/db";
import { AppError, required } from "@/lib/errors";
import { type Product, type Asset } from "@/modules/inventory/types";
import { readPrivate, publishBytes } from "@/modules/studio/storage";
import { shopify, checkUserErrors } from "./client";
import { ADMIN } from "./operations";
type Errors = { userErrors: { message: string }[] };
function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export async function publishProduct(id: string, revision: number) {
  return transaction(async (c) => {
    const {
      rows: [p],
    } = await c.query<Product>(
      "SELECT * FROM products WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (
      !p ||
      p.stock !== "available" ||
      p.preparation !== "approved" ||
      p.revision !== revision ||
      !p.price_minor
    )
      throw new AppError(
        "Publication refusée : stock, version ou validation humaine modifié.",
        409,
      );
    if (p.is_demo)
      throw new AppError(
        "Un article de démonstration ne peut pas être publié dans Shopify.",
        403,
      );
    const location = required("SHOPIFY_LOCATION_ID"),
      publication = required("SHOPIFY_PUBLICATION_ID");
    const context = await shopify<{ shop: { currencyCode: string } }>(
      "admin",
      ADMIN.context,
    );
    if (context.shop.currencyCode !== p.currency)
      throw new AppError(
        "Devise boutique différente du prix ERP. Conversion explicite requise.",
        409,
      );
    // Reconcile a lost productSet response before mutating: never recreate its variant.
    const identifier = p.shopify_product_id
      ? { id: p.shopify_product_id }
      : { handle: p.sku.toLowerCase() };
    const existing = await shopify<{
      productByIdentifier: null | {
        id: string;
        tags: string[];
        variants: {
          nodes: {
            id: string;
            sku: string;
            inventoryItem: {
              id: string;
              inventoryLevel: null | {
                quantities: { name: string; quantity: number }[];
              };
            };
          }[];
        };
      };
    }>("admin", ADMIN.lookup, { identifier, location });
    const remote = existing.productByIdentifier;
    const remoteVariant = remote?.variants.nodes[0];
    if (
      remote &&
      (!remote.tags.includes("spotlight") ||
        remote.variants.nodes.length !== 1 ||
        remoteVariant?.sku !== p.sku)
    )
      throw new AppError(
        "Conflit d’identifiant Shopify : rapprochement humain requis.",
        409,
      );
    if (!remote && p.shopify_product_id)
      throw new AppError(
        "Produit Shopify supprimé : republication automatique interdite.",
        409,
      );
    const remoteLevel = remoteVariant?.inventoryItem.inventoryLevel;
    if (
      remoteLevel &&
      remoteLevel.quantities.some(
        (q) =>
          (q.name === "committed" && q.quantity > 0) ||
          (q.name === "available" && q.quantity !== 1),
      )
    )
      throw new AppError(
        "Disponibilité Shopify modifiée : rapprocher les commandes avant publication.",
        409,
      );
    const { rows: assets } = await c.query<Asset>(
      "SELECT * FROM assets WHERE product_id=$1 AND selected AND review='approved' ORDER BY position,id",
      [id],
    );
    if (!assets.some((a) => a.kind !== "marketing"))
      throw new AppError(
        "Au moins une photo documentaire approuvée est requise.",
      );
    const files = [];
    for (const a of assets) {
      let url = a.public_url;
      if (!url) {
        url = await publishBytes(
          `approved/${a.id}-${a.sha256.slice(0, 12)}.${a.mime.split("/")[1]}`,
          await readPrivate(a.storage_key),
          a.mime,
        );
        await c.query("UPDATE assets SET public_url=$2 WHERE id=$1", [
          a.id,
          url,
        ]);
      }
      files.push({
        originalSource: url,
        contentType: "IMAGE",
        alt:
          a.kind === "marketing"
            ? `${p.title} — mise en scène marketing`
            : `${p.title} — photo de la pièce`,
      });
    }
    const input = {
      title: p.title,
      handle: p.sku.toLowerCase(),
      vendor: p.brand,
      productType: p.category,
      status: "ACTIVE",
      descriptionHtml: `<p>${escapeHtml(p.description).replace(/\n/g, "<br>")}</p><p>État : ${escapeHtml(p.condition)}. Défauts : ${escapeHtml(p.defects || "Voir les photos et la description.")}</p>`,
      tags: [...new Set(["spotlight", ...p.tags])],
      files,
      productOptions: [{ name: "Pièce", values: [{ name: "Unique" }] }],
      variants: [
        {
          ...(remoteVariant ? { id: remoteVariant.id } : {}),
          sku: p.sku,
          price: (p.price_minor / 100).toFixed(2),
          optionValues: [{ optionName: "Pièce", name: "Unique" }],
          inventoryPolicy: "DENY",
          inventoryItem: { tracked: true },
        },
      ],
    };
    const set = await shopify<{
      productSet: Errors & {
        product: {
          id: string;
          variants: { nodes: { id: string; inventoryItem: { id: string } }[] };
        };
      };
    }>("admin", ADMIN.productSet, {
      input,
      identifier,
    });
    checkUserErrors(set.productSet);
    const sp = set.productSet.product,
      v = sp.variants.nodes[0];
    if (!v) throw new AppError("Variante Shopify absente", 502);
    // Never write available=1 on routine sync; stable activation key survives lost responses.
    if (!p.shopify_activated && !remoteLevel) {
      const activate = await shopify<{ inventoryActivate: Errors }>(
        "admin",
        ADMIN.activate,
        {
          item: v.inventoryItem.id,
          location,
          key: `spotlight-activate-${p.id}`,
        },
      );
      checkUserErrors(activate.inventoryActivate);
    }
    const published = await shopify<{ publishablePublish: Errors }>(
      "admin",
      ADMIN.publish,
      { id: sp.id, input: [{ publicationId: publication }] },
    );
    checkUserErrors(published.publishablePublish);
    await c.query(
      "UPDATE products SET shopify_product_id=$2,shopify_variant_id=$3,shopify_inventory_id=$4,shopify_activated=true WHERE id=$1",
      [id, sp.id, v.id, v.inventoryItem.id],
    );
    await c.query(
      "INSERT INTO listings(product_id,channel,status,title,price_minor,external_id,confirmed_at) VALUES($1,'shopify','published',$2,$3,$4,now()) ON CONFLICT(product_id,channel) DO UPDATE SET status='published',title=$2,price_minor=$3,external_id=$4,confirmed_at=now(),last_error=null",
      [id, p.title, p.price_minor, sp.id],
    );
    await c.query(
      "INSERT INTO audit(product_id,event,details) VALUES($1,'shopify.published',$2)",
      [id, { productId: sp.id, revision }],
    );
    return { productId: sp.id };
  });
}
export async function withdrawProduct(id: string, jobId: string) {
  const [p] = await query<Product>("SELECT * FROM products WHERE id=$1", [id]);
  if (!p?.shopify_inventory_id) return { notPublished: true };
  const location = required("SHOPIFY_LOCATION_ID");
  const level = await shopify<{
    inventoryItem: {
      inventoryLevel: {
        quantities: { name: string; quantity: number }[];
      } | null;
    };
  }>("admin", ADMIN.level, { id: p.shopify_inventory_id, location });
  const available = level.inventoryItem.inventoryLevel?.quantities.find(
    (q) => q.name === "available",
  )?.quantity;
  if (available === undefined)
    throw new AppError("Stock Shopify introuvable", 409);
  if (available > 0) {
    const zero = await shopify<{ inventorySetQuantities: Errors }>(
      "admin",
      ADMIN.zero,
      {
        key: `spotlight-withdraw-${jobId}`,
        input: {
          name: "available",
          reason: "correction",
          referenceDocumentUri: `gid://spotlight/Job/${jobId}`,
          quantities: [
            {
              inventoryItemId: p.shopify_inventory_id,
              locationId: location,
              quantity: 0,
              changeFromQuantity: available,
            },
          ],
        },
      },
    );
    checkUserErrors(zero.inventorySetQuantities);
  }
  await query(
    "UPDATE listings SET status='withdrawn',confirmed_at=now() WHERE product_id=$1 AND channel='shopify'",
    [id],
  );
  return { available: 0 };
}
