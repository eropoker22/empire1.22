import type { RunBuildingActionCommand } from "@empire/shared-types";
import type { BuildingActionBalanceConfig } from "../contracts";
import type { GameCoreContext } from "../engine/context";
import type { CoreGameState } from "../entities";

export interface SpecificBuildingActionValidationInput {
  state: CoreGameState;
  command: RunBuildingActionCommand;
  context: GameCoreContext;
  player: CoreGameState["playersById"][string];
  district: CoreGameState["districtsById"][string];
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  balances: Record<string, number>;
}
