import type { BalanceConfig } from "../contracts/balance-config";
import { getAllPublicBuildingDefinitions } from "../public/building-definitions";

export const baseBuildingActionsConfig: NonNullable<BalanceConfig["buildingActions"]> =
  Object.fromEntries(
    getAllPublicBuildingDefinitions().flatMap((definition) =>
      definition.specialActions.map((action) => [
        action.actionId,
        {
          actionId: action.actionId,
          buildingType: definition.buildingTypeId,
          label: action.label,
          description: action.description,
          durationMs: action.durationMs,
          cooldownMs: action.cooldownMs,
          inputCost: { ...action.inputCost },
          outputGain: { ...action.outputGain },
          heatGain: action.heatGain,
          influenceChange: action.influenceChange,
          effectModifiers: action.effectModifiers ? { ...action.effectModifiers } : undefined,
          requiredOwner: true,
          allowedIfContested: false,
          reportText: action.reportText
        }
      ])
    )
  );
