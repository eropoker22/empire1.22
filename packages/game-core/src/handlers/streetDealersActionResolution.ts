import type { RunBuildingActionCommand } from "@empire/shared-types";
import type { BuildingActionBalanceConfig, SmugglingTunnelBalanceConfig, StreetDealersBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { composeEntityId } from "../utils";
import { resolveDealerSupplyStats, resolveOpenChannelStats } from "./smugglingTunnelBuildingActions";
import {
  resolveDrugConfig,
  resolveRequestedSlotId,
  resolveStreetRiskPct,
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
}): StreetDealersActionResolution | null => {
  if (input.action.actionId !== input.config.startDrugSale.actionId || input.building.buildingTypeId !== input.config.buildingTypeId) {
    return null;
  }

  const ownedCount = getOwnedStreetDealerCount(input.state, input.player.id, input.config);
  const slotCount = resolveStreetDealerSlotCount(ownedCount, input.config);
  const slotId = resolveRequestedSlotId(input.command.payload, slotCount);
  const drug = resolveDrugConfig(input.command.payload.itemId, input.config);
  const amount = Math.floor(Number(input.command.payload.amount || 0));
  const network = resolveStreetDealerNetworkMultipliers(ownedCount, input.config);
  const dealerSupply = resolveDealerSupplyStats({ state: input.state, playerId: input.player.id, config: input.smugglingTunnelConfig });
  const openChannel = resolveOpenChannelStats({
    state: input.state,
    playerId: input.player.id,
    config: input.smugglingTunnelConfig,
    tick: input.state.root.tick
  });
  const salePriceMultiplier = network.salePriceMultiplier
    * (1 + dealerSupply.salePriceBonusPct / 100 + openChannel.dealerSalePriceBonusPct / 100);
  const saleSpeedMultiplier = network.saleSpeedMultiplier
    * (1 + dealerSupply.saleSpeedBonusPct / 100 + openChannel.dealerSaleSpeedBonusPct / 100);
  const saleHeatMultiplier = network.heatMultiplier
    * (1 + dealerSupply.saleHeatRiskBonusPct / 100);
  const rewardDirtyCash = Math.floor(amount * drug.basePriceDirtyCash * salePriceMultiplier);
  const durationTicks = Math.max(
    1,
    Math.ceil((drug.baseDurationMinutes * 60000 / saleSpeedMultiplier) / Math.max(1, input.tickRateMs))
  );
  const heatGain = Math.ceil(amount * drug.baseHeatPerUnit * saleHeatMultiplier);
  const heatPreview = Math.ceil(heatGain * (1 + openChannel.dealerSaleHeatBonusPct / 100));
  const streetRiskPct = resolveStreetRiskPct(amount, drug, input.config, dealerSupply.streetRiskReductionPct);
  const streetRiskPreviewPct = Math.min(input.config.streetIncidents.maxStreetRiskPct, streetRiskPct + openChannel.streetIncidentFlatRiskPct);
  const metadata = getStreetDealersPlayerMetadata(input.player);
  const nextSlot: StreetDealerSaleSlot = {
    slotId,
    saleId: composeEntityId("street-sale", `${input.command.id}:${slotId}`),
    itemId: drug.itemId,
    itemLabel: drug.label,
    amount,
    startedAtTick: input.state.root.tick,
    completesAtTick: input.state.root.tick + durationTicks,
    rewardDirtyCash,
    heatGain,
    streetRiskPct,
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
    reportText: `Dealer slot ${slotId} prodává ${amount}x ${drug.label}. Hotovo za ${durationTicks} ticků, street risk ${streetRiskPct} %.`,
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
        salePriceMultiplier,
        saleSpeedMultiplier,
        saleHeatMultiplier
      },
      rewardPreviewDirtyCash: rewardDirtyCash,
      heatPreview,
      durationTicks,
      completesAtTick: nextSlot.completesAtTick,
      streetRiskPct: streetRiskPreviewPct
    }
  };
};

