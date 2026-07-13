import type { ResolvedGameModeConfig } from "../../contracts/game-mode-config";
import { freeModeInstitutionalBuildingActions } from "./free-mode-institutional-building-actions";
import { freeModeRecoveryBuildingActions } from "./free-mode-recovery-building-actions";
import { freeModeRestaurantBuildingActions } from "./free-mode-restaurant-building-actions";
import { freeModeVenueBuildingActions } from "./free-mode-venue-building-actions";

export const freeModeBuildingActions: NonNullable<ResolvedGameModeConfig["balance"]["buildingActions"]> = {
  ...freeModeInstitutionalBuildingActions,
  ...freeModeRecoveryBuildingActions,
  ...freeModeRestaurantBuildingActions,
  ...freeModeVenueBuildingActions
};
