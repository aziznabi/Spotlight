import "server-only";
import { put, get, head, BlobNotFoundError } from "@vercel/blob";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { required, AppError } from "@/lib/errors";
const localRoot = path.resolve(".local/objects");
function local() {
  if (process.env.STORAGE_DRIVER !== "local") return false;
  if (process.env.VERCEL || process.env.DATABASE_ENV !== "development")
    throw new AppError("Stockage local interdit hors développement.", 503);
  return true;
}
function localPath(key: string) {
  if (!/^[a-zA-Z0-9/_.-]+$/.test(key) || key.includes(".."))
    throw new AppError("Clé invalide");
  return path.join(localRoot, key);
}
export async function storePrivate(key: string, bytes: Buffer, mime: string) {
  if (local()) {
    const file = localPath(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes, { flag: "wx" });
    return key;
  }
  const blob = await put(key, bytes, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: mime,
    token: required("BLOB_READ_WRITE_TOKEN"),
  });
  return blob.pathname;
}
export async function readPrivate(key: string) {
  if (local()) return readFile(localPath(key));
  const blob = await get(key, {
    access: "private",
    token: required("BLOB_READ_WRITE_TOKEN"),
  });
  if (!blob || blob.statusCode !== 200)
    throw new AppError("Image introuvable", 404);
  return Buffer.from(await new Response(blob.stream).arrayBuffer());
}
export async function publishBytes(key: string, bytes: Buffer, mime: string) {
  if (local())
    throw new AppError(
      "Publication bloquée : configurez le stockage objet public.",
      503,
    );
  const token = required("BLOB_PUBLIC_READ_WRITE_TOKEN");
  try {
    return (await head(key, { token })).url;
  } catch (e) {
    if (!(e instanceof BlobNotFoundError)) throw e;
  }
  const blob = await put(key, bytes, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: mime,
    token,
  });
  return blob.url;
}
