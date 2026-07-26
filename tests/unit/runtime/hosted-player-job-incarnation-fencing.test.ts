import { describe, expect, it, vi } from "vitest";
import type {
  HostedJoinJobRecord,
  HostedJoinReservationRecord,
  HostedServerRecord
} from "../../../apps/server/src/admin/hosted";
import { createInMemoryHostedJoinRepository } from
  "../../../apps/server/src/admin/hosted/in-memory-hosted-join-repository";
import { failPostgresMembershipJob } from
  "../../../apps/server/src/player-entry/postgres-player-entry-membership-jobs";
import type {
  PostgresDatabase,
  PostgresQueryable
} from "../../../apps/server/src/runtime/persistence/postgres";

const T0 = "2026-07-26T10:00:00.000Z";
const T1 = "2026-07-26T10:00:10.000Z";
const T2 = "2026-07-26T10:00:20.000Z";
const T3 = "2026-07-26T11:00:00.000Z";

describe("hosted player job incarnation fencing", () => {
  it("prevents an old worker incarnation from failing a reclaimed or completed join job", async () => {
    const reservation = joinReservation();
    const job = joinJob(reservation);
    const joinJobs = new Map([[job.jobId, job]]);
    const joinReservations = new Map([[reservation.reservationId, reservation]]);
    const repository = createInMemoryHostedJoinRepository({
      servers: new Map([[reservation.serverInstanceId, joinableServer()]]),
      joinReservations,
      joinJobs
    });

    const oldClaim = await repository.claimJoinJob("worker:1", "incarnation:old", T0, T1);
    const currentClaim = await repository.claimJoinJob("worker:1", "incarnation:new", T2, T3);
    expect(oldClaim?.version).toBe(2);
    expect(currentClaim?.version).toBe(3);

    expect(await repository.failJoin({
      reservationId: reservation.reservationId,
      jobId: job.jobId,
      serverInstanceId: reservation.serverInstanceId,
      workerId: "worker:1",
      workerIncarnationId: "incarnation:old",
      expectedJobVersion: oldClaim!.version,
      status: "canceled",
      errorCode: "STALE_FAILURE",
      at: T2
    })).toBe(false);
    expect(joinJobs.get(job.jobId)).toMatchObject({
      status: "claimed",
      claimedByWorkerIncarnationId: "incarnation:new",
      version: 3
    });

    expect(await repository.completeJoin({
      reservationId: reservation.reservationId,
      jobId: job.jobId,
      serverInstanceId: reservation.serverInstanceId,
      playerIdentityId: reservation.playerIdentityId,
      workerId: "worker:1",
      workerIncarnationId: "incarnation:new",
      expectedJobVersion: currentClaim!.version,
      joinTicketId: "ticket:1",
      at: T2
    })).toBe(true);
    expect(await repository.failJoin({
      reservationId: reservation.reservationId,
      jobId: job.jobId,
      serverInstanceId: reservation.serverInstanceId,
      workerId: "worker:1",
      workerIncarnationId: "incarnation:old",
      expectedJobVersion: oldClaim!.version,
      status: "canceled",
      errorCode: "LATE_FAILURE",
      at: T2
    })).toBe(false);
    expect(joinJobs.get(job.jobId)?.status).toBe("completed");
    expect(joinReservations.get(reservation.reservationId)?.status).toBe("committed");
  });

  it("does not update membership state when a failure no longer owns the claim", async () => {
    const queryMock = vi.fn(async (_sql: string, _parameters?: unknown[]) => result([]));
    const database = databaseFor(queryMock);

    expect(await failPostgresMembershipJob(database, {
      membershipId: "membership:1",
      jobId: "membership-job:1",
      serverInstanceId: "instance:1",
      workerId: "worker:1",
      workerIncarnationId: "incarnation:stale",
      expectedJobVersion: 2,
      errorCode: "STALE_FAILURE",
      at: T2
    })).toBe(false);

    expect(queryMock).toHaveBeenCalledTimes(1);
    const sql = String(queryMock.mock.calls[0]?.[0]).replace(/\s+/g, " ");
    expect(sql).toContain("server_instance_id=$3 AND status='claimed'");
    expect(sql).toContain("claimed_by_worker_incarnation_id=$5");
    expect(sql).toContain("version=$6");
    expect(sql).toContain("claimed_until > $8::timestamptz");
  });
});

const joinReservation = (): HostedJoinReservationRecord => ({
  reservationId: "reservation:1",
  serverInstanceId: "instance:1",
  playerIdentityId: "account:1",
  status: "reserved",
  idempotencyKey: "join-reservation:1",
  requestHash: "hash:1",
  expectedServerVersion: 1,
  reservedSlot: 1,
  factionId: "mafian",
  joinTicketId: null,
  expiresAt: T3,
  createdAt: T0,
  committedAt: null,
  canceledAt: null,
  updatedAt: T0,
  version: 1
});

const joinJob = (reservation: HostedJoinReservationRecord): HostedJoinJobRecord => ({
  jobId: "join-job:1",
  reservationId: reservation.reservationId,
  serverInstanceId: reservation.serverInstanceId,
  status: "pending",
  attempt: 0,
  availableAt: T0,
  claimedByWorkerId: null,
  claimedByWorkerIncarnationId: null,
  claimedUntil: null,
  lastErrorCode: null,
  createdAt: T0,
  updatedAt: T0,
  version: 1
});

const joinableServer = (): HostedServerRecord => ({
  serverInstanceId: "instance:1",
  provisioningState: "ready",
  status: "running",
  registrationOpensAt: T0,
  registrationClosesAt: T3,
  registrationClosedAt: null,
  registrationWindowMinutes: 60
} as HostedServerRecord);

const databaseFor = (queryMock: ReturnType<typeof vi.fn>): PostgresDatabase => {
  const query = queryMock as unknown as PostgresQueryable["query"];
  return {
    query,
    transaction: async (callback) => callback({ query }),
    close: async () => undefined
  };
};

const result = (rows: Array<Record<string, unknown>>) => ({
  rows,
  rowCount: rows.length,
  command: "UPDATE",
  oid: 0,
  fields: []
}) as never;
