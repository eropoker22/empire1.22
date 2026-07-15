import { resolveDistrictBuildingTypes } from "@empire/game-config";
import type { CoreGameState } from "@empire/game-core";
import type {
  Building,
  District,
  DistrictId,
  ResourceState,
  ServerInstanceId
} from "@empire/shared-types";
import { createBuildingId, formatDistrictName } from "./gameplay-slice-bootstrap-format";

export const createSharedCityDistrict = (input: {
  instanceId: ServerInstanceId;
  districtId: DistrictId;
  name?: string;
  ownerPlayerId: string | null;
  slotCount: number;
  zone: string;
  buildingSetKey?: string;
  adjacentDistrictIds: DistrictId[];
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
    name: input.name ?? formatDistrictName(input.districtId),
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
    securityRevision: 1,
    version: 1
  };
};

export const seedSharedCityDistrictBuildings = (
  state: CoreGameState,
  instanceId: ServerInstanceId,
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

const createBuilding = (
  instanceId: ServerInstanceId,
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
