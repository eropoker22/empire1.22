import type { RunBuildingActionCommand } from "@empire/shared-types";
import type { BuildingActionBalanceConfig, SmugglingTunnelBalanceConfig, StreetDealersBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import { resolveDayNightActionRule } from "../rules/day-night/dayNightActionRules";
import { composeEntityId } from "../utils";
import { resolveDealerSupplyStats, resolveOpenChannelStats } from "./smugglingTunnelBuildingActions";
import {
  minutesToTicks,
  resolveRequestedSlotId,
  resolveStreetRiskPct,
  resolveStreetDealerSlotDrug,
  upsertSlot
} from "./streetDealersActionHelpers";
import { getStreetDealersPlayerMetadata, withStreetDealersPlayerMetadata } from "./streetDealersMetadata";
import { getOwnedStreetDealerCount, resolveStreetDealerNetworkMultipliers, resolveStreetDealerSlotCount } from "./streetDealersNetwork";
import { resolveSaleCompletion } from "./streetDealersSaleOutcomes";
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
  const heatPreview = Math.ceil(baseHeatGain * (1 + openChannel.dealerSaleHeatBonusPct / 100));
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
  const saleSlot: StreetDealerSaleSlot = {
    slotId,
    saleId: composeEntityId(
      "street-sale",
      `${input.player.id}:${input.building.id}:${slotId}:${input.state.root.tick}`
    ),
    itemId: drug.itemId,
    itemLabel: drug.label,
    amount,
    startedAtTick: input.state.root.tick,
    completesAtTick: input.state.root.tick,
    rewardDirtyCash,
    heatGain: baseHeatGain,
    streetRiskPct: effectiveStreetRiskPct,
    originDistrictId: input.command.payload.districtId,
    originBuildingId: input.command.payload.buildingId
  };
  const completion = resolveSaleCompletion({
    state: input.state,
    playerId: input.player.id,
    slot: saleSlot,
    config: input.config,
    smugglingTunnelConfig: input.smugglingTunnelConfig,
    tickRateMs: input.tickRateMs
  });
  const incidentCooldownTicks = minutesToTicks(
    Number(completion.incident?.extraCooldownMinutes || 0),
    input.tickRateMs
  );
  const cooldownUntilTick = input.state.root.tick + durationTicks
    + (completion.incident?.extraCooldownMinutes ? incidentCooldownTicks : 0);
  const nextSlot: StreetDealerSaleSlot = { slotId, cooldownUntilTick };
  const result = {
    type: "sale_completed",
    slotId,
    itemId: drug.itemId,
    itemLabel: drug.label,
    amount,
    rewardDirtyCash: completion.rewardDirtyCash,
    baseRewardDirtyCash,
    heatGain: completion.heatGain,
    streetRiskPct: effectiveStreetRiskPct,
    incident: completion.incident,
    cooldownUntilTick,
    instant: true
  };
  const nextMetadata: StreetDealersPlayerMetadata = {
    slots: upsertSlot(metadata.slots, nextSlot),
    saleHistory: [...metadata.saleHistory, { tick: input.state.root.tick, ...result }].slice(-20)
  };

  return {
    balances: {
      ...input.balances,
      [drug.itemId]: Math.max(0, Number(input.balances[drug.itemId] || 0) - amount),
      "dirty-cash": Math.max(0, Number(input.balances["dirty-cash"] || 0) + completion.rewardDirtyCash)
    },
    playerMetadata: withStreetDealersPlayerMetadata(input.player, nextMetadata),
    heatGain: completion.heatGain,
    influenceChange: 0,
    inputCost: { [drug.itemId]: amount },
    outputGain: { "dirty-cash": completion.rewardDirtyCash },
    reportText: `Pouliční dealeři okamžitě prodali ${amount}x ${drug.label} za ${completion.rewardDirtyCash} dirty cash; pouliční riziko ${effectiveStreetRiskPct} %.`,
    streetDealerResult: {
      ...result,
      ownedStreetDealers: ownedCount,
      availableSlots: slotCount,
      multipliers: network,
      dealerSupply,
      openChannel,
      effectiveMultipliers: {
        saleSpeedMultiplier,
        saleHeatMultiplier
      },
      rewardPreviewDirtyCash: completion.rewardDirtyCash,
      heatPreview: completion.heatGain,
      cooldownTicks: durationTicks,
      streetRiskPct: effectiveStreetRiskPct,
      dayNightPhase: phaseRule.phaseId
    }
  };
};
