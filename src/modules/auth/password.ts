import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
export function hashPassword(password: string) {
  if (password.length < 12) throw new Error("12 caractères minimum");
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, hash: string) {
  const [salt, expected] = hash.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const b = Buffer.from(expected, "hex");
  return b.length === actual.length && timingSafeEqual(b, actual);
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
