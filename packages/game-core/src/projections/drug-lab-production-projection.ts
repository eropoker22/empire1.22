import type { DrugLabProductionBuildingView } from "@empire/shared-types";
import type { ResolvedGameModeConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { createTimedDrugLabProductionBuildingView } from "./timed-production-projections";

export const createDrugLabProductionBuildingView = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  playerId: string;
  config?: ResolvedGameModeConfig;
  tickRateMs?: number;
}): DrugLabProductionBuildingView | null => createTimedDrugLabProductionBuildingView(input);
