import type { DistrictId } from "@empire/shared-types";
import { makeAdjacencySymmetric, wrapIndex } from "./gameplay-slice-shared-city-adjacency";
import {
  createConnectorDistrictId,
  createConnectorDistrictIds,
  createSharedCityDistrictId,
  nonDowntownZones,
  selectBuildingSetKey,
  sharedCitySpawnDistrictIds,
  SHARED_CITY_DOWNTOWN_DISTRICT_COUNT,
  SHARED_CITY_NON_DOWNTOWN_DISTRICT_COUNT,
  type NonDowntownDistrictZone,
  type ServerMapComposition
} from "./gameplay-slice-shared-city-map-constants";

export interface DistrictSeedPlan {
  id: DistrictId;
  zone: string;
  buildingSetKey: string;
  adjacentDistrictIds: DistrictId[];
}

export const createSharedCityPlans = (composition: ServerMapComposition): DistrictSeedPlan[] => {
  const zoneAllocator = createNonDowntownZoneAllocator(composition);
  const fixedNonDowntownPlans = [
    ...sharedCitySpawnDistrictIds.map((districtId, index) =>
      createSpawnDistrictPlan(districtId, index, zoneAllocator.next())
    ),
    ...createConnectorDistrictIds().map((districtId, index) =>
      createConnectorDistrictPlan(districtId, index + 1, zoneAllocator.next())
    )
  ];
  const extensionPlans = createExtensionDistrictPlans(
    zoneAllocator,
    SHARED_CITY_NON_DOWNTOWN_DISTRICT_COUNT - fixedNonDowntownPlans.length
  );
  const plans = [
    ...fixedNonDowntownPlans,
    createCentralDistrictPlan(1, ["district:central:2", ...createConnectorDistrictIds()]),
    createCentralDistrictPlan(2, ["district:central:1", "district:central:3"]),
    createCentralDistrictPlan(3, ["district:central:1", "district:central:2"]),
    ...createDowntownExtensionDistrictPlans(),
    ...extensionPlans
  ];

  return makeAdjacencySymmetric(plans);
};

const createSpawnDistrictPlan = (
  districtId: DistrictId,
  index: number,
  zone: NonDowntownDistrictZone
): DistrictSeedPlan => {
  const previousSpawn = sharedCitySpawnDistrictIds[(index + sharedCitySpawnDistrictIds.length - 1) % sharedCitySpawnDistrictIds.length];
  const nextSpawn = sharedCitySpawnDistrictIds[(index + 1) % sharedCitySpawnDistrictIds.length];

  return {
    id: districtId,
    zone,
    buildingSetKey: selectBuildingSetKey(zone, index),
    adjacentDistrictIds: [previousSpawn, nextSpawn, createConnectorDistrictId(Math.floor(index / 4) + 1)]
  };
};

const createConnectorDistrictPlan = (
  districtId: DistrictId,
  connectorIndex: number,
  zone: NonDowntownDistrictZone
): DistrictSeedPlan => {
  const firstSpawnIndex = (connectorIndex - 1) * 4;

  return {
    id: districtId,
    zone,
    buildingSetKey: selectBuildingSetKey(zone, connectorIndex),
    adjacentDistrictIds: [
      "district:central:1",
      createConnectorDistrictId(wrapIndex(connectorIndex - 1, createConnectorDistrictIds().length)),
      createConnectorDistrictId(wrapIndex(connectorIndex + 1, createConnectorDistrictIds().length)),
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

const createDowntownExtensionDistrictPlans = (): DistrictSeedPlan[] =>
  Array.from(
    { length: SHARED_CITY_DOWNTOWN_DISTRICT_COUNT - 3 },
    (_value, index): DistrictSeedPlan => {
      const id = createSharedCityDistrictId("downtown", index + 1);
      const previousId = index === 0
        ? "district:central:1"
        : createSharedCityDistrictId("downtown", index);
      const nextId = index === SHARED_CITY_DOWNTOWN_DISTRICT_COUNT - 4
        ? "district:central:2"
        : createSharedCityDistrictId("downtown", index + 2);

      return {
        id,
        zone: "downtown",
        buildingSetKey: selectBuildingSetKey("downtown", index + 3),
        adjacentDistrictIds: [previousId, nextId]
      };
    }
  );

const createExtensionDistrictPlans = (
  zoneAllocator: ReturnType<typeof createNonDowntownZoneAllocator>,
  count: number
): DistrictSeedPlan[] => {
  const seeds = Array.from({ length: count }, (_value, index) => {
    const zone = zoneAllocator.next();
    return {
      id: createSharedCityDistrictId(zone, index + 1),
      zone
    };
  });

  return seeds.map((seed, index) => ({
    id: seed.id,
    zone: seed.zone,
    buildingSetKey: selectBuildingSetKey(seed.zone, index),
    adjacentDistrictIds: [
      index === 0 ? "district:central:1" : seeds[index - 1]!.id,
      index === count - 1 ? "district:central:3" : seeds[index + 1]!.id
    ]
  }));
};

const createNonDowntownZoneAllocator = (composition: ServerMapComposition) => {
  const remaining: Record<NonDowntownDistrictZone, number> = {
    commercial: composition.commercial,
    industrial: composition.industrial,
    residential: composition.residential,
    park: composition.park
  };
  let cursor = 0;

  return {
    next: (): NonDowntownDistrictZone => {
      for (let offset = 0; offset < nonDowntownZones.length; offset += 1) {
        const zone = nonDowntownZones[(cursor + offset) % nonDowntownZones.length]!;
        if (remaining[zone] > 0) {
          remaining[zone] -= 1;
          cursor = (cursor + offset + 1) % nonDowntownZones.length;
          return zone;
        }
      }

      throw new Error("Server map composition exhausted before shared city seed completed.");
    }
  };
};
