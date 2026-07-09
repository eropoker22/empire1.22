import {
  getAirportMetadata,
  resolveAirportCustomsRiskPct
} from "../handlers/airportBuildingActions";
import {
  getCentralBankMetadata,
  getOwnedCentralBankCount,
  resolveCentralBankReserveStats
} from "../handlers/centralBankBuildingActions";
import {
  getCityHallMetadata,
  resolveCityHallScandalRiskPct
} from "../handlers/cityHallBuildingActions";
import {
  getOwnedCourthouseCount,
  resolveCourthouseTier
} from "../handlers/courthouseBuildingActions";
import {
  getLobbyClubMetadata,
  getOwnedLobbyClubCount,
  resolveLobbyClubInfluenceActionCostReductionPct,
  resolveLobbyClubNegativeRumorReductionPct,
  resolveLobbyClubScandalRiskPct,
  resolveLobbyClubTier
} from "../handlers/lobbyClubBuildingActions";
import {
  getOwnedShoppingMallCount,
  resolveShoppingMallMarketBonuses,
  resolveShoppingMallNetworkMultipliers
} from "../handlers/shoppingMallBuildingActions";
import {
  getStockExchangeMetadata,
  resolveStockExchangeFeeReduction,
  resolveStockExchangeInspectionRiskPct
} from "../handlers/stockExchangeBuildingActions";
import { formatNumber, formatTickLabel } from "./district-building-action-formatters";
import {
  formatCityHallEmergencyDecree,
  formatFinanceActionCooldown,
  formatMultiplierBonus,
  resolveCentralBankOversightRiskForUi
} from "./district-building-finance-helpers";
import type { BuildingStatsProjectionInput, BuildingStatView } from "./district-building-stats-types";

export const createFinanceBuildingStats = (input: BuildingStatsProjectionInput): BuildingStatView[] | null => {
  if (input.building.buildingTypeId === "shopping_mall" && input.shoppingMallConfig && input.building.ownerPlayerId) {
    const ownedCount = getOwnedShoppingMallCount(input.state, input.building.ownerPlayerId, input.shoppingMallConfig);
    const network = resolveShoppingMallNetworkMultipliers(ownedCount, input.shoppingMallConfig);
    const marketBonuses = resolveShoppingMallMarketBonuses(ownedCount, input.shoppingMallConfig);
    return [
      { label: "Clean / min", value: `$${formatNumber(input.shoppingMallConfig.cleanCashPerMinute * network.cleanIncomeMultiplier)}` },
      { label: "Dirty / min", value: `$${formatNumber(input.shoppingMallConfig.dirtyCashPerMinute * network.dirtyIncomeMultiplier)}` },
      { label: "Influence / min", value: formatNumber(input.shoppingMallConfig.influencePerMinute * network.influenceMultiplier) },
      { label: "Heat / min", value: formatNumber(input.shoppingMallConfig.heatPerMinute * network.heatMultiplier) },
      { label: "Vlastněná centra", value: `${ownedCount}/${input.shoppingMallConfig.countOnMap}` },
      { label: "Clean výnos", value: formatMultiplierBonus(network.cleanIncomeMultiplier) },
      { label: "Dirty výnos", value: formatMultiplierBonus(network.dirtyIncomeMultiplier) },
      { label: "Vliv", value: formatMultiplierBonus(network.influenceMultiplier) },
      { label: "Běžný market", value: `-${formatNumber(marketBonuses.regularMarketDiscountPct)} %` },
      { label: "Černý market", value: `-${formatNumber(marketBonuses.blackMarketDiscountPct)} %` },
      { label: "Market poplatek", value: `-${formatNumber(marketBonuses.marketFeeReductionPct)} %` }
    ];
  }
  if (input.building.buildingTypeId === "stock_exchange" && input.stockExchangeConfig && input.building.ownerPlayerId) {
    const metadata = getStockExchangeMetadata(input.building, input.tick);
    const feeReduction = resolveStockExchangeFeeReduction({ building: input.building, config: input.stockExchangeConfig, tick: input.tick });
    const riskPct = resolveStockExchangeInspectionRiskPct({
      state: input.state,
      building: input.building,
      config: input.stockExchangeConfig,
      tick: input.tick
    });
    const activeEffects = metadata.marketEffects
      .map((effect) => `${effect.mode} ${effect.category} ${formatTickLabel(Math.max(0, effect.expiresAtTick - input.tick))}`)
      .join(", ");
    const hints = metadata.trendHints.slice(-3).map((hint) => hint.text).join(" | ");
    return [
      { label: "Clean / min", value: `$${formatNumber(input.stockExchangeConfig.cleanCashPerMinute)}` },
      { label: "Influence / min", value: formatNumber(input.stockExchangeConfig.influencePerMinute) },
      { label: "Heat / min", value: formatNumber(input.stockExchangeConfig.heatPerMinute) },
      { label: "Běžný poplatek", value: `-${formatNumber(feeReduction.regularMarketPct)} %` },
      { label: "Hráčský poplatek", value: `-${formatNumber(feeReduction.playerMarketPct)} %` },
      { label: "Černý poplatek", value: `-${formatNumber(feeReduction.blackMarketPct)} %` },
      { label: "Tržní signály", value: hints || "čeká na další signál" },
      { label: "Finanční kontrola", value: `${formatNumber(riskPct)} %` },
      { label: "Vnitřní tipy", value: Number(metadata.insiderWindowExpiresAtTick || 0) > input.tick ? `aktivní ${formatTickLabel(Number(metadata.insiderWindowExpiresAtTick) - input.tick)}` : "neaktivní" },
      { label: "Zmrazení income", value: Number(metadata.incomeFrozenUntilTick || 0) > input.tick ? `aktivní ${formatTickLabel(Number(metadata.incomeFrozenUntilTick) - input.tick)}` : "žádné" },
      { label: "Stav poplatků", value: feeReduction.disabled ? `vypnuto ${formatTickLabel(Number(metadata.feeReductionDisabledUntilTick || 0) - input.tick)}` : "aktivní" },
      { label: "Serverové tržní efekty", value: activeEffects || "žádné" }
    ];
  }
  if (input.building.buildingTypeId === "central_bank" && input.centralBankConfig && input.building.ownerPlayerId) {
    const metadata = getCentralBankMetadata(input.building, input.tick);
    const stats = resolveCentralBankReserveStats({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.centralBankConfig,
      tick: input.tick
    });
    const ownedCount = getOwnedCentralBankCount(input.state, input.building.ownerPlayerId, input.centralBankConfig);
    const latestInterest = metadata.interestEvents.at(-1);
    const intervention = stats.activeCurrencyInterventions
      .map((effect) => `${effect.category} ${formatTickLabel(Math.max(0, effect.expiresAtTick - input.tick))}`)
      .join(", ");
    return [
      { label: "Clean / min", value: `$${formatNumber(input.centralBankConfig.cleanCashPerMinute * (stats.tier?.incomeMultiplier ?? 1))}` },
      { label: "Influence / min", value: formatNumber(input.centralBankConfig.influencePerMinute * (stats.tier?.influenceMultiplier ?? 1)) },
      { label: "Heat / min", value: formatNumber(input.centralBankConfig.heatPerMinute * (stats.tier?.heatMultiplier ?? 1)) },
      { label: "Vlastněné banky", value: `${ownedCount}/${input.centralBankConfig.countOnMap}` },
      { label: "Ochrana clean cash", value: `${formatNumber(stats.cleanCashProtectionPct)} %` },
      { label: "Úrok rezervy", value: `${formatNumber(stats.interestPct)} % každých ${formatNumber(stats.interestIntervalMinutes)} min` },
      { label: "Max úrok za tick", value: `$${formatNumber(stats.maxInterestCleanCash)}` },
      { label: "Další úrok", value: metadata.lastInterestTick === undefined || !stats.tier ? "počítá se" : formatTickLabel(Math.max(0, metadata.lastInterestTick + Math.ceil(stats.tier.interestIntervalMinutes * 60000 / Math.max(1, input.tickRateMs ?? 5000)) - input.tick)) },
      { label: "Poslední úrok", value: latestInterest ? `$${formatNumber(latestInterest.amount)}` : "žádný" },
      { label: "Market poplatek", value: `-${formatNumber(stats.marketFeeReductionPct)} %` },
      { label: "Stabilita ekonomiky", value: `pokuty -${formatNumber(stats.fineReductionPct)} %, krize -${formatNumber(stats.economicCrisisImpactReductionPct)} %` },
      { label: "Finanční postih", value: `-${formatNumber(stats.financialInspectionPenaltyReductionPct)} %` },
      { label: "Riziko dohledu", value: `${formatNumber(resolveCentralBankOversightRiskForUi(input.state, input.building, input.centralBankConfig, input.tick))} %` },
      { label: "Zmrazené účty", value: stats.frozenAccountsActive ? `aktivní ${formatTickLabel(Number(metadata.frozenAccountsExpiresAtTick || 0) - input.tick)}` : "neaktivní" },
      { label: "Kurzovní intervence", value: intervention || "neaktivní" },
      { label: "Stav rezervy", value: stats.interestDisabled ? `úrok vypnutý ${formatTickLabel(Number(metadata.interestDisabledUntilTick || 0) - input.tick)}` : "aktivní" }
    ];
  }
  if (input.building.buildingTypeId === "airport" && input.airportConfig && input.building.ownerPlayerId) {
    const metadata = getAirportMetadata(input.building, input.tick);
    const customsRiskPct = resolveAirportCustomsRiskPct({
      state: input.state,
      building: input.building,
      config: input.airportConfig,
      smugglingTunnelConfig: input.smugglingTunnelConfig,
      tick: input.tick
    });
    const pendingImports = metadata.pendingImports
      .map((entry) => `${entry.category} ${formatTickLabel(Math.max(0, entry.completesAtTick - input.tick))}`)
      .join(", ");
    const offerItems = metadata.blackCharterOffer?.items?.join(", ") ?? "";
    return [
      { label: "Clean / min", value: `$${formatNumber(input.airportConfig.cleanCashPerMinute)}` },
      { label: "Dirty / min", value: `$${formatNumber(input.airportConfig.dirtyCashPerMinute)}` },
      { label: "Influence / min", value: formatNumber(input.airportConfig.influencePerMinute) },
      { label: "Heat / min", value: formatNumber(input.airportConfig.heatPerMinute) },
      { label: "Sleva na materiály", value: `-${formatNumber(input.airportConfig.importDiscount.materialsPct)} %` },
      { label: "Sleva na vzácné díly", value: `-${formatNumber(input.airportConfig.importDiscount.rareComponentsPct)} %` },
      { label: "Sleva černého marketu", value: `-${formatNumber(input.airportConfig.importDiscount.blackMarketItemsPct)} %` },
      { label: "Čekání doručení", value: `-${formatNumber(input.airportConfig.cooldownReduction.marketDeliveryPct)} %` },
      { label: "Signál černého marketu", value: `rare +${formatNumber(input.airportConfig.blackMarketSignal.rareItemOfferChanceBonusPct)} %, nabídky +${input.airportConfig.blackMarketSignal.extraStockRefreshOffers}` },
      { label: "Celní riziko", value: `${formatNumber(customsRiskPct)} %` },
      { label: "Čekající import", value: pendingImports || "žádný" },
      { label: "Černý charter", value: Number(metadata.blackCharterExpiresAtTick || 0) > input.tick ? `aktivní ${formatTickLabel(Number(metadata.blackCharterExpiresAtTick) - input.tick)} · ${offerItems}` : "neaktivní" },
      { label: "Evakuační koridor", value: Number(metadata.evacuationCorridorExpiresAtTick || 0) > input.tick ? `aktivní ${formatTickLabel(Number(metadata.evacuationCorridorExpiresAtTick) - input.tick)}` : "neaktivní" },
      { label: "Slevy importu", value: Number(metadata.discountDisabledUntilTick || 0) > input.tick ? `vypnuto ${formatTickLabel(Number(metadata.discountDisabledUntilTick) - input.tick)}` : "aktivní" },
      { label: "Další cena importu", value: metadata.nextImportCostPenaltyPct ? `+${formatNumber(metadata.nextImportCostPenaltyPct)} %` : "normální" }
    ];
  }
  if (input.building.buildingTypeId === "city_hall" && input.cityHallConfig && input.building.ownerPlayerId) {
    const metadata = getCityHallMetadata(input.building, input.tick);
    const scandalRiskPct = resolveCityHallScandalRiskPct({
      state: input.state,
      building: input.building,
      config: input.cityHallConfig,
      tick: input.tick
    });
    const cover = Object.values(metadata.officialCoverByDistrictId)
      .map((entry) => `${entry.districtId} ${formatTickLabel(Math.max(0, entry.expiresAtTick - input.tick))}`)
      .join(", ");
    const decree = metadata.emergencyDecree && metadata.emergencyDecree.expiresAtTick > input.tick
      ? formatCityHallEmergencyDecree(metadata.emergencyDecree, input.tick)
      : "neaktivní";
    return [
      { label: "Clean / min", value: `$${formatNumber(input.cityHallConfig.cleanCashPerMinute)}` },
      { label: "Influence / min", value: formatNumber(input.cityHallConfig.influencePerMinute) },
      { label: "Heat / min", value: formatNumber(input.cityHallConfig.heatPerMinute) },
      { label: "Městská autorita", value: `vliv +${formatNumber(input.cityHallConfig.cityAuthority.influenceGenerationBonusPct)} %, legální heat -${formatNumber(input.cityHallConfig.cityAuthority.legalBuildingHeatReductionPct)} %` },
      { label: "Cena vlivových akcí", value: `-${formatNumber(input.cityHallConfig.cityAuthority.influenceActionCostReductionPct)} % cap -${formatNumber(input.cityHallConfig.cityAuthority.maxInfluenceActionCostReductionPct)} %` },
      { label: "Varování před raidem", value: `+${formatNumber(input.cityHallConfig.cityAuthority.policeRaidWarningChancePct)} %` },
      { label: "Tlak districtu", value: `+${formatNumber(input.cityHallConfig.cityAuthority.districtControlPressurePct)} %` },
      { label: "Riziko skandálu", value: `${formatNumber(scandalRiskPct)} %` },
      { label: "Úřední krytí", value: cover || "neaktivní" },
      { label: "Nouzová vyhláška", value: decree },
      { label: "Postih vlivu", value: Number(metadata.influencePenaltyUntilTick || 0) > input.tick ? `aktivní ${formatTickLabel(Number(metadata.influencePenaltyUntilTick) - input.tick)}` : "žádný" },
      { label: "Městská zakázka", value: Number(metadata.cityContractBlockedUntilTick || 0) > input.tick ? `blokovaná ${formatTickLabel(Number(metadata.cityContractBlockedUntilTick) - input.tick)}` : "dostupná" }
    ];
  }
  if (input.building.buildingTypeId === "lobby_club" && input.lobbyClubConfig && input.building.ownerPlayerId) {
    const metadata = getLobbyClubMetadata(input.building, input.tick);
    const ownedCount = getOwnedLobbyClubCount(input.state, input.building.ownerPlayerId, input.lobbyClubConfig);
    const tier = resolveLobbyClubTier(ownedCount, input.lobbyClubConfig);
    const scandalRiskPct = resolveLobbyClubScandalRiskPct({
      state: input.state,
      building: input.building,
      config: input.lobbyClubConfig,
      tick: input.tick
    });
    const influenceCostReductionPct = resolveLobbyClubInfluenceActionCostReductionPct({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.lobbyClubConfig,
      tick: input.tick
    });
    const negativeRumorReductionPct = resolveLobbyClubNegativeRumorReductionPct({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.lobbyClubConfig,
      tick: input.tick
    });
    return [
      { label: "Clean / min", value: `$${formatNumber(input.lobbyClubConfig.cleanCashPerMinute * (tier?.incomeMultiplier ?? 1))}` },
      { label: "Influence / min", value: formatNumber(input.lobbyClubConfig.influencePerMinute * (tier?.influenceMultiplier ?? 1)) },
      { label: "Heat / min", value: formatNumber(input.lobbyClubConfig.heatPerMinute * (tier?.heatMultiplier ?? 1)) },
      { label: "Vlastněné lobby kluby", value: `${ownedCount}/${input.lobbyClubConfig.countOnMap}` },
      { label: "Lobby tlak", value: `+${formatNumber(tier?.pressurePct ?? 0)} %` },
      { label: "Cena vlivových akcí", value: `-${formatNumber(influenceCostReductionPct)} % cap -${formatNumber(input.lobbyClubConfig.influenceCostReduction.maxCombinedPct)} %` },
      { label: "Negativní drby", value: `-${formatNumber(negativeRumorReductionPct)} % relativně` },
      { label: "Civilní síť", value: `restaurace pravda +${formatNumber(input.lobbyClubConfig.civilNetworkSupport.restaurantCivilRumorTruthPct)} %, hinty +${formatNumber(input.lobbyClubConfig.civilNetworkSupport.convenienceDistrictHintChancePct)} %, market fee -${formatNumber(input.lobbyClubConfig.civilNetworkSupport.shoppingMallMarketFeeReductionPct)} %, VIP pravda +${formatNumber(input.lobbyClubConfig.civilNetworkSupport.vipLoungeTruthChancePct)} %` },
      { label: "Riziko lobby skandálu", value: `${formatNumber(scandalRiskPct)} %` },
      { label: "Zákulisní tlak", value: Number(metadata.backroomPressureExpiresAtTick || 0) > input.tick ? `aktivní ${formatTickLabel(Number(metadata.backroomPressureExpiresAtTick) - input.tick)}` : "neaktivní" },
      { label: "Mediální clona", value: Number(metadata.mediaScreenExpiresAtTick || 0) > input.tick ? `aktivní ${formatTickLabel(Number(metadata.mediaScreenExpiresAtTick) - input.tick)}` : "neaktivní" },
      { label: "Další sleva vlivu", value: Number(metadata.nextInfluenceDiscountExpiresAtTick || 0) > input.tick ? `-${formatNumber(metadata.nextInfluenceDiscountPct ?? 0)} % ${formatTickLabel(Number(metadata.nextInfluenceDiscountExpiresAtTick) - input.tick)}` : "žádná" },
      { label: "Čekání zákulisního tlaku", value: formatFinanceActionCooldown(input.building, input.lobbyClubConfig.backroomPressure.actionId, input.tick) },
      { label: "Čekání tichého vyjednávání", value: formatFinanceActionCooldown(input.building, input.lobbyClubConfig.quietNegotiation.actionId, input.tick) },
      { label: "Čekání mediální clony", value: formatFinanceActionCooldown(input.building, input.lobbyClubConfig.mediaScreen.actionId, input.tick) }
    ];
  }
  if (input.building.buildingTypeId === "court" && input.courthouseConfig) {
    const ownedCount = getOwnedCourthouseCount(input.state, input.building.ownerPlayerId ?? input.playerId, input.courthouseConfig);
    const tier = resolveCourthouseTier(ownedCount, input.courthouseConfig);
    return [
      { label: "Clean / min", value: `$${formatNumber(input.courthouseConfig.cleanCashPerMinute * (tier?.cleanIncomeMultiplier ?? 1))}` },
      { label: "Influence / min", value: formatNumber(input.courthouseConfig.influencePerMinute * (tier?.influenceMultiplier ?? 1)) },
      { label: "Heat / min", value: formatNumber(input.courthouseConfig.heatPerMinute * (tier?.heatMultiplier ?? 1)) },
      { label: "Vlastněné soudy", value: `${ownedCount}/${input.courthouseConfig.countOnMap}` },
      { label: "Clean výnos", value: formatMultiplierBonus(tier?.cleanIncomeMultiplier ?? 1) },
      { label: "Vliv", value: formatMultiplierBonus(tier?.influenceMultiplier ?? 1) },
      { label: "Následky raidu", value: `-${formatNumber(tier?.policeRaidConsequencesReductionPct ?? 0)} %` }
    ];
  }
  return null;
};

