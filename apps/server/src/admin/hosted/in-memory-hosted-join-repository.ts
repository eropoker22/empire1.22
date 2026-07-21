import type {
  HostedControlPlaneRepository,
  HostedJoinJobRecord,
  HostedJoinReservationRecord,
  HostedServerRecord
} from "./hosted-control-plane-repository";
import { resolveHostedServerRegistrationState } from "./hosted-server-registration-state";
import { copyInMemoryHostedValue as copy } from "./in-memory-hosted-control-plane-utils";

type InMemoryHostedJoinRepository = Pick<HostedControlPlaneRepository,
  "getJoinReservation" | "getJoinReservationByIdempotency" | "reserveJoinTransaction" |
  "claimJoinJob" | "completeJoin" | "failJoin" | "expireJoinReservations" | "getJoinCapacity">;

export const createInMemoryHostedJoinRepository = (state: {
  servers: Map<string, HostedServerRecord>;
  joinReservations: Map<string, HostedJoinReservationRecord>;
  joinJobs: Map<string, HostedJoinJobRecord>;
}): InMemoryHostedJoinRepository => ({
  getJoinReservation: async (reservationId) => copy(state.joinReservations.get(reservationId) ?? null),
  getJoinReservationByIdempotency: async (playerIdentityId, idempotencyKey) => copy(
    [...state.joinReservations.values()].find((entry) =>
      entry.playerIdentityId === playerIdentityId && entry.idempotencyKey === idempotencyKey) ?? null
  ),
  reserveJoinTransaction: async (input) => {
    const replay = [...state.joinReservations.values()].find((entry) =>
      entry.playerIdentityId === input.reservation.playerIdentityId &&
      entry.idempotencyKey === input.reservation.idempotencyKey);
    if (replay) {
      const job = [...state.joinJobs.values()].find((entry) => entry.reservationId === replay.reservationId) ?? null;
      return replay.serverInstanceId === input.reservation.serverInstanceId &&
        replay.requestHash === input.reservation.requestHash
        ? { kind: "replayed", reservation: copy(replay), job: copy(job) }
        : { kind: "conflict" };
    }
    const server = state.servers.get(input.reservation.serverInstanceId);
    if (!server) return { kind: "not-found" };
    for (const reservation of state.joinReservations.values()) {
      if (reservation.status === "reserved" && reservation.expiresAt <= input.reservation.createdAt) {
        reservation.status = "expired";
      }
    }
    const active = [...state.joinReservations.values()].find((entry) =>
      entry.serverInstanceId === input.reservation.serverInstanceId &&
      entry.playerIdentityId === input.reservation.playerIdentityId &&
      (entry.status === "reserved" || entry.status === "committed"));
    if (active) {
      const job = [...state.joinJobs.values()].find((entry) => entry.reservationId === active.reservationId) ?? null;
      return { kind: "replayed", reservation: copy(active), job: copy(job) };
    }
    if (server.version !== input.reservation.expectedServerVersion) return { kind: "stale-version" };
    if (!isInMemoryHostedServerJoinableAt(server, input.reservation.createdAt)) return { kind: "not-joinable" };
    const occupied = [...state.joinReservations.values()].filter((entry) =>
      entry.serverInstanceId === server.serverInstanceId &&
      (entry.status === "committed" ||
        (entry.status === "reserved" && entry.expiresAt > input.reservation.createdAt))).length;
    if (occupied >= server.capacity) return { kind: "server-full" };
    const reservation = { ...input.reservation, reservedSlot: occupied + 1 };
    state.joinReservations.set(reservation.reservationId, copy(reservation));
    state.joinJobs.set(input.job.jobId, copy(input.job));
    return { kind: "created", reservation: copy(reservation), job: copy(input.job) };
  },
  claimJoinJob: async (workerId, now, until) => {
    const job = [...state.joinJobs.values()].find((entry) => {
      const reservation = state.joinReservations.get(entry.reservationId);
      const server = state.servers.get(entry.serverInstanceId);
      return reservation?.status === "reserved" && reservation.expiresAt > now && entry.availableAt <= now &&
        server !== undefined && isInMemoryHostedServerJoinableAt(server, now) &&
        (entry.status === "pending" || (entry.status === "claimed" && (entry.claimedUntil ?? "") <= now));
    });
    if (!job) return null;
    Object.assign(job, { status: "claimed", claimedByWorkerId: workerId, claimedUntil: until,
      attempt: job.attempt + 1, updatedAt: now, version: job.version + 1 });
    return copy(job);
  },
  completeJoin: async (input) => {
    const reservation = state.joinReservations.get(input.reservationId);
    const job = state.joinJobs.get(input.jobId);
    if (!reservation || !job) return false;
    if (reservation.status === "committed") return reservation.joinTicketId === input.joinTicketId;
    if (reservation.status !== "reserved" || reservation.expiresAt <= input.at) return false;
    Object.assign(reservation, { status: "committed", joinTicketId: input.joinTicketId, committedAt: input.at,
      updatedAt: input.at, version: reservation.version + 1 });
    Object.assign(job, { status: "completed", claimedUntil: null, lastErrorCode: null,
      updatedAt: input.at, version: job.version + 1 });
    return true;
  },
  failJoin: async (input) => {
    const reservation = state.joinReservations.get(input.reservationId);
    const job = state.joinJobs.get(input.jobId);
    if (reservation && reservation.status !== "committed") {
      Object.assign(reservation, { status: input.status,
        canceledAt: input.status === "expired" ? reservation.canceledAt : input.at,
        updatedAt: input.at, version: reservation.version + 1 });
    }
    if (job && job.status !== "completed") {
      Object.assign(job, { status: "failed", claimedUntil: null,
        lastErrorCode: input.errorCode, updatedAt: input.at, version: job.version + 1 });
    }
  },
  expireJoinReservations: async (at) => {
    let expired = 0;
    for (const reservation of state.joinReservations.values()) {
      if (reservation.status !== "reserved" || reservation.expiresAt > at) continue;
      Object.assign(reservation, { status: "expired", updatedAt: at, version: reservation.version + 1 });
      const job = [...state.joinJobs.values()].find((entry) => entry.reservationId === reservation.reservationId);
      if (job && job.status !== "completed") {
        Object.assign(job, { status: "failed", claimedUntil: null,
          lastErrorCode: "JOIN_RESERVATION_EXPIRED", updatedAt: at, version: job.version + 1 });
      }
      expired += 1;
    }
    return expired;
  },
  getJoinCapacity: async (serverInstanceId, at) => ({
    committedPlayers: [...state.joinReservations.values()].filter((entry) =>
      entry.serverInstanceId === serverInstanceId && entry.status === "committed").length,
    reservedSlots: [...state.joinReservations.values()].filter((entry) =>
      entry.serverInstanceId === serverInstanceId && entry.status === "reserved" && entry.expiresAt > at).length
  })
});

const isInMemoryHostedServerJoinableAt = (server: HostedServerRecord, at: string): boolean =>
  server.provisioningState === "ready"
  && (server.status === "lobby" || server.status === "running")
  && resolveHostedServerRegistrationState({
    registrationOpensAt: server.registrationOpensAt,
    registrationClosesAt: server.registrationClosesAt,
    registrationClosedAt: server.registrationClosedAt,
    registrationWindowMinutes: server.registrationWindowMinutes
  }, new Date(at)).canCreateMembership;
