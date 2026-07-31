import { describe, expect, it, vi } from "vitest";
import {
  FREE_HOSTED_STARTING_MATERIAL_IDS,
  copyFreeHostedStartingPlayerState
} from "@empire/game-config";
import type { HostedStartingPlayerStateView } from "@empire/shared-types";
import {
  insertServer,
  loadCreateReplay,
  mapServer
} from "../../apps/server/src/admin/hosted/postgres-hosted-control-plane-helpers";
import { createPostgresHostedControlPlaneRepository } from "../../apps/server/src/admin/hosted/postgres-hosted-control-plane-repository";
import type { HostedServerRecord } from "../../apps/server/src/admin/hosted/hosted-control-plane-repository";
import type {
  PostgresDatabase,
  PostgresQueryable
} from "../../apps/server/src/runtime/persistence/postgres";

const NOW = "2026-07-31T10:00:00.000Z";

describe("hosted starting player state persistence", () => {
  it("writes every configured number to the JSONB parameter including zero", async () => {
    const startingPlayerState = distinctiveStartingPlayerState();
    const queryMock = vi.fn(async (_sql: string, _parameters?: readonly unknown[]) => pgRows([]));
    const database = { query: queryMock as unknown as PostgresQueryable["query"] };

    await insertServer(database, server({ startingPlayerState }));

    const parameters = queryMock.mock.calls[0]?.[1];
    if (!parameters) throw new Error("Expected the INSERT parameters.");
    const persisted = JSON.parse(String(parameters.at(-1))) as HostedStartingPlayerStateView;
    expect(persisted).toEqual(startingPlayerState);
    expect(persisted.cleanCash).toBe(0);
    expect(persisted.materials.chemicals).toBe(0);
    expect(Object.keys(persisted.materials)).toEqual(FREE_HOSTED_STARTING_MATERIAL_IDS);
  });

  it("maps shuffled JSONB keys back to the canonical order without changing values", () => {
    const expected = distinctiveStartingPlayerState();
    const shuffled = {
      ...expected,
      materials: Object.fromEntries(
        [...FREE_HOSTED_STARTING_MATERIAL_IDS].reverse()
          .map((materialId) => [materialId, expected.materials[materialId]])
      )
    };

    const mapped = mapServer(postgresServerRow(server(), JSON.stringify(shuffled)));

    expect(mapped.startingPlayerState).toEqual(expected);
    expect(Object.keys(mapped.startingPlayerState!.materials)).toEqual(FREE_HOSTED_STARTING_MATERIAL_IDS);
  });

  it("marks a numeric-string legacy state incompatible without substituting defaults", () => {
    const invalid = {
      ...distinctiveStartingPlayerState(),
      cleanCash: "0"
    };

    const mapped = mapServer(postgresServerRow(server(), invalid));
    expect(mapped).toMatchObject({
      status: "failed",
      joinPolicy: "closed",
      provisioningState: "failed",
      lastErrorCode: "HOSTED_STARTING_PLAYER_STATE_LEGACY_INVALID"
    });
    expect(mapped.startingPlayerState).toBeUndefined();
  });

  it("marks a missing legacy state incompatible without substituting defaults", () => {
    const mapped = mapServer(postgresServerRow(server(), null));

    expect(mapped).toMatchObject({
      status: "failed",
      joinPolicy: "closed",
      provisioningState: "failed",
      lastErrorCode: "HOSTED_STARTING_PLAYER_STATE_LEGACY_INVALID"
    });
    expect(mapped.startingPlayerState).toBeUndefined();
  });

  it("keeps the full server list readable when one legacy row is invalid", async () => {
    const rows = [
      postgresServerRow(server({ serverInstanceId: "instance:valid" }), distinctiveStartingPlayerState()),
      postgresServerRow(server({ serverInstanceId: "instance:invalid" }), "{invalid-json")
    ];
    const queryMock = vi.fn(async () => pgRows(rows));
    const database = {
      query: queryMock as unknown as PostgresDatabase["query"],
      transaction: async () => {
        throw new Error("Transaction is not used by this read.");
      },
      close: async () => undefined
    } as PostgresDatabase;
    const repository = createPostgresHostedControlPlaneRepository(database);

    const servers = await repository.listServers();

    expect(servers).toHaveLength(2);
    expect(servers[0]).toMatchObject({
      serverInstanceId: "instance:valid",
      provisioningState: "ready",
      startingPlayerState: distinctiveStartingPlayerState()
    });
    expect(servers[1]).toMatchObject({
      serverInstanceId: "instance:invalid",
      status: "failed",
      joinPolicy: "closed",
      provisioningState: "failed",
      lastErrorCode: "HOSTED_STARTING_PLAYER_STATE_LEGACY_INVALID"
    });
    expect(servers[1]?.startingPlayerState).toBeUndefined();
  });

  it("keeps an invalid legacy row failed and closed during create replay", async () => {
    const hosted = server();
    const rows = [
      pgRows([{
        request_hash: "request-hash",
        resource_id: hosted.serverInstanceId,
        response_payload: {
          status: "lobby",
          provisioningState: "ready",
          joinPolicy: "open",
          version: 1,
          updatedAt: NOW,
          jobId: "job:starting-state"
        }
      }]),
      pgRows([postgresServerRow(hosted, null)]),
      pgRows([{
        job_id: "job:starting-state",
        server_instance_id: hosted.serverInstanceId,
        attempt: 0,
        status: "completed",
        available_at: NOW,
        claimed_by_worker_id: null,
        claimed_until: null,
        last_error_code: null,
        created_at: NOW,
        updated_at: NOW,
        version: 1
      }])
    ];
    const database = {
      query: vi.fn(async () => rows.shift() ?? pgRows([])) as unknown as PostgresQueryable["query"]
    };

    const replay = await loadCreateReplay(database, "admin:owner", "create:key", "request-hash");

    expect(replay).toMatchObject({
      kind: "replayed",
      server: {
        status: "failed",
        joinPolicy: "closed",
        provisioningState: "failed",
        lastErrorCode: "HOSTED_STARTING_PLAYER_STATE_LEGACY_INVALID"
      }
    });
  });
});

const distinctiveStartingPlayerState = (): HostedStartingPlayerStateView => ({
  cleanCash: 0,
  dirtyCash: 23_456,
  population: 345,
  spySlots: 2,
  materials: Object.fromEntries(
    FREE_HOSTED_STARTING_MATERIAL_IDS.map((materialId, index) => [materialId, index * 137])
  ) as HostedStartingPlayerStateView["materials"]
});

const server = (overrides: Partial<HostedServerRecord> = {}): HostedServerRecord => ({
  serverInstanceId: "instance:starting-state-persistence",
  mode: "free",
  serverTemplate: "control",
  displayName: "Starting State Persistence",
  region: "eu-central",
  capacity: 2,
  status: "lobby",
  joinPolicy: "closed",
  provisioningState: "ready",
  minimumReadyPlayersToStart: 1,
  registrationWindowMinutes: 60,
  registrationScheduleVersion: 0,
  registrationOpensAt: null,
  registrationClosesAt: null,
  registrationClosedAt: null,
  registrationBaselinePlayers: null,
  canonicalFinalLockdownTrigger: null,
  canonicalFirstEliminationTick: null,
  canonicalTickRateMs: null,
  effectiveFinalLockdownTrigger: null,
  effectiveFirstEliminationTick: null,
  worldSeed: "starting-state-seed",
  configVersion: 1,
  mapComposition: {
    downtown: 8,
    commercial: 40,
    residential: 38,
    industrial: 38,
    park: 37
  },
  startingPlayerState: copyFreeHostedStartingPlayerState(),
  initialSnapshotId: "snapshot:initial",
  currentSnapshotId: "snapshot:initial",
  runtimeLeaseOwnerId: null,
  runtimeLeaseExpiresAt: null,
  lastWorkerHeartbeatAt: null,
  lastStartedAt: null,
  lastPausedAt: null,
  lastStoppedAt: null,
  lastErrorCode: null,
  createdByAdminUserId: "admin:owner",
  createdAt: NOW,
  updatedAt: NOW,
  version: 1,
  ...overrides
});

const postgresServerRow = (
  hosted: HostedServerRecord,
  startingPlayerState: unknown
): Record<string, unknown> => ({
  server_instance_id: hosted.serverInstanceId,
  mode: hosted.mode,
  server_template: hosted.serverTemplate,
  display_name: hosted.displayName,
  region: hosted.region,
  capacity: hosted.capacity,
  status: hosted.status,
  join_policy: hosted.joinPolicy,
  provisioning_state: hosted.provisioningState,
  minimum_ready_players_to_start: hosted.minimumReadyPlayersToStart,
  registration_window_minutes: hosted.registrationWindowMinutes,
  registration_schedule_version: hosted.registrationScheduleVersion,
  registration_opens_at: hosted.registrationOpensAt,
  registration_closes_at: hosted.registrationClosesAt,
  registration_closed_at: hosted.registrationClosedAt,
  registration_baseline_players: hosted.registrationBaselinePlayers,
  canonical_final_lockdown_trigger: hosted.canonicalFinalLockdownTrigger,
  canonical_first_elimination_tick: hosted.canonicalFirstEliminationTick,
  canonical_tick_rate_ms: hosted.canonicalTickRateMs,
  effective_final_lockdown_trigger: hosted.effectiveFinalLockdownTrigger,
  effective_first_elimination_tick: hosted.effectiveFirstEliminationTick,
  world_seed: hosted.worldSeed,
  config_version: hosted.configVersion,
  map_composition: hosted.mapComposition,
  starting_player_state: startingPlayerState,
  initial_snapshot_id: hosted.initialSnapshotId,
  current_snapshot_id: hosted.currentSnapshotId,
  runtime_lease_owner_id: hosted.runtimeLeaseOwnerId,
  runtime_lease_expires_at: hosted.runtimeLeaseExpiresAt,
  last_worker_heartbeat_at: hosted.lastWorkerHeartbeatAt,
  last_started_at: hosted.lastStartedAt,
  last_paused_at: hosted.lastPausedAt,
  last_stopped_at: hosted.lastStoppedAt,
  last_error_code: hosted.lastErrorCode,
  created_by_admin_user_id: hosted.createdByAdminUserId,
  created_at: hosted.createdAt,
  updated_at: hosted.updatedAt,
  version: hosted.version
});

const pgRows = (rows: Record<string, unknown>[]) => ({
  rows,
  rowCount: rows.length,
  command: "",
  oid: 0,
  fields: []
});
