import { describe, expect, it } from "vitest";
import {
  createPostgresAdminMonitoringRepository,
  resolveAdminDurableRepositories
} from "../../apps/server/src/admin/read-only";
import type { PostgresQueryable } from "../../apps/server/src/runtime/persistence/postgres";

describe("Postgres admin monitoring repository", () => {
  it("keeps a durable instance visible without a worker or snapshot", async () => {
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const database = fakeDatabase(calls);
    const repository = createPostgresAdminMonitoringRepository(database, () => new Date("2026-07-16T10:00:00.000Z"));

    const overview = await repository.listKnownInstances();
    expect(overview).toEqual([expect.objectContaining({
      serverInstanceId: "server:offline", displayName: "Offline durable", workerStatus: "no-worker", playerCount: 0
    })]);
    const detail = await repository.getInstanceRuntimeProjection("server:offline");
    expect(detail).toMatchObject({ serverInstanceId: "server:offline", runtimeAvailable: false });
    expect(detail?.players).toEqual([]);
    expect(detail?.economy.serverInstanceId).toBe("server:offline");
    expect(detail?.snapshot).toMatchObject({
      rollingCheckpointCount: 0,
      lifecycleCheckpointCount: 0,
      terminalCheckpointCount: 0,
      lastCleanupStatus: "unavailable",
      storageHealth: "unavailable"
    });
    expect(calls.filter((call) => call.values.length > 0).every((call) => call.values[0] === "server:offline")).toBe(true);
  });

  it("exposes recovery head, checkpoint retention, and cleanup health without snapshot payload access", async () => {
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const database = fakeDatabase(calls, {
      snapshotPayload: {
        snapshotId: "snapshot:head:42",
        createdAt: "2026-07-16T10:19:50.000Z",
        tick: 42,
        integrity: { rootVersion: 77 },
        version: { schemaVersion: 3 }
      },
      storageRow: {
        last_checkpoint_at: "2026-07-16T10:15:00.000Z",
        rolling_checkpoint_count: "24",
        lifecycle_checkpoint_count: "3",
        terminal_checkpoint_count: "1",
        last_cleanup_at: "2026-07-16T10:10:00.000Z",
        last_cleanup_status: "success"
      }
    });
    const repository = createPostgresAdminMonitoringRepository(
      database,
      () => new Date("2026-07-16T10:20:00.000Z")
    );

    await expect(repository.getSnapshotMetadata("server:offline")).resolves.toMatchObject({
      snapshotId: "snapshot:head:42",
      tick: 42,
      stateVersion: 77,
      lastCheckpointAt: "2026-07-16T10:15:00.000Z",
      rollingCheckpointCount: 24,
      lifecycleCheckpointCount: 3,
      terminalCheckpointCount: 1,
      lastCleanupAt: "2026-07-16T10:10:00.000Z",
      lastCleanupStatus: "success",
      storageHealth: "healthy"
    });
    const storageQuery = calls.find((call) => call.sql.includes("rolling_checkpoint_count"));
    expect(storageQuery?.sql).toContain("checkpoint_kind = 'lifecycle-checkpoint'");
    expect(storageQuery?.sql).toContain("empire_snapshot_maintenance");
    expect(storageQuery?.values).toEqual(["server:offline"]);
  });

  it("rejects in-memory repositories in production", () => {
    expect(resolveAdminDurableRepositories({ NODE_ENV: "production" }).accepted).toBe(false);
    expect(resolveAdminDurableRepositories({ NODE_ENV: "test" }).accepted).toBe(true);
  });
});

const fakeDatabase = (
  calls: Array<{ sql: string; values: readonly unknown[] }>,
  options: {
    snapshotPayload?: Record<string, unknown>;
    storageRow?: Record<string, unknown>;
  } = {}
): PostgresQueryable => ({
  query: async <TRow extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) => {
    calls.push({ sql, values });
    if (sql.includes("FROM empire_server_instances")) return result<TRow>([{
      server_instance_id: "server:offline", mode: "free", status: "paused",
      payload: { displayName: "Offline durable", region: "eu-central", capacity: 20, joinPolicy: "closed" },
      snapshot_payload: null, snapshot_created_at: null, heartbeat_at: null, lock_owner: null, locked_until: null, last_error_at: null
    }]);
    if (sql.includes("rolling_checkpoint_count")) {
      return result<TRow>(options.storageRow ? [options.storageRow] : []);
    }
    if (sql.includes("SELECT payload FROM empire_snapshot_latest")) {
      return result<TRow>(options.snapshotPayload ? [{ payload: options.snapshotPayload }] : []);
    }
    return result<TRow>([]);
  }
});

const result = <TRow extends Record<string, unknown>>(rows: Array<Record<string, unknown>>) => ({
  rows: rows as TRow[], rowCount: rows.length, command: "SELECT", oid: 0, fields: []
});
