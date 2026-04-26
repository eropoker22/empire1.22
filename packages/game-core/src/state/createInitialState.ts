import {
  PRODUCTION_GAME_LIFECYCLE_PHASES,
  type GameModeId
} from "@empire/shared-types";
import type { ServerInstance } from "@empire/shared-types/entities/server-instance";
import type { GameStateRoot } from "@empire/shared-types/entities/game-state-root";
import type { CoreGameState } from "../entities/game-state";

/**
 * Responsibility: Canonical bootstrap factory for a fresh authoritative game state.
 * Belongs here: initial normalized state shape for a new instance.
 * Does not belong here: debug seeds, restore logic, or transport concerns.
 */
export const createInitialState = (instanceId: string, mode: GameModeId): CoreGameState => {
  const serverInstance: ServerInstance = {
    id: instanceId,
    mode,
    configKey: mode,
    status: "pending",
    startedAt: new Date(0).toISOString(),
    endedAt: null,
    worldSeed: "pending-seed",
    currentTick: 0,
    gameStateId: `${instanceId}:root`,
    version: 1
  };

  const root: GameStateRoot = {
    id: serverInstance.gameStateId,
    serverInstanceId: instanceId,
    tick: 0,
    phase: PRODUCTION_GAME_LIFECYCLE_PHASES.bootstrapping,
    playerIds: [],
    allianceIds: [],
    districtIds: [],
    eventIds: [],
    trapIds: [],
    notificationIds: [],
    victoryStateId: null,
    matchResultId: null,
    version: 1
  };

  return {
    serverInstance,
    root,
    playersById: {},
    alliancesById: {},
    districtsById: {},
    buildingsById: {},
    resourceStatesById: {},
    cooldownStatesById: {},
    effectStatesById: {},
    policeStatesById: {},
    eventsById: {},
    trapsById: {},
    notificationsById: {},
    victoryState: null,
    matchResult: null
  };
};
