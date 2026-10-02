import nextEnv from "@next/env";
import { query, pool } from "../src/lib/db";
import { hashPassword } from "../src/modules/auth/password";
nextEnv.loadEnvConfig(process.cwd());
const email = process.env.ADMIN_EMAIL,
  password = process.env.ADMIN_PASSWORD,
  role = process.env.ADMIN_ROLE ?? "admin";
if (!email || !password || !["admin", "operator"].includes(role))
  throw new Error(
    "ADMIN_EMAIL, ADMIN_PASSWORD (12+ caractères), ADMIN_ROLE requis.",
  );
await query(
  "INSERT INTO users(email,password_hash,name,role) VALUES($1,$2,$3,$4)",
  [email.toLowerCase(), hashPassword(password), email.split("@")[0], role],
);
console.log("Compte privé créé. Retirer ADMIN_PASSWORD de la configuration.");
await pool().end();
