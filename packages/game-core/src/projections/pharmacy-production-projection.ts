import type { PharmacyProductionBuildingView } from "@empire/shared-types";
import type { ResolvedGameModeConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { createTimedPharmacyProductionBuildingView } from "./timed-production-projections";

export const createPharmacyProductionBuildingView = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  playerId: string;
  config?: ResolvedGameModeConfig;
  tickRateMs?: number;
}): PharmacyProductionBuildingView | null => createTimedPharmacyProductionBuildingView(input);
