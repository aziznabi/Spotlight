import { Pool, type PoolClient, type QueryResultRow } from "pg";
const globalDb = globalThis as unknown as { spotlightPool?: Pool };
export function pool() {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "DATABASE_URL manquant : configurez la branche Neon de développement.",
    );
  return (globalDb.spotlightPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    options: "-c search_path=spotlight,public",
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
