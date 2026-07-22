import * as crypto from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import type { PostgresDatabase, PostgresQueryable } from "./postgres-client";

export interface DatabaseMigrationStatus {
  current: boolean;
  pending: string[];
  applied: string[];
}

export const getDatabaseMigrationStatus = async (
  database: PostgresDatabase,
  migrationsDirectory: URL
): Promise<DatabaseMigrationStatus> => {
  const files = await loadMigrations(migrationsDirectory);
  return database.transaction(async (client) => {
    await acquireMigrationLock(client);
    await ensureHistoryTable(client);
    return resolveMigrationStatus(client, files);
  });
};

export const migrateDatabase = async (
  database: PostgresDatabase,
  migrationsDirectory: URL
): Promise<DatabaseMigrationStatus> => {
  const files = await loadMigrations(migrationsDirectory);
  return database.transaction(async (client) => {
    await acquireMigrationLock(client);
    await ensureHistoryTable(client);
    const status = await resolveMigrationStatus(client, files);
    for (const filename of status.pending) {
      const migration = files.find((entry) => entry.filename === filename)!;
      const alreadyApplied = await client.query<{ checksum: string }>(
        `SELECT checksum FROM empire_schema_migrations WHERE filename=$1`, [filename]);
      if (alreadyApplied.rows[0]) {
        if (alreadyApplied.rows[0].checksum !== migration.checksum) {
          throw new Error(`Database migration checksum mismatch: ${filename}.`);
        }
        continue;
      }
      await client.query(migration.sql);
      await client.query(
        `INSERT INTO empire_schema_migrations (filename, checksum, applied_at) VALUES ($1,$2,now())`,
        [filename, migration.checksum]
      );
    }
    return resolveMigrationStatus(client, files);
  });
};

const acquireMigrationLock = (database: PostgresQueryable): Promise<unknown> => database.query(
  `SELECT pg_advisory_xact_lock($1)`,
  [1_843_771_153]
);

const ensureHistoryTable = (database: PostgresQueryable): Promise<unknown> => database.query(`
  CREATE TABLE IF NOT EXISTS empire_schema_migrations (
    filename text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL
  )
`);

const resolveMigrationStatus = async (
  database: PostgresQueryable,
  files: Awaited<ReturnType<typeof loadMigrations>>
): Promise<DatabaseMigrationStatus> => {
  const history = await database.query<{ filename: string; checksum: string }>(
    `SELECT filename, checksum FROM empire_schema_migrations ORDER BY filename`
  );
  const known = new Map(files.map((entry) => [entry.filename, entry]));
  for (const row of history.rows) {
    const migration = known.get(row.filename);
    if (!migration) throw new Error(`Database contains unknown migration: ${row.filename}.`);
    if (migration.checksum !== row.checksum) throw new Error(`Database migration checksum mismatch: ${row.filename}.`);
  }
  const applied = history.rows.map((row) => row.filename);
  const appliedSet = new Set(applied);
  const pending = files.filter((entry) => !appliedSet.has(entry.filename)).map((entry) => entry.filename);
  return { current: pending.length === 0, pending, applied };
};

const loadMigrations = async (directory: URL) => {
  const filenames = (await readdir(directory)).filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/u.test(name)).sort();
  if (filenames.length === 0) throw new Error("No database migrations were found.");
  return Promise.all(filenames.map(async (filename) => {
    const sql = await readFile(new URL(filename, directory), "utf8");
    return { filename, sql, checksum: crypto.createHash("sha256").update(sql).digest("hex") };
  }));
};
