import type { PublicServerMatchmakingRequest } from "@empire/shared-types";
import type { ServerApp } from "../app";
import { createJsonResponse, type NetlifyFunctionResponse } from "./netlify-json-response";

export const handlePublicServerMatchmakingReserve = async (
  server: ServerApp,
  method: string,
  body: unknown,
  headers?: Record<string, string | string[] | undefined>
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
  const reservationResponse = server.publicServerMatchmaking.reservePublicServer({
    ...(body as PublicServerMatchmakingRequest),
    playerId: identity.accountId
  });
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
