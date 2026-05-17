import type { CoreGameState } from "@empire/game-core";
import type { DistrictId, DomainError, ServerInstanceId } from "@empire/shared-types";
import {
  createSharedCityDistrict,
  seedSharedCityDistrictBuildings
} from "./gameplay-slice-shared-city-entities";

export interface SharedCitySeedConfig {
  buildSlotLimit: number;
  productionBuildings: Record<string, { resourceKey: string }>;
  mapComposition?: ServerMapComposition;
}

export interface ServerMapComposition {
  downtown: 8;
  commercial: number;
  industrial: number;
  residential: number;
  park: number;
}

interface DistrictSeedPlan {
  id: DistrictId;
  zone: string;
  buildingSetKey: string;
  adjacentDistrictIds: DistrictId[];
}

type NonDowntownDistrictZone = "commercial" | "industrial" | "residential" | "park";
type SharedCityDistrictZone = NonDowntownDistrictZone | "downtown";

const nonDowntownZones = ["commercial", "industrial", "residential", "park"] as const;

export const SHARED_CITY_TOTAL_DISTRICT_COUNT = 161;
export const SHARED_CITY_DOWNTOWN_DISTRICT_COUNT = 8;
export const SHARED_CITY_NON_DOWNTOWN_DISTRICT_COUNT =
  SHARED_CITY_TOTAL_DISTRICT_COUNT - SHARED_CITY_DOWNTOWN_DISTRICT_COUNT;

export const DEFAULT_SERVER_MAP_COMPOSITION: ServerMapComposition = {
  downtown: 8,
  commercial: 40,
  industrial: 35,
  residential: 48,
  park: 30
};

const buildingSetKeysByZone: Record<SharedCityDistrictZone, string[]> = {
  commercial: ["early-stable-2", "mid-mix-1", "mid-balance-1", "early-cash"],
  industrial: ["ind-early-1", "ind-mid-3", "ind-mid-1", "ind-early-4"],
  residential: ["res-early-3", "res-mid-1", "res-mid-2", "res-early-4"],
  park: ["park-early-1", "park-mid-3", "park-mid-1", "park-early-2"],
  downtown: ["down-core-1", "down-core-2", "down-core-3", "down-mid-2", "down-high-1"]
};

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
  const mapComposition = config.mapComposition ?? DEFAULT_SERVER_MAP_COMPOSITION;
  const validationErrors = validateServerMapComposition(mapComposition);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors[0]?.message ?? "Invalid shared city map composition.");
  }

  for (const districtPlan of createSharedCityPlans(mapComposition)) {
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

export const validateServerMapComposition = (
  composition: ServerMapComposition | null | undefined
): DomainError[] => {
  const details = createMapCompositionDetails(composition);
  const values = composition
    ? [
        composition.commercial,
        composition.industrial,
        composition.residential,
        composition.park,
        composition.downtown
      ]
    : [];
  const hasOnlyNonNegativeIntegers =
    values.length === 5 && values.every((value) => Number.isInteger(value) && value >= 0);

  if (!composition || !hasOnlyNonNegativeIntegers) {
    return [
      {
        code: "server.invalid_map_composition",
        message: "Server map composition must use non-negative integer district counts.",
        details
      }
    ];
  }

  if (composition.downtown !== SHARED_CITY_DOWNTOWN_DISTRICT_COUNT) {
    return [
      {
        code: "server.invalid_map_composition",
        message: "Server map composition must contain exactly 8 downtown districts.",
        details
      }
    ];
  }

  const nonDowntownTotal = getNonDowntownDistrictCount(composition);
  const total = nonDowntownTotal + composition.downtown;
  if (
    nonDowntownTotal !== SHARED_CITY_NON_DOWNTOWN_DISTRICT_COUNT ||
    total !== SHARED_CITY_TOTAL_DISTRICT_COUNT
  ) {
    return [
      {
        code: "server.invalid_map_composition",
        message: "Server map composition must contain exactly 161 districts.",
        details
      }
    ];
  }

  return [];
};

const createSharedCityPlans = (composition: ServerMapComposition): DistrictSeedPlan[] => {
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

  return seeds.map((seed, index) => {
    const previousId = index === 0
      ? "district:central:1"
      : seeds[index - 1]!.id;
    const nextId = index === count - 1
      ? "district:central:3"
      : seeds[index + 1]!.id;

    return {
      id: seed.id,
      zone: seed.zone,
      buildingSetKey: selectBuildingSetKey(seed.zone, index),
      adjacentDistrictIds: [previousId, nextId]
    };
  });
};

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
  Array.from({ length: 5 }, (_value, index) => createConnectorDistrictId(index + 1));

const createConnectorDistrictId = (index: number): DistrictId =>
  createSharedCityDistrictId("connector", index);

function createSharedCityDistrictId(
  kind: "spawn" | "connector" | "central" | "downtown" | NonDowntownDistrictZone,
  index: number
): DistrictId {
  return `district:${kind}:${index}`;
}

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

const selectBuildingSetKey = (zone: SharedCityDistrictZone, index: number): string => {
  const keys = buildingSetKeysByZone[zone];
  return keys[index % keys.length] ?? keys[0]!;
};

const getNonDowntownDistrictCount = (composition: ServerMapComposition): number =>
  composition.commercial + composition.industrial + composition.residential + composition.park;

const createMapCompositionDetails = (
  composition: ServerMapComposition | null | undefined
): Record<string, unknown> => ({
  composition: composition ?? null,
  expectedDowntown: SHARED_CITY_DOWNTOWN_DISTRICT_COUNT,
  expectedNonDowntownTotal: SHARED_CITY_NON_DOWNTOWN_DISTRICT_COUNT,
  expectedTotal: SHARED_CITY_TOTAL_DISTRICT_COUNT,
  actualNonDowntownTotal: composition ? getNonDowntownDistrictCount(composition) : null,
  actualTotal: composition ? getNonDowntownDistrictCount(composition) + composition.downtown : null
});

const wrapIndex = (value: number, length: number): number => ((value - 1 + length) % length) + 1;

const appendUnique = <TValue>(target: TValue[], value: TValue): void => {
  if (!target.includes(value)) target.push(value);
};
