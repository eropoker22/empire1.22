import type {
  DomainError,
  GameplaySliceResponse,
  LoadGameplaySliceRequest,
  SubmitGameplayCommandRequest
} from "@empire/shared-types";
import type { GameplaySliceTransport } from "./gameplay-slice-transport";

export interface GameplaySliceJsonRequest {
  method: string;
  path: string;
  body: unknown;
}

export interface GameplaySliceJsonResponse {
  status: number;
  body: GameplaySliceResponse;
}

/**
 * Responsibility: Framework-neutral JSON endpoint adapter for gameplay slice transport.
 * Belongs here: HTTP-shaped method/path/body routing.
 * Does not belong here: gameplay rules, persistence, or browser rendering.
 */
export const createGameplaySliceJsonHandler = (
  transport: GameplaySliceTransport,
  endpointBase = "/api/gameplay-slice"
) => ({
  handle: (request: GameplaySliceJsonRequest): GameplaySliceJsonResponse => {
    if (request.method.toUpperCase() !== "POST") {
      return createErrorResponse(405, {
        code: "transport.method_not_allowed",
        message: "Gameplay slice endpoints require POST."
      });
    }

    const route = normalizeRoute(request.path, endpointBase);

    if (route === "load") {
      return {
        status: 200,
        body: transport.load(request.body as LoadGameplaySliceRequest)
      };
    }

    if (route === "submit") {
      return {
        status: 200,
        body: transport.submit(request.body as SubmitGameplayCommandRequest)
      };
    }

    return createErrorResponse(404, {
      code: "transport.not_found",
      message: "Gameplay slice endpoint was not found."
    });
  }
});

const normalizeRoute = (
  path: string,
  endpointBase: string
): "load" | "submit" | null => {
  const normalizedBase = endpointBase.replace(/\/+$/u, "");
  const normalizedPath = path.replace(/\/+$/u, "");

  if (normalizedPath === `${normalizedBase}/load`) {
    return "load";
  }

  if (normalizedPath === `${normalizedBase}/submit`) {
    return "submit";
  }

  return null;
};

const createErrorResponse = (
  status: number,
  error: DomainError
): GameplaySliceJsonResponse => ({
  status,
  body: {
    accepted: false,
    readModel: null,
    errors: [error]
  }
});
