import type { FactoryProductionBuildingView } from "@empire/shared-types";
import type { ResolvedGameModeConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { createTimedFactoryProductionBuildingView } from "./timed-production-projections";

export const createFactoryProductionBuildingView = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  playerId: string;
  config?: ResolvedGameModeConfig;
  tickRateMs?: number;
}): FactoryProductionBuildingView | null => createTimedFactoryProductionBuildingView(input);
