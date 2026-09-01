import type {
  BuildingActionInputView,
  BuildingActionStatus,
  DistrictPanelDealerSaleView
} from "@empire/shared-types";
import type {
  AirportBalanceConfig,
  BuildingActionBalanceConfig,
  CentralBankBalanceConfig,
  CityHallBalanceConfig,
  DayNightActionRuleConfig,
  StockExchangeBalanceConfig,
  StreetDealersBalanceConfig
} from "../contracts/game-mode-config";
import { formatNumber, formatResourceLabel } from "./district-building-action-formatters";
import type { CoreGameState } from "../entities";
import {
  getOwnedStreetDealerCount,
  getStreetDealersPlayerMetadata,
  resolveStreetDealerSlotCount
} from "../handlers/streetDealersBuildingActions";

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
  inputDefaultValues?: Record<string, string | number>; inputMaximumValues?: Record<string, number>;
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
        min: 1,
        max: Math.max(1, Number(input.inputMaximumValues?.investmentCleanCash || input.stockExchangeConfig.speculativeBuy.maxInvestmentCleanCash)), defaultValue: Math.max(1, Number(input.inputDefaultValues?.investmentCleanCash || 1))
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
      createSelectInput(
        "mode",
        "Režim vyhlášky",
        Object.values(input.cityHallConfig.emergencyDecree.modes).map((mode) => mode.modeId)
      ),
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

export const createStreetDealerSaleView = (input: {
  config?: StreetDealersBalanceConfig;
  state: CoreGameState;
  playerId: string;
  playerBalances: Record<string, number>;
  currentPhase: "day" | "night";
  dayNightRule?: DayNightActionRuleConfig;
  tick: number;
  tickRateMs: number;
}): DistrictPanelDealerSaleView | null => {
  const config = input.config;
  const player = input.state.playersById[input.playerId];
  if (!config || !player) return null;
  const ownedCount = getOwnedStreetDealerCount(input.state, input.playerId, config);
  const slotCount = resolveStreetDealerSlotCount(ownedCount, config);
  const metadata = getStreetDealersPlayerMetadata(player);
  const lockedSlots = metadata.slots.filter(
    (slot) => Boolean(slot.saleId) || Number(slot.cooldownUntilTick || 0) > input.tick
  );
  const lockedSlotsById = new Map(lockedSlots.map((slot) => [slot.slotId, slot]));
  const anySaleActive = lockedSlots.length > 0;
  const items = config.sellableDrugs.map((drug) => ({
    itemId: drug.itemId,
    label: drug.label,
    ownedAmount: resolvePlayerResourceAmount(input.playerBalances, drug.itemId, drug.aliases),
    minimumAmountPerSale: Math.max(1, Number(drug.minimumAmountPerSale || 1)),
    unitSalePriceDirtyCash: Math.max(0, Number(drug.unitSalePriceDirtyCash || 0))
  }));
  const itemsById = new Map(items.map((item) => [item.itemId, item]));
  return {
    phase: input.currentPhase === "day" ? "day" : "night",
    phaseStatusLabel: createStreetDealerPhaseStatusLabel(input.currentPhase, input.dayNightRule),
    slotCount,
    slots: config.dealerSlots.slice(0, slotCount).map((slot) => {
      const item = itemsById.get(slot.itemId);
      const activeSale = lockedSlotsById.get(slot.slotId);
      return {
        slotId: slot.slotId,
        label: item?.label || slot.itemId,
        itemId: item?.itemId || slot.itemId,
        itemLabel: item?.label || slot.itemId,
        ownedAmount: item?.ownedAmount || 0,
        unitSalePriceDirtyCash: item?.unitSalePriceDirtyCash || 0,
        minimumAmountPerSale: item?.minimumAmountPerSale || 1,
        locked: anySaleActive,
        statusLabel: activeSale?.saleId
          ? "Starý prodej se dokončí při synchronizaci"
          : Number(activeSale?.cooldownUntilTick || 0) > input.tick
            ? `Cooldown · ${formatRemainingDuration(
                (Number(activeSale?.cooldownUntilTick || input.tick) - input.tick) * input.tickRateMs
              )}`
            : ""
      };
    }),
    items
  };
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

const resolvePlayerResourceAmount = (
  balances: Record<string, number>,
  itemId: string,
  aliases: string[] = []
): number => {
  for (const key of [itemId, ...aliases]) {
    const value = balances[key];
    if (value !== undefined && Number.isFinite(Number(value))) {
      return Math.max(0, Math.floor(Number(value)));
    }
  }
  return 0;
};

const createStreetDealerPhaseStatusLabel = (
  phase: "day" | "night",
  rule?: DayNightActionRuleConfig
): string => {
  const phaseLabel = phase === "day" ? "DEN" : "NOC";
  const appliesPenalty = Boolean(rule?.preferredPhase && rule.preferredPhase !== phase);
  if (!appliesPenalty) return `${phaseLabel}: standardní výnos`;

  const details = [
    formatMultiplierDelta("výnos", rule?.rewardMultiplier),
    formatMultiplierDelta("heat", rule?.heatMultiplier),
    Number(rule?.detectionChanceModifierPct || 0) > 0
      ? `riziko +${formatNumber(Number(rule?.detectionChanceModifierPct || 0))} p. b.`
      : ""
  ].filter(Boolean);
  return details.length > 0 ? `${phaseLabel}: ${details.join(", ")}` : `${phaseLabel}: standardní výnos`;
};

const formatMultiplierDelta = (label: string, multiplier: number | undefined): string => {
  const value = Number(multiplier);
  if (!Number.isFinite(value) || Math.abs(value - 1) < 0.001) return "";
  const percentage = (value - 1) * 100;
  return `${label} ${percentage >= 0 ? "+" : ""}${formatCompactNumber(percentage)} %`;
};

const formatCompactNumber = (value: number): string =>
  String(Number(Number(value || 0).toFixed(2)));

const formatRemainingDuration = (remainingMs: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${seconds}s`;
};
