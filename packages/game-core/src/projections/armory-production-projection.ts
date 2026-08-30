import type { ArmoryProductionBuildingView } from "@empire/shared-types";
import type { ResolvedGameModeConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { createTimedArmoryProductionBuildingView } from "./timed-production-projections";

export const createArmoryProductionBuildingView = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  playerId: string;
  config?: ResolvedGameModeConfig;
  tickRateMs?: number;
}): ArmoryProductionBuildingView | null => createTimedArmoryProductionBuildingView(input);
