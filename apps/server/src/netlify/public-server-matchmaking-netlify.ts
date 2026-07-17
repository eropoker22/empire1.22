import * as crypto from "node:crypto";
import type { PublicServerMatchmakingRequest, PublicServerMatchmakingResponse } from "@empire/shared-types";
import type { AdminDurableRepositories } from "../admin/read-only";
import type { HostedJoinReservationRecord, HostedServerRecord } from "../admin/hosted";
import type { ServerApp } from "../app";
import { listHostedPublicServerCandidates, type HostedPublicServerCandidate } from "./hosted-public-server-read-model";
import { createJsonResponse, type NetlifyFunctionResponse } from "./netlify-json-response";

export const handlePublicServerMatchmakingReserve = async (
  server: ServerApp,
  method: string,
  body: unknown,
  headers: Record<string, string | string[] | undefined> | undefined,
  environment: Record<string, string | undefined>,
  repositories: AdminDurableRepositories | null
): Promise<NetlifyFunctionResponse> => {
  if (method.toUpperCase() !== "POST") {
    return createJsonResponse(405, {
      accepted: false,
      reservation: null,
      errors: [{
        code: "transport.method_not_allowed",
        message: "Matchmaking reserve endpoint requires POST."
      }]
    });
  }

  const identity = await server.accountIdentityProvider.resolve({ headers, body });
  if (!identity) {
    return createJsonResponse(200, {
      accepted: false,
      reservation: null,
      errors: [{ code: "SESSION_REQUIRED", message: "Account identity is required for matchmaking reserve." }]
    });
  }
  const request = { ...(body as PublicServerMatchmakingRequest), playerId: identity.accountId };
  const reservationResponse = repositories?.kind === "postgres"
    ? await reserveHostedPublicServer(request, identity.accountId,
      isRecord(body) ? String(body.factionId ?? "").trim() || null : null,
      header(headers, "idempotency-key"), repositories)
    : server.publicServerMatchmaking.reservePublicServer(request);
  if (!reservationResponse.accepted || !reservationResponse.reservation) {
    return createJsonResponse(200, reservationResponse);
  }
  if (repositories?.kind === "postgres") return createJsonResponse(200, reservationResponse);
  const ticket = await server.gameplaySessionService.createJoinTicket({
    accountId: identity.accountId,
    serverInstanceId: reservationResponse.reservation.serverInstanceId,
    mode: reservationResponse.reservation.mode,
    factionId: isRecord(body) ? String(body.factionId ?? "").trim() || null : null,
    nowIso: new Date().toISOString()
  });
  return createJsonResponse(200, {
    ...reservationResponse,
    reservation: {
      ...reservationResponse.reservation,
      joinTicket: ticket.ticketId
    }
  });
};

const reserveHostedPublicServer = async (
  request: PublicServerMatchmakingRequest,
  playerIdentityId: string,
  factionId: string | null,
  idempotencyKey: string,
  repositories: AdminDurableRepositories | null
): Promise<PublicServerMatchmakingResponse> => {
  if (!repositories || repositories.kind !== "postgres") {
    return reject("matchmaking.unavailable", "Matchmaking is unavailable.");
  }
  if (!idempotencyKey || idempotencyKey.length > 160) {
    return reject("matchmaking.idempotency_required", "Matchmaking requires an idempotency key.");
  }

  try {
    const requestHash = hashRequest(request, factionId);
    const existing = await repositories.hosted.getJoinReservationByIdempotency(playerIdentityId, idempotencyKey);
    if (existing) {
      if (existing.requestHash !== requestHash) return reject("matchmaking.idempotency_conflict", "Matchmaking idempotency key conflicts with another request.");
      const hosted = await repositories.hosted.getServer(existing.serverInstanceId);
      return hosted ? responseForReservation(existing, hosted) : reject("matchmaking.unavailable", "Matchmaking is unavailable.");
    }
    const candidates = selectCandidates(await listHostedPublicServerCandidates(repositories), request);
    if (candidates.length === 0) {
      const preferredId = String(request.preferredServerInstanceId ?? "").trim();
      if (preferredId) {
        const preferred = await repositories.hosted.getServer(preferredId);
        const capacity = preferred ? await repositories.hosted.getJoinCapacity(preferredId, new Date().toISOString()) : null;
        if (preferred && capacity && preferred.provisioningState === "ready" && preferred.joinPolicy === "open"
          && (preferred.status === "lobby" || preferred.status === "running")
          && capacity.committedPlayers + capacity.reservedSlots >= preferred.capacity) {
          return reject("SERVER_FULL", "The selected server has no available capacity.");
        }
      }
      return reject("matchmaking.no_public_server", "No public server is currently available for this request.");
    }
    const now = new Date();
    for (const selected of candidates) {
      const reservationId = `reservation:${crypto.randomUUID()}`;
      const createdAt = now.toISOString();
      const result = await repositories.hosted.reserveJoinTransaction({
        reservation: {
          reservationId,
          serverInstanceId: selected.hosted.serverInstanceId,
          playerIdentityId,
          status: "reserved",
          idempotencyKey,
          requestHash,
          expectedServerVersion: selected.hosted.version,
          reservedSlot: 1,
          factionId,
          joinTicketId: null,
          expiresAt: new Date(now.getTime() + 60_000).toISOString(),
          createdAt,
          committedAt: null,
          canceledAt: null,
          updatedAt: createdAt,
          version: 1
        },
        job: {
          jobId: `join-job:${crypto.randomUUID()}`,
          reservationId,
          serverInstanceId: selected.hosted.serverInstanceId,
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
      });
      if (result.kind === "created" || result.kind === "replayed") {
        return responseForReservation(result.reservation, selected.hosted);
      }
      if (result.kind === "conflict") return reject("matchmaking.idempotency_conflict", "Matchmaking idempotency key conflicts with another request.");
      if (result.kind !== "server-full" && result.kind !== "stale-version" && result.kind !== "not-joinable") break;
    }
    return reject("SERVER_FULL", "The selected server has no available capacity.");
  } catch (_error) {
    return reject("matchmaking.unavailable", "Matchmaking is unavailable.");
  }
};

const responseForReservation = (
  reservation: HostedJoinReservationRecord,
  hosted: HostedServerRecord
): PublicServerMatchmakingResponse => reservation.status === "committed" && Boolean(reservation.joinTicketId)
  ? {
      accepted: true,
      reservation: {
        reservationId: reservation.reservationId,
        status: "committed",
        joinTicket: reservation.joinTicketId,
        serverInstanceId: hosted.serverInstanceId,
        mode: hosted.mode,
        region: hosted.region,
        displayName: hosted.displayName,
        expiresAt: reservation.expiresAt
      },
      errors: []
    }
  : {
      accepted: false,
      reservation: reservation.status === "reserved" ? {
        reservationId: reservation.reservationId,
        status: "reserved",
        joinTicket: null,
        serverInstanceId: hosted.serverInstanceId,
        mode: hosted.mode,
        region: hosted.region,
        displayName: hosted.displayName,
        expiresAt: reservation.expiresAt
      } : null,
      errors: [{ code: reservation.status === "reserved" ? "matchmaking.preparing" : "matchmaking.reservation_unavailable",
        message: reservation.status === "reserved" ? "Server se připravuje." : "Matchmaking reservation is unavailable." }]
    };

const hashRequest = (request: PublicServerMatchmakingRequest, factionId: string | null): string =>
  crypto.createHash("sha256").update(JSON.stringify({
    mode: request.mode ?? null,
    preferredRegion: request.preferredRegion ?? null,
    preferredServerInstanceId: request.preferredServerInstanceId ?? null,
    regionLatencyMs: request.regionLatencyMs ?? null,
    factionId
  })).digest("hex");

const selectCandidates = (
  candidates: HostedPublicServerCandidate[],
  request: PublicServerMatchmakingRequest
): HostedPublicServerCandidate[] => {
  const mode = request.mode === "free" || request.mode === "war" ? request.mode : null;
  const preferredId = String(request.preferredServerInstanceId ?? "").trim();
  const preferredRegion = String(request.preferredRegion ?? "").trim().toLowerCase();
  const latencyByRegion = new Map(Object.entries(request.regionLatencyMs ?? {})
    .filter(([, latency]) => Number.isFinite(latency) && latency >= 0)
    .map(([region, latency]) => [region.toLowerCase(), latency]));

  return candidates
    .filter(({ hosted }) => (!mode || hosted.mode === mode)
      && (!preferredId || hosted.serverInstanceId === preferredId))
    .sort((left, right) => score(left) - score(right)
      || left.summary.playerCount - right.summary.playerCount
      || left.hosted.serverInstanceId.localeCompare(right.hosted.serverInstanceId));

  function score(candidate: HostedPublicServerCandidate): number {
    const region = candidate.hosted.region.toLowerCase();
    const latency = latencyByRegion.get(region) ?? 250;
    const regionPenalty = preferredRegion && preferredRegion !== region ? 1000 : 0;
    return latency + regionPenalty
      + (candidate.summary.playerCount / Math.max(1, candidate.hosted.capacity)) * 100;
  }
};

const reject = (code: string, message: string): PublicServerMatchmakingResponse => ({
  accepted: false,
  reservation: null,
  errors: [{ code, message }]
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const header = (headers: Record<string, string | string[] | undefined> | undefined, name: string): string => {
  const value = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name)?.[1];
  return (Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "")).trim();
};
