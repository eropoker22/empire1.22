import {
  seedNeutralDistrictLootPool,
  type ConflictBalanceConfig,
  type CoreGameState
} from "@empire/game-core";
import type { ServerInstanceId } from "@empire/shared-types";
import {
  createSharedCityDistrict,
  seedSharedCityDistrictBuildings
} from "./gameplay-slice-shared-city-entities";
import {
  DEFAULT_SERVER_MAP_COMPOSITION,
  type ServerMapComposition
} from "./gameplay-slice-shared-city-map-constants";
import { validateServerMapComposition } from "./gameplay-slice-shared-city-composition";
import { createSharedCityPlans } from "./gameplay-slice-shared-city-plan";

export interface SharedCitySeedConfig {
  buildSlotLimit: number;
  productionBuildings: Record<string, { resourceKey: string }>;
  robbery?: ConflictBalanceConfig["robbery"];
  mapComposition?: ServerMapComposition;
}

export type { ServerMapComposition } from "./gameplay-slice-shared-city-map-constants";
export {
  DEFAULT_SERVER_MAP_COMPOSITION,
  SHARED_CITY_DOWNTOWN_DISTRICT_COUNT,
  SHARED_CITY_NON_DOWNTOWN_DISTRICT_COUNT,
  SHARED_CITY_TOTAL_DISTRICT_COUNT,
  sharedCitySpawnDistrictIds
} from "./gameplay-slice-shared-city-map-constants";
export {
  enabledSharedCitySpawnDistrictIds,
  findSharedCitySpawnCandidate,
  sharedCitySpawnPool,
  type SpawnCandidate,
  type SpawnZone
} from "./gameplay-slice-spawn-pool";
export { validateServerMapComposition } from "./gameplay-slice-shared-city-composition";
export { claimNextSharedCitySpawnDistrict } from "./gameplay-slice-shared-city-spawn";

/**
 * Responsibility: deterministic shared city slice for multiplayer session bootstrap.
 * Belongs here: map seed, spawn district assignment, and neutral district records.
 * Does not belong here: combat, balancing changes, UI state, or matchmaking.
 */
export const ensureSharedCityMap = (
  state: CoreGameState,
  instanceId: ServerInstanceId,
  config: SharedCitySeedConfig
): boolean => {
  const mapComposition = config.mapComposition ?? DEFAULT_SERVER_MAP_COMPOSITION;
  const validationErrors = validateServerMapComposition(mapComposition);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors[0]?.message ?? "Invalid shared city map composition.");
  }

  let changed = false;
  for (const districtPlan of createSharedCityPlans(mapComposition)) {
    if (state.districtsById[districtPlan.id]) {
      if (!state.root.districtIds.includes(districtPlan.id)) {
        state.root.districtIds.push(districtPlan.id);
        changed = true;
      }
      continue;
    }

    const district = createSharedCityDistrict({
      instanceId,
      districtId: districtPlan.id,
      name: districtPlan.name,
      ownerPlayerId: null,
      slotCount: config.buildSlotLimit,
      zone: districtPlan.zone,
      buildingSetKey: districtPlan.buildingSetKey,
      adjacentDistrictIds: districtPlan.adjacentDistrictIds
    });
    if (!district.ownerPlayerId && config.robbery) {
      district.neutralLootPool = seedNeutralDistrictLootPool(
        state.serverInstance.worldSeed,
        district,
        0,
        config.robbery
      );
    }

    state.districtsById[district.id] = district;
    appendUnique(state.root.districtIds, district.id);
    seedSharedCityDistrictBuildings(state, instanceId, district, config.productionBuildings);
    changed = true;
  }

  return changed;
};

const appendUnique = <TValue>(target: TValue[], value: TValue): void => {
  if (!target.includes(value)) target.push(value);
};
