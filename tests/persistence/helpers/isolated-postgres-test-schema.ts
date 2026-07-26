import * as crypto from "node:crypto";
import {
  createPostgresDatabase,
  type PostgresDatabase
} from "../../../apps/server/src/runtime/persistence/postgres";
import { applyPostgresTestMigrations } from "./postgres-prod-like-smoke-helpers";

export interface IsolatedPostgresTestSchema {
  database: PostgresDatabase;
  databaseUrl: string;
  close(): Promise<void>;
}

export const createIsolatedPostgresTestSchema = async (
  databaseUrl: string,
  prefix: string
): Promise<IsolatedPostgresTestSchema> => {
  const adminDatabase = createPostgresDatabase(databaseUrl);
  const schema = `${sanitize(prefix)}_${Date.now()}_${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
  await adminDatabase.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);

  const scopedUrl = new URL(databaseUrl);
  const currentOptions = scopedUrl.searchParams.get("options")?.trim();
  scopedUrl.searchParams.set(
    "options",
    [currentOptions, `-csearch_path=${schema}`].filter(Boolean).join(" ")
  );
  const database = createPostgresDatabase(scopedUrl.toString());
  try {
    await applyPostgresTestMigrations(database);
  } catch (error) {
    await database.close().catch(() => undefined);
    await adminDatabase.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
    await adminDatabase.close();
    throw error;
  }

  let closed = false;
  return {
    database,
    databaseUrl: scopedUrl.toString(),
    close: async () => {
      if (closed) return;
      closed = true;
      await database.close();
      await adminDatabase.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
      await adminDatabase.close();
    }
  };
};

const sanitize = (value: string): string => {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_]+/gu, "_").replace(/^_+|_+$/gu, "");
  return normalized || "postgres_test";
};

const quoteIdentifier = (value: string): string => `"${value.replace(/"/gu, "\"\"")}"`;
