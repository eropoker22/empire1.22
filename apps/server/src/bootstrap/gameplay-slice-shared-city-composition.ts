import type { DomainError } from "@empire/shared-types";
import {
  SHARED_CITY_DOWNTOWN_DISTRICT_COUNT,
  SHARED_CITY_NON_DOWNTOWN_DISTRICT_COUNT,
  SHARED_CITY_TOTAL_DISTRICT_COUNT,
  type ServerMapComposition
} from "./gameplay-slice-shared-city-map-constants";

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
    return [{
      code: "server.invalid_map_composition",
      message: "Server map composition must use non-negative integer district counts.",
      details
    }];
  }

  if (composition.downtown !== SHARED_CITY_DOWNTOWN_DISTRICT_COUNT) {
    return [{
      code: "server.invalid_map_composition",
      message: "Server map composition must contain exactly 8 downtown districts.",
      details
    }];
  }

  const nonDowntownTotal = getNonDowntownDistrictCount(composition);
  const total = nonDowntownTotal + composition.downtown;
  if (
    nonDowntownTotal !== SHARED_CITY_NON_DOWNTOWN_DISTRICT_COUNT ||
    total !== SHARED_CITY_TOTAL_DISTRICT_COUNT
  ) {
    return [{
      code: "server.invalid_map_composition",
      message: "Server map composition must contain exactly 161 districts.",
      details
    }];
  }

  if (
    composition.commercial !== 40 ||
    composition.industrial !== 38 ||
    composition.residential !== 38 ||
    composition.park !== 37
  ) {
    return [{
      code: "server.invalid_map_composition",
      message: "Server map composition must match the canonical Empire Streets city map manifest.",
      details
    }];
  }

  return [];
};

export const getNonDowntownDistrictCount = (composition: ServerMapComposition): number =>
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
