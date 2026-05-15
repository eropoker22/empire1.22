import type { CoreGameState } from "@empire/game-core";
import type { DistrictId, ServerInstanceId } from "@empire/shared-types";
import {
  createSharedCityDistrict,
  seedSharedCityDistrictBuildings
} from "./gameplay-slice-shared-city-entities";

export interface SharedCitySeedConfig {
  buildSlotLimit: number;
  productionBuildings: Record<string, { resourceKey: string }>;
}

interface DistrictSeedPlan {
  id: DistrictId;
  zone: string;
  buildingSetKey: string;
  adjacentDistrictIds: DistrictId[];
}

const spawnProfiles = [
  { zone: "commercial", buildingSetKey: "early-stable-2" },
  { zone: "residential", buildingSetKey: "res-early-3" },
  { zone: "industrial", buildingSetKey: "ind-early-1" },
  { zone: "park", buildingSetKey: "park-early-1" }
] as const;

const connectorProfiles = [
  { zone: "commercial", buildingSetKey: "mid-mix-1" },
  { zone: "industrial", buildingSetKey: "ind-mid-3" },
  { zone: "park", buildingSetKey: "park-mid-3" },
  { zone: "residential", buildingSetKey: "res-mid-1" },
  { zone: "downtown", buildingSetKey: "down-mid-2" }
] as const;

export const sharedCitySpawnDistrictIds = Array.from(
  { length: 20 },
  (_value, index) => createSharedCityDistrictId("spawn", index + 1)
);

/**
 * Responsibility: deterministic shared city slice for multiplayer session bootstrap.
 * Belongs here: map seed, spawn district assignment, and neutral district records.
 * Does not belong here: combat, balancing changes, UI state, or matchmaking.
 */
export const ensureSharedCityMap = (
  state: CoreGameState,
  instanceId: ServerInstanceId,
  config: SharedCitySeedConfig
): void => {
  for (const districtPlan of createSharedCityPlans()) {
    if (state.districtsById[districtPlan.id]) {
      continue;
    }

    const district = createSharedCityDistrict({
      instanceId,
      districtId: districtPlan.id,
      ownerPlayerId: null,
      slotCount: config.buildSlotLimit,
      zone: districtPlan.zone,
      buildingSetKey: districtPlan.buildingSetKey,
      adjacentDistrictIds: districtPlan.adjacentDistrictIds
    });

    state.districtsById[district.id] = district;
    appendUnique(state.root.districtIds, district.id);
    seedSharedCityDistrictBuildings(state, instanceId, district, config.productionBuildings);
  }
};

export const claimNextSharedCitySpawnDistrict = (
  state: CoreGameState,
  playerId: string
): DistrictId | null => {
  const spawnDistrict = sharedCitySpawnDistrictIds
    .map((districtId) => state.districtsById[districtId])
    .find((district) => district && !district.ownerPlayerId && district.status === "neutral");

  if (!spawnDistrict) {
    return null;
  }

  spawnDistrict.ownerPlayerId = playerId;
  spawnDistrict.status = "claimed";
  for (const buildingId of spawnDistrict.buildingIds) {
    const building = state.buildingsById[buildingId];
    if (building) {
      building.ownerPlayerId = playerId;
    }
  }

  return spawnDistrict.id;
};

const createSharedCityPlans = (): DistrictSeedPlan[] => {
  const plans = [
    ...sharedCitySpawnDistrictIds.map(createSpawnDistrictPlan),
    ...connectorProfiles.map((_profile, index) => createConnectorDistrictPlan(index + 1)),
    createCentralDistrictPlan(1, ["district:central:2", ...createConnectorDistrictIds()]),
    createCentralDistrictPlan(2, ["district:central:1", "district:central:3"]),
    createCentralDistrictPlan(3, ["district:central:1", "district:central:2"])
  ];

  return makeAdjacencySymmetric(plans);
};

const createSpawnDistrictPlan = (districtId: DistrictId, index: number): DistrictSeedPlan => {
  const profile = spawnProfiles[index % spawnProfiles.length] ?? spawnProfiles[0];
  const previousSpawn = sharedCitySpawnDistrictIds[(index + sharedCitySpawnDistrictIds.length - 1) % sharedCitySpawnDistrictIds.length];
  const nextSpawn = sharedCitySpawnDistrictIds[(index + 1) % sharedCitySpawnDistrictIds.length];

  return {
    id: districtId,
    zone: profile.zone,
    buildingSetKey: profile.buildingSetKey,
    adjacentDistrictIds: [previousSpawn, nextSpawn, createConnectorDistrictId(Math.floor(index / 4) + 1)]
  };
};

const createConnectorDistrictPlan = (connectorIndex: number): DistrictSeedPlan => {
  const profile = connectorProfiles[connectorIndex - 1] ?? connectorProfiles[0];
  const firstSpawnIndex = (connectorIndex - 1) * 4;

  return {
    id: createConnectorDistrictId(connectorIndex),
    zone: profile.zone,
    buildingSetKey: profile.buildingSetKey,
    adjacentDistrictIds: [
      "district:central:1",
      createConnectorDistrictId(wrapIndex(connectorIndex - 1, connectorProfiles.length)),
      createConnectorDistrictId(wrapIndex(connectorIndex + 1, connectorProfiles.length)),
      ...sharedCitySpawnDistrictIds.slice(firstSpawnIndex, firstSpawnIndex + 4)
    ]
  };
};

const createCentralDistrictPlan = (
  centralIndex: number,
  adjacentDistrictIds: DistrictId[]
): DistrictSeedPlan => ({
  id: createSharedCityDistrictId("central", centralIndex),
  zone: "downtown",
  buildingSetKey: centralIndex === 1 ? "down-core-1" : centralIndex === 2 ? "down-core-2" : "down-core-3",
  adjacentDistrictIds
});

const makeAdjacencySymmetric = (plans: DistrictSeedPlan[]): DistrictSeedPlan[] => {
  const adjacencyById = new Map(plans.map((plan) => [plan.id, new Set(plan.adjacentDistrictIds)]));

  for (const plan of plans) {
    for (const adjacentDistrictId of plan.adjacentDistrictIds) {
      adjacencyById.get(adjacentDistrictId)?.add(plan.id);
    }
  }

  return plans.map((plan) => ({
    ...plan,
    adjacentDistrictIds: Array.from(adjacencyById.get(plan.id) ?? [])
  }));
};

const createConnectorDistrictIds = (): DistrictId[] =>
  connectorProfiles.map((_profile, index) => createConnectorDistrictId(index + 1));

const createConnectorDistrictId = (index: number): DistrictId =>
  createSharedCityDistrictId("connector", index);

function createSharedCityDistrictId(kind: "spawn" | "connector" | "central", index: number): DistrictId {
  return `district:${kind}:${index}`;
}

const wrapIndex = (value: number, length: number): number => ((value - 1 + length) % length) + 1;

const appendUnique = <TValue>(target: TValue[], value: TValue): void => {
  if (!target.includes(value)) target.push(value);
};
