import type { DomainError, GameModeId, ServerInstanceId } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import type { ServerInstanceManager } from "../server-instance-manager";
import {
  ensureSharedCityMap,
  type ServerMapComposition,
  validateServerMapComposition
} from "../../bootstrap/gameplay-slice-shared-city-seed";
import { systemClock, type Clock } from "../scheduling/clock";

export interface CreateGameServerInstanceRequest {
  mode: GameModeId;
  region: string;
  serverInstanceId?: ServerInstanceId;
  displayName?: string;
  capacity?: number;
  mapComposition?: ServerMapComposition;
}

export type ServerInstanceCreationResult =
  | {
      accepted: true;
      runtime: ServerInstanceRuntime;
      errors: [];
    }
  | {
      accepted: false;
      runtime: null;
      errors: DomainError[];
    };

export interface ServerInstanceCreationService {
  createGameServerInstance(request: CreateGameServerInstanceRequest): ServerInstanceRuntime;
  createGameServerInstanceResult(request: CreateGameServerInstanceRequest): ServerInstanceCreationResult;
}

/**
 * Responsibility: Explicit lifecycle entry point for pre-creating joinable game servers.
 * Belongs here: runtime creation, lobby metadata, and map seeding.
 * Does not belong here: matchmaking, billing, or gameplay command effects.
 */
export const createServerInstanceCreationService = (
  instanceManager: ServerInstanceManager,
  options: {
    clock?: Clock;
  } = {}
): ServerInstanceCreationService => {
  const clock = options.clock ?? systemClock;
  let sequence = 0;

  return {
    createGameServerInstance: (request) => {
      const result = createGameServerInstanceResult(request);
      if (!result.accepted) {
        throw new Error(result.errors[0]?.message ?? "Server instance creation failed.");
      }

      return result.runtime;
    },
    createGameServerInstanceResult
  };

  function createGameServerInstanceResult(
    request: CreateGameServerInstanceRequest
  ): ServerInstanceCreationResult {
    if (request.mapComposition) {
      const errors = validateServerMapComposition(request.mapComposition);
      if (errors.length > 0) {
        return {
          accepted: false,
          runtime: null,
          errors
        };
      }
    }

    sequence += 1;
    const serverInstanceId = request.serverInstanceId ?? createServerInstanceId(request.mode, request.region, clock, sequence);
    if (instanceManager.getInstanceById(serverInstanceId)) {
      return {
        accepted: false,
        runtime: null,
        errors: [
          {
            code: "server.instance_already_exists",
            message: "Server instance already exists.",
            details: {
              serverInstanceId
            }
          }
        ]
      };
    }

    const runtime = instanceManager.createInstance(serverInstanceId, request.mode, {
      displayName: request.displayName,
      region: request.region,
      capacity: request.capacity
    });

    seedRuntimeMap(runtime, request.mapComposition);
    runtime.record.status = "lobby";
    runtime.state.serverInstance.worldSeed = `shared-city:${serverInstanceId}`;
    runtime.state.serverInstance.currentTick = runtime.state.root.tick;

    return {
      accepted: true,
      runtime,
      errors: []
    };
  }
};

const seedRuntimeMap = (
  runtime: ServerInstanceRuntime,
  mapComposition: ServerMapComposition | undefined
): void => {
  ensureSharedCityMap(runtime.state, runtime.record.id, {
    buildSlotLimit: runtime.config.balance.buildSlotLimit,
    productionBuildings: runtime.config.balance.productionBuildings ?? {},
    mapComposition
  });
};

const createServerInstanceId = (
  mode: GameModeId,
  region: string,
  clock: Clock,
  sequence: number
): ServerInstanceId => {
  const safeRegion = region.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") || "local";
  return `instance:${mode}:${safeRegion}:${clock.now().getTime()}:${sequence}`;
};
