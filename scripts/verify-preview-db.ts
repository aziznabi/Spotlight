import { pool } from "../src/lib/db";

// A configured preview must prove it can use its database before becoming Ready.
// Local builds and previews without DATABASE_URL keep their existing behavior.
if (
  process.env.VERCEL === "1" &&
  process.env.VERCEL_ENV === "preview" &&
  process.env.DATABASE_URL
) {
  if (process.env.DATABASE_ENV !== "development")
    throw new Error("La preview doit utiliser une base de développement.");
  if (new URL(process.env.APP_URL ?? "").protocol !== "https:")
    throw new Error("APP_URL HTTPS requis pour la preview.");
  if (process.env.SESSION_COOKIE_SECURE !== "true")
    throw new Error("SESSION_COOKIE_SECURE=true requis pour la preview.");
  if ((process.env.CRON_SECRET?.length ?? 0) < 32)
    throw new Error("CRON_SECRET de 32 caractères minimum requis.");

  const db = pool();
  try {
    const client = await db.connect();
    try {
      await client.query("BEGIN READ ONLY");
      await client.query("SET LOCAL statement_timeout='8s'");
      // Exercise the application's actual pool, search_path and table privileges.
      await client.query("SELECT id FROM users LIMIT 0");
      await client.query("SELECT id FROM products LIMIT 0");
      await client.query("SELECT id FROM jobs LIMIT 0");
      await client.query("SELECT id FROM assets LIMIT 0");
      await client.query("COMMIT");
      console.log(
        "Spotlight preview: connexion PostgreSQL et lecture du schéma validées; URL HTTPS, cookies sécurisés et secret cron configurés.",
      );
    } finally {
      // Destroy this verification connection, including any aborted transaction.
      client.release(true);
    }
  } catch (error) {
    // Never log the connection string or provider error details in build output.
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    console.error(
      "Spotlight preview: connexion ou schéma PostgreSQL non validé." +
        (/^[A-Z0-9_]{2,40}$/.test(code) ? ` Code: ${code}` : ""),
    );
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
