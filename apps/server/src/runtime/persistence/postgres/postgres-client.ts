import type { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

export interface PostgresQueryable {
  query<TRow extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<QueryResult<TRow>>;
}

export interface PostgresDatabase extends PostgresQueryable {
  transaction<TResult>(
    callback: (client: PostgresQueryable) => Promise<TResult>
  ): Promise<TResult>;
  close(): Promise<void>;
}

export const createPostgresDatabase = (databaseUrl: string): PostgresDatabase => {
  const connectionString = validatePostgresDatabaseUrl(databaseUrl);
  let poolPromise: Promise<Pool> | null = null;

  const getPool = async (): Promise<Pool> => {
    poolPromise ??= import("pg").then(({ Pool }) => new Pool({ connectionString }));
    return poolPromise;
  };

  return {
    query: async (sql, params) => {
      const pool = await getPool();
      return pool.query(sql, params as unknown[]);
    },
    transaction: async (callback) => {
      const pool = await getPool();
      const client = await pool.connect();
      return withPostgresTransactionClient(client, callback);
    },
    close: async () => {
      if (!poolPromise) {
        return;
      }
      const pool = await poolPromise;
      await pool.end();
      poolPromise = null;
    }
  };
};

export const withPostgresTransaction = async <TResult>(
  database: PostgresDatabase,
  callback: (client: PostgresQueryable) => Promise<TResult>
): Promise<TResult> => database.transaction(callback);

export const validatePostgresDatabaseUrl = (databaseUrl: string): string => {
  const trimmed = databaseUrl.trim();
  if (!trimmed) {
    throw new Error("Postgres persistence requires EMPIRE_DATABASE_URL or GAMEPLAY_DATABASE_URL.");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch (_error) {
    throw new Error("Postgres persistence database URL is invalid.");
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("Postgres persistence database URL must use postgres:// or postgresql://.");
  }

  return trimmed;
};

const withPostgresTransactionClient = async <TResult>(
  client: PoolClient,
  callback: (client: PostgresQueryable) => Promise<TResult>
): Promise<TResult> => {
  await client.query("BEGIN");
  try {
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
