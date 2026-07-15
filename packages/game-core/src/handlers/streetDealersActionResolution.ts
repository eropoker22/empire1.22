import type { RunBuildingActionCommand } from "@empire/shared-types";
import type { BuildingActionBalanceConfig, SmugglingTunnelBalanceConfig, StreetDealersBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import {
  applyDayNightActionHeat,
  resolveDayNightActionRule
} from "../rules/day-night/dayNightActionRules";
import { composeEntityId } from "../utils";
import { resolveDealerSupplyStats, resolveOpenChannelStats } from "./smugglingTunnelBuildingActions";
import {
  resolveRequestedSlotId,
  resolveStreetRiskPct,
  resolveStreetDealerSlotDrug,
  upsertSlot
} from "./streetDealersActionHelpers";
import { getStreetDealersPlayerMetadata, withStreetDealersPlayerMetadata } from "./streetDealersMetadata";
import { getOwnedStreetDealerCount, resolveStreetDealerNetworkMultipliers, resolveStreetDealerSlotCount } from "./streetDealersNetwork";
import type { StreetDealerSaleSlot, StreetDealersActionResolution, StreetDealersPlayerMetadata } from "./streetDealersTypes";
export const resolveStreetDealersAction = (input: {
  state: CoreGameState;
  player: CoreGameState["playersById"][string];
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  command: RunBuildingActionCommand;
  balances: Record<string, number>;
  config: StreetDealersBalanceConfig;
  smugglingTunnelConfig?: SmugglingTunnelBalanceConfig;
  tickRateMs: number;
  context: Pick<GameCoreContext, "config">;
}): StreetDealersActionResolution | null => {
  if (input.action.actionId !== input.config.startDrugSale.actionId || input.building.buildingTypeId !== input.config.buildingTypeId) {
    return null;
  }

  const ownedCount = getOwnedStreetDealerCount(input.state, input.player.id, input.config);
  const slotCount = resolveStreetDealerSlotCount(ownedCount, input.config);
  const slotId = resolveRequestedSlotId(input.command.payload, slotCount);
  const drug = resolveStreetDealerSlotDrug(slotId, input.config);
  if (!drug) return null;
  const amount = Number(input.command.payload.amount);
  const network = resolveStreetDealerNetworkMultipliers(ownedCount, input.config);
  const dealerSupply = resolveDealerSupplyStats({ state: input.state, playerId: input.player.id, config: input.smugglingTunnelConfig });
  const openChannel = resolveOpenChannelStats({
    state: input.state,
    playerId: input.player.id,
    config: input.smugglingTunnelConfig,
    tick: input.state.root.tick
  });
  const saleSpeedMultiplier = network.saleSpeedMultiplier
    * (1 + dealerSupply.saleSpeedBonusPct / 100 + openChannel.dealerSaleSpeedBonusPct / 100);
  const saleHeatMultiplier = network.heatMultiplier
    * (1 + dealerSupply.saleHeatRiskBonusPct / 100);
  const baseRewardDirtyCash = Math.floor(amount * drug.unitSalePriceDirtyCash);
  const durationTicks = Math.max(
    1,
    Math.ceil((drug.cooldownMinutes * 60000 / saleSpeedMultiplier) / Math.max(1, input.tickRateMs))
  );
  const baseHeatGain = Math.ceil(amount * drug.baseHeatPerUnit * saleHeatMultiplier);
  const rewardDirtyCash = baseRewardDirtyCash;
  const heatGain = applyDayNightActionHeat(
    baseHeatGain,
    input.state,
    input.context,
    input.action.actionId,
    input.building.buildingTypeId
  );
  const heatPreview = Math.ceil(heatGain * (1 + openChannel.dealerSaleHeatBonusPct / 100));
  const streetRiskPct = resolveStreetRiskPct(amount, drug, input.config, dealerSupply.streetRiskReductionPct);
  const phaseRule = resolveDayNightActionRule(
    input.state,
    input.context,
    input.action.actionId,
    input.building.buildingTypeId
  );
  const phaseRiskPct = phaseRule.appliesModifiers
    ? Math.max(0, Number(phaseRule.rule?.detectionChanceModifierPct ?? 0))
    : 0;
  const effectiveStreetRiskPct = Math.min(
    input.config.streetIncidents.maxStreetRiskPct,
    streetRiskPct + openChannel.streetIncidentFlatRiskPct + phaseRiskPct
  );
  const metadata = getStreetDealersPlayerMetadata(input.player);
  const nextSlot: StreetDealerSaleSlot = {
    slotId,
    saleId: composeEntityId(
      "street-sale",
      `${input.player.id}:${input.building.id}:${slotId}:${input.state.root.tick}`
    ),
    itemId: drug.itemId,
    itemLabel: drug.label,
    amount,
    startedAtTick: input.state.root.tick,
    completesAtTick: input.state.root.tick + durationTicks,
    rewardDirtyCash,
    heatGain,
    streetRiskPct: effectiveStreetRiskPct,
    originDistrictId: input.command.payload.districtId,
    originBuildingId: input.command.payload.buildingId
  };
  const nextMetadata: StreetDealersPlayerMetadata = {
    slots: upsertSlot(metadata.slots, nextSlot),
    saleHistory: metadata.saleHistory
  };

  return {
    balances: {
      ...input.balances,
      [drug.itemId]: Math.max(0, Number(input.balances[drug.itemId] || 0) - amount)
    },
    playerMetadata: withStreetDealersPlayerMetadata(input.player, nextMetadata),
    heatGain: 0,
    influenceChange: 0,
    inputCost: { [drug.itemId]: amount },
    outputGain: {},
    reportText: `Pouliční dealeři prodávají ${amount}x ${drug.label}. Hotovo za ${durationTicks} ticků, pouliční riziko ${effectiveStreetRiskPct} %.`,
    streetDealerResult: {
      type: "sale_started",
      slotId,
      itemId: drug.itemId,
      itemLabel: drug.label,
      amount,
      ownedStreetDealers: ownedCount,
      availableSlots: slotCount,
      multipliers: network,
      dealerSupply,
      openChannel,
      effectiveMultipliers: {
        saleSpeedMultiplier,
        saleHeatMultiplier
      },
      rewardPreviewDirtyCash: rewardDirtyCash,
      heatPreview,
      durationTicks,
      completesAtTick: nextSlot.completesAtTick,
      streetRiskPct: effectiveStreetRiskPct,
      dayNightPhase: phaseRule.phaseId
    }
  };
};
