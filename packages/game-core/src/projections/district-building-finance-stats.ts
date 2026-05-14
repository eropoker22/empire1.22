import type { CentralBankBalanceConfig } from "../contracts/game-mode-config";
import type { CoreGameState } from "../entities/game-state";
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
      { label: "Owned malls", value: `${ownedCount}/${input.shoppingMallConfig.countOnMap}` },
      { label: "Clean income multiplier", value: `x${formatNumber(network.cleanIncomeMultiplier)}` },
      { label: "Dirty income multiplier", value: `x${formatNumber(network.dirtyIncomeMultiplier)}` },
      { label: "Influence multiplier", value: `x${formatNumber(network.influenceMultiplier)}` },
      { label: "Regular market discount", value: `-${formatNumber(marketBonuses.regularMarketDiscountPct)} %` },
      { label: "Black market discount", value: `-${formatNumber(marketBonuses.blackMarketDiscountPct)} %` },
      { label: "Market fee reduction", value: `-${formatNumber(marketBonuses.marketFeeReductionPct)} %` }
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
      { label: "Regular fee reduction", value: `-${formatNumber(feeReduction.regularMarketPct)} %` },
      { label: "Player fee reduction", value: `-${formatNumber(feeReduction.playerMarketPct)} %` },
      { label: "Black fee reduction", value: `-${formatNumber(feeReduction.blackMarketPct)} %` },
      { label: "Market trend hints", value: hints || "waiting for next signal" },
      { label: "Financial inspection risk", value: `${formatNumber(riskPct)} %` },
      { label: "Insider Window", value: Number(metadata.insiderWindowExpiresAtTick || 0) > input.tick ? `active ${formatTickLabel(Number(metadata.insiderWindowExpiresAtTick) - input.tick)}` : "inactive" },
      { label: "Income freeze", value: Number(metadata.incomeFrozenUntilTick || 0) > input.tick ? `active ${formatTickLabel(Number(metadata.incomeFrozenUntilTick) - input.tick)}` : "none" },
      { label: "Fee reduction status", value: feeReduction.disabled ? `disabled ${formatTickLabel(Number(metadata.feeReductionDisabledUntilTick || 0) - input.tick)}` : "active" },
      { label: "Server-wide market effects", value: activeEffects || "none" }
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
      { label: "Owned banks", value: `${ownedCount}/${input.centralBankConfig.countOnMap}` },
      { label: "Clean cash protection", value: `${formatNumber(stats.cleanCashProtectionPct)} %` },
      { label: "Reserve interest", value: `${formatNumber(stats.interestPct)} % every ${formatNumber(stats.interestIntervalMinutes)} min` },
      { label: "Max interest tick", value: `$${formatNumber(stats.maxInterestCleanCash)}` },
      { label: "Next interest", value: metadata.lastInterestTick === undefined || !stats.tier ? "initializing" : formatTickLabel(Math.max(0, metadata.lastInterestTick + Math.ceil(stats.tier.interestIntervalMinutes * 60000 / Math.max(1, input.tickRateMs ?? 5000)) - input.tick)) },
      { label: "Last interest", value: latestInterest ? `$${formatNumber(latestInterest.amount)}` : "none" },
      { label: "Market fee reduction", value: `-${formatNumber(stats.marketFeeReductionPct)} %` },
      { label: "Economic stability", value: `fines -${formatNumber(stats.fineReductionPct)} %, crisis -${formatNumber(stats.economicCrisisImpactReductionPct)} %` },
      { label: "Financial penalty reduction", value: `-${formatNumber(stats.financialInspectionPenaltyReductionPct)} %` },
      { label: "Financial Oversight Risk", value: `${formatNumber(resolveCentralBankOversightRiskForUi(input.state, input.building, input.centralBankConfig, input.tick))} %` },
      { label: "Zmrazené účty", value: stats.frozenAccountsActive ? `active ${formatTickLabel(Number(metadata.frozenAccountsExpiresAtTick || 0) - input.tick)}` : "inactive" },
      { label: "Kurzovní intervence", value: intervention || "inactive" },
      { label: "Reserve status", value: stats.interestDisabled ? `interest disabled ${formatTickLabel(Number(metadata.interestDisabledUntilTick || 0) - input.tick)}` : "active" }
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
      { label: "Materials discount", value: `-${formatNumber(input.airportConfig.importDiscount.materialsPct)} %` },
      { label: "Rare components discount", value: `-${formatNumber(input.airportConfig.importDiscount.rareComponentsPct)} %` },
      { label: "Black Market discount", value: `-${formatNumber(input.airportConfig.importDiscount.blackMarketItemsPct)} %` },
      { label: "Market delivery cooldown", value: `-${formatNumber(input.airportConfig.cooldownReduction.marketDeliveryPct)} %` },
      { label: "Black Market Signal", value: `rare +${formatNumber(input.airportConfig.blackMarketSignal.rareItemOfferChanceBonusPct)} %, offers +${input.airportConfig.blackMarketSignal.extraStockRefreshOffers}` },
      { label: "Customs Risk", value: `${formatNumber(customsRiskPct)} %` },
      { label: "Pending import", value: pendingImports || "none" },
      { label: "Černý charter", value: Number(metadata.blackCharterExpiresAtTick || 0) > input.tick ? `active ${formatTickLabel(Number(metadata.blackCharterExpiresAtTick) - input.tick)} · ${offerItems}` : "inactive" },
      { label: "Evakuační koridor", value: Number(metadata.evacuationCorridorExpiresAtTick || 0) > input.tick ? `active ${formatTickLabel(Number(metadata.evacuationCorridorExpiresAtTick) - input.tick)}` : "inactive" },
      { label: "Import discounts", value: Number(metadata.discountDisabledUntilTick || 0) > input.tick ? `disabled ${formatTickLabel(Number(metadata.discountDisabledUntilTick) - input.tick)}` : "active" },
      { label: "Next import cost", value: metadata.nextImportCostPenaltyPct ? `+${formatNumber(metadata.nextImportCostPenaltyPct)} %` : "normal" }
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
      ? `${metadata.emergencyDecree.modeId}${metadata.emergencyDecree.zone ? ` ${metadata.emergencyDecree.zone}` : ""} ${formatTickLabel(metadata.emergencyDecree.expiresAtTick - input.tick)}`
      : "inactive";
    return [
      { label: "Clean / min", value: `$${formatNumber(input.cityHallConfig.cleanCashPerMinute)}` },
      { label: "Influence / min", value: formatNumber(input.cityHallConfig.influencePerMinute) },
      { label: "Heat / min", value: formatNumber(input.cityHallConfig.heatPerMinute) },
      { label: "City Authority", value: `influence +${formatNumber(input.cityHallConfig.cityAuthority.influenceGenerationBonusPct)} %, legal heat -${formatNumber(input.cityHallConfig.cityAuthority.legalBuildingHeatReductionPct)} %` },
      { label: "Influence action cost", value: `-${formatNumber(input.cityHallConfig.cityAuthority.influenceActionCostReductionPct)} % cap -${formatNumber(input.cityHallConfig.cityAuthority.maxInfluenceActionCostReductionPct)} %` },
      { label: "Police raid warning", value: `+${formatNumber(input.cityHallConfig.cityAuthority.policeRaidWarningChancePct)} %` },
      { label: "District pressure", value: `+${formatNumber(input.cityHallConfig.cityAuthority.districtControlPressurePct)} %` },
      { label: "Corruption Scandal Risk", value: `${formatNumber(scandalRiskPct)} %` },
      { label: "Úřední krytí", value: cover || "inactive" },
      { label: "Nouzová vyhláška", value: decree },
      { label: "Influence penalty", value: Number(metadata.influencePenaltyUntilTick || 0) > input.tick ? `active ${formatTickLabel(Number(metadata.influencePenaltyUntilTick) - input.tick)}` : "none" },
      { label: "Městská zakázka", value: Number(metadata.cityContractBlockedUntilTick || 0) > input.tick ? `blocked ${formatTickLabel(Number(metadata.cityContractBlockedUntilTick) - input.tick)}` : "available" }
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
      { label: "Owned Lobby Clubs", value: `${ownedCount}/${input.lobbyClubConfig.countOnMap}` },
      { label: "Lobby Pressure", value: `+${formatNumber(tier?.pressurePct ?? 0)} %` },
      { label: "Influence action cost", value: `-${formatNumber(influenceCostReductionPct)} % cap -${formatNumber(input.lobbyClubConfig.influenceCostReduction.maxCombinedPct)} %` },
      { label: "Negative rumor chance", value: `-${formatNumber(negativeRumorReductionPct)} % relative` },
      { label: "Civil network support", value: `restaurant truth +${formatNumber(input.lobbyClubConfig.civilNetworkSupport.restaurantCivilRumorTruthPct)} %, hints +${formatNumber(input.lobbyClubConfig.civilNetworkSupport.convenienceDistrictHintChancePct)} %, market fee -${formatNumber(input.lobbyClubConfig.civilNetworkSupport.shoppingMallMarketFeeReductionPct)} %, VIP truth +${formatNumber(input.lobbyClubConfig.civilNetworkSupport.vipLoungeTruthChancePct)} %` },
      { label: "Lobby Scandal Risk", value: `${formatNumber(scandalRiskPct)} %` },
      { label: "Zákulisní tlak", value: Number(metadata.backroomPressureExpiresAtTick || 0) > input.tick ? `active ${formatTickLabel(Number(metadata.backroomPressureExpiresAtTick) - input.tick)}` : "inactive" },
      { label: "Mediální clona", value: Number(metadata.mediaScreenExpiresAtTick || 0) > input.tick ? `active ${formatTickLabel(Number(metadata.mediaScreenExpiresAtTick) - input.tick)}` : "inactive" },
      { label: "Next influence discount", value: Number(metadata.nextInfluenceDiscountExpiresAtTick || 0) > input.tick ? `-${formatNumber(metadata.nextInfluenceDiscountPct ?? 0)} % ${formatTickLabel(Number(metadata.nextInfluenceDiscountExpiresAtTick) - input.tick)}` : "none" },
      { label: "Zákulisní tlak cooldown", value: formatCooldown(input.building, input.lobbyClubConfig.backroomPressure.actionId, input.tick) },
      { label: "Tiché vyjednávání cooldown", value: formatCooldown(input.building, input.lobbyClubConfig.quietNegotiation.actionId, input.tick) },
      { label: "Mediální clona cooldown", value: formatCooldown(input.building, input.lobbyClubConfig.mediaScreen.actionId, input.tick) }
    ];
  }
  if (input.building.buildingTypeId === "court" && input.courthouseConfig) {
    const ownedCount = getOwnedCourthouseCount(input.state, input.building.ownerPlayerId ?? input.playerId, input.courthouseConfig);
    const tier = resolveCourthouseTier(ownedCount, input.courthouseConfig);
    return [
      { label: "Clean / min", value: `$${formatNumber(input.courthouseConfig.cleanCashPerMinute * (tier?.cleanIncomeMultiplier ?? 1))}` },
      { label: "Influence / min", value: formatNumber(input.courthouseConfig.influencePerMinute * (tier?.influenceMultiplier ?? 1)) },
      { label: "Heat / min", value: formatNumber(input.courthouseConfig.heatPerMinute * (tier?.heatMultiplier ?? 1)) },
      { label: "Owned courts", value: `${ownedCount}/${input.courthouseConfig.countOnMap}` },
      { label: "Clean income multiplier", value: `x${formatNumber(tier?.cleanIncomeMultiplier ?? 1)}` },
      { label: "Influence multiplier", value: `x${formatNumber(tier?.influenceMultiplier ?? 1)}` },
      { label: "Police raid consequences", value: `-${formatNumber(tier?.policeRaidConsequencesReductionPct ?? 0)} %` }
    ];
  }
  return null;
};

const formatCooldown = (
  building: CoreGameState["buildingsById"][string],
  actionId: string,
  tick: number
): string => {
  const remainingTicks = Math.max(0, Number((building.actionCooldowns ?? {})[actionId] || 0) - tick);
  return remainingTicks > 0 ? formatTickLabel(remainingTicks) : "ready";
};
const resolveCentralBankOversightRiskForUi = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  config: CentralBankBalanceConfig,
  tick: number
): number => {
  const metadata = getCentralBankMetadata(building, tick);
  const playerId = building.ownerPlayerId;
  const player = playerId ? state.playersById[playerId] : undefined;
  const policeState = player ? state.policeStatesById[player.policeStateId] : undefined;
  const eventRisk = metadata.riskEvents.reduce((total, event) => total + Math.max(0, Number(event.riskPct || 0)), 0);
  const heatRisk = Number(policeState?.heat || 0) > config.financialOversight.heatThreshold
    ? config.financialOversight.heatRiskPct
    : 0;
  const stockRisk = playerId && Object.values(state.buildingsById).some((candidate) => candidate.ownerPlayerId === playerId && candidate.status === "active" && candidate.buildingTypeId === "stock_exchange")
    ? config.financialOversight.stockExchangeRiskPct
    : 0;
  const cityHallReduction = playerId && Object.values(state.buildingsById).some((candidate) => candidate.ownerPlayerId === playerId && candidate.status === "active" && candidate.buildingTypeId === "city_hall")
    ? config.financialOversight.cityHallRiskReductionPct
    : 0;
  return Math.max(0, Math.min(100, config.financialOversight.passiveRiskPct + eventRisk + heatRisk + stockRisk - cityHallReduction));
};
