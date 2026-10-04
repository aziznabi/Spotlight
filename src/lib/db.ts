import { Pool, type PoolClient, type QueryResultRow } from "pg";
const globalDb = globalThis as unknown as { spotlightPool?: Pool };
export function pool() {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "DATABASE_URL manquant : configurez la branche Neon de développement.",
    );
  const hostname = new URL(process.env.DATABASE_URL).hostname;
  const neonPooler =
    hostname.endsWith(".neon.tech") && hostname.includes("-pooler.");
  return (globalDb.spotlightPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    // PgBouncer rejects this startup parameter. The Neon runtime role has a
    // persistent search_path; direct/local connections retain the explicit one.
    ...(neonPooler ? {} : { options: "-c search_path=spotlight,public" }),
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 10000,
  }));
}
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  return (await pool().query<T>(sql, values)).rows;
}
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
