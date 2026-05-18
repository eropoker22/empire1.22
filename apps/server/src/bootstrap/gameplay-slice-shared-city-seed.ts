import type { CoreGameState } from "@empire/game-core";
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

const appendUnique = <TValue>(target: TValue[], value: TValue): void => {
  if (!target.includes(value)) target.push(value);
};
