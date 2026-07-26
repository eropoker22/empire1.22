import type { QueryResultRow } from "pg";
import {
  acquireMigrationLock,
  ensureHistoryTable
} from "./migration-runner";
import type {
  PostgresDatabase,
  PostgresQueryable
} from "./postgres-client";
import { PRODUCTION_MIGRATION_CONTRACT } from "./production-migration-contract";
import {
  CHECKPOINT_METADATA_BACKFILL_SQL,
  HEAD_TICK_BACKFILL_SQL,
  PREPARATION_VERIFICATION_SQL,
  RECOVERY_HEAD_BACKFILL_SQL,
  SNAPSHOT_CONSTRAINTS_SQL,
  SNAPSHOT_MAINTENANCE_SQL
} from "./controlled-snapshot-recovery-sql";

const SNAPSHOT_RECOVERY_MIGRATION = "017_snapshot_recovery_heads_and_checkpoints.sql";
const DEFAULT_BATCH_SIZE = 500;

export interface ControlledSnapshotRecoveryMigrationResult {
  alreadyApplied: boolean;
  updatedHeadRows: number;
  updatedCheckpointRows: number;
  backfilledHeadRows: number;
}

export const prepareSnapshotRecoveryMigrationControlled = async (
  database: PostgresDatabase,
  options: {
    batchSize?: number;
    log?: (message: string) => void;
  } = {}
): Promise<ControlledSnapshotRecoveryMigrationResult> => {
  const batchSize = positiveBatchSize(options.batchSize);
  const log = options.log ?? ((message: string) => console.info(message));
  if (await assertPrerequisites(database)) {
    return emptyResult(true);
  }

  await prepareSnapshotColumns(database);
  const updatedHeadRows = await runUpdateBatches(database, HEAD_TICK_BACKFILL_SQL, batchSize);
  const updatedCheckpointRows = await runUpdateBatches(database, CHECKPOINT_METADATA_BACKFILL_SQL, batchSize);
  await finalizeSnapshotColumns(database);
  const backfilledHeadRows = await backfillRecoveryHeads(database, batchSize);
  await ensureSnapshotMaintenanceSchema(database);
  await ensureSnapshotIndexes(database);
  await markPreparedMigrationApplied(database);

  const result = {
    alreadyApplied: false,
    updatedHeadRows,
    updatedCheckpointRows,
    backfilledHeadRows
  };
  log(
    `[snapshot-migration] status=prepared headTicks=${updatedHeadRows} ` +
    `checkpointRows=${updatedCheckpointRows} backfilledHeads=${backfilledHeadRows}`
  );
  return result;
};

const assertPrerequisites = async (database: PostgresDatabase): Promise<boolean> =>
  database.transaction(async (client) => {
    await client.query("SET LOCAL lock_timeout = '5s'");
    await acquireMigrationLock(client);
    await ensureHistoryTable(client);
    const history = await client.query<MigrationRow>(
      "SELECT filename, checksum FROM empire_schema_migrations ORDER BY filename"
    );
    const applied = new Map(history.rows.map((row) => [row.filename, row.checksum]));
    const targetIndex = PRODUCTION_MIGRATION_CONTRACT.findIndex(([filename]) =>
      filename === SNAPSHOT_RECOVERY_MIGRATION);
    const target = PRODUCTION_MIGRATION_CONTRACT[targetIndex];
    if (!target) throw new Error("Snapshot recovery migration is absent from the production contract.");
    const appliedTarget = applied.get(target[0]);
    if (appliedTarget) {
      if (appliedTarget !== target[1]) throw new Error(`Database migration checksum mismatch: ${target[0]}.`);
      return true;
    }
    for (const [filename, checksum] of PRODUCTION_MIGRATION_CONTRACT.slice(0, targetIndex)) {
      if (applied.get(filename) !== checksum) {
        throw new Error(
          `Controlled snapshot recovery requires migration ${filename} with its production checksum.`
        );
      }
    }
    return false;
  });

const prepareSnapshotColumns = (database: PostgresDatabase): Promise<void> =>
  runMigrationTransaction(database, async (client) => {
    await client.query(`
      ALTER TABLE empire_snapshot_latest
        ADD COLUMN IF NOT EXISTS tick integer;
      ALTER TABLE empire_snapshot_latest
        ALTER COLUMN tick SET DEFAULT 0;
      ALTER TABLE empire_snapshots
        ADD COLUMN IF NOT EXISTS checkpoint_kind text,
        ADD COLUMN IF NOT EXISTS reason_code text,
        ADD COLUMN IF NOT EXISTS lifecycle_phase text,
        ADD COLUMN IF NOT EXISTS is_protected boolean;
      ALTER TABLE empire_snapshots
        ALTER COLUMN checkpoint_kind SET DEFAULT 'legacy-checkpoint',
        ALTER COLUMN reason_code SET DEFAULT 'legacy-snapshot-backfill',
        ALTER COLUMN is_protected SET DEFAULT false;
    `);
  });

const runUpdateBatches = async (
  database: PostgresDatabase,
  sql: string,
  batchSize: number
): Promise<number> => {
  let total = 0;
  while (true) {
    const updated = await runMigrationTransaction(database, async (client) => {
      const result = await client.query(sql, [batchSize]);
      return result.rowCount ?? result.rows.length;
    });
    total += updated;
    if (updated < batchSize) return total;
  }
};

const finalizeSnapshotColumns = (database: PostgresDatabase): Promise<void> =>
  runMigrationTransaction(database, async (client) => {
    await client.query(SNAPSHOT_CONSTRAINTS_SQL);
  });

const backfillRecoveryHeads = async (
  database: PostgresDatabase,
  batchSize: number
): Promise<number> => {
  let cursor = "";
  let inserted = 0;
  while (true) {
    const batch = await runMigrationTransaction(database, async (client) => {
      const instances = await client.query<{ server_instance_id: string }>(
        `SELECT DISTINCT server_instance_id
         FROM empire_snapshots
         WHERE server_instance_id > $1
         ORDER BY server_instance_id
         LIMIT $2`,
        [cursor, batchSize]
      );
      const instanceIds = instances.rows.map((row) => row.server_instance_id);
      if (instanceIds.length === 0) return { instanceIds, inserted: 0 };
      const result = await client.query(RECOVERY_HEAD_BACKFILL_SQL, [instanceIds]);
      return { instanceIds, inserted: result.rowCount ?? result.rows.length };
    });
    inserted += batch.inserted;
    if (batch.instanceIds.length === 0) return inserted;
    cursor = batch.instanceIds.at(-1)!;
  }
};

const ensureSnapshotMaintenanceSchema = (database: PostgresDatabase): Promise<void> =>
  runMigrationTransaction(database, async (client) => {
    await client.query(SNAPSHOT_MAINTENANCE_SQL);
  });

const ensureSnapshotIndexes = async (database: PostgresDatabase): Promise<void> => {
  await recreateInvalidIndex(database, "empire_snapshots_instance_kind_created_idx");
  await database.query(
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS empire_snapshots_instance_kind_created_idx
     ON empire_snapshots (server_instance_id, checkpoint_kind, created_at DESC)`
  );
  await recreateInvalidIndex(database, "empire_snapshots_cleanup_idx");
  await database.query(
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS empire_snapshots_cleanup_idx
     ON empire_snapshots (checkpoint_kind, is_protected, created_at, server_instance_id)`
  );
};

const recreateInvalidIndex = async (database: PostgresDatabase, indexName: string): Promise<void> => {
  const result = await database.query<{ valid: boolean }>(
    `SELECT index.indisvalid AS valid
     FROM pg_class relation
     JOIN pg_index index ON index.indexrelid = relation.oid
     WHERE relation.oid = to_regclass($1)`,
    [indexName]
  );
  if (result.rows[0]?.valid === false) {
    await database.query(`DROP INDEX CONCURRENTLY IF EXISTS ${indexName}`);
  }
};

const markPreparedMigrationApplied = (database: PostgresDatabase): Promise<void> =>
  runMigrationTransaction(database, async (client) => {
    const verification = await client.query<{ ready: boolean }>(PREPARATION_VERIFICATION_SQL);
    if (verification.rows[0]?.ready !== true) {
      throw new Error("Controlled snapshot recovery preparation did not pass final verification.");
    }
    const target = PRODUCTION_MIGRATION_CONTRACT.find(([filename]) =>
      filename === SNAPSHOT_RECOVERY_MIGRATION)!;
    await client.query(
      `INSERT INTO empire_schema_migrations (filename, checksum, applied_at)
       VALUES ($1, $2, now())
       ON CONFLICT (filename) DO NOTHING`,
      target
    );
    const recorded = await client.query<{ checksum: string }>(
      "SELECT checksum FROM empire_schema_migrations WHERE filename = $1",
      [target[0]]
    );
    if (recorded.rows[0]?.checksum !== target[1]) {
      throw new Error(`Database migration checksum mismatch: ${target[0]}.`);
    }
  });

const runMigrationTransaction = <TResult>(
  database: PostgresDatabase,
  callback: (client: PostgresQueryable) => Promise<TResult>
): Promise<TResult> => database.transaction(async (client) => {
  await client.query("SET LOCAL lock_timeout = '5s'");
  await acquireMigrationLock(client);
  return callback(client);
});

const positiveBatchSize = (value: number | undefined): number =>
  Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : DEFAULT_BATCH_SIZE;

const emptyResult = (alreadyApplied: boolean): ControlledSnapshotRecoveryMigrationResult => ({
  alreadyApplied,
  updatedHeadRows: 0,
  updatedCheckpointRows: 0,
  backfilledHeadRows: 0
});

interface MigrationRow extends QueryResultRow {
  filename: string;
  checksum: string;
}
