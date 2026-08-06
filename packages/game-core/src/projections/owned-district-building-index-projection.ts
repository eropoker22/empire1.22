import type {
  DistrictSummaryView,
  OwnedDistrictBuildingIndexEntryView,
  OwnedDistrictBuildingIndexView
} from "@empire/shared-types";
import type { CoreGameState } from "../entities/game-state";
import { formatResourceLabel } from "./district-building-action-formatters";
import {
  normalizeBuildingDisplayName,
  resolveCatalogVariantName
} from "./district-building-display-helpers";

export interface OwnedDistrictBuildingIndexCatalogEntry {
  buildingTypeId: string;
  label: string;
  nameVariants?: readonly string[];
}

/**
 * Builds the compact cross-district building index used before a district is selected.
 * Actionable building, slot, and conflict data remain exclusive to the full district panel.
 */
export const createOwnedDistrictBuildingIndexViews = (
  state: CoreGameState,
  playerId: string,
  districts: readonly DistrictSummaryView[],
  buildCatalog: readonly OwnedDistrictBuildingIndexCatalogEntry[]
): OwnedDistrictBuildingIndexView[] => {
  const definitionsByType = new Map(
    buildCatalog.map((entry) => [entry.buildingTypeId, entry])
  );

  return districts
    .filter((summary) => {
      const district = state.districtsById[summary.districtId];
      return summary.isOwnedByPlayer
        && district?.ownerPlayerId === playerId
        && district.status !== "destroyed";
    })
    .sort((left, right) => left.districtId.localeCompare(right.districtId))
    .map((summary) => {
      const district = state.districtsById[summary.districtId]!;
      return {
        ...summary,
        buildings: district.buildingIds.flatMap((buildingId) => {
          const building = state.buildingsById[buildingId];
          if (!building || building.status === "destroyed") return [];

          const definition = definitionsByType.get(building.buildingTypeId);
          const label = definition?.label ?? formatResourceLabel(building.buildingTypeId);
          const variantName = normalizeBuildingDisplayName(building.displayName)
            ?? resolveCatalogVariantName(definition, building.id);
          const entry: OwnedDistrictBuildingIndexEntryView = {
            buildingId: building.id,
            buildingTypeId: building.buildingTypeId,
            label,
            displayName: variantName ?? label,
            variantName,
            level: building.level,
            status: building.status
          };
          return [entry];
        })
      };
    });
};
