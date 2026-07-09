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

const formatMultiplierBonus = (value: number): string =>
  `${Number(value || 1) >= 1 ? "+" : ""}${formatNumber((Number(value || 1) - 1) * 100)} %`;

export const createMarketBuildingStats = (input: BuildingStatsProjectionInput): BuildingStatView[] | null => {
  if (input.building.buildingTypeId === "vip_lounge" && input.vipLoungeConfig && input.building.ownerPlayerId) {
    const stats = resolveVipLoungeRumorStats({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.vipLoungeConfig
    });
    const metadata = getVipLoungeMetadata(input.building);
    const latestRumorStatus = metadata.rumorEvents.length > 0 ? "dostupné v městských zprávách" : "čeká na další šeptandu";
    return [
      { label: "Clean / min", value: `$${formatNumber(input.vipLoungeConfig.cleanCashPerMinute * stats.tier.incomeMultiplier)}` },
      { label: "Dirty / min", value: `$${formatNumber(input.vipLoungeConfig.dirtyCashPerMinute * stats.tier.incomeMultiplier)}` },
      { label: "Influence / min", value: formatNumber(input.vipLoungeConfig.influencePerMinute * stats.tier.influenceMultiplier) },
      { label: "Heat / min", value: formatNumber(input.vipLoungeConfig.heatPerMinute * stats.tier.heatMultiplier) },
      { label: "Vlastněné VIP lounge", value: `${stats.ownedCount}/${input.vipLoungeConfig.countOnMap}` },
      { label: "Interval drbů", value: `${formatNumber(stats.rumorIntervalMinutes)} min` },
      { label: "Šance zákulisního drbu", value: `${formatNumber(stats.passiveRumorChancePct)} %` },
      { label: "Šance pravdy", value: `${formatNumber(stats.truthChancePct)} %` },
      { label: "Šance hintu districtu", value: `${formatNumber(stats.districtHintChancePct)} %` },
      { label: "Šance hintu budovy", value: `${formatNumber(stats.buildingHintChancePct)} %` },
      { label: "Šance spolehlivosti", value: `${formatNumber(stats.reliabilityLabelChancePct)} %` },
      { label: "Poslední zákulisní drb", value: latestRumorStatus }
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
      { label: "Clean / hour", value: `$${formatNumber(input.carDealerConfig.cleanCashPerMinute * 60 * network.cleanIncomeMultiplier)}` },
      { label: "Dirty / hour", value: `$${formatNumber(input.carDealerConfig.dirtyCashPerMinute * 60 * network.dirtyIncomeMultiplier)}` },
      { label: "Heat / day", value: formatNumber(input.carDealerConfig.heatPerMinute * 60 * 24 * network.heatMultiplier) },
      { label: "Influence / day", value: formatNumber(input.carDealerConfig.influencePerMinute * 60 * 24) },
      { label: "Vlastněné autosalony", value: `${ownedCount}/${input.carDealerConfig.countOnMap}` },
      { label: "Clean výnos", value: formatMultiplierBonus(network.cleanIncomeMultiplier) },
      { label: "Dirty výnos", value: formatMultiplierBonus(network.dirtyIncomeMultiplier) },
      { label: "Zkrácení čekání", value: `-${formatNumber(support.cooldownReductionPct)} %` },
      { label: "Šance úniku", value: `+${formatNumber(support.escapeChanceBonusPct)} %` },
      { label: "Cap garáž + autosalon", value: `-${formatNumber(support.combinedGarageDealerMaxReductionPct)} %` },
      { label: "Platí na", value: formatCategoryList([...support.fullBonusCategories, ...support.halfBonusCategories, ...support.smallBonusCategories]) },
      { label: "Bez bonusu", value: formatCategoryList(support.excludedCategories) }
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
      { label: "Vlastněné tunely", value: `${ownedCount}/${input.smugglingTunnelConfig.countOnMap}` },
      { label: "Dirty bonus sítě", value: formatMultiplierBonus(network.dirtyProductionMultiplier) },
      { label: "Heat bonus sítě", value: formatMultiplierBonus(network.heatMultiplier) },
      { label: "Podpora Pouličních dealerů", value: `+${formatNumber(dealerSupply.dealerSupplyBonusPct)} %` },
      { label: "Cena prodeje Pouličních dealerů", value: `+${formatNumber(dealerSupply.salePriceBonusPct + openChannel.dealerSalePriceBonusPct)} %` },
      { label: "Rychlost prodeje Pouličních dealerů", value: `+${formatNumber(dealerSupply.saleSpeedBonusPct + openChannel.dealerSaleSpeedBonusPct)} %` },
      { label: "Pasivní dirty bonus Pouličních dealerů", value: `+${formatNumber(dealerSupply.passiveDirtyIncomeBonusPct)} %` },
      { label: "Snížení pouličního rizika", value: `-${formatNumber(dealerSupply.streetRiskReductionPct)} %` },
      { label: "Heat riziko Pouličních dealerů", value: `+${formatNumber(dealerSupply.saleHeatRiskBonusPct + openChannel.dealerSaleHeatBonusPct)} %` },
      { label: "Otevřený kanál", value: openChannel.active ? `aktivní ${formatTickLabel(openChannel.remainingTicks)}` : "připravený po čekání" },
      { label: "Riziko pouličního incidentu", value: `+${formatNumber(openChannel.streetIncidentFlatRiskPct)} %` }
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
      : "žádné";
    return [
      { label: "Dirty / min", value: `$${formatNumber(input.streetDealersConfig.dirtyCashPerMinute * network.passiveDirtyIncomeMultiplier * (1 + dealerSupply.passiveDirtyIncomeBonusPct / 100))}` },
      { label: "Heat / min", value: formatNumber(input.streetDealersConfig.heatPerMinute * network.heatMultiplier) },
      { label: "Vlastnění dealeři", value: `${ownedCount}/${input.streetDealersConfig.countOnMap}` },
      { label: "Sloty dealerů", value: `${Math.max(0, slotCount - lockedSlots.length)}/${slotCount} volné` },
      { label: "Aktivní prodeje", value: activeSaleSummary },
      { label: "Sklad drog", value: inventory || "prázdný" },
      { label: "Pasivní dirty bonus", value: formatMultiplierBonus(network.passiveDirtyIncomeMultiplier) },
      { label: "Bonus ceny prodeje", value: formatMultiplierBonus(network.salePriceMultiplier) },
      { label: "Bonus rychlosti prodeje", value: formatMultiplierBonus(network.saleSpeedMultiplier) },
      { label: "Heat bonus sítě", value: formatMultiplierBonus(network.heatMultiplier) },
      { label: "Bonus ceny z Pašovacích tunelů", value: `+${formatNumber(dealerSupply.salePriceBonusPct + openChannel.dealerSalePriceBonusPct)} %` },
      { label: "Bonus rychlosti z Pašovacích tunelů", value: `+${formatNumber(dealerSupply.saleSpeedBonusPct + openChannel.dealerSaleSpeedBonusPct)} %` },
      { label: "Pasivní dirty bonus z Pašovacích tunelů", value: `+${formatNumber(dealerSupply.passiveDirtyIncomeBonusPct)} %` },
      { label: "Snížení rizika z Pašovacích tunelů", value: `-${formatNumber(dealerSupply.streetRiskReductionPct)} %` },
      { label: "Heat riziko z Pašovacích tunelů", value: `+${formatNumber(dealerSupply.saleHeatRiskBonusPct + openChannel.dealerSaleHeatBonusPct)} %` },
      { label: "Otevřený kanál", value: openChannel.active ? `aktivní ${formatTickLabel(openChannel.remainingTicks)}` : "neaktivní" }
    ];
  }
  return null;
};
