import type { Building, District, PlayerId } from "@empire/shared-types";
import type { CoreGameState } from "../entities";

export const STARTER_DISTRICT_PRODUCTION_BUILDING_TYPES = Object.freeze([
  "pharmacy",
  "drug_lab",
  "factory",
  "armory"
] as const);

export const ensureStarterDistrictProductionBuildings = (input: {
  district: District;
  buildingsById: CoreGameState["buildingsById"];
  ownerPlayerId: PlayerId;
}): {
  district: District;
  buildingsById: CoreGameState["buildingsById"];
  changed: boolean;
} => {
  const existingTypes = new Set(input.district.buildingIds
    .map((buildingId) => input.buildingsById[buildingId]?.buildingTypeId)
    .filter((buildingTypeId): buildingTypeId is string => Boolean(buildingTypeId)));
  const missingTypes = STARTER_DISTRICT_PRODUCTION_BUILDING_TYPES
    .filter((buildingTypeId) => !existingTypes.has(buildingTypeId));
  if (missingTypes.length === 0) {
    return { district: input.district, buildingsById: input.buildingsById, changed: false };
  }

  const nextBuildingIds = [...input.district.buildingIds];
  const nextBuildingsById = { ...input.buildingsById };
  for (const buildingTypeId of missingTypes) {
    const existingBuilding = Object.values(input.buildingsById).find((building) => (
      building.districtId === input.district.id
      && building.ownerPlayerId === input.ownerPlayerId
      && building.buildingTypeId === buildingTypeId
      && building.status !== "destroyed"
      && !nextBuildingIds.includes(building.id)
    ));
    if (existingBuilding) {
      nextBuildingIds.push(existingBuilding.id);
      continue;
    }
    const buildingId = createStarterBuildingId(input.district.id, buildingTypeId, nextBuildingsById);
    nextBuildingIds.push(buildingId);
    nextBuildingsById[buildingId] = createStarterBuilding(
      buildingId,
      buildingTypeId,
      input.district,
      input.ownerPlayerId
    );
  }

  return {
    district: {
      ...input.district,
      buildingIds: nextBuildingIds,
      slotCount: Math.max(input.district.slotCount, nextBuildingIds.length),
      version: input.district.version + 1
    },
    buildingsById: nextBuildingsById,
    changed: true
  };
};

export const migrateStarterDistrictProductionBuildings = (
  state: CoreGameState
): CoreGameState => {
  let districtsById = state.districtsById;
  let buildingsById = state.buildingsById;
  let changed = false;

  for (const player of Object.values(state.playersById)) {
    if (!player.homeDistrictId) continue;
    const district = districtsById[player.homeDistrictId];
    if (!district || district.ownerPlayerId !== player.id) continue;
    const ensured = ensureStarterDistrictProductionBuildings({
      district,
      buildingsById,
      ownerPlayerId: player.id
    });
    if (!ensured.changed) continue;
    if (districtsById === state.districtsById) districtsById = { ...state.districtsById };
    districtsById[district.id] = ensured.district;
    buildingsById = ensured.buildingsById;
    changed = true;
  }

  if (!changed) return state;
  return {
    ...state,
    districtsById,
    buildingsById,
    root: {
      ...state.root,
      version: state.root.version + 1
    }
  };
};

const createStarterBuildingId = (
  districtId: string,
  buildingTypeId: string,
  buildingsById: CoreGameState["buildingsById"]
): string => {
  const districtKey = districtId.replace(/[^a-z0-9-]/giu, "-");
  const baseId = `building:${districtKey}:starter:${buildingTypeId}`;
  let buildingId = baseId;
  let suffix = 2;
  while (buildingsById[buildingId]) {
    buildingId = `${baseId}:${suffix}`;
    suffix += 1;
  }
  return buildingId;
};

const createStarterBuilding = (
  buildingId: string,
  buildingTypeId: string,
  district: District,
  ownerPlayerId: PlayerId
): Building => ({
  id: buildingId,
  serverInstanceId: district.serverInstanceId,
  districtId: district.id,
  ownerPlayerId,
  buildingTypeId,
  displayName: null,
  level: 1,
  status: "active",
  processing: null,
  actionCooldowns: {},
  metadata: { starterProductionBuilding: true },
  startedAt: new Date(0).toISOString(),
  completedAt: new Date(0).toISOString(),
  version: 1
});
