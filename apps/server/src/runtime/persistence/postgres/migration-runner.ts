import * as crypto from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import type { PostgresDatabase, PostgresQueryable } from "./postgres-client";

export interface DatabaseMigrationStatus {
  current: boolean;
  pending: string[];
  applied: string[];
}

export interface DatabaseMigrationOptions {
  stopBeforeFilename?: string;
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
  migrationsDirectory: URL,
  options: DatabaseMigrationOptions = {}
): Promise<DatabaseMigrationStatus> => {
  const files = await loadMigrations(migrationsDirectory);
  const stopBeforeIndex = options.stopBeforeFilename
    ? files.findIndex((entry) => entry.filename === options.stopBeforeFilename)
    : files.length;
  if (options.stopBeforeFilename && stopBeforeIndex < 0) {
    throw new Error(`Database migration stop target was not found: ${options.stopBeforeFilename}.`);
  }
  return database.transaction(async (client) => {
    await acquireMigrationLock(client);
    await ensureHistoryTable(client);
    const status = await resolveMigrationStatus(client, files);
    for (const filename of status.pending) {
      const migration = files.find((entry) => entry.filename === filename)!;
      if (files.indexOf(migration) >= stopBeforeIndex) continue;
      const alreadyApplied = await client.query<{ checksum: string }>(
        `SELECT checksum FROM empire_schema_migrations WHERE filename=$1`, [filename]);
      if (alreadyApplied.rows[0]) {
        if (alreadyApplied.rows[0].checksum !== migration.checksum) {
          throw new Error(`Database migration checksum mismatch: ${filename}.`);
        }
        continue;
      }
      if (filename === SNAPSHOT_RECOVERY_MIGRATION) {
        await assertSnapshotRecoveryMigrationCanRunOnline(client);
        await client.query("SET LOCAL lock_timeout = '5s'");
      }
      await client.query(migration.sql);
      if (filename === SNAPSHOT_RECOVERY_MIGRATION) {
        await client.query("SET LOCAL lock_timeout = DEFAULT");
      }
      await client.query(
        `INSERT INTO empire_schema_migrations (filename, checksum, applied_at) VALUES ($1,$2,now())`,
        [filename, migration.checksum]
      );
    }
    return resolveMigrationStatus(client, files);
  });
};

const SNAPSHOT_RECOVERY_MIGRATION = "017_snapshot_recovery_heads_and_checkpoints.sql";
export const SNAPSHOT_RECOVERY_ONLINE_ROW_LIMIT = 50_000;

export class SnapshotRecoveryMigrationOnlineSafetyError extends Error {
  readonly safeCode = "SNAPSHOT_RECOVERY_MIGRATION_REQUIRES_CONTROLLED_ROLLOUT";

  constructor(exceedsOnlineRowLimit: boolean) {
    super(
      `Migration ${SNAPSHOT_RECOVERY_MIGRATION} refuses automatic execution when legacy snapshots already exist` +
      `${exceedsOnlineRowLimit ? ` (more than ${SNAPSHOT_RECOVERY_ONLINE_ROW_LIMIT} rows)` : ""}; run ` +
      "`npm run db:migrate -- --controlled-snapshot-recovery` from the controlled snapshot backfill runbook."
    );
    this.name = "SnapshotRecoveryMigrationOnlineSafetyError";
  }
}

export const assertSnapshotRecoveryMigrationCanRunOnline = async (
  database: PostgresQueryable
): Promise<void> => {
  const result = await database.query<{
    has_snapshot_history: boolean;
    has_recovery_head: boolean;
    exceeds_safe_limit: boolean;
  }>(
    `SELECT CASE
       WHEN to_regclass('empire_snapshots') IS NULL THEN false
       ELSE EXISTS (SELECT 1 FROM empire_snapshots LIMIT 1)
     END AS has_snapshot_history,
     CASE
       WHEN to_regclass('empire_snapshot_latest') IS NULL THEN false
       ELSE EXISTS (SELECT 1 FROM empire_snapshot_latest LIMIT 1)
     END AS has_recovery_head,
     CASE
       WHEN to_regclass('empire_snapshots') IS NULL THEN false
       ELSE EXISTS (
          SELECT 1
          FROM empire_snapshots
          OFFSET $1
          LIMIT 1
        )
     END AS exceeds_safe_limit`,
    [SNAPSHOT_RECOVERY_ONLINE_ROW_LIMIT]
  );
  const safety = result.rows[0];
  if (safety?.has_snapshot_history || safety?.has_recovery_head) {
    throw new SnapshotRecoveryMigrationOnlineSafetyError(safety.exceeds_safe_limit);
  }
};

export const DATABASE_MIGRATION_ADVISORY_LOCK = 1_843_771_153;

export const acquireMigrationLock = (database: PostgresQueryable): Promise<unknown> => database.query(
  `SELECT pg_advisory_xact_lock($1)`,
  [DATABASE_MIGRATION_ADVISORY_LOCK]
);

export const ensureHistoryTable = (database: PostgresQueryable): Promise<unknown> => database.query(`
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
    return { filename, sql, checksum: checksumMigrationSql(sql) };
  }));
};

export const checksumMigrationSql = (sql: string): string => crypto
  .createHash("sha256")
  .update(sql.replace(/\r\n/gu, "\n"))
  .digest("hex");
