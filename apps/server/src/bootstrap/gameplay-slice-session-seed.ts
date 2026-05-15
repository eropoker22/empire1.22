import {
  applyFactionStartingPackage,
  type CoreGameState,
  createPlayerPoliceState,
  normalizeFactionId
} from "@empire/game-core";
import { resolveDistrictBuildingTypes, resolveModeConfig } from "@empire/game-config";
import type {
  Building,
  District,
  GameModeId,
  Player,
  PlayerFactionId,
  ResourceState,
  ServerInstanceId
} from "@empire/shared-types";
import {
  createBuildingId,
  createNeighborDistrictId,
  formatDistrictName
} from "./gameplay-slice-bootstrap-format";

export interface GameplaySliceMembershipRequest {
  serverInstanceId: ServerInstanceId;
  playerId: string;
  districtId: string;
  factionId?: PlayerFactionId | string | null;
  mode: GameModeId;
}

/**
 * Responsibility: deterministic bootstrap seed for one joined gameplay slice player.
 * Belongs here: starter player, starter districts, and starter building records.
 * Does not belong here: gameplay command effects or client-side rules.
 */
export const addPlayerToGameplaySliceState = (
  state: CoreGameState,
  request: GameplaySliceMembershipRequest
): CoreGameState => {
  const config = resolveModeConfig(request.mode);
  const factionId = normalizeFactionId(request.factionId, config);
  const districtIds = createJoinDistrictIds(state, request.districtId, request.playerId);
  const player = createPlayer({ ...request, districtId: districtIds[0] }, factionId);

  state.playersById[player.id] = player;
  state.resourceStatesById[player.resourceStateId] = createResourceState(
    player.resourceStateId,
    "player",
    player.id,
    config.balance.startingResources
  );
  state.policeStatesById[player.policeStateId] = createPlayerPoliceState(player, state.root.tick);
  appendUnique(state.root.playerIds, player.id);

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
    appendUnique(state.root.districtIds, district.id);
    seedDistrictBuildings(state, request.serverInstanceId, district, config.balance.productionBuildings ?? {});
  });

  return applyFactionStartingPackage(state, player.id, { config });
};

const seedDistrictBuildings = (
  state: CoreGameState,
  instanceId: string,
  district: District,
  productionBuildings: Record<string, { resourceKey: string }>
): void => {
  district.buildingIds.forEach((buildingId, buildingIndex) => {
    const buildingTypeId = district.buildingIds[buildingIndex]?.split(":").at(-2) ?? "warehouse";
    const building = createBuilding(instanceId, district, buildingId, buildingTypeId);
    const productionProfile = productionBuildings[building.buildingTypeId];

    state.buildingsById[building.id] = building;
    if (productionProfile) {
      state.resourceStatesById[`resource:${building.id}`] = createResourceState(
        `resource:${building.id}`,
        "building",
        building.id,
        { [productionProfile.resourceKey]: 0 }
      );
    }
  });
};

const createJoinDistrictIds = (
  state: CoreGameState,
  requestedDistrictId: string,
  playerId: string
): string[] => {
  const homeDistrictId = state.districtsById[requestedDistrictId]
    ? createUniqueDistrictId(state, requestedDistrictId, playerId, 0)
    : requestedDistrictId;
  const neighborIds = [1, 2].map((offset) => {
    const candidateId = createNeighborDistrictId(homeDistrictId, offset);
    return state.districtsById[candidateId]
      ? createUniqueDistrictId(state, requestedDistrictId, playerId, offset)
      : candidateId;
  });
  return [homeDistrictId, ...neighborIds];
};

const createUniqueDistrictId = (
  state: CoreGameState,
  requestedDistrictId: string,
  playerId: string,
  offset: number
): string => {
  const requestedKey = sanitizeIdFragment(requestedDistrictId.replace(/^district:/u, "")) || "home";
  const playerKey = sanitizeIdFragment(playerId.replace(/^player:/u, "")) || "player";
  let attempt = 0;

  while (true) {
    const candidateId = `district:${requestedKey}:join:${playerKey}:${offset + attempt}`;
    if (!state.districtsById[candidateId]) return candidateId;
    attempt += 1;
  }
};

const createPlayer = (
  request: GameplaySliceMembershipRequest,
  factionId: PlayerFactionId
): Player => ({
  id: request.playerId,
  accountId: `account:${request.playerId}`,
  serverInstanceId: request.serverInstanceId,
  name: request.playerId.replace(/^player:/u, "").replace(/[-:]+/gu, " ") || "Street Player",
  factionId,
  color: "#3b82f6",
  status: "active",
  allianceId: null,
  homeDistrictId: request.districtId,
  attackLoadout: { pistol: 2, smg: 1 },
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
    buildingIds: buildingTypes.map((buildingTypeId, index) => createBuildingId(input.districtId, buildingTypeId, index)),
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
): ResourceState => ({ id, ownerType, ownerId, balances: { ...balances }, incomeModifiers: {}, lastUpdatedTick: 0, version: 1 });

const appendUnique = <TValue>(target: TValue[], value: TValue): void => {
  if (!target.includes(value)) target.push(value);
};

const sanitizeIdFragment = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9-]/giu, "-").replace(/^-+|-+$/gu, "");
