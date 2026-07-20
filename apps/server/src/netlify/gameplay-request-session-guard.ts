import type { createGameplaySessionNetlifyHandlers } from "./gameplay-session-netlify";
import { createGameplayFunctionErrorResponse } from "./gameplay-function-error-response";
import { createJsonResponse, type NetlifyFunctionResponse } from "./netlify-json-response";

type SessionHandlers = Pick<ReturnType<typeof createGameplaySessionNetlifyHandlers>, "validateRequestSession">;

export const rejectInvalidGameplayRequestSession = async (
  handlers: SessionHandlers,
  sessionToken: string | null | undefined,
  serverInstanceId: string,
  responseKind: "slice" | "command-result" = "slice"
): Promise<NetlifyFunctionResponse | null> => {
  const validation = await handlers.validateRequestSession(sessionToken, serverInstanceId);
  if (validation.accepted) return null;
  if (responseKind === "command-result") {
    return createJsonResponse(200, {
      accepted: false,
      status: "not_found",
      readModel: null,
      errors: validation.errors
    });
  }
  return createJsonResponse(200, createGameplayFunctionErrorResponse(validation.errors));
};
