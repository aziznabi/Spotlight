import "server-only";
import { transaction } from "@/lib/db";
import { AppError } from "@/lib/errors";
export async function archiveVariant(id: string, actorId: string) {
  return transaction(async (c) => {
    const {
      rows: [owner],
    } = await c.query("SELECT product_id FROM assets WHERE id=$1", [id]);
    if (!owner) throw new AppError("Image introuvable", 404);
    await c.query("SELECT id FROM products WHERE id=$1 FOR UPDATE", [
      owner.product_id,
    ]);
    const {
      rows: [a],
    } = await c.query("SELECT * FROM assets WHERE id=$1 FOR UPDATE", [id]);
    if (a.kind === "original")
      throw new AppError(
        "Les originaux sont conservés et ne peuvent pas être supprimés.",
        409,
      );
    if (a.deleted_at) return { ok: true };
    if (a.selected || a.public_url)
      throw new AppError(
        "Image sélectionnée ou déjà publiée : retirer ses dépendances avant suppression.",
        409,
      );
    const { rows: children } = await c.query(
      "SELECT id FROM assets WHERE source_id=$1 AND deleted_at IS NULL",
      [id],
    );
    if (children.length)
      throw new AppError("Cette image possède des variantes dépendantes.", 409);
    await c.query("UPDATE assets SET deleted_at=now() WHERE id=$1", [id]);
    await c.query(
      "INSERT INTO audit(actor_id,product_id,event,details) VALUES($1,$2,'asset.archived',$3)",
      [actorId, a.product_id, { assetId: id, sourceId: a.source_id }],
    );
    // Logical removal preserves provenance and the source object. Object lifecycle purge is separate.
    return { ok: true };
  });
}
