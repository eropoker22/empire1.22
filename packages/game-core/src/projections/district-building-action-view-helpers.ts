import type { BuildingActionInputView, BuildingActionStatus } from "@empire/shared-types";
import type {
  AirportBalanceConfig,
  BuildingActionBalanceConfig,
  CentralBankBalanceConfig,
  CityHallBalanceConfig,
  StockExchangeBalanceConfig,
  StreetDealersBalanceConfig
} from "../contracts/game-mode-config";
import { formatNumber, formatResourceLabel } from "./district-building-action-formatters";
import type { CoreGameState } from "../entities";
import { getOwnedStreetDealerCount, resolveStreetDealerSlotCount } from "../handlers/streetDealersBuildingActions";

export const resolveBuildingActionStatus = (input: {
  disabledReason: string | null;
  cooldownRemainingTicks: number;
  missingCostCount: number;
}): BuildingActionStatus => {
  if (!input.disabledReason) return "available";
  if (input.cooldownRemainingTicks > 0) return "cooldown";
  if (input.missingCostCount > 0) return "missing_cost";
  return "blocked";
};

export const createExpectedEffectSummary = (action: BuildingActionBalanceConfig): string[] => [
  ...Object.entries(action.outputGain)
    .filter(([, amount]) => Number(amount || 0) > 0)
    .map(([resourceKey, amount]) => `+${formatNumber(amount)} ${formatResourceLabel(resourceKey)}`),
  action.influenceChange !== 0 ? `Vliv ${formatSigned(action.influenceChange)}` : "",
  action.durationMs > 0 ? `Trvání ${Math.ceil(action.durationMs / 1000)}s` : "",
  action.effectModifiers ? "Dočasný efekt budovy" : "",
  action.reportText
].filter(Boolean);

export const createRiskSummary = (action: BuildingActionBalanceConfig): string[] => [
  action.heatGain > 0 ? `Heat +${formatNumber(action.heatGain)}` : "",
  action.cooldownMs > 0 ? `Čekání ${Math.ceil(action.cooldownMs / 1000)}s` : ""
].filter(Boolean);

export const createRequiredInputViews = (input: {
  action: BuildingActionBalanceConfig;
  stockExchangeConfig?: StockExchangeBalanceConfig;
  centralBankConfig?: CentralBankBalanceConfig;
  airportConfig?: AirportBalanceConfig;
  cityHallConfig?: CityHallBalanceConfig;
  streetDealersConfig?: StreetDealersBalanceConfig;
  state?: CoreGameState;
  playerId?: string;
}): BuildingActionInputView[] => {
  const actionId = input.action.actionId;

  if (input.streetDealersConfig && actionId === input.streetDealersConfig.startDrugSale.actionId) {
    const ownedCount = input.state && input.playerId
      ? getOwnedStreetDealerCount(input.state, input.playerId, input.streetDealersConfig)
      : 0;
    const slotCount = resolveStreetDealerSlotCount(ownedCount, input.streetDealersConfig);
    return [
      {
        id: "dealerSlotId",
        type: "select",
        label: "Prodávaná látka",
        required: true,
        options: input.streetDealersConfig.dealerSlots.slice(0, slotCount).map((slot) => {
          const drug = input.streetDealersConfig?.sellableDrugs.find((candidate) => candidate.itemId === slot.itemId);
          return { value: slot.slotId, label: drug?.label || slot.itemId };
        })
      },
      {
        id: "amount",
        type: "number",
        label: "Množství",
        required: true,
        min: Math.min(...input.streetDealersConfig.sellableDrugs.map((drug) => drug.minimumAmountPerSale))
      }
    ];
  }

  if (input.airportConfig && actionId === input.airportConfig.expressImport.actionId) {
    return [createSelectInput("targetCategory", "Kategorie importu", input.airportConfig.expressImport.targetCategories)];
  }

  if (input.stockExchangeConfig && actionId === input.stockExchangeConfig.speculativeBuy.actionId) {
    return [
      createSelectInput("targetCategory", "Kategorie marketu", input.stockExchangeConfig.speculativeBuy.targetCategories),
      {
        id: "investmentCleanCash",
        type: "number",
        label: "Investice",
        required: true,
        min: 1
      }
    ];
  }

  if (input.stockExchangeConfig && actionId === input.stockExchangeConfig.marketPressure.actionId) {
    return [
      createSelectInput("targetCategory", "Kategorie marketu", input.stockExchangeConfig.marketPressure.targetCategories),
      createSelectInput("mode", "Režim tlaku", ["pump", "dump"])
    ];
  }

  if (input.centralBankConfig && actionId === input.centralBankConfig.currencyIntervention.actionId) {
    return [
      createSelectInput("targetCategory", "Kategorie marketu", input.centralBankConfig.currencyIntervention.targetCategories)
    ];
  }

  if (input.cityHallConfig && actionId === input.cityHallConfig.emergencyDecree.actionId) {
    return [
      createSelectInput("mode", "Režim vyhlášky", Object.keys(input.cityHallConfig.emergencyDecree.modes)),
      {
        id: "targetZone",
        type: "text",
        label: "Cílová zóna",
        required: false
      }
    ];
  }

  return [];
};

const createSelectInput = (
  id: string,
  label: string,
  values: string[]
): BuildingActionInputView => ({
  id,
  type: "select",
  label,
  required: true,
  options: values.map((value) => ({
    value,
    label: formatResourceLabel(value)
  }))
});

const formatSigned = (value: number): string =>
  value >= 0 ? `+${formatNumber(value)}` : formatNumber(value);
