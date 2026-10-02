import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
if (process.env.VERCEL) throw new Error("Local database forbidden on Vercel");
const pg = new EmbeddedPostgres({
  databaseDir: ".local/postgres",
  user: "spotlight",
  password: "local-test-only",
  port: 5433,
  persistent: true,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: console.error,
});
if (!existsSync(".local/postgres/PG_VERSION")) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
const r = await client.query(
  "SELECT 1 FROM pg_database WHERE datname='spotlight'",
);
await client.end();
if (!r.rows.length) await pg.createDatabase("spotlight");
console.log(
  "PostgreSQL local de vérification prêt sur 127.0.0.1:5433 (données synthétiques uniquement).",
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    await pg.stop();
    process.exit(0);
  });
await new Promise(() => {});
