import type { PublicServerMatchmakingRequest } from "@empire/shared-types";
import type { ServerApp } from "../app";
import { createJsonResponse, type NetlifyFunctionResponse } from "./netlify-json-response";

export const handlePublicServerMatchmakingReserve = (
  server: ServerApp,
  method: string,
  body: unknown
): NetlifyFunctionResponse => {
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

  return createJsonResponse(
    200,
    server.publicServerMatchmaking.reservePublicServer(body as PublicServerMatchmakingRequest)
  );
};
