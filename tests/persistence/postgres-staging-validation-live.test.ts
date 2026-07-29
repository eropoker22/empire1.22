import * as crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";
import { describe, expect, it } from "vitest";
import {
  assertHostedRuntimeWorkerSchemaCurrent,
  HOSTED_WORKER_SCHEMA_ERROR
} from "../../apps/server/src/bootstrap/hosted-runtime-worker-preflight";
import { createApiReadinessResponse } from "../../apps/server/src/netlify/api-readiness-netlify";
import {
  createInstanceSnapshot,
  createLifecycleCheckpoint,
  createServerInstanceRuntime
} from "../../apps/server/src/runtime";
import {
  createPostgresDatabase,
  createPostgresSnapshotRepository,
  isProductionSchemaCurrent,
  PRODUCTION_MIGRATION_CONTRACT,
  type PostgresDatabase
} from "../../apps/server/src/runtime/persistence/postgres";
import {
  checksumMigrationSql,
  getDatabaseMigrationStatus,
  migrateDatabase
} from
  "../../apps/server/src/runtime/persistence/postgres/migration-runner";
import { createIsolatedPostgresTestSchema } from "./helpers/isolated-postgres-test-schema";
import { resolveLivePostgresSmokeConfig } from "./helpers/postgres-prod-like-smoke-helpers";

const live = resolveLivePostgresSmokeConfig();
const run = live.run ? it : it.skip;
const migrationsDirectory = new URL(
  "../../apps/server/src/runtime/persistence/postgres/migrations/",
  import.meta.url
);

describe("PostgreSQL staging contract live", () => {
  run("rejects schema 016, migrates canonically through 022, and detects checksum tampering", async () => {
    const isolated = await createEmptySchema(live.databaseUrl!, "staging_contract");
    try {
      await applyMigrationsThrough(isolated.database, 15);
      const before = await getDatabaseMigrationStatus(isolated.database, migrationsDirectory);
      expect(before.current).toBe(false);
      expect(before.applied).toHaveLength(15);
      expect(before.pending).toEqual(PRODUCTION_MIGRATION_CONTRACT.slice(15).map(([filename]) => filename));

      const prerequisite = await migrateDatabase(isolated.database, migrationsDirectory, {
        stopBeforeFilename: "017_snapshot_recovery_heads_and_checkpoints.sql"
      });
      expect(prerequisite.current).toBe(false);
      expect(prerequisite.applied).toHaveLength(16);
      expect(prerequisite.pending).toEqual(PRODUCTION_MIGRATION_CONTRACT.slice(16).map(([filename]) => filename));
      expect(await isProductionSchemaCurrent(isolated.database)).toBe(false);

      const heartbeatBefore = await countRows(isolated.database, "empire_hosted_worker_heartbeats");
      const rejected = await createApiReadinessResponse(isolated.database, {
        EMPIRE_BUILD_SHA: "a".repeat(40)
      });
      expect(rejected.statusCode).toBe(503);
      expect(JSON.parse(rejected.body)).toMatchObject({ code: "DATABASE_MIGRATIONS_PENDING" });
      await expect(assertHostedRuntimeWorkerSchemaCurrent(isolated.database))
        .rejects.toThrow(HOSTED_WORKER_SCHEMA_ERROR);
      expect(await countRows(isolated.database, "empire_hosted_worker_heartbeats")).toBe(heartbeatBefore);

      const migrationTimings = await applyRemainingMigrationsIndividually(isolated.database);
      const migrated = await getDatabaseMigrationStatus(isolated.database, migrationsDirectory);
      expect(migrated.current).toBe(true);
      expect(migrated.applied).toHaveLength(PRODUCTION_MIGRATION_CONTRACT.length);
      expect(await isProductionSchemaCurrent(isolated.database)).toBe(true);

      const rerunStartedAt = performance.now();
      const rerun = await migrateDatabase(isolated.database, migrationsDirectory);
      const rerunDurationMs = performance.now() - rerunStartedAt;
      expect(rerun).toEqual(migrated);

      const history = await isolated.database.query<{ filename: string; checksum: string }>(
        "SELECT filename,checksum FROM empire_schema_migrations ORDER BY filename"
      );
      expect(history.rows.map((row) => [row.filename, row.checksum])).toEqual(PRODUCTION_MIGRATION_CONTRACT);
      await assertPostMigrationSchema(isolated.database);

      const accepted = await createApiReadinessResponse(isolated.database, {
        EMPIRE_BUILD_SHA: "b".repeat(40)
      });
      expect(accepted.statusCode).toBe(200);
      expect(JSON.parse(accepted.body)).toMatchObject({ status: "ready", schema: "current" });

      await isolated.database.query(
        "UPDATE empire_schema_migrations SET checksum='tampered' WHERE filename=$1",
        ["022_single_player_hosted_start.sql"]
      );
      expect(await isProductionSchemaCurrent(isolated.database)).toBe(false);
      await expect(getDatabaseMigrationStatus(isolated.database, migrationsDirectory))
        .rejects.toThrow(/checksum mismatch/u);

      console.info("[postgres-staging-validation] migration timings", {
        ...migrationTimings,
        idempotentRerunMs: Math.round(rerunDurationMs * 100) / 100
      });
    } finally {
      await isolated.close();
    }
  }, 90_000);

  run("proves two-session locking, SKIP LOCKED, advisory locks, timeout recovery, JSONB and recovery CAS", async () => {
    const isolated = await createIsolatedPostgresTestSchema(live.databaseUrl!, "staging_primitives");
    const firstPool = new Pool({ connectionString: withApplicationName(
      isolated.databaseUrl,
      "empire_staging_validation_a"
    ) });
    const secondPool = new Pool({ connectionString: withApplicationName(
      isolated.databaseUrl,
      "empire_staging_validation_b"
    ) });
    let first: PoolClient | null = null;
    let second: PoolClient | null = null;
    let poolsClosed = false;
    try {
      [first, second] = await Promise.all([firstPool.connect(), secondPool.connect()]);
      const firstPid = Number((await first.query("SELECT pg_backend_pid() AS pid")).rows[0]?.pid);
      const secondPid = Number((await second.query("SELECT pg_backend_pid() AS pid")).rows[0]?.pid);
      expect(firstPid).not.toBe(secondPid);

      await first.query("CREATE TABLE staging_lock_probe (id integer PRIMARY KEY, payload text NOT NULL)");
      await first.query("INSERT INTO staging_lock_probe VALUES (1,'one'),(2,'two'),(3,'three'),(4,'four')");

      await first.query("BEGIN");
      await first.query("SELECT id FROM staging_lock_probe WHERE id=1 FOR UPDATE");
      await second.query("BEGIN");
      await second.query("SET LOCAL lock_timeout='100ms'");
      const lockWaitStartedAt = performance.now();
      await expect(second.query("SELECT id FROM staging_lock_probe WHERE id=1 FOR UPDATE"))
        .rejects.toMatchObject({ code: "55P03" });
      const lockWaitDurationMs = performance.now() - lockWaitStartedAt;
      await second.query("ROLLBACK");
      await first.query("COMMIT");

      await first.query("BEGIN");
      await first.query("SELECT id FROM staging_lock_probe WHERE id=1 FOR UPDATE");
      await second.query("BEGIN");
      await expect(second.query("SELECT id FROM staging_lock_probe WHERE id=2 FOR UPDATE"))
        .resolves.toMatchObject({ rowCount: 1 });
      await Promise.all([first.query("ROLLBACK"), second.query("ROLLBACK")]);

      await first.query("BEGIN");
      await first.query("SELECT id FROM staging_lock_probe ORDER BY id LIMIT 2 FOR UPDATE");
      await second.query("BEGIN");
      const skipped = await second.query<{ id: number }>(
        "SELECT id FROM staging_lock_probe ORDER BY id LIMIT 2 FOR UPDATE SKIP LOCKED"
      );
      expect(skipped.rows.map((row) => row.id)).toEqual([3, 4]);
      await Promise.all([first.query("ROLLBACK"), second.query("ROLLBACK")]);

      await first.query("BEGIN");
      await second.query("BEGIN");
      const advisoryKey = 1_843_771_154;
      expect((await first.query(
        "SELECT pg_try_advisory_xact_lock($1) AS acquired", [advisoryKey]
      )).rows[0]?.acquired).toBe(true);
      expect((await second.query(
        "SELECT pg_try_advisory_xact_lock($1) AS acquired", [advisoryKey]
      )).rows[0]?.acquired).toBe(false);
      await Promise.all([first.query("ROLLBACK"), second.query("ROLLBACK")]);

      await second.query("BEGIN");
      await second.query("SET LOCAL statement_timeout='100ms'");
      await expect(second.query("SELECT pg_sleep(0.25)")).rejects.toMatchObject({ code: "57014" });
      await second.query("ROLLBACK");
      await expect(second.query("SELECT 1 AS usable")).resolves.toMatchObject({ rows: [{ usable: 1 }] });

      const jsonMetrics = await verifyJsonbRoundTrip(first);
      const casMetrics = await verifyRecoveryHeadCas(isolated.database);

      first.release();
      second.release();
      first = null;
      second = null;
      await Promise.all([firstPool.end(), secondPool.end()]);
      poolsClosed = true;
      const leaked = await isolated.database.query<{ count: string | number }>(
        `SELECT count(*) AS count FROM pg_stat_activity
         WHERE application_name IN ('empire_staging_validation_a','empire_staging_validation_b')
           AND state='idle in transaction'`
      );
      expect(Number(leaked.rows[0]?.count)).toBe(0);

      console.info("[postgres-staging-validation] primitive timings", {
        lockWaitMs: Math.round(lockWaitDurationMs * 100) / 100,
        ...jsonMetrics,
        ...casMetrics
      });
    } finally {
      first?.release();
      second?.release();
      if (!poolsClosed) {
        await firstPool.end().catch(() => undefined);
        await secondPool.end().catch(() => undefined);
      }
      await isolated.close();
    }
  }, 90_000);
});

const verifyJsonbRoundTrip = async (client: PoolClient) => {
  await client.query("CREATE TABLE staging_jsonb_probe (id text PRIMARY KEY,payload jsonb NOT NULL)");
  const payload = {
    players: Array.from({ length: 20 }, (_, index) => ({ id: `player:${index}`, commands: index * 17 })),
    districts: Array.from({ length: 161 }, (_, index) => ({ id: `district:${index}`, owner: index % 20 })),
    processedCommandIds: Array.from({ length: 2_000 }, (_, index) => `command:${index}`),
    randomPayload: crypto.randomBytes(240_000).toString("base64url")
  };
  const serializedStartedAt = performance.now();
  const serialized = JSON.stringify(payload);
  const serializationMs = performance.now() - serializedStartedAt;
  const serializedBytes = new TextEncoder().encode(serialized).byteLength;
  expect(serializedBytes).toBeGreaterThan(8_192);

  const writeStartedAt = performance.now();
  await client.query("INSERT INTO staging_jsonb_probe (id,payload) VALUES ('large',$1::jsonb)", [serialized]);
  const writeMs = performance.now() - writeStartedAt;
  const readStartedAt = performance.now();
  const stored = await client.query<{ payload: typeof payload; stored_bytes: number }>(
    "SELECT payload,pg_column_size(payload) AS stored_bytes FROM staging_jsonb_probe WHERE id='large'"
  );
  const readMs = performance.now() - readStartedAt;
  expect(stored.rows[0]?.payload).toEqual(payload);
  expect(Number(stored.rows[0]?.stored_bytes)).toBeGreaterThan(2_048);
  return rounded({ serializedBytes, serializationMs, writeMs, readMs });
};

const verifyRecoveryHeadCas = async (database: PostgresDatabase) => {
  const repository = createPostgresSnapshotRepository(database);
  const instanceId = `instance:staging-cas:${crypto.randomUUID()}`;
  const runtime = createServerInstanceRuntime(instanceId, "free");
  runtime.state.root.version = 1;
  runtime.state.root.tick = 1;
  const first = createInstanceSnapshot(runtime);
  expect(await repository.saveRecoveryHead(first)).toBe("created");

  runtime.state.root.version = 2;
  runtime.state.root.tick = 2;
  const second = createInstanceSnapshot(runtime);
  expect(await repository.saveRecoveryHead(second)).toBe("updated");
  expect(await repository.saveRecoveryHead(second)).toBe("idempotent");
  await expect(repository.saveRecoveryHead(first)).rejects.toThrow(/stale rootVersion/u);

  const divergent = structuredClone(second);
  if (!divergent.lobby) throw new Error("CAS fixture lobby is missing.");
  divergent.lobby.displayName = `${divergent.lobby.displayName} divergent`;
  await expect(repository.saveRecoveryHead(divergent)).rejects.toThrow(/same rootVersion/u);

  runtime.state.root.version = 3;
  runtime.state.root.tick = 3;
  const fallbackSnapshot = createInstanceSnapshot(runtime);
  const checkpoint = createLifecycleCheckpoint(fallbackSnapshot, "instance-paused");
  await repository.saveCheckpoint(checkpoint);
  await database.query("DELETE FROM empire_snapshot_latest WHERE server_instance_id=$1", [instanceId]);
  const recovery = await repository.loadForRecovery(instanceId);
  expect(recovery).toMatchObject({ source: "checkpoint-fallback", snapshot: { snapshotId: fallbackSnapshot.snapshotId } });
  expect((await repository.loadRecoveryHead(instanceId))?.snapshotId).toBe(fallbackSnapshot.snapshotId);
  expect(await countRows(database, "empire_snapshot_latest", instanceId)).toBe(1);
  return { recoveryHeadRows: 1, fallbackRootVersion: fallbackSnapshot.integrity.rootVersion };
};

const assertPostMigrationSchema = async (database: PostgresDatabase): Promise<void> => {
  const columns = await database.query<{ table_name: string; column_name: string }>(
    `SELECT table_name,column_name FROM information_schema.columns
     WHERE table_schema=current_schema()
       AND table_name IN ('empire_snapshot_latest','empire_snapshots','empire_snapshot_maintenance',
                          'empire_hosted_join_jobs','empire_server_membership_jobs',
                          'empire_account_terms_acceptances')`
  );
  const names = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
  for (const expected of [
    "empire_snapshot_latest.tick",
    "empire_snapshot_latest.root_version",
    "empire_snapshot_latest.payload",
    "empire_snapshots.checkpoint_kind",
    "empire_snapshots.reason_code",
    "empire_snapshots.lifecycle_phase",
    "empire_snapshots.is_protected",
    "empire_snapshot_maintenance.last_deleted_rows",
    "empire_hosted_join_jobs.claimed_by_worker_incarnation_id",
    "empire_server_membership_jobs.claimed_by_worker_incarnation_id",
    "empire_account_terms_acceptances.account_id",
    "empire_account_terms_acceptances.terms_version",
    "empire_account_terms_acceptances.accepted_at"
  ]) expect(names.has(expected)).toBe(true);

  const indexes = await database.query<{ indexname: string }>(
    "SELECT indexname FROM pg_indexes WHERE schemaname=current_schema()"
  );
  const indexNames = new Set(indexes.rows.map((row) => row.indexname));
  expect(indexNames.has("empire_snapshot_latest_instance_tick_idx")).toBe(false);
  expect(indexNames.has("empire_snapshot_latest_root_version_idx")).toBe(false);
  expect(indexNames.has("empire_snapshots_instance_kind_created_idx")).toBe(true);
  expect(indexNames.has("empire_snapshots_cleanup_idx")).toBe(true);
  expect(await countRows(database, "empire_snapshot_maintenance")).toBe(1);
};

const createEmptySchema = async (databaseUrl: string, prefix: string) => {
  const admin = createPostgresDatabase(databaseUrl);
  const schema = `${prefix}_${Date.now()}_${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
  await admin.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
  const scoped = new URL(databaseUrl);
  scoped.searchParams.set("options", `-csearch_path=${schema}`);
  const database = createPostgresDatabase(scoped.toString());
  return {
    database,
    databaseUrl: scoped.toString(),
    close: async () => {
      await database.close();
      await admin.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
      await admin.close();
    }
  };
};

const applyMigrationsThrough = async (database: PostgresDatabase, number: number): Promise<void> => {
  await database.query(`CREATE TABLE empire_schema_migrations (
    filename text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL)`);
  for (const [filename] of PRODUCTION_MIGRATION_CONTRACT.slice(0, number)) {
    const sql = await readFile(new URL(filename, migrationsDirectory), "utf8");
    await database.transaction(async (client) => {
      await client.query(sql);
      await client.query(
        "INSERT INTO empire_schema_migrations (filename,checksum,applied_at) VALUES ($1,$2,now())",
        [filename, checksumMigrationSql(sql)]
      );
    });
  }
};

const applyRemainingMigrationsIndividually = async (database: PostgresDatabase) => {
  const timings: Record<string, number> = {};
  const boundaries = [
    ["017", "018_drop_redundant_snapshot_head_tick_index.sql"],
    ["018", "019_drop_redundant_snapshot_head_root_version_index.sql"],
    ["019", "020_hosted_player_job_incarnation_fencing.sql"],
    ["020", "021_account_terms_acceptance.sql"],
    ["021", "022_single_player_hosted_start.sql"],
    ["022", null]
  ] as const;
  for (const [number, stopBeforeFilename] of boundaries) {
    const startedAt = performance.now();
    await migrateDatabase(database, migrationsDirectory, stopBeforeFilename ? { stopBeforeFilename } : {});
    timings[`migration${number}Ms`] = Math.round((performance.now() - startedAt) * 100) / 100;
  }
  return timings;
};

const countRows = async (
  database: PostgresDatabase,
  table: string,
  instanceId?: string
): Promise<number> => {
  const result = await database.query<{ count: string | number }>(
    `SELECT count(*) AS count FROM ${quoteIdentifier(table)}
     ${instanceId ? "WHERE server_instance_id=$1" : ""}`,
    instanceId ? [instanceId] : []
  );
  return Number(result.rows[0]?.count ?? 0);
};

const rounded = (values: Record<string, number>) => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [key, Math.round(value * 100) / 100])
);

const withApplicationName = (databaseUrl: string, applicationName: string): string => {
  const url = new URL(databaseUrl);
  url.searchParams.set("application_name", applicationName);
  return url.toString();
};

const quoteIdentifier = (value: string): string => `"${value.replaceAll("\"", "\"\"")}"`;
