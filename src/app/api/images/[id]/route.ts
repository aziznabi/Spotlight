import { requireUser } from "@/modules/auth/server";
import { query } from "@/lib/db";
import { readPrivate } from "@/modules/studio/storage";
import { AppError, message } from "@/lib/errors";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser();
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new AppError("Image invalide", 400);
    const [a] = await query(
      "SELECT storage_key,mime FROM assets WHERE id=$1 AND deleted_at IS NULL",
      [id],
    );
    if (!a) throw new AppError("Image introuvable", 404);
    return new Response(new Uint8Array(await readPrivate(a.storage_key)), {
      headers: {
        "Content-Type": a.mime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        ...(new URL(req.url).searchParams.has("download")
          ? {
              "Content-Disposition": `attachment; filename="spotlight-${id}.${a.mime.split("/")[1]}"`,
            }
          : {}),
      },
    });
  } catch (e) {
    return Response.json(
      { error: message(e) },
      { status: e instanceof AppError ? e.status : 500 },
    );
  }
}
