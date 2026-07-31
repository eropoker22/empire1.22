import { describe, expect, it } from "vitest";
import { copyFreeHostedStartingPlayerState } from "@empire/game-config";
import {
  createPostgresAdminMonitoringRepository,
  resolveAdminDurableRepositories
} from "../../apps/server/src/admin/read-only";
import type { PostgresQueryable } from "../../apps/server/src/runtime/persistence/postgres";
import { createCoreStateFixture } from "../fixtures/game-state-fixtures";

describe("Postgres admin monitoring repository", () => {
  it("keeps a durable instance visible without a worker or snapshot", async () => {
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const database = fakeDatabase(calls);
    const repository = createPostgresAdminMonitoringRepository(database, () => new Date("2026-07-16T10:00:00.000Z"));

    const overview = await repository.listKnownInstances();
    expect(overview).toEqual([expect.objectContaining({
      serverInstanceId: "server:offline", displayName: "Offline durable", workerStatus: "no-worker", playerCount: 0,
      snapshotStale: false,
      freshness: expect.objectContaining({ stale: false, staleReason: null })
    })]);
    const detail = await repository.getInstanceRuntimeProjection("server:offline");
    expect(detail).toMatchObject({ serverInstanceId: "server:offline", runtimeAvailable: false });
    expect(detail?.runtimeHealth).toMatchObject({
      lifecycleStatus: "paused",
      runtimeActive: { status: "not-applicable", reasonCode: "runtime-not-required-paused" },
      tickAdvancing: { status: "not-applicable", reasonCode: "tick-not-required-paused" },
      snapshotCurrent: { status: "fail", reasonCode: "recovery-head-missing" },
      commandsAccepted: { status: "not-applicable", reasonCode: "commands-not-accepted-paused" }
    });
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

  it("marks an invalid hosted starting state failed and closed in admin summaries", async () => {
    const repository = createPostgresAdminMonitoringRepository(
      fakeDatabase([], { startingPlayerState: null }),
      () => new Date("2026-07-16T10:00:00.000Z")
    );

    await expect(repository.listKnownInstances()).resolves.toEqual([
      expect.objectContaining({
        serverInstanceId: "server:offline",
        status: "failed",
        joinPolicy: "closed"
      })
    ]);
  });

  it("keeps tick health pending until a later repository observation proves progress", async () => {
    let now = new Date("2026-07-31T10:00:00.000Z");
    let tick = 10;
    let stateVersion = 100;
    const database = runningDatabase(() => ({
      now: now.toISOString(),
      tick,
      stateVersion
    }));
    const repository = createPostgresAdminMonitoringRepository(database, () => now);

    const first = await repository.getInstanceRuntimeProjection("server:running");
    expect(first?.runtimeHealth?.tickAdvancing).toMatchObject({
      status: "pending",
      reasonCode: "tick-observation-first-sample"
    });

    now = new Date("2026-07-31T10:00:10.000Z");
    tick = 11;
    stateVersion = 101;
    const second = await repository.getInstanceRuntimeProjection("server:running");
    expect(second?.runtimeHealth?.tickAdvancing).toMatchObject({
      status: "pass",
      reasonCode: "tick-advance-two-sample",
      observedAt: "2026-07-31T10:00:10.000Z"
    });
  });

  it("expires an old applied command without probing or mutating the running instance", async () => {
    let now = new Date("2026-07-31T10:00:00.000Z");
    let tick = 20;
    let stateVersion = 200;
    const lastAppliedCommandAt = "2026-07-31T09:59:50.000Z";
    const database = runningDatabase(() => ({
      now: now.toISOString(),
      tick,
      stateVersion,
      lastAppliedCommandAt
    }));
    const repository = createPostgresAdminMonitoringRepository(database, () => now);

    const recent = await repository.getInstanceRuntimeProjection("server:running");
    expect(recent?.runtimeHealth?.commandsAccepted).toEqual({
      status: "pass",
      reasonCode: "recent-applied-command-observed",
      observedAt: lastAppliedCommandAt
    });

    now = new Date("2026-07-31T10:00:31.000Z");
    tick = 21;
    stateVersion = 201;
    const stale = await repository.getInstanceRuntimeProjection("server:running");
    expect(stale?.runtimeHealth?.commandsAccepted).toEqual({
      status: "pending",
      reasonCode: "applied-command-observation-stale",
      observedAt: lastAppliedCommandAt
    });
  });
});

const fakeDatabase = (
  calls: Array<{ sql: string; values: readonly unknown[] }>,
  options: {
    snapshotPayload?: Record<string, unknown>;
    storageRow?: Record<string, unknown>;
    startingPlayerState?: unknown;
  } = {}
): PostgresQueryable => ({
  query: async <TRow extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) => {
    calls.push({ sql, values });
    if (sql.includes("FROM empire_server_instances")) return result<TRow>([{
      server_instance_id: "server:offline", mode: "free", status: "paused",
      payload: { displayName: "Offline durable", region: "eu-central", capacity: 20, joinPolicy: "closed" },
      snapshot_payload: null, snapshot_created_at: null, heartbeat_at: null, lock_owner: null, locked_until: null,
      last_error_at: null,
      hosted_starting_player_state: Object.hasOwn(options, "startingPlayerState")
        ? options.startingPlayerState
        : copyFreeHostedStartingPlayerState()
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

const runningDatabase = (
  current: () => {
    now: string;
    tick: number;
    stateVersion: number;
    lastAppliedCommandAt?: string | null;
  }
): PostgresQueryable => ({
  query: async <TRow extends Record<string, unknown>>(sql: string) => {
    const value = current();
    const snapshot = runningSnapshot(value);
    if (sql.includes("FROM empire_server_instances si")) {
      return result<TRow>([{
        server_instance_id: "server:running",
        mode: "free",
        status: "running",
        payload: {
          displayName: "Running durable",
          region: "eu-central",
          capacity: 20,
          joinPolicy: "closed"
        },
        snapshot_payload: snapshot,
        snapshot_created_at: value.now,
        heartbeat_at: value.now,
        lock_owner: "worker:running",
        lease_incarnation_id: "worker-incarnation:running",
        locked_until: new Date(Date.parse(value.now) + 60_000).toISOString(),
        heartbeat_worker_id: "worker:running",
        heartbeat_worker_incarnation_id: "worker-incarnation:running",
        last_error_at: null,
        hosted_display_name: "Running durable",
        hosted_region: "eu-central",
        hosted_capacity: 20,
        hosted_join_policy: "closed",
        hosted_status: "running",
        hosted_starting_player_state: copyFreeHostedStartingPlayerState(),
        canonical_tick_rate_ms: 10_000
      }]);
    }
    if (sql.includes("SELECT payload FROM empire_snapshot_latest")) {
      return result<TRow>([{ payload: snapshot }]);
    }
    if (sql.includes("SELECT hsi.canonical_tick_rate_ms")) {
      return result<TRow>([{
        canonical_tick_rate_ms: 10_000,
        last_started_at: "2026-07-31T09:55:00.000Z",
        last_tick: value.tick,
        last_snapshot_at: value.now,
        last_error_code: null,
        last_applied_command_at: value.lastAppliedCommandAt ?? null,
        instance_worker_id: "worker:running",
        instance_worker_incarnation_id: "worker-incarnation:running",
        runtime_lease_incarnation_id: "worker-incarnation:running"
      }]);
    }
    if (sql.includes("rolling_checkpoint_count")) {
      return result<TRow>([{
        last_checkpoint_at: value.now,
        rolling_checkpoint_count: 1,
        lifecycle_checkpoint_count: 1,
        terminal_checkpoint_count: 0,
        last_cleanup_at: value.now,
        last_cleanup_status: "success"
      }]);
    }
    return result<TRow>([]);
  }
});

const runningSnapshot = (input: {
  now: string;
  tick: number;
  stateVersion: number;
}) => {
  const state = createCoreStateFixture("server:running");
  state.root.tick = input.tick;
  state.root.version = input.stateVersion;
  return {
    snapshotId: `snapshot:server:running:${input.tick}:${input.stateVersion}`,
    instanceId: "server:running",
    createdAt: input.now,
    tick: input.tick,
    mode: "free",
    metadata: {
      instanceId: "server:running",
      mode: "free",
      configKey: "free",
      status: "running",
      createdAt: "2026-07-31T09:50:00.000Z",
      startedAt: "2026-07-31T09:55:00.000Z",
      stoppedAt: null,
      crashCount: 0,
      lastCrashAt: null,
      version: 1
    },
    version: {
      schemaVersion: 3,
      coreVersion: "test",
      configVersion: "test"
    },
    integrity: {
      entityCounts: {},
      rootVersion: input.stateVersion
    },
    runtime: {
      processedCommandIds: [],
      commandRateLimitWindow: {
        tick: input.tick,
        commandCountsByPlayerId: {}
      }
    },
    state
  };
};
