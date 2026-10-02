import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { query } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { tokenHash, verifyPassword, hashPassword } from "./password";
export type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "operator";
};
const dummyHash = hashPassword("dummy-timing-password");
export async function getUser(): Promise<User | null> {
  const token = (await cookies()).get("spotlight_session")?.value;
  if (!token || !process.env.DATABASE_URL) return null;
  const rows = await query<User>(
    "SELECT u.id,u.email,u.name,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now() AND NOT u.disabled",
    [tokenHash(token)],
  );
  return rows[0] ?? null;
}
export async function requireUser(admin = false) {
  const user = await getUser();
  if (!user) throw new AppError("Connexion requise", 401);
  if (admin && user.role !== "admin")
    throw new AppError("Accès administrateur requis", 403);
  return user;
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_URL;
  if (
    !origin ||
    !expected ||
    new URL(origin).origin !== new URL(expected).origin
  )
    throw new AppError("Origine de requête refusée", 403);
}
export async function login(email: string, password: string) {
  const key = tokenHash(email.toLowerCase());
  const attempts = await query(
    "INSERT INTO login_attempts(key,count,window_start) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE login_attempts.count+1 END, window_start=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END RETURNING count",
    [key],
  );
  if (attempts[0].count > 10)
    throw new AppError("Trop de tentatives. Réessayez dans 15 minutes.", 429);
  const [user] = await query(
    "SELECT * FROM users WHERE email=$1 AND NOT disabled",
    [email.toLowerCase()],
  );
  const valid = verifyPassword(password, user?.password_hash ?? dummyHash);
  if (!valid || !user) throw new AppError("Identifiants incorrects", 401);
  await query("DELETE FROM login_attempts WHERE key=$1", [key]);
  const token = randomBytes(32).toString("base64url");
  await query(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",
    [tokenHash(token), user.id],
  );
  (await cookies()).set("spotlight_session", token, {
    httpOnly: true,
    secure:
      process.env.VERCEL === "1" ||
      process.env.SESSION_COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    maxAge: 43200,
  });
  return { name: user.name, role: user.role };
}
export async function logout() {
  const c = await cookies();
  const token = c.get("spotlight_session")?.value;
  if (token)
    await query("DELETE FROM sessions WHERE token_hash=$1", [tokenHash(token)]);
  c.delete("spotlight_session");
}
