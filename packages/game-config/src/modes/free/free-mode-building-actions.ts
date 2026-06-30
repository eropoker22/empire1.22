import type { ResolvedGameModeConfig } from "../../contracts/game-mode-config";
import { freeModeInstitutionalBuildingActions } from "./free-mode-institutional-building-actions";
import { freeModeProductionBuildingActions } from "./free-mode-production-building-actions";
import { freeModeRecoveryBuildingActions } from "./free-mode-recovery-building-actions";
import { freeModeRestaurantBuildingActions } from "./free-mode-restaurant-building-actions";
import { freeModeVenueBuildingActions } from "./free-mode-venue-building-actions";

export const freeModeBuildingActions: NonNullable<ResolvedGameModeConfig["balance"]["buildingActions"]> = {
  ...freeModeProductionBuildingActions,
  ...freeModeInstitutionalBuildingActions,
  ...freeModeRecoveryBuildingActions,
  ...freeModeRestaurantBuildingActions,
  ...freeModeVenueBuildingActions
};
