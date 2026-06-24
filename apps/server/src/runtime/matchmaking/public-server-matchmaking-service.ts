import {
  publicServerRegistry,
  resolvePublicServerInstanceId
} from "@empire/game-config";
import type {
  DomainError,
  PublicServerMatchmakingRequest,
  PublicServerMatchmakingResponse,
  PublicServerReservation
} from "@empire/shared-types";
import type { ServerInstanceManager } from "../server-instance-manager";
import { validateRuntimeJoinability } from "../instance-manager/server-instance-joinability";
import { systemClock, type Clock } from "../scheduling/clock";

const RESERVATION_TTL_MS = 60_000;

interface ActiveReservation extends PublicServerReservation {
  playerId: string;
}

export interface PublicServerMatchmakingService {
  reservePublicServer(request: PublicServerMatchmakingRequest): PublicServerMatchmakingResponse;
  listActiveReservations(): PublicServerReservation[];
}

export const createPublicServerMatchmakingService = (
  instanceManager: ServerInstanceManager,
  options: { clock?: Clock } = {}
): PublicServerMatchmakingService => {
  const clock = options.clock ?? systemClock;
  const reservations = new Map<string, ActiveReservation>();

  return {
    reservePublicServer: (request) => {
      pruneExpiredReservations(reservations, clock.now());
      const playerId = normalizeText(request.playerId);
      if (!playerId) return reject("matchmaking.invalid_request", "Matchmaking request requires playerId.");

      const closedServerError = getClosedPublicServerError(request);
      if (closedServerError) return closedServerError;

      const candidates = createCandidates(instanceManager, request, reservations);
      if (candidates.length === 0) {
        return reject("matchmaking.no_public_server", "No public server is currently available for this request.");
      }

      const selected = candidates.sort((left, right) =>
        left.score - right.score ||
        left.summary.playerCount - right.summary.playerCount ||
        left.summary.serverInstanceId.localeCompare(right.summary.serverInstanceId)
      )[0]!;
      const reservation = createReservation(selected.summary, playerId, clock.now());
      reservations.set(reservation.reservationId, reservation);
      return { accepted: true, reservation, errors: [] };
    },
    listActiveReservations: () => {
      pruneExpiredReservations(reservations, clock.now());
      return [...reservations.values()].map(stripPlayerId);
    }
  };
};

const getClosedPublicServerError = (
  request: PublicServerMatchmakingRequest
): PublicServerMatchmakingResponse | null => {
  const mode = normalizeMode(request.mode);
  const preferredServerInstanceId = resolvePublicServerInstanceId(normalizeText(request.preferredServerInstanceId));
  if (preferredServerInstanceId) {
    const preferredServer = publicServerRegistry.find((entry) => entry.serverInstanceId === preferredServerInstanceId);
    if (preferredServer && preferredServer.joinPolicy !== "open") {
      return reject("matchmaking.server_closed", "War server je dočasně uzavřený. Teď testujeme Free režim.");
    }
    return null;
  }

  if (!mode) return null;
  const matchingPublicServers = publicServerRegistry.filter((entry) => entry.isPublic && entry.mode === mode);
  if (matchingPublicServers.length > 0 && matchingPublicServers.every((entry) => entry.joinPolicy !== "open")) {
    return reject("matchmaking.server_closed", "War server je dočasně uzavřený. Teď testujeme Free režim.");
  }
  return null;
};

const createCandidates = (
  instanceManager: ServerInstanceManager,
  request: PublicServerMatchmakingRequest,
  reservations: Map<string, ActiveReservation>
) => {
  const mode = normalizeMode(request.mode);
  const preferredRegion = normalizeText(request.preferredRegion).toLowerCase();
  const preferredServerInstanceId = resolvePublicServerInstanceId(normalizeText(request.preferredServerInstanceId));
  if (preferredServerInstanceId) {
    const preferredServer = publicServerRegistry.find((entry) => entry.serverInstanceId === preferredServerInstanceId);
    if (preferredServer && preferredServer.joinPolicy !== "open") {
      return [];
    }
  }
  const latencyByRegion = normalizeLatencyMap(request.regionLatencyMs);
  const publicEntries = publicServerRegistry.filter((entry) =>
    entry.isPublic &&
    (!mode || entry.mode === mode) &&
    entry.joinPolicy === "open" &&
    (!preferredServerInstanceId || entry.serverInstanceId === preferredServerInstanceId)
  );

  return publicEntries.flatMap((entry) => {
    const runtime = instanceManager.getInstanceById(entry.serverInstanceId);
    if (!runtime) return [];
    const joinabilityErrors = validateRuntimeJoinability(runtime, normalizeText(request.playerId));
    if (joinabilityErrors.length > 0) return [];
    const summary = instanceManager.getServerSummary(entry.serverInstanceId);
    if (!summary) return [];
    const reservedCount = countReservationsForServer(reservations, entry.serverInstanceId);
    if (summary.playerCount + reservedCount >= summary.maxPlayers) return [];
    const latency = latencyByRegion.get(entry.region.toLowerCase()) ?? 250;
    const regionPenalty = preferredRegion && preferredRegion !== entry.region.toLowerCase() ? 1000 : 0;
    const fillRatio = summary.playerCount / Math.max(1, summary.maxPlayers);
    return [{ summary, score: latency + regionPenalty + fillRatio * 100 }];
  });
};

const createReservation = (
  summary: NonNullable<ReturnType<ServerInstanceManager["getServerSummary"]>>,
  playerId: string,
  now: Date
): ActiveReservation => ({
  reservationId: `reservation:${summary.serverInstanceId}:${playerId}:${now.getTime()}`,
  joinTicket: "",
  serverInstanceId: summary.serverInstanceId,
  mode: summary.mode === "war" ? "war" : "free",
  region: summary.region,
  displayName: summary.displayName,
  expiresAt: new Date(now.getTime() + RESERVATION_TTL_MS).toISOString(),
  playerId
});

const pruneExpiredReservations = (
  reservations: Map<string, ActiveReservation>,
  now: Date
): void => {
  for (const [reservationId, reservation] of reservations) {
    if (Date.parse(reservation.expiresAt) <= now.getTime()) {
      reservations.delete(reservationId);
    }
  }
};

const countReservationsForServer = (
  reservations: Map<string, ActiveReservation>,
  serverInstanceId: string
): number =>
  [...reservations.values()].filter((reservation) => reservation.serverInstanceId === serverInstanceId).length;

const stripPlayerId = (reservation: ActiveReservation): PublicServerReservation => ({
  reservationId: reservation.reservationId,
  joinTicket: reservation.joinTicket,
  serverInstanceId: reservation.serverInstanceId,
  mode: reservation.mode,
  region: reservation.region,
  displayName: reservation.displayName,
  expiresAt: reservation.expiresAt
});

const normalizeLatencyMap = (value: PublicServerMatchmakingRequest["regionLatencyMs"]): Map<string, number> =>
  new Map(Object.entries(value ?? {})
    .filter(([, latency]) => Number.isFinite(latency) && latency >= 0)
    .map(([region, latency]) => [region.toLowerCase(), latency]));

const normalizeText = (value: unknown): string =>
  String(value ?? "").trim();

const normalizeMode = (value: unknown): "free" | "war" | "" => {
  const normalized = normalizeText(value).toLowerCase();
  return normalized === "free" || normalized === "war" ? normalized : "";
};

const reject = (
  code: string,
  message: string
): PublicServerMatchmakingResponse => ({
  accepted: false,
  reservation: null,
  errors: [{ code, message } satisfies DomainError]
});
