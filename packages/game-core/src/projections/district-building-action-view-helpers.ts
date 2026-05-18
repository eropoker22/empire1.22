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
  action.influenceChange !== 0 ? `Influence ${formatSigned(action.influenceChange)}` : "",
  action.durationMs > 0 ? `Duration ${Math.ceil(action.durationMs / 1000)}s` : "",
  action.effectModifiers ? "Timed building effect" : "",
  action.reportText
].filter(Boolean);

export const createRiskSummary = (action: BuildingActionBalanceConfig): string[] => [
  action.heatGain > 0 ? `Heat +${formatNumber(action.heatGain)}` : "",
  action.cooldownMs > 0 ? `Cooldown ${Math.ceil(action.cooldownMs / 1000)}s` : ""
].filter(Boolean);

export const createRequiredInputViews = (input: {
  action: BuildingActionBalanceConfig;
  stockExchangeConfig?: StockExchangeBalanceConfig;
  centralBankConfig?: CentralBankBalanceConfig;
  airportConfig?: AirportBalanceConfig;
  cityHallConfig?: CityHallBalanceConfig;
  streetDealersConfig?: StreetDealersBalanceConfig;
}): BuildingActionInputView[] => {
  const actionId = input.action.actionId;

  if (input.streetDealersConfig && actionId === input.streetDealersConfig.startDrugSale.actionId) {
    return [
      {
        id: "dealerSlotId",
        type: "select",
        label: "Dealer slot",
        required: true,
        options: Array.from({ length: 5 }, (_value, index) => ({
          value: `slot-${index + 1}`,
          label: `Slot ${index + 1}`
        }))
      },
      {
        id: "itemId",
        type: "select",
        label: "Drug item",
        required: true,
        options: input.streetDealersConfig.sellableDrugs.map((drug) => ({
          value: drug.itemId,
          label: drug.label
        }))
      },
      {
        id: "amount",
        type: "number",
        label: "Amount",
        required: true,
        min: 1,
        max: 12
      }
    ];
  }

  if (input.airportConfig && actionId === input.airportConfig.expressImport.actionId) {
    return [createSelectInput("targetCategory", "Import category", input.airportConfig.expressImport.targetCategories)];
  }

  if (input.stockExchangeConfig && actionId === input.stockExchangeConfig.speculativeBuy.actionId) {
    return [
      createSelectInput("targetCategory", "Market category", input.stockExchangeConfig.speculativeBuy.targetCategories),
      {
        id: "investmentCleanCash",
        type: "number",
        label: "Investment",
        required: true,
        min: 1
      }
    ];
  }

  if (input.stockExchangeConfig && actionId === input.stockExchangeConfig.marketPressure.actionId) {
    return [
      createSelectInput("targetCategory", "Market category", input.stockExchangeConfig.marketPressure.targetCategories),
      createSelectInput("mode", "Pressure mode", ["pump", "dump"])
    ];
  }

  if (input.centralBankConfig && actionId === input.centralBankConfig.currencyIntervention.actionId) {
    return [
      createSelectInput("targetCategory", "Market category", input.centralBankConfig.currencyIntervention.targetCategories)
    ];
  }

  if (input.cityHallConfig && actionId === input.cityHallConfig.emergencyDecree.actionId) {
    return [
      createSelectInput("mode", "Decree mode", Object.keys(input.cityHallConfig.emergencyDecree.modes)),
      {
        id: "targetZone",
        type: "text",
        label: "Target zone",
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
