import type {
  DomainError,
  GameplaySliceResponse
} from "@empire/shared-types";
import type { GameplaySliceTransport } from "./gameplay-slice-transport";
import {
  createGameplaySliceValidationResponse,
  validateLoadGameplaySliceRequest,
  validateSubmitGameplayCommandRequest
} from "./gameplay-slice-request-validation";

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
  handle: async (request: GameplaySliceJsonRequest): Promise<GameplaySliceJsonResponse> => {
    if (request.method.toUpperCase() !== "POST") {
      return createErrorResponse(405, {
        code: "transport.method_not_allowed",
        message: "Gameplay slice endpoints require POST."
      });
    }

    const route = normalizeRoute(request.path, endpointBase);

    if (route === "load") {
      const validation = validateLoadGameplaySliceRequest(request.body);
      if (!validation.accepted) {
        return {
          status: 200,
          body: createGameplaySliceValidationResponse(validation.errors)
        };
      }

      return {
        status: 200,
        body: await transport.load(validation.request)
      };
    }

    if (route === "submit") {
      const validation = validateSubmitGameplayCommandRequest(request.body);
      if (!validation.accepted) {
        return {
          status: 200,
          body: createGameplaySliceValidationResponse(validation.errors)
        };
      }

      return {
        status: 200,
        body: await transport.submit(validation.request)
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
