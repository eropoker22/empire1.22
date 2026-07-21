import { describe, expect, it, vi } from "vitest";
import type { HostedJoinJobRecord, HostedJoinReservationRecord } from "../../../apps/server/src/admin/hosted";
import { createPostgresHostedControlPlaneRepository } from "../../../apps/server/src/admin/hosted";
import { isPostgresHostedServerJoinableAt } from
  "../../../apps/server/src/admin/hosted/postgres-hosted-join-gate";
import type {
  PostgresDatabase,
  PostgresQueryable
} from "../../../apps/server/src/runtime/persistence/postgres";

const OPEN_AT = "2026-07-20T16:00:00.000Z";
const CLOSES_AT = "2026-07-20T17:00:00.000Z";

describe("postgres hosted join registration gate", () => {
  it("uses the registration timestamps instead of the materialized join policy", () => {
    expect(isPostgresHostedServerJoinableAt({ ...joinableServerRow(), join_policy: "closed" },
      new Date("2026-07-20T16:30:00.000Z"))).toBe(true);
  });

  it("uses the database clock and excludes the closesAt boundary", async () => {
    const queryMock = vi.fn(async (sql: string) => {
      if (sql.includes("player_identity_id=$1 AND idempotency_key=$2")) return result([]);
      if (sql.includes("SELECT clock_timestamp() AS now")) return result([{ now: CLOSES_AT }]);
      if (sql.includes("FROM empire_hosted_server_instances") && sql.includes("FOR UPDATE")) {
        return result([joinableServerRow()]);
      }
      if (sql.includes("SET status='expired'")) return result([]);
      if (sql.includes("server_instance_id=$1 AND player_identity_id=$2")) return result([]);
      throw new Error(`Unexpected SQL: ${sql.replace(/\s+/g, " ")}`);
    });
    const repository = createPostgresHostedControlPlaneRepository(databaseFor(queryMock));

    const outcome = await repository.reserveJoinTransaction(joinInput("2026-07-20T16:59:59.000Z"));

    expect(outcome).toEqual({ kind: "not-joinable" });
    expect(queryMock.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO empire_hosted_join_reservations"))).toBe(false);
  });

  it("replays an idempotent reservation before reading the gate clock", async () => {
    const input = joinInput("2026-07-20T17:30:00.000Z");
    const queryMock = vi.fn(async (sql: string) => {
      if (sql.includes("player_identity_id=$1 AND idempotency_key=$2")) return result([reservationRow(input.reservation)]);
      if (sql.includes("FROM empire_hosted_join_jobs")) return result([jobRow(input.job)]);
      throw new Error(`Gate was read before replay: ${sql.replace(/\s+/g, " ")}`);
    });
    const repository = createPostgresHostedControlPlaneRepository(databaseFor(queryMock));

    const outcome = await repository.reserveJoinTransaction(input);

    expect(outcome).toMatchObject({ kind: "replayed", reservation: { reservationId: input.reservation.reservationId } });
    expect(queryMock.mock.calls.some(([sql]) => String(sql).includes("clock_timestamp() AS now"))).toBe(false);
  });

  it("keeps pending jobs unclaimed once registration is closed", async () => {
    const queryMock = vi.fn(async (_sql: string) => result([]));
    const repository = createPostgresHostedControlPlaneRepository(databaseFor(queryMock));

    expect(await repository.claimJoinJob("worker:1", CLOSES_AT, "2026-07-20T17:01:00.000Z")).toBeNull();
    const sql = String(queryMock.mock.calls[0]?.[0]).replace(/\s+/g, " ");
    expect(sql).toContain("server.registration_opens_at <= clock_timestamp()");
    expect(sql).toContain("server.registration_closes_at > clock_timestamp()");
    expect(sql).toContain("server.runtime_lease_expires_at > clock_timestamp()");
    expect(sql).not.toContain("server.join_policy='open'");
  });
});

const databaseFor = (queryMock: ReturnType<typeof vi.fn>): PostgresDatabase => {
  const query = queryMock as unknown as PostgresQueryable["query"];
  return {
    query,
    transaction: async (callback) => callback({ query }),
    close: async () => undefined
  };
};

const joinInput = (createdAt: string): { reservation: HostedJoinReservationRecord; job: HostedJoinJobRecord } => {
  const reservation: HostedJoinReservationRecord = {
    reservationId: "reservation:test",
    serverInstanceId: "instance:test",
    playerIdentityId: "account:test",
    status: "reserved",
    idempotencyKey: "join:test",
    requestHash: "hash:test",
    expectedServerVersion: 1,
    reservedSlot: 1,
    factionId: null,
    joinTicketId: null,
    expiresAt: new Date(Date.parse(createdAt) + 60_000).toISOString(),
    createdAt,
    committedAt: null,
    canceledAt: null,
    updatedAt: createdAt,
    version: 1
  };
  return {
    reservation,
    job: {
      jobId: "join-job:test",
      reservationId: reservation.reservationId,
      serverInstanceId: reservation.serverInstanceId,
      status: "pending",
      attempt: 0,
      availableAt: createdAt,
      claimedByWorkerId: null,
      claimedUntil: null,
      lastErrorCode: null,
      createdAt,
      updatedAt: createdAt,
      version: 1
    }
  };
};

const joinableServerRow = () => ({
  version: 1,
  capacity: 20,
  status: "lobby",
  join_policy: "open",
  provisioning_state: "ready",
  current_snapshot_id: "snapshot:1",
  runtime_lease_owner_id: "worker:1",
  runtime_lease_expires_at: "2026-07-20T17:05:00.000Z",
  last_worker_heartbeat_at: "2026-07-20T16:59:50.000Z",
  registration_opens_at: OPEN_AT,
  registration_closes_at: CLOSES_AT,
  registration_closed_at: null,
  registration_window_minutes: 60
});

const reservationRow = (reservation: HostedJoinReservationRecord) => ({
  reservation_id: reservation.reservationId,
  server_instance_id: reservation.serverInstanceId,
  player_identity_id: reservation.playerIdentityId,
  status: reservation.status,
  idempotency_key: reservation.idempotencyKey,
  request_hash: reservation.requestHash,
  expected_server_version: reservation.expectedServerVersion,
  reserved_slot: reservation.reservedSlot,
  faction_id: reservation.factionId,
  join_ticket_id: reservation.joinTicketId,
  expires_at: reservation.expiresAt,
  created_at: reservation.createdAt,
  committed_at: reservation.committedAt,
  canceled_at: reservation.canceledAt,
  updated_at: reservation.updatedAt,
  version: reservation.version
});

const jobRow = (job: HostedJoinJobRecord) => ({
  job_id: job.jobId,
  reservation_id: job.reservationId,
  server_instance_id: job.serverInstanceId,
  status: job.status,
  attempt: job.attempt,
  available_at: job.availableAt,
  claimed_by_worker_id: job.claimedByWorkerId,
  claimed_until: job.claimedUntil,
  last_error_code: job.lastErrorCode,
  created_at: job.createdAt,
  updated_at: job.updatedAt,
  version: job.version
});

const result = (rows: Array<Record<string, unknown>>) => ({
  rows,
  rowCount: rows.length,
  command: "SELECT",
  oid: 0,
  fields: []
}) as never;
