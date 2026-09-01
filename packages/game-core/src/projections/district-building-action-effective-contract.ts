import type { BuildingActionBalanceConfig, ResolvedGameModeConfig } from "../contracts/game-mode-config";
import type { CoreGameState } from "../entities/game-state";
import { resolveEffectiveBuildingActionPreview } from "../rules/buildings/buildingActionCosts";
import { resolveBuildingActionContractPreview } from "./district-building-action-contract-preview";
import { createBaseBuildingActionPreview } from "./district-building-display-helpers";

export const resolveProjectedBuildingActionContract = (input: {
  state: CoreGameState;
  config?: ResolvedGameModeConfig;
  building: CoreGameState["buildingsById"][string];
  district: CoreGameState["districtsById"][string];
  action: BuildingActionBalanceConfig;
  playerId: string;
  playerBalances: Record<string, number>;
}) => {
  const actionContract = input.config
    ? resolveBuildingActionContractPreview({ ...input, config: input.config })
    : null;
  const projectedAction = actionContract?.action ?? input.action;
  const effectivePreview = input.config
    ? resolveEffectiveBuildingActionPreview({
        action: projectedAction,
        state: input.state,
        context: { config: input.config },
        buildingTypeId: input.building.buildingTypeId
      })
    : createBaseBuildingActionPreview(projectedAction);
  const minimumCostPreview = input.config && actionContract?.minimumInputCost
    ? resolveEffectiveBuildingActionPreview({
        action: { ...projectedAction, inputCost: actionContract.minimumInputCost },
        state: input.state,
        context: { config: input.config },
        buildingTypeId: input.building.buildingTypeId
      })
    : effectivePreview;
  return { actionContract, projectedAction, effectivePreview, minimumCostPreview };
};
