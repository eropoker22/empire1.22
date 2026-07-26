import type {
  QueryResult,
  QueryResultRow
} from "pg";
import { describe, expect, it } from "vitest";
import { prepareSnapshotRecoveryMigrationControlled } from
  "../../apps/server/src/runtime/persistence/postgres/controlled-snapshot-recovery-migration";
import {
  SNAPSHOT_RECOVERY_ONLINE_ROW_LIMIT,
  SnapshotRecoveryMigrationOnlineSafetyError,
  assertSnapshotRecoveryMigrationCanRunOnline
} from "../../apps/server/src/runtime/persistence/postgres/migration-runner";
import type {
  PostgresDatabase,
  PostgresQueryable
} from "../../apps/server/src/runtime/persistence/postgres/postgres-client";
import { PRODUCTION_MIGRATION_CONTRACT } from
  "../../apps/server/src/runtime/persistence/postgres/production-migration-contract";

describe("controlled snapshot recovery migration", () => {
  it("backfills legacy rows in bounded retryable batches before recording migration 017", async () => {
    const database = new ControlledMigrationDatabase();

    await expect(prepareSnapshotRecoveryMigrationControlled(database, {
      batchSize: 2,
      log: () => undefined
    })).resolves.toEqual({
      alreadyApplied: false,
      updatedHeadRows: 3,
      updatedCheckpointRows: 5,
      backfilledHeadRows: 3
    });

    expect(database.batchSizes).toEqual([2, 2, 2, 2, 2]);
    expect(database.instanceCursors).toEqual(["", "instance:b", "instance:c"]);
    expect(database.createdConcurrentIndexes).toEqual([
      "empire_snapshots_instance_kind_created_idx",
      "empire_snapshots_cleanup_idx"
    ]);
    expect(database.recordedMigration).toBe("017_snapshot_recovery_heads_and_checkpoints.sql");
  });

  it("is idempotent after the canonical migration checksum is recorded", async () => {
    const database = new ControlledMigrationDatabase(true);

    await expect(prepareSnapshotRecoveryMigrationControlled(database, {
      batchSize: 2,
      log: () => undefined
    })).resolves.toMatchObject({ alreadyApplied: true });

    expect(database.schemaMutationCount).toBe(0);
  });

  it("keeps the normal path fail-closed for any existing legacy snapshot history", async () => {
    const database = queryable([{
      has_snapshot_history: true,
      has_recovery_head: false,
      exceeds_safe_limit: false
    }]);

    await expect(assertSnapshotRecoveryMigrationCanRunOnline(database))
      .rejects.toMatchObject({
        name: SnapshotRecoveryMigrationOnlineSafetyError.name,
        safeCode: "SNAPSHOT_RECOVERY_MIGRATION_REQUIRES_CONTROLLED_ROLLOUT"
      });
    expect(SNAPSHOT_RECOVERY_ONLINE_ROW_LIMIT).toBe(50_000);
  });

  it("keeps the normal path fail-closed for an existing recovery head without history", async () => {
    const database = queryable([{
      has_snapshot_history: false,
      has_recovery_head: true,
      exceeds_safe_limit: false
    }]);

    await expect(assertSnapshotRecoveryMigrationCanRunOnline(database))
      .rejects.toMatchObject({
        safeCode: "SNAPSHOT_RECOVERY_MIGRATION_REQUIRES_CONTROLLED_ROLLOUT"
      });
  });

  it("keeps the normal path available for an empty database", async () => {
    const database = queryable([{
      has_snapshot_history: false,
      has_recovery_head: false,
      exceeds_safe_limit: false
    }]);

    await expect(assertSnapshotRecoveryMigrationCanRunOnline(database)).resolves.toBeUndefined();
  });
});

class ControlledMigrationDatabase implements PostgresDatabase {
  readonly batchSizes: number[] = [];
  readonly instanceCursors: string[] = [];
  readonly createdConcurrentIndexes: string[] = [];
  recordedMigration: string | null = null;
  schemaMutationCount = 0;
  private headBatch = 0;
  private checkpointBatch = 0;

  constructor(private readonly migrationApplied = false) {}

  async query<TRow extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: readonly unknown[] = []
  ): Promise<QueryResult<TRow>> {
    const compact = sql.replace(/\s+/gu, " ").trim();
    if (compact.includes("SELECT filename, checksum FROM empire_schema_migrations")) {
      const targetIndex = PRODUCTION_MIGRATION_CONTRACT.findIndex(([filename]) =>
        filename.startsWith("017_"));
      const rows = PRODUCTION_MIGRATION_CONTRACT.slice(0, targetIndex)
        .concat(this.migrationApplied ? [PRODUCTION_MIGRATION_CONTRACT[targetIndex]!] : [])
        .map(([filename, checksum]) => ({ filename, checksum }));
      return result(rows);
    }
    if (compact.startsWith("CREATE TABLE IF NOT EXISTS empire_schema_migrations")) {
      return result([]);
    }
    if (compact.startsWith("WITH batch AS ( SELECT ctid FROM empire_snapshot_latest")) {
      this.batchSizes.push(Number(params[0]));
      const rowCount = [2, 1][this.headBatch++] ?? 0;
      return result([], rowCount);
    }
    if (compact.startsWith("WITH batch AS ( SELECT ctid FROM empire_snapshots")) {
      this.batchSizes.push(Number(params[0]));
      const rowCount = [2, 2, 1][this.checkpointBatch++] ?? 0;
      return result([], rowCount);
    }
    if (compact.startsWith("SELECT DISTINCT server_instance_id FROM empire_snapshots")) {
      const cursor = String(params[0]);
      this.instanceCursors.push(cursor);
      const rows = cursor === ""
        ? [{ server_instance_id: "instance:a" }, { server_instance_id: "instance:b" }]
        : cursor === "instance:b"
          ? [{ server_instance_id: "instance:c" }]
          : [];
      return result(rows);
    }
    if (compact.startsWith("INSERT INTO empire_snapshot_latest")) {
      return result([], (params[0] as string[]).length);
    }
    if (compact.startsWith("CREATE INDEX CONCURRENTLY")) {
      const indexName = compact.match(/IF NOT EXISTS ([a-z0-9_]+)/u)?.[1] ?? "";
      this.createdConcurrentIndexes.push(indexName);
      this.schemaMutationCount += 1;
      return result([]);
    }
    if (compact.startsWith("SELECT index.indisvalid AS valid")) {
      return result([{ valid: true }]);
    }
    if (compact.includes("AS ready")) {
      return result([{ ready: true }]);
    }
    if (compact.startsWith("INSERT INTO empire_schema_migrations")) {
      this.recordedMigration = String(params[0]);
      return result([]);
    }
    if (compact.startsWith("SELECT checksum FROM empire_schema_migrations")) {
      const target = PRODUCTION_MIGRATION_CONTRACT.find(([filename]) => filename === params[0])!;
      return result([{ checksum: target[1] }]);
    }
    if (
      compact.startsWith("ALTER TABLE") ||
      compact.startsWith("CREATE TABLE") ||
      compact.startsWith("INSERT INTO empire_snapshot_maintenance")
    ) {
      this.schemaMutationCount += 1;
      return result([]);
    }
    return result([]);
  }

  async transaction<TResult>(
    callback: (client: PostgresQueryable) => Promise<TResult>
  ): Promise<TResult> {
    return callback(this);
  }

  async close(): Promise<void> {
    return;
  }
}

const queryable = (rows: QueryResultRow[]): PostgresQueryable => ({
  query: async <TRow extends QueryResultRow = QueryResultRow>() =>
    result(rows) as QueryResult<TRow>
});

const result = <TRow extends QueryResultRow>(
  rows: QueryResultRow[],
  rowCount = rows.length
): QueryResult<TRow> => ({
  command: "",
  rowCount,
  oid: 0,
  fields: [],
  rows: rows as TRow[]
});
