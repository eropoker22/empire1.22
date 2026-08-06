import { createInitialState, type CoreGameState } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { PRODUCTION_GAME_LIFECYCLE_PHASES } from "@empire/shared-types";
import {
  createDistrictFixture,
  createFixedBuildingFixture,
  createPlayerFixture,
  createResourceStateFixture
} from "./game-state-fixtures";

const canonicalFreeConfig = resolveModeConfig("free");

export const acceleratedLifecycleConfig = {
  ...canonicalFreeConfig,
  balance: {
    ...canonicalFreeConfig.balance,
    elimination: {
      ...canonicalFreeConfig.balance.elimination!,
      firstEliminationTick: 2,
      intervalTicks: 1,
      minActivePlayers: 8,
      quietHours: {
        ...canonicalFreeConfig.balance.elimination!.quietHours!,
        enabled: false
      }
    },
    finalLockdown: {
      ...canonicalFreeConfig.balance.finalLockdown!,
      triggerActivePlayers: 8,
      activeDurationTicks: 3,
      pauseDuringQuietHours: false
    }
  }
};

export const createTwentyPlayerLifecycleState = (
  instanceId = "instance:full-free-lifecycle"
): CoreGameState => {
  const state = createInitialState(instanceId, "free");
  state.serverInstance = {
    ...state.serverInstance,
    status: "running",
    startedAt: "2026-08-06T10:00:00.000Z",
    worldSeed: "full-free-lifecycle-seed"
  };
  state.root.phase = PRODUCTION_GAME_LIFECYCLE_PHASES.live;

  for (let index = 1; index <= 20; index += 1) {
    const playerId = `player:${index}`;
    const districtId = `district:${index}`;
    const resourceStateId = `resource:${index}`;
    const cooldownStateId = `cooldown:${index}`;
    const effectStateId = `effect:${index}`;
    const policeStateId = `police:${index}`;
    const player = createPlayerFixture({
      id: playerId,
      accountId: `account:${index}`,
      serverInstanceId: state.serverInstance.id,
      name: `Player ${index}`,
      homeDistrictId: districtId,
      resourceStateId,
      cooldownStateId,
      effectStateId,
      policeStateId,
      population: 100 + index,
      lastActionAt: "2026-08-06T09:59:00.000Z"
    });
    const building = createFixedBuildingFixture("warehouse", {
      id: `building:${index}:warehouse`,
      serverInstanceId: state.serverInstance.id,
      districtId,
      ownerPlayerId: playerId
    });

    state.playersById[playerId] = player;
    state.districtsById[districtId] = createDistrictFixture({
      id: districtId,
      serverInstanceId: state.serverInstance.id,
      ownerPlayerId: playerId,
      influence: 10 + index,
      buildingIds: [building.id]
    });
    state.buildingsById[building.id] = building;
    state.resourceStatesById[resourceStateId] = createResourceStateFixture({
      id: resourceStateId,
      ownerType: "player",
      ownerId: playerId,
      balances: {
        cash: 5_000 + index * 100,
        "dirty-cash": 1_000 + index * 10,
        population: 100 + index,
        chemicals: index
      }
    });
    state.cooldownStatesById[cooldownStateId] = {
      id: cooldownStateId,
      ownerType: "player",
      ownerId: playerId,
      cooldowns: {},
      version: 1
    };
    state.effectStatesById[effectStateId] = {
      id: effectStateId,
      ownerType: "player",
      ownerId: playerId,
      effects: [],
      version: 1
    };
    state.policeStatesById[policeStateId] = {
      id: policeStateId,
      ownerPlayerId: playerId,
      heat: 0,
      wantedLevel: 0,
      lastDecayTick: 0,
      activeFlags: [],
      version: 1
    };
    state.root.playerIds.push(playerId);
    state.root.districtIds.push(districtId);
  }

  return state;
};
