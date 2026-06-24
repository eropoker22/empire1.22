import {
  getOwnedCarDealerCount,
  resolveCarDealerNetworkMultipliers,
  resolveCarDealerSupportStats
} from "../handlers/carDealerBuildingActions";
import {
  getOwnedSmugglingTunnelCount,
  resolveDealerSupplyStats,
  resolveOpenChannelStats,
  resolveSmugglingTunnelNetworkMultipliers
} from "../handlers/smugglingTunnelBuildingActions";
import {
  getOwnedStreetDealerCount,
  getStreetDealersPlayerMetadata,
  resolveStreetDealerNetworkMultipliers,
  resolveStreetDealerSlotCount
} from "../handlers/streetDealersBuildingActions";
import {
  getVipLoungeMetadata,
  resolveVipLoungeRumorStats
} from "../handlers/vipLoungeBuildingActions";
import { formatCategoryList, formatNumber, formatTickLabel } from "./district-building-action-formatters";
import type { BuildingStatsProjectionInput, BuildingStatView } from "./district-building-stats-types";

export const createMarketBuildingStats = (input: BuildingStatsProjectionInput): BuildingStatView[] | null => {
  if (input.building.buildingTypeId === "vip_lounge" && input.vipLoungeConfig && input.building.ownerPlayerId) {
    const stats = resolveVipLoungeRumorStats({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.vipLoungeConfig
    });
    const metadata = getVipLoungeMetadata(input.building);
    const latestRumorStatus = metadata.rumorEvents.length > 0 ? "available in city feed" : "waiting for next whisper";
    return [
      { label: "Clean / min", value: `$${formatNumber(input.vipLoungeConfig.cleanCashPerMinute * stats.tier.incomeMultiplier)}` },
      { label: "Dirty / min", value: `$${formatNumber(input.vipLoungeConfig.dirtyCashPerMinute * stats.tier.incomeMultiplier)}` },
      { label: "Influence / min", value: formatNumber(input.vipLoungeConfig.influencePerMinute * stats.tier.influenceMultiplier) },
      { label: "Heat / min", value: formatNumber(input.vipLoungeConfig.heatPerMinute * stats.tier.heatMultiplier) },
      { label: "Owned VIP lounges", value: `${stats.ownedCount}/${input.vipLoungeConfig.countOnMap}` },
      { label: "Rumor interval", value: `${formatNumber(stats.rumorIntervalMinutes)} min` },
      { label: "Backroom rumor chance", value: `${formatNumber(stats.passiveRumorChancePct)} %` },
      { label: "Truth chance", value: `${formatNumber(stats.truthChancePct)} %` },
      { label: "District hint chance", value: `${formatNumber(stats.districtHintChancePct)} %` },
      { label: "Building hint chance", value: `${formatNumber(stats.buildingHintChancePct)} %` },
      { label: "Reliability label chance", value: `${formatNumber(stats.reliabilityLabelChancePct)} %` },
      { label: "Latest backroom rumor", value: latestRumorStatus }
    ];
  }
  if (input.building.buildingTypeId === "car_dealer" && input.carDealerConfig && input.building.ownerPlayerId) {
    const ownedCount = getOwnedCarDealerCount(input.state, input.building.ownerPlayerId, input.carDealerConfig);
    const network = resolveCarDealerNetworkMultipliers(ownedCount, input.carDealerConfig);
    const support = resolveCarDealerSupportStats({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.carDealerConfig,
      garageConfig: input.garageConfig
    });
    return [
      { label: "Clean / min", value: `$${formatNumber(input.carDealerConfig.cleanCashPerMinute * network.cleanIncomeMultiplier)}` },
      { label: "Dirty / min", value: `$${formatNumber(input.carDealerConfig.dirtyCashPerMinute * network.dirtyIncomeMultiplier)}` },
      { label: "Heat / min", value: formatNumber(input.carDealerConfig.heatPerMinute * network.heatMultiplier) },
      { label: "Owned car dealers", value: `${ownedCount}/${input.carDealerConfig.countOnMap}` },
      { label: "Clean income multiplier", value: `x${formatNumber(network.cleanIncomeMultiplier)}` },
      { label: "Dirty income multiplier", value: `x${formatNumber(network.dirtyIncomeMultiplier)}` },
      { label: "Mobility bonus", value: `+${formatNumber(support.mobilityBonusPct)} %` },
      { label: "Cooldown reduction", value: `-${formatNumber(support.cooldownReductionPct)} %` },
      { label: "Escape chance bonus", value: `+${formatNumber(support.escapeChanceBonusPct)} %` },
      { label: "Garage + dealer cap", value: `-${formatNumber(support.combinedGarageDealerMaxReductionPct)} %` },
      { label: "Applies to", value: formatCategoryList([...support.fullBonusCategories, ...support.halfBonusCategories, ...support.smallBonusCategories]) },
      { label: "No bonus", value: formatCategoryList(support.excludedCategories) }
    ];
  }
  if (input.building.buildingTypeId === "smuggling_tunnel" && input.smugglingTunnelConfig && input.building.ownerPlayerId) {
    const ownedCount = getOwnedSmugglingTunnelCount(input.state, input.building.ownerPlayerId, input.smugglingTunnelConfig);
    const network = resolveSmugglingTunnelNetworkMultipliers(ownedCount, input.smugglingTunnelConfig);
    const dealerSupply = resolveDealerSupplyStats({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.smugglingTunnelConfig
    });
    const openChannel = resolveOpenChannelStats({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.smugglingTunnelConfig,
      tick: input.tick
    });
    const productionPerMinute = input.smugglingTunnelConfig.dirtyCashPerMinute
      * network.dirtyProductionMultiplier
      * (1 + openChannel.tunnelDirtyProductionBonusPct / 100);
    const heatPerMinute = input.smugglingTunnelConfig.heatPerMinute * network.heatMultiplier;
    return [
      { label: "Dirty / min", value: `$${formatNumber(productionPerMinute)}` },
      { label: "Heat / min", value: formatNumber(heatPerMinute) },
      { label: "Owned tunnels", value: `${ownedCount}/${input.smugglingTunnelConfig.countOnMap}` },
      { label: "Dirty production multiplier", value: `x${formatNumber(network.dirtyProductionMultiplier)}` },
      { label: "Heat multiplier", value: `x${formatNumber(network.heatMultiplier)}` },
      { label: "Dealer Supply bonus", value: `+${formatNumber(dealerSupply.dealerSupplyBonusPct)} %` },
      { label: "Kontraband Flow", value: dealerSupply.contrabandFlowLabel },
      { label: "Dealer sale price bonus", value: `+${formatNumber(dealerSupply.salePriceBonusPct + openChannel.dealerSalePriceBonusPct)} %` },
      { label: "Dealer sale speed bonus", value: `+${formatNumber(dealerSupply.saleSpeedBonusPct + openChannel.dealerSaleSpeedBonusPct)} %` },
      { label: "Dealer passive dirty bonus", value: `+${formatNumber(dealerSupply.passiveDirtyIncomeBonusPct)} %` },
      { label: "Dealer street risk reduction", value: `-${formatNumber(dealerSupply.streetRiskReductionPct)} %` },
      { label: "Dealer heat risk bonus", value: `+${formatNumber(dealerSupply.saleHeatRiskBonusPct + openChannel.dealerSaleHeatBonusPct)} %` },
      { label: "Otevřít kanál", value: openChannel.active ? `active ${formatTickLabel(openChannel.remainingTicks)}` : "ready when off cooldown" },
      { label: "Boost incident risk", value: `+${formatNumber(openChannel.streetIncidentFlatRiskPct)} %` }
    ];
  }
  if (input.building.buildingTypeId === "street_dealers" && input.streetDealersConfig && input.building.ownerPlayerId) {
    const player = input.state.playersById[input.building.ownerPlayerId];
    const ownedCount = getOwnedStreetDealerCount(input.state, input.building.ownerPlayerId, input.streetDealersConfig);
    const network = resolveStreetDealerNetworkMultipliers(ownedCount, input.streetDealersConfig);
    const dealerSupply = resolveDealerSupplyStats({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.smugglingTunnelConfig
    });
    const openChannel = resolveOpenChannelStats({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.smugglingTunnelConfig,
      tick: input.tick
    });
    const slotCount = resolveStreetDealerSlotCount(ownedCount, input.streetDealersConfig);
    const metadata = player ? getStreetDealersPlayerMetadata(player) : { slots: [], saleHistory: [] };
    const lockedSlots = metadata.slots.filter((slot) => slot.saleId || Number(slot.cooldownUntilTick || 0) > input.tick);
    const activeSales = metadata.slots.filter((slot) => slot.saleId);
    const inventory = input.streetDealersConfig.sellableDrugs
      .map((drug) => `${drug.label}: ${formatNumber(input.playerBalances[drug.itemId] || 0)}`)
      .join(", ");
    const activeSaleSummary = activeSales.length > 0
      ? activeSales
          .map((slot) => `${slot.slotId} ${slot.itemLabel ?? slot.itemId} ${formatTickLabel(Math.max(0, Number(slot.completesAtTick || 0) - input.tick))}`)
          .join(", ")
      : "none";
    return [
      { label: "Dirty / min", value: `$${formatNumber(input.streetDealersConfig.dirtyCashPerMinute * network.passiveDirtyIncomeMultiplier * (1 + dealerSupply.passiveDirtyIncomeBonusPct / 100))}` },
      { label: "Heat / min", value: formatNumber(input.streetDealersConfig.heatPerMinute * network.heatMultiplier) },
      { label: "Owned dealers", value: `${ownedCount}/${input.streetDealersConfig.countOnMap}` },
      { label: "Dealer slots", value: `${Math.max(0, slotCount - lockedSlots.length)}/${slotCount} free` },
      { label: "Active sales", value: activeSaleSummary },
      { label: "Drug inventory", value: inventory || "empty" },
      { label: "Passive dirty multiplier", value: `x${formatNumber(network.passiveDirtyIncomeMultiplier)}` },
      { label: "Sale price multiplier", value: `x${formatNumber(network.salePriceMultiplier)}` },
      { label: "Sale speed multiplier", value: `x${formatNumber(network.saleSpeedMultiplier)}` },
      { label: "Heat multiplier", value: `x${formatNumber(network.heatMultiplier)}` },
      { label: "Tunnel sale price bonus", value: `+${formatNumber(dealerSupply.salePriceBonusPct + openChannel.dealerSalePriceBonusPct)} %` },
      { label: "Tunnel sale speed bonus", value: `+${formatNumber(dealerSupply.saleSpeedBonusPct + openChannel.dealerSaleSpeedBonusPct)} %` },
      { label: "Tunnel passive dirty bonus", value: `+${formatNumber(dealerSupply.passiveDirtyIncomeBonusPct)} %` },
      { label: "Tunnel street risk reduction", value: `-${formatNumber(dealerSupply.streetRiskReductionPct)} %` },
      { label: "Tunnel heat risk bonus", value: `+${formatNumber(dealerSupply.saleHeatRiskBonusPct + openChannel.dealerSaleHeatBonusPct)} %` },
      { label: "Otevřít kanál", value: openChannel.active ? `active ${formatTickLabel(openChannel.remainingTicks)}` : "inactive" }
    ];
  }
  return null;
};
