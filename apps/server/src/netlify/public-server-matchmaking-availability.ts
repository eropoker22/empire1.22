import type {
  PublicServerMatchmakingRequest,
  PublicServerMatchmakingResponse
} from "@empire/shared-types";
import type { HostedPublicServerProjection } from "./hosted-public-server-read-model";

export const rejectUnavailablePreferredServer = (
  publicServers: HostedPublicServerProjection[],
  request: PublicServerMatchmakingRequest
): PublicServerMatchmakingResponse => {
  const preferredId = String(request.preferredServerInstanceId ?? "").trim();
  const preferred = preferredId
    ? publicServers.find((projection) => projection.hosted.serverInstanceId === preferredId)
    : null;
  if (!preferred) return reject("matchmaking.no_public_server", "No public server is currently available for this request.");
  if (preferred.view.disabledReason === "SERVER_FULL") {
    return reject("SERVER_FULL", "The selected server has no available capacity.");
  }
  if (preferred.view.registrationReasonCode) {
    return reject(preferred.view.registrationReasonCode, registrationUnavailableMessage(preferred.view.registrationReasonCode));
  }
  return reject("matchmaking.no_public_server", "No public server is currently available for this request.");
};

const registrationUnavailableMessage = (code: string): string =>
  code === "SERVER_REGISTRATION_NOT_OPEN" || code === "SERVER_REGISTRATION_NOT_SCHEDULED"
    ? "Registration for the selected server is not open yet."
    : "Registration for the selected server is closed.";

const reject = (code: string, message: string): PublicServerMatchmakingResponse => ({
  accepted: false,
  reservation: null,
  errors: [{ code, message }]
});
