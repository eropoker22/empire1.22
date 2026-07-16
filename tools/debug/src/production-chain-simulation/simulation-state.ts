import { createInitialState, type CoreGameState } from "@empire/game-core";
import {
  DEFAULT_PLAYER_COLOR,
  type Building,
  type CancelProductionLineCommand,
  type CollectProductionCommand,
  type CraftItemCommand,
  type District,
  type Player,
  type ResourceState
} from "@empire/shared-types";

const INSTANCE_ID = "instance:production-chain:1";
const PLAYER_ID = "player:production-chain:1";
const DISTRICT_ID = "district:production-chain:1";
export const PLAYER_RESOURCE_ID = "resource:production-chain:player:1";
export const BUILDING_IDS = {
  pharmacy: "building:production-chain:pharmacy:1",
  drug_lab: "building:production-chain:drug-lab:1",
  factory: "building:production-chain:factory:1",
  armory: "building:production-chain:armory:1"
} as const;

export const createProductionChainState = (balances: Record<string, number>): CoreGameState => {
  const state = createInitialState(INSTANCE_ID, "free");
  const player: Player = {
    id: PLAYER_ID,
    accountId: "account:production-chain:1",
    serverInstanceId: INSTANCE_ID,
    name: "Production Chain Auditor",
    factionId: "mafian",
    color: DEFAULT_PLAYER_COLOR,
    status: "active",
    allianceId: null,
    homeDistrictId: DISTRICT_ID,
    attackLoadout: {},
    population: 100,
    resourceStateId: PLAYER_RESOURCE_ID,
    cooldownStateId: "cooldown:production-chain:1",
    effectStateId: "effect:production-chain:1",
    policeStateId: "police:production-chain:1",
    createdAt: new Date(0).toISOString(),
    lastActionAt: null,
    version: 1
  };
  const buildings = Object.entries(BUILDING_IDS).map(([buildingTypeId, id]) => createBuilding(id, buildingTypeId));
  const district: District = {
    id: DISTRICT_ID,
    serverInstanceId: INSTANCE_ID,
    templateId: "template:production-chain:1",
    name: "Production Chain District",
    zone: "industrial",
    adjacentDistrictIds: [],
    ownerPlayerId: PLAYER_ID,
    controllerAllianceId: null,
    heat: 0,
    influence: 0,
    buildingIds: buildings.map((building) => building.id),
    defenseLoadout: {},
    slotCount: buildings.length,
    status: "claimed",
    resourceModifiers: {},
    securityRevision: 1,
    conflictRevision: 1,
    version: 1
  };
  const resources: ResourceState = {
    id: PLAYER_RESOURCE_ID,
    ownerType: "player",
    ownerId: PLAYER_ID,
    balances,
    incomeModifiers: {},
    lastUpdatedTick: 0,
    version: 1
  };

  state.playersById[player.id] = player;
  state.districtsById[district.id] = district;
  state.resourceStatesById[resources.id] = resources;
  for (const building of buildings) state.buildingsById[building.id] = building;
  state.root.playerIds.push(player.id);
  state.root.districtIds.push(district.id);
  return state;
};

export const createCraftCommand = (
  sequence: number,
  buildingId: string,
  recipeId: string,
  quantity: number
): CraftItemCommand => ({
  ...createCommandEnvelope(sequence, "craft-item"),
  type: "craft-item",
  payload: { districtId: DISTRICT_ID, buildingId, recipeId, quantity }
});

export const createCollectCommand = (
  sequence: number,
  buildingId: string,
  resourceKey: string
): CollectProductionCommand => ({
  ...createCommandEnvelope(sequence, "collect-production"),
  type: "collect-production",
  payload: { districtId: DISTRICT_ID, buildingId, resourceKey }
});

export const createCancelCommand = (
  sequence: number,
  buildingId: string,
  recipeId: string
): CancelProductionLineCommand => ({
  ...createCommandEnvelope(sequence, "cancel-production-line"),
  type: "cancel-production-line",
  payload: { districtId: DISTRICT_ID, buildingId, recipeId }
});

export const getBuildingOutput = (state: CoreGameState, buildingId: string, resourceKey: string): number =>
  Math.max(0, Number(state.resourceStatesById[`resource:${buildingId}`]?.balances[resourceKey] ?? 0));

export const getPlayerBalance = (state: CoreGameState, resourceKey: string): number =>
  Math.max(0, Number(state.resourceStatesById[PLAYER_RESOURCE_ID]?.balances[resourceKey] ?? 0));

const createBuilding = (id: string, buildingTypeId: string): Building => ({
  id,
  serverInstanceId: INSTANCE_ID,
  districtId: DISTRICT_ID,
  ownerPlayerId: PLAYER_ID,
  buildingTypeId,
  level: 1,
  status: "active",
  processing: null,
  productionLines: {},
  actionCooldowns: {},
  startedAt: new Date(0).toISOString(),
  completedAt: new Date(0).toISOString(),
  version: 1
});

const createCommandEnvelope = (sequence: number, type: string) => ({
  id: `command:production-chain:${sequence}:${type}`,
  mode: "free" as const,
  playerId: PLAYER_ID,
  serverInstanceId: INSTANCE_ID,
  issuedAt: new Date(sequence).toISOString(),
  clientRequestId: null
});
