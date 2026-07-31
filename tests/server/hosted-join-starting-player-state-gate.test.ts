import { describe, expect, it, vi } from "vitest";
import { FREE_HOSTED_STARTING_MATERIAL_IDS } from "@empire/game-config";
import type {
  HostedJoinJobRecord,
  HostedJoinReservationRecord
} from "../../apps/server/src/admin/hosted";
import { createPostgresHostedControlPlaneRepository } from
  "../../apps/server/src/admin/hosted/postgres-hosted-control-plane-repository";
import type {
  PostgresDatabase,
  PostgresQueryable
} from "../../apps/server/src/runtime/persistence/postgres";

const NOW = "2026-07-20T16:30:00.000Z";

describe("postgres hosted join starting-state gate", () => {
  it.each([
    ["null", null],
    ["malformed JSON", "{invalid-json"],
    ["numeric strings", JSON.stringify({
      ...zeroStartingPlayerState(),
      dirtyCash: "0"
    })]
  ])("fails closed for persisted %s before creating a reservation or job", async (_label, startingPlayerState) => {
    const queryMock = gateQueryMock(startingPlayerState);
    const repository = createPostgresHostedControlPlaneRepository(databaseFor(queryMock));

    const outcome = await repository.reserveJoinTransaction(joinInput());

    expect(outcome).toEqual({ kind: "not-joinable" });
    const statements = queryMock.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, " "));
    expect(statements.find((sql) => sql.includes("FROM empire_hosted_server_instances")))
      .toContain("starting_player_state");
    expect(statements.some((sql) => sql.includes("INSERT INTO empire_hosted_join_reservations"))).toBe(false);
    expect(statements.some((sql) => sql.includes("INSERT INTO empire_hosted_join_jobs"))).toBe(false);
  });

  it("accepts shuffled canonical persisted keys with zero values", async () => {
    const shuffled = {
      materials: Object.fromEntries(
        [...FREE_HOSTED_STARTING_MATERIAL_IDS].reverse().map((materialId) => [materialId, 0])
      ),
      spySlots: 2,
      population: 0,
      dirtyCash: 0,
      cleanCash: 0
    };
    const queryMock = gateQueryMock(JSON.stringify(shuffled));
    const repository = createPostgresHostedControlPlaneRepository(databaseFor(queryMock));

    const outcome = await repository.reserveJoinTransaction(joinInput());

    expect(outcome).toMatchObject({ kind: "created" });
    const statements = queryMock.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, " "));
    expect(statements.filter((sql) => sql.includes("INSERT INTO empire_hosted_join_"))).toHaveLength(2);
  });
});

const gateQueryMock = (startingPlayerState: unknown) => vi.fn(async (sql: string) => {
  if (sql.includes("player_identity_id=$1 AND idempotency_key=$2")) return result([]);
  if (sql.includes("FROM empire_hosted_server_instances") && sql.includes("FOR UPDATE")) {
    return result([joinableServerRow(startingPlayerState)]);
  }
  if (sql.includes("SELECT clock_timestamp() AS now")) return result([{ now: NOW }]);
  if (sql.includes("SET status='expired'")) return result([]);
  if (sql.includes("server_instance_id=$1 AND player_identity_id=$2")) return result([]);
  if (sql.includes("(SELECT count(*) FROM")) {
    return result([{ committed_players: 0, reserved_slots: 0 }]);
  }
  if (sql.includes("INSERT INTO empire_hosted_join_reservations")) return result([]);
  if (sql.includes("INSERT INTO empire_hosted_join_jobs")) return result([]);
  throw new Error(`Unexpected SQL: ${sql.replace(/\s+/g, " ")}`);
});

const databaseFor = (queryMock: ReturnType<typeof vi.fn>): PostgresDatabase => {
  const query = queryMock as unknown as PostgresQueryable["query"];
  return {
    query,
    transaction: async (callback) => callback({ query }),
    close: async () => undefined
  };
};

const joinInput = (): { reservation: HostedJoinReservationRecord; job: HostedJoinJobRecord } => {
  const reservation: HostedJoinReservationRecord = {
    reservationId: "reservation:starting-state-gate",
    serverInstanceId: "instance:starting-state-gate",
    playerIdentityId: "account:starting-state-gate",
    status: "reserved",
    idempotencyKey: "join:starting-state-gate",
    requestHash: "hash:starting-state-gate",
    expectedServerVersion: 1,
    reservedSlot: 1,
    factionId: null,
    joinTicketId: null,
    expiresAt: "2026-07-20T16:31:00.000Z",
    createdAt: NOW,
    committedAt: null,
    canceledAt: null,
    updatedAt: NOW,
    version: 1
  };
  return {
    reservation,
    job: {
      jobId: "join-job:starting-state-gate",
      reservationId: reservation.reservationId,
      serverInstanceId: reservation.serverInstanceId,
      status: "pending",
      attempt: 0,
      availableAt: NOW,
      claimedByWorkerId: null,
      claimedByWorkerIncarnationId: null,
      claimedUntil: null,
      lastErrorCode: null,
      createdAt: NOW,
      updatedAt: NOW,
      version: 1
    }
  };
};

const joinableServerRow = (startingPlayerState: unknown) => ({
  version: 1,
  capacity: 20,
  status: "lobby",
  join_policy: "open",
  provisioning_state: "ready",
  current_snapshot_id: "snapshot:1",
  runtime_lease_owner_id: "worker:1",
  runtime_lease_expires_at: "2026-07-20T16:35:00.000Z",
  last_worker_heartbeat_at: "2026-07-20T16:29:50.000Z",
  registration_opens_at: "2026-07-20T16:00:00.000Z",
  registration_closes_at: "2026-07-20T17:00:00.000Z",
  registration_closed_at: null,
  registration_window_minutes: 60,
  starting_player_state: startingPlayerState
});

const zeroStartingPlayerState = () => ({
  cleanCash: 0,
  dirtyCash: 0,
  population: 0,
  spySlots: 2,
  materials: Object.fromEntries(
    FREE_HOSTED_STARTING_MATERIAL_IDS.map((materialId) => [materialId, 0])
  )
});

const result = (rows: Array<Record<string, unknown>>) => ({
  rows,
  rowCount: rows.length,
  command: "SELECT",
  oid: 0,
  fields: []
}) as never;
