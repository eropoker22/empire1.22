import { createInitialState, createPlayerPoliceState } from "@empire/game-core";
import { resolveDistrictBuildingTypes, resolveModeConfig } from "@empire/game-config";
import type {
  Building,
  District,
  GameCommand,
  GameModeId,
  LoadGameplaySliceRequest,
  Player,
  ResourceState,
  ServerInstanceId,
  SubmitGameplayCommandRequest
} from "@empire/shared-types";
import type { ServerInstanceManager } from "../runtime";
import {
  createBuildingId,
  createNeighborDistrictId,
  formatDistrictName,
  inferModeFromInstanceId
} from "./gameplay-slice-bootstrap-format";
import {
  restoreGameplaySliceSessionFromSnapshot,
  type EnsureGameplaySliceSessionOptions
} from "./gameplay-slice-snapshot-restore";

export interface GameplaySliceSessionRequest {
  serverInstanceId: ServerInstanceId;
  playerId: string;
  districtId: string;
  mode?: GameModeId;
}

/**
 * Responsibility: Temporary server-side bootstrap for the first HTTP gameplay slice.
 * Belongs here: creating an authoritative process-local instance when persistence
 * has not restored one yet.
 * Does not belong here: client session parsing or long-term storage.
 */
export const ensureGameplaySliceSession = async (
  instanceManager: ServerInstanceManager,
  request: LoadGameplaySliceRequest | SubmitGameplayCommandRequest,
  options: EnsureGameplaySliceSessionOptions = {}
): Promise<void> => {
  const sessionRequest = normalizeSessionRequest(request);
  const existingRuntime = instanceManager.getInstanceById(sessionRequest.serverInstanceId);

  if (existingRuntime) {
    return;
  }

  const mode = sessionRequest.mode ?? inferModeFromInstanceId(sessionRequest.serverInstanceId);
  const restored = await restoreGameplaySliceSessionFromSnapshot(
    instanceManager,
    {
      serverInstanceId: sessionRequest.serverInstanceId,
      fallbackMode: mode
    },
    options
  );

  if (restored) {
    return;
  }

  const runtime = instanceManager.createInstance(sessionRequest.serverInstanceId, mode);

  runtime.state = createGameplaySliceSessionState({
    ...sessionRequest,
    mode
  });

  instanceManager.startInstance(sessionRequest.serverInstanceId);
};

const normalizeSessionRequest = (
  request: LoadGameplaySliceRequest | SubmitGameplayCommandRequest
): GameplaySliceSessionRequest => {
  if ("command" in request) {
    const command = request.command as GameCommand;

    return {
      serverInstanceId: command.serverInstanceId,
      playerId: command.playerId,
      districtId: request.focusDistrictId,
      mode: command.mode
    };
  }

  return {
    serverInstanceId: request.serverInstanceId,
    playerId: request.playerId,
    districtId: request.districtId
  };
};

const createGameplaySliceSessionState = (request: Required<GameplaySliceSessionRequest>) => {
  const config = resolveModeConfig(request.mode);
  const state = createInitialState(request.serverInstanceId, request.mode);
  const districtIds = [
    request.districtId,
    createNeighborDistrictId(request.districtId, 1),
    createNeighborDistrictId(request.districtId, 2)
  ];
  const player = createPlayer(request);

  state.playersById[player.id] = player;
  state.resourceStatesById[player.resourceStateId] = createResourceState(
    player.resourceStateId,
    "player",
    player.id,
    config.balance.startingResources
  );
  state.policeStatesById[player.policeStateId] = createPlayerPoliceState(player, state.root.tick);
  state.root.playerIds.push(player.id);

  districtIds.forEach((districtId, index) => {
    const isHomeDistrict = index === 0;
    const district = createDistrict({
      instanceId: request.serverInstanceId,
      districtId,
      ownerPlayerId: isHomeDistrict ? player.id : null,
      slotCount: config.balance.buildSlotLimit,
      zone: isHomeDistrict ? "commercial" : "industrial",
      buildingSetKey: isHomeDistrict ? "early-stable-2" : "ind-top-1",
      adjacentDistrictIds: districtIds.filter((candidateId) => candidateId !== districtId)
    });

    state.districtsById[district.id] = district;
    state.root.districtIds.push(district.id);

    district.buildingIds.forEach((buildingId, buildingIndex) => {
      const buildingTypeId = district.buildingIds[buildingIndex]?.split(":").at(-2) ?? "warehouse";
      const building = createBuilding(request.serverInstanceId, district, buildingId, buildingTypeId);
      const productionProfile = config.balance.productionBuildings?.[building.buildingTypeId];

      state.buildingsById[building.id] = building;

      if (productionProfile) {
        state.resourceStatesById[`resource:${building.id}`] = createResourceState(
          `resource:${building.id}`,
          "building",
          building.id,
          {
            [productionProfile.resourceKey]: 0
          }
        );
      }
    });
  });

  return state;
};

const createPlayer = (request: Required<GameplaySliceSessionRequest>): Player => ({
  id: request.playerId,
  accountId: `account:${request.playerId}`,
  serverInstanceId: request.serverInstanceId,
  name: request.playerId.replace(/^player:/u, "").replace(/[-:]+/gu, " ") || "Street Player",
  factionId: "mafian",
  color: "#3b82f6",
  status: "active",
  allianceId: null,
  homeDistrictId: request.districtId,
  attackLoadout: {
    pistol: 2,
    smg: 1
  },
  resourceStateId: `resource:${request.playerId}`,
  cooldownStateId: `cooldown:${request.playerId}`,
  effectStateId: `effect:${request.playerId}`,
  policeStateId: `police:${request.playerId}`,
  createdAt: new Date(0).toISOString(),
  lastActionAt: null,
  version: 1
});

const createDistrict = (input: {
  instanceId: string;
  districtId: string;
  ownerPlayerId: string | null;
  slotCount: number;
  zone: string;
  buildingSetKey: string;
  adjacentDistrictIds: string[];
}): District => {
  const buildingTypes = resolveDistrictBuildingTypes({
    districtId: input.districtId,
    zone: input.zone,
    buildingSetKey: input.buildingSetKey
  });

  return {
    id: input.districtId,
    serverInstanceId: input.instanceId,
    templateId: `district-template:${input.zone}`,
    name: formatDistrictName(input.districtId),
    zone: input.zone,
    adjacentDistrictIds: input.adjacentDistrictIds,
    ownerPlayerId: input.ownerPlayerId,
    controllerAllianceId: null,
    heat: 0,
    influence: 0,
    buildingIds: buildingTypes.map((buildingTypeId, index) =>
      createBuildingId(input.districtId, buildingTypeId, index)
    ),
    defenseLoadout: {},
    slotCount: Math.max(input.slotCount, buildingTypes.length),
    status: input.ownerPlayerId ? "claimed" : "neutral",
    resourceModifiers: {},
    version: 1
  };
};

const createBuilding = (
  instanceId: string,
  district: District,
  buildingId: string,
  buildingTypeId: string
): Building => ({
  id: buildingId,
  serverInstanceId: instanceId,
  districtId: district.id,
  ownerPlayerId: district.ownerPlayerId ?? "player:neutral",
  buildingTypeId,
  displayName: null,
  level: 1,
  status: "active",
  processing: null,
  actionCooldowns: {},
  startedAt: new Date(0).toISOString(),
  completedAt: new Date(0).toISOString(),
  version: 1
});

const createResourceState = (
  id: string,
  ownerType: ResourceState["ownerType"],
  ownerId: string,
  balances: Record<string, number>
): ResourceState => ({
  id,
  ownerType,
  ownerId,
  balances: { ...balances },
  incomeModifiers: {},
  lastUpdatedTick: 0,
  version: 1
});
