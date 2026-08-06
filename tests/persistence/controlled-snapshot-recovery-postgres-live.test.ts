import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  createInstanceSnapshot,
  createServerInstanceRuntime
} from "../../apps/server/src/runtime";
import { prepareSnapshotRecoveryMigrationControlled } from
  "../../apps/server/src/runtime/persistence/postgres/controlled-snapshot-recovery-migration";
import { createPostgresDatabase } from
  "../../apps/server/src/runtime/persistence/postgres/postgres-client";
import {
  SNAPSHOT_CLEANUP_ADVISORY_LOCK,
  cleanupPostgresCheckpoints
} from
  "../../apps/server/src/runtime/persistence/postgres/postgres-snapshot-maintenance";
import { PRODUCTION_MIGRATION_CONTRACT } from
  "../../apps/server/src/runtime/persistence/postgres/production-migration-contract";
import { createSnapshotPersistenceMetrics } from
  "../../apps/server/src/runtime/persistence/repositories";
import { resolveLivePostgresSmokeConfig } from "./helpers/postgres-prod-like-smoke-helpers";

const live = resolveLivePostgresSmokeConfig();
const describeWhenDatabaseConfigured = live.run ? describe : describe.skip;

describeWhenDatabaseConfigured("controlled snapshot recovery PostgreSQL live", () => {
  it("selects the latest valid legacy root and remains idempotent after an interrupted-safe batch run", async () => {
    const adminDatabase = createPostgresDatabase(live.databaseUrl!);
    const schema = `snapshot_controlled_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const scopedDatabase = createPostgresDatabase(live.databaseUrl!, { max: 1 });
    const lockDatabase = createPostgresDatabase(live.databaseUrl!, { max: 1 });
    try {
      await adminDatabase.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
      await scopedDatabase.query(`SET search_path TO ${quoteIdentifier(schema)}`);
      await lockDatabase.query(`SET search_path TO ${quoteIdentifier(schema)}`);
      const initialSql = await readFile(new URL(
        "../../apps/server/src/runtime/persistence/postgres/migrations/001_initial_runtime_persistence.sql",
        import.meta.url
      ), "utf8");
      await scopedDatabase.query(initialSql);
      await seedPrerequisiteHistory(scopedDatabase);

      const runtime = createServerInstanceRuntime("instance:controlled-live", "free");
      runtime.state.root.tick = 4;
      runtime.state.root.version = 5;
      const valid = createInstanceSnapshot(runtime);
      runtime.state.root.tick = 6;
      runtime.state.root.version = 7;
      const corruptRoot = createInstanceSnapshot(runtime);
      corruptRoot.integrity.rootVersion = 999;
      runtime.state.root.tick = 8;
      runtime.state.root.version = 9;
      const corruptCounts = createInstanceSnapshot(runtime);
      corruptCounts.integrity.entityCounts.players += 1;

      await scopedDatabase.query(
        `INSERT INTO empire_server_instances (
           id, server_instance_id, schema_version, mode, status, payload, created_at, updated_at
         ) VALUES ($1, $2, 1, 'free', 'running', '{}'::jsonb, now(), now())`,
        [`server-instance:${runtime.record.id}`, runtime.record.id]
      );
      await insertLegacySnapshot(scopedDatabase, valid);
      await insertLegacySnapshot(scopedDatabase, corruptRoot);
      await insertLegacySnapshot(scopedDatabase, corruptCounts);
      await scopedDatabase.query(
        `INSERT INTO empire_snapshot_latest (
           id, server_instance_id, schema_version, snapshot_id, root_version,
           payload, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz, now())`,
        [
          `snapshot-head:${corruptCounts.instanceId}`,
          corruptCounts.instanceId,
          corruptCounts.version.schemaVersion,
          corruptCounts.snapshotId,
          corruptCounts.integrity.rootVersion,
          JSON.stringify(corruptCounts),
          corruptCounts.createdAt
        ]
      );

      await expect(prepareSnapshotRecoveryMigrationControlled(scopedDatabase, {
        batchSize: 1,
        log: () => undefined
      })).resolves.toMatchObject({
        alreadyApplied: false,
        updatedHeadRows: 1,
        updatedCheckpointRows: 3,
        backfilledHeadRows: 1
      });

      const head = await scopedDatabase.query<{
        root_version: string | number;
        snapshot_id: string;
        payload: { integrity: { rootVersion: number } };
      }>(
        `SELECT root_version, snapshot_id, payload
         FROM empire_snapshot_latest
         WHERE server_instance_id = $1`,
        [runtime.record.id]
      );
      expect(Number(head.rows[0]?.root_version)).toBe(valid.integrity.rootVersion);
      expect(head.rows[0]?.snapshot_id).toBe(valid.snapshotId);
      expect(head.rows[0]?.payload.integrity.rootVersion).toBe(valid.integrity.rootVersion);

      const metadata = await scopedDatabase.query<{ total: string | number; classified: string | number }>(
        `SELECT count(*) AS total,
                count(*) FILTER (
                  WHERE checkpoint_kind = 'legacy-checkpoint'
                    AND reason_code = 'legacy-snapshot-backfill'
                    AND is_protected = false
                ) AS classified
         FROM empire_snapshots`
      );
      expect(Number(metadata.rows[0]?.classified)).toBe(Number(metadata.rows[0]?.total));

      await expect(prepareSnapshotRecoveryMigrationControlled(scopedDatabase, {
        batchSize: 1,
        log: () => undefined
      })).resolves.toMatchObject({ alreadyApplied: true });

      await scopedDatabase.query(`
        CREATE TABLE empire_hosted_server_instances (
          server_instance_id text PRIMARY KEY,
          status text NOT NULL
        )
      `);
      await scopedDatabase.query(
        `INSERT INTO empire_hosted_server_instances (server_instance_id, status)
         VALUES ($1, 'archived')`,
        [runtime.record.id]
      );
      await scopedDatabase.query(
        `INSERT INTO empire_snapshots (
           id,server_instance_id,schema_version,snapshot_id,root_version,tick,
           checkpoint_kind,reason_code,lifecycle_phase,is_protected,payload,created_at,updated_at
         ) VALUES
           ($1,$3,$4,$5,$6,$7,'lifecycle-checkpoint','final-lockdown-entered','final_lockdown',true,$8::jsonb,$9::timestamptz,now()),
           ($2,$3,$4,$10,$11,$12,'terminal-checkpoint','instance-completed','resolved',true,$8::jsonb,$9::timestamptz,now())`,
        [
          `snapshot-protected:lifecycle:${runtime.record.id}`,
          `snapshot-protected:terminal:${runtime.record.id}`,
          runtime.record.id,
          valid.version.schemaVersion,
          `checkpoint:lifecycle:${runtime.record.id}`,
          valid.integrity.rootVersion + 1,
          valid.tick + 1,
          JSON.stringify(valid),
          valid.createdAt,
          `checkpoint:terminal:${runtime.record.id}`,
          valid.integrity.rootVersion + 2,
          valid.tick + 2
        ]
      );
      const lockAcquired = deferred<void>();
      const releaseLock = deferred<void>();
      const heldLock = lockDatabase.transaction(async (client) => {
        await client.query("SELECT pg_advisory_xact_lock($1)", [SNAPSHOT_CLEANUP_ADVISORY_LOCK]);
        lockAcquired.resolve();
        await releaseLock.promise;
      });
      await lockAcquired.promise;
      await expect(cleanupPostgresCheckpoints(
        scopedDatabase,
        { wrapWritesInTransaction: true },
        retentionPolicy,
        "2026-07-26T11:59:00.000Z",
        createSnapshotPersistenceMetrics()
      )).resolves.toMatchObject({ acquired: false, deletedRows: 0 });
      releaseLock.resolve();
      await heldLock;
      const cleaned = await cleanupPostgresCheckpoints(
        scopedDatabase,
        { wrapWritesInTransaction: true },
        retentionPolicy,
        "2026-07-26T12:00:00.000Z",
        createSnapshotPersistenceMetrics()
      );
      expect(cleaned).toMatchObject({ acquired: true, deletedRows: 2 });
      const protectedRows = await scopedDatabase.query<{ count: string | number }>(
        `SELECT count(*) AS count FROM empire_snapshots
         WHERE server_instance_id=$1 AND is_protected=true
           AND checkpoint_kind IN ('lifecycle-checkpoint','terminal-checkpoint')`,
        [runtime.record.id]
      );
      expect(Number(protectedRows.rows[0]?.count)).toBe(2);
      await expect(cleanupPostgresCheckpoints(
        scopedDatabase,
        { wrapWritesInTransaction: true },
        retentionPolicy,
        "2026-07-26T12:01:00.000Z",
        createSnapshotPersistenceMetrics()
      )).resolves.toMatchObject({ acquired: true, deletedRows: 0 });
      const maintenance = await scopedDatabase.query<{
        last_status: string;
        last_deleted_rows: string | number;
      }>(
        `SELECT last_status,last_deleted_rows FROM empire_snapshot_maintenance WHERE scope='global'`
      );
      expect(maintenance.rows[0]).toMatchObject({ last_status: "success" });
      expect(Number(maintenance.rows[0]?.last_deleted_rows)).toBe(0);

      const migration = await scopedDatabase.query<{ count: string | number }>(
        `SELECT count(*) AS count
         FROM empire_schema_migrations
         WHERE filename = '017_snapshot_recovery_heads_and_checkpoints.sql'`
      );
      expect(Number(migration.rows[0]?.count)).toBe(1);
    } finally {
      await lockDatabase.close();
      await scopedDatabase.close();
      await adminDatabase.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
      await adminDatabase.close();
    }
  }, 30_000);
});

const seedPrerequisiteHistory = async (
  database: ReturnType<typeof createPostgresDatabase>
): Promise<void> => {
  await database.query(`
    CREATE TABLE IF NOT EXISTS empire_schema_migrations (
      filename text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL
    )
  `);
  const targetIndex = PRODUCTION_MIGRATION_CONTRACT.findIndex(([filename]) =>
    filename === "017_snapshot_recovery_heads_and_checkpoints.sql");
  for (const [filename, checksum] of PRODUCTION_MIGRATION_CONTRACT.slice(0, targetIndex)) {
    await database.query(
      `INSERT INTO empire_schema_migrations (filename, checksum, applied_at)
       VALUES ($1, $2, now())`,
      [filename, checksum]
    );
  }
};

const insertLegacySnapshot = (
  database: ReturnType<typeof createPostgresDatabase>,
  snapshot: ReturnType<typeof createInstanceSnapshot>
): Promise<unknown> => database.query(
  `INSERT INTO empire_snapshots (
     id, server_instance_id, schema_version, snapshot_id, root_version,
     tick, payload, created_at, updated_at
   ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::timestamptz, now())`,
  [
    `snapshot-history:${snapshot.instanceId}:${snapshot.snapshotId}`,
    snapshot.instanceId,
    snapshot.version.schemaVersion,
    snapshot.snapshotId,
    snapshot.integrity.rootVersion === 999 ? 7 : snapshot.integrity.rootVersion,
    snapshot.tick,
    JSON.stringify(snapshot),
    snapshot.createdAt
  ]
);

const quoteIdentifier = (value: string): string => `"${value.replace(/"/gu, "\"\"")}"`;

const retentionPolicy = {
  rollingCheckpointCountActive: 24,
  rollingCheckpointCountTerminal: 1,
  retainLifecycleCheckpoints: true,
  terminalRetentionDays: 365_000,
  cleanupBatchSize: 10
};

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
};
