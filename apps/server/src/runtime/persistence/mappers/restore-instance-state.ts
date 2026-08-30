import {
  migratePharmacyProductionState,
  migrateDrugLabProductionState,
  migrateFactoryProductionState,
  migrateArmoryProductionState,
  migrateConflictState,
  migrateStarterDistrictProductionBuildings,
  normalizePlayerPopulationState,
  normalizePlayerStorageResourceAliases,
  type CoreGameState
} from "@empire/game-core";
import type { InstanceSnapshotDto } from "../dto";
import type { GameCoreContext } from "@empire/game-core";

/**
 * Responsibility: Restores authoritative state from a validated snapshot DTO.
 * Belongs here: pure mapping from persistence snapshot shape back to core state.
 * Does not belong here: runtime scheduler creation or repository access.
 */
export const restoreInstanceState = (
  snapshot: InstanceSnapshotDto,
  _context?: Pick<GameCoreContext, "config">
): CoreGameState => {
  const migrated = migrateConflictState(
    migrateArmoryProductionState(
      migrateFactoryProductionState(
        migrateDrugLabProductionState(
          migratePharmacyProductionState(
            migrateStarterDistrictProductionBuildings(
              normalizePlayerPopulationState(
                normalizePlayerStorageResourceAliases(snapshot.state)
              )
            )
          )
        )
      )
    )
  );
  return migrated;
};
