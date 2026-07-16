import * as crypto from "node:crypto";
import type { PublicServerMatchmakingRequest, PublicServerMatchmakingResponse } from "@empire/shared-types";
import type { AdminDurableRepositories } from "../admin/read-only";
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

  const identity = server.accountIdentityProvider.resolve({ headers, body });
  if (!identity) {
    return createJsonResponse(200, {
      accepted: false,
      reservation: null,
      errors: [{ code: "SESSION_REQUIRED", message: "Account identity is required for matchmaking reserve." }]
    });
  }
  const request = { ...(body as PublicServerMatchmakingRequest), playerId: identity.accountId };
  const reservationResponse = environment.NODE_ENV === "production"
    ? await reserveHostedPublicServer(request, repositories)
    : server.publicServerMatchmaking.reservePublicServer(request);
  if (!reservationResponse.accepted || !reservationResponse.reservation) {
    return createJsonResponse(200, reservationResponse);
  }
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
  repositories: AdminDurableRepositories | null
): Promise<PublicServerMatchmakingResponse> => {
  if (!repositories || repositories.kind !== "postgres") {
    return reject("matchmaking.unavailable", "Matchmaking is unavailable.");
  }

  try {
    const selected = selectCandidates(
      await listHostedPublicServerCandidates(repositories),
      request
    )[0];
    if (!selected) {
      return reject("matchmaking.no_public_server", "No public server is currently available for this request.");
    }
    const now = new Date();
    return {
      accepted: true,
      reservation: {
        reservationId: `reservation:${crypto.randomUUID()}`,
        joinTicket: "",
        serverInstanceId: selected.hosted.serverInstanceId,
        mode: selected.hosted.mode,
        region: selected.hosted.region,
        displayName: selected.hosted.displayName,
        expiresAt: new Date(now.getTime() + 60_000).toISOString()
      },
      errors: []
    };
  } catch (_error) {
    return reject("matchmaking.unavailable", "Matchmaking is unavailable.");
  }
};

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
