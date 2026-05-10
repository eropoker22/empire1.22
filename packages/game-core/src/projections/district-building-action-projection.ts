import type { DistrictPanelBuildingView } from "@empire/shared-types";
import type { BuildingActionBalanceConfig } from "../contracts/game-mode-config";
import type { CoreGameState } from "../entities/game-state";
import type { DistrictPanelBuildingCatalogEntry } from "./district-building-catalog-types";
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
  getOwnedConvenienceStoreCount,
  resolveConvenienceStoreNetworkMultipliers,
  resolveConvenienceStoreRumorStats
} from "../handlers/convenienceStoreBuildingActions";
import {
  getOwnedCarDealerCount,
  resolveCarDealerNetworkMultipliers,
  resolveCarDealerSupportStats
} from "../handlers/carDealerBuildingActions";
import {
  getOwnedGarageCount,
  resolveGarageCooldownStats,
  resolveGarageNetworkMultipliers
} from "../handlers/garageBuildingActions";
import {
  getOwnedFitnessClubCount,
  resolveFitnessClubNetworkMultipliers,
  resolveFitnessClubSupportBonuses
} from "../handlers/fitnessClubBuildingActions";
import {
  getOwnedPowerStationCount,
  getPowerStationMetadata,
  resolvePowerStationInfrastructureBonusPct,
  resolvePowerStationNetworkMultipliers
} from "../handlers/powerStationBuildingActions";
import {
  getOwnedRestaurantCount,
  resolveRestaurantNetworkMultipliers,
  resolveRestaurantRumorStats
} from "../handlers/restaurantBuildingActions";
import {
  getOwnedRecruitmentCenterCount,
  resolveRecruitmentCenterNetworkMultipliers,
  resolveRecruitmentCenterSupportBonuses
} from "../handlers/recruitmentCenterBuildingActions";
import {
  getOwnedRecyclingCenterCount,
  resolveRecyclingCenterNetworkMultipliers,
  resolveRecyclingCenterSalvageStats
} from "../handlers/recyclingCenterBuildingActions";
import {
  getOwnedStripClubCount,
  getStripClubMetadata,
  resolveStripClubNetworkMultipliers,
  resolveStripClubRumorStats
} from "../handlers/stripClubBuildingActions";
import {
  getVipLoungeMetadata,
  resolveVipLoungeRumorStats
} from "../handlers/vipLoungeBuildingActions";
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
  getOwnedSchoolCount,
  getSchoolMetadata,
  isEveningCourseActive,
  resolveSchoolCapacity,
  resolveSchoolNetworkMultipliers,
  resolveSchoolTalentChancePct
} from "../handlers/schoolBuildingActions";
import type { AirportBalanceConfig, CarDealerBalanceConfig, CentralBankBalanceConfig, CityHallBalanceConfig, FitnessClubBalanceConfig, GarageBalanceConfig, PowerStationBalanceConfig, RecruitmentCenterBalanceConfig, RecyclingCenterBalanceConfig, RestaurantBalanceConfig, SchoolBalanceConfig, ShoppingMallBalanceConfig, SmugglingTunnelBalanceConfig, StockExchangeBalanceConfig, StreetDealersBalanceConfig, StripClubBalanceConfig, VipLoungeBalanceConfig } from "../contracts/game-mode-config";
import type { ConvenienceStoreBalanceConfig } from "../contracts/game-mode-config";

export interface CreateDistrictPanelBuildingViewsInput {
  state: CoreGameState;
  buildings: CoreGameState["buildingsById"][string][];
  buildCatalog: ReadonlyArray<DistrictPanelBuildingCatalogEntry>;
  actionCatalog: Readonly<Record<string, BuildingActionBalanceConfig>>;
  stripClubConfig?: StripClubBalanceConfig;
  restaurantConfig?: RestaurantBalanceConfig;
  convenienceStoreConfig?: ConvenienceStoreBalanceConfig;
  shoppingMallConfig?: ShoppingMallBalanceConfig;
  stockExchangeConfig?: StockExchangeBalanceConfig;
  centralBankConfig?: CentralBankBalanceConfig;
  airportConfig?: AirportBalanceConfig;
  cityHallConfig?: CityHallBalanceConfig;
  vipLoungeConfig?: VipLoungeBalanceConfig;
  powerStationConfig?: PowerStationBalanceConfig;
  recruitmentCenterConfig?: RecruitmentCenterBalanceConfig;
  fitnessClubConfig?: FitnessClubBalanceConfig;
  garageConfig?: GarageBalanceConfig;
  carDealerConfig?: CarDealerBalanceConfig;
  smugglingTunnelConfig?: SmugglingTunnelBalanceConfig;
  streetDealersConfig?: StreetDealersBalanceConfig;
  schoolConfig?: SchoolBalanceConfig;
  recyclingCenterConfig?: RecyclingCenterBalanceConfig;
  district: CoreGameState["districtsById"][string];
  playerId: string;
  playerBalances: Record<string, number>;
  tick: number;
  tickRateMs?: number;
}

export const createDistrictPanelBuildingViews = (
  input: CreateDistrictPanelBuildingViewsInput
): DistrictPanelBuildingView[] => {
  const buildingDefinitions = Object.fromEntries(input.buildCatalog.map((entry) => [entry.buildingTypeId, entry]));

  return input.buildings.map((building) => {
    const definition = buildingDefinitions[building.buildingTypeId];
    const actions = createBuildingActionViews({
      actionCatalog: input.actionCatalog,
      building,
      state: input.state,
      stripClubConfig: input.stripClubConfig,
      restaurantConfig: input.restaurantConfig,
      convenienceStoreConfig: input.convenienceStoreConfig,
      shoppingMallConfig: input.shoppingMallConfig,
      stockExchangeConfig: input.stockExchangeConfig,
      centralBankConfig: input.centralBankConfig,
      airportConfig: input.airportConfig,
      cityHallConfig: input.cityHallConfig,
      vipLoungeConfig: input.vipLoungeConfig,
      powerStationConfig: input.powerStationConfig,
      recruitmentCenterConfig: input.recruitmentCenterConfig,
      fitnessClubConfig: input.fitnessClubConfig,
      garageConfig: input.garageConfig,
      carDealerConfig: input.carDealerConfig,
      smugglingTunnelConfig: input.smugglingTunnelConfig,
      streetDealersConfig: input.streetDealersConfig,
      schoolConfig: input.schoolConfig,
      recyclingCenterConfig: input.recyclingCenterConfig,
      district: input.district,
      playerId: input.playerId,
      playerBalances: input.playerBalances,
      tick: input.tick,
      tickRateMs: input.tickRateMs
    });

    const baseLabel = definition?.label ?? formatResourceLabel(building.buildingTypeId);
    const variantName = normalizeBuildingDisplayName(building.displayName) ?? resolveCatalogVariantName(definition, building.id);

    return {
      buildingId: building.id,
      buildingTypeId: building.buildingTypeId,
      label: baseLabel,
      displayName: variantName ?? baseLabel,
      variantName,
      zone: definition?.zone ?? input.district.zone,
      role: definition?.role ?? "Fixed building",
      info: definition?.info ?? "Fixed district building.",
      stats: createBuildingStats({
        definition,
        state: input.state,
        district: input.district,
        building,
        playerId: input.playerId,
        playerBalances: input.playerBalances,
        stripClubConfig: input.stripClubConfig,
        restaurantConfig: input.restaurantConfig,
        convenienceStoreConfig: input.convenienceStoreConfig,
        shoppingMallConfig: input.shoppingMallConfig,
        stockExchangeConfig: input.stockExchangeConfig,
        centralBankConfig: input.centralBankConfig,
        airportConfig: input.airportConfig,
        cityHallConfig: input.cityHallConfig,
        vipLoungeConfig: input.vipLoungeConfig,
        powerStationConfig: input.powerStationConfig,
        recruitmentCenterConfig: input.recruitmentCenterConfig,
        fitnessClubConfig: input.fitnessClubConfig,
        garageConfig: input.garageConfig,
        carDealerConfig: input.carDealerConfig,
        smugglingTunnelConfig: input.smugglingTunnelConfig,
        streetDealersConfig: input.streetDealersConfig,
        schoolConfig: input.schoolConfig,
        recyclingCenterConfig: input.recyclingCenterConfig,
        tick: input.tick,
        tickRateMs: input.tickRateMs
      }),
      specialActions: createSpecialActionViews(definition, actions),
      level: building.level,
      status: building.status,
      actionCooldowns: { ...(building.actionCooldowns ?? {}) },
      actions
    };
  });
};

const createBuildingStats = (input: {
  definition: CreateDistrictPanelBuildingViewsInput["buildCatalog"][number] | undefined;
  state: CoreGameState;
  district: CoreGameState["districtsById"][string];
  building: CoreGameState["buildingsById"][string];
  playerId: string;
  playerBalances: Record<string, number>;
  stripClubConfig?: StripClubBalanceConfig;
  restaurantConfig?: RestaurantBalanceConfig;
  convenienceStoreConfig?: ConvenienceStoreBalanceConfig;
  shoppingMallConfig?: ShoppingMallBalanceConfig;
  stockExchangeConfig?: StockExchangeBalanceConfig;
  centralBankConfig?: CentralBankBalanceConfig;
  airportConfig?: AirportBalanceConfig;
  cityHallConfig?: CityHallBalanceConfig;
  vipLoungeConfig?: VipLoungeBalanceConfig;
  powerStationConfig?: PowerStationBalanceConfig;
  recruitmentCenterConfig?: RecruitmentCenterBalanceConfig;
  fitnessClubConfig?: FitnessClubBalanceConfig;
  garageConfig?: GarageBalanceConfig;
  carDealerConfig?: CarDealerBalanceConfig;
  smugglingTunnelConfig?: SmugglingTunnelBalanceConfig;
  streetDealersConfig?: StreetDealersBalanceConfig;
  schoolConfig?: SchoolBalanceConfig;
  recyclingCenterConfig?: RecyclingCenterBalanceConfig;
  tick: number;
  tickRateMs?: number;
}) => {
  const definition = input.definition;
  const stats = definition?.stats;
  const baseStats = [
    { label: "Clean / h", value: `$${formatNumber(stats?.cleanPerHour ?? 0)}` },
    { label: "Dirty / h", value: `$${formatNumber(stats?.dirtyPerHour ?? 0)}` },
    { label: "Heat / day", value: formatNumber(stats?.heatPerDay ?? 0) },
    { label: "Influence / day", value: formatNumber(stats?.influencePerDay ?? 0) },
    { label: "Max level", value: String(stats?.maxLevel ?? 1) }
  ];
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
  if (input.building.buildingTypeId === "vip_lounge" && input.vipLoungeConfig && input.building.ownerPlayerId) {
    const stats = resolveVipLoungeRumorStats({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.vipLoungeConfig
    });
    const metadata = getVipLoungeMetadata(input.building);
    const lastRumor = metadata.rumorEvents.at(-1);
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
      { label: "Latest backroom rumor", value: lastRumor?.text ?? "waiting for next whisper" }
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
  if (input.building.buildingTypeId === "school" && input.schoolConfig && input.building.ownerPlayerId) {
    const ownedCount = getOwnedSchoolCount(input.state, input.building.ownerPlayerId, input.schoolConfig);
    const network = resolveSchoolNetworkMultipliers(ownedCount, input.schoolConfig);
    const metadata = getSchoolMetadata(input.building, input.tick);
    const eveningActive = isEveningCourseActive(metadata, input.tick);
    const capacity = resolveSchoolCapacity({
      state: input.state,
      building: input.building,
      config: input.schoolConfig
    });
    const stored = Math.min(capacity, metadata.storedStudents);
    const productionPerMinute = input.schoolConfig.populationPerMinute
      * network.populationProductionMultiplier
      * (eveningActive ? input.schoolConfig.eveningCourse.populationProductionMultiplier : 1);
    const timeToFullTicks = productionPerMinute > 0 && stored < capacity
      ? Math.ceil((capacity - stored) / productionPerMinute * 60000 / Math.max(1, input.tickRateMs ?? 5000))
      : 0;
    const talentChancePct = resolveSchoolTalentChancePct({
      ownedCount,
      config: input.schoolConfig,
      eveningCourseActive: eveningActive
    });
    return [
      { label: "Clean / min", value: `$${formatNumber(input.schoolConfig.cleanCashPerMinute * network.incomeMultiplier * (eveningActive ? input.schoolConfig.eveningCourse.cleanIncomeMultiplier : 1))}` },
      { label: "Influence / min", value: formatNumber(input.schoolConfig.influencePerMinute) },
      { label: "Population / min", value: formatNumber(productionPerMinute) },
      { label: "Students", value: `${formatNumber(Math.floor(stored))} / ${formatNumber(capacity)}` },
      { label: "Time to full", value: stored >= capacity ? "Plná kapacita" : formatTickLabel(timeToFullTicks) },
      { label: "Owned schools", value: `${ownedCount}/${input.schoolConfig.countOnMap}` },
      { label: "Population multiplier", value: `x${formatNumber(network.populationProductionMultiplier)}` },
      { label: "Capacity multiplier", value: `x${formatNumber(network.studentCapacityMultiplier)}` },
      { label: "Income multiplier", value: `x${formatNumber(network.incomeMultiplier)}` },
      { label: "Talent chance", value: `${formatNumber(talentChancePct)} %` },
      { label: "Výsledek talentu", value: "jen uliční zprávy" },
      { label: "Evening course", value: eveningActive ? `active ${formatTickLabel(Math.max(0, Number(metadata.eveningCourseExpiresAtTick || 0) - input.tick))}` : "ready when off cooldown" }
    ];
  }
  if (input.building.buildingTypeId === "fitness_club" && input.fitnessClubConfig && input.building.ownerPlayerId) {
    const ownedCount = getOwnedFitnessClubCount(input.state, input.building.ownerPlayerId, input.fitnessClubConfig);
    const network = resolveFitnessClubNetworkMultipliers(ownedCount, input.fitnessClubConfig);
    const support = resolveFitnessClubSupportBonuses({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.fitnessClubConfig
    });
    return [
      { label: "Clean / min", value: `$${formatNumber(input.fitnessClubConfig.cleanCashPerMinute * network.incomeMultiplier)}` },
      { label: "Heat / min", value: formatNumber(input.fitnessClubConfig.heatPerMinute * network.heatMultiplier) },
      { label: "Owned fitness clubs", value: `${ownedCount}/${input.fitnessClubConfig.countOnMap}` },
      { label: "Income multiplier", value: `x${formatNumber(network.incomeMultiplier)}` },
      { label: "Attack strength bonus", value: `+${formatNumber(support.attackStrengthBonusPct)} %` },
      { label: "Defense strength bonus", value: `+${formatNumber(support.defenseStrengthBonusPct)} %` },
      { label: "Recruitment + fitness attack cap", value: `+${formatNumber(support.combinedRecruitmentFitnessAttackCapPct)} %` },
      { label: "Recruitment + fitness defense cap", value: `+${formatNumber(support.combinedRecruitmentFitnessDefenseCapPct)} %` },
      { label: "Attack applies to", value: "gang body, bats, pistols, grenades, SMGs, bazookas by weight" },
      { label: "Defense applies to", value: "gang body, vests, barricades; not cameras or alarm" }
    ];
  }
  if (input.building.buildingTypeId === "garage" && input.garageConfig && input.building.ownerPlayerId) {
    const ownedCount = getOwnedGarageCount(input.state, input.building.ownerPlayerId, input.garageConfig);
    const network = resolveGarageNetworkMultipliers(ownedCount, input.garageConfig);
    const cooldownStats = resolveGarageCooldownStats({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.garageConfig
    });
    return [
      { label: "Clean / min", value: `$${formatNumber(input.garageConfig.cleanCashPerMinute * network.incomeMultiplier)}` },
      { label: "Heat / min", value: formatNumber(input.garageConfig.heatPerMinute * network.heatMultiplier) },
      { label: "Owned garages", value: `${ownedCount}/${input.garageConfig.countOnMap}` },
      { label: "Income multiplier", value: `x${formatNumber(network.incomeMultiplier)}` },
      { label: "Cooldown reduction", value: `-${formatNumber(cooldownStats.cooldownReductionPct)} %` },
      { label: "Full bonus categories", value: formatCategoryList(cooldownStats.fullBonusCategories) },
      { label: "Half bonus categories", value: formatCategoryList(cooldownStats.halfBonusCategories) },
      { label: "No bonus categories", value: formatCategoryList(cooldownStats.excludedCategories) }
    ];
  }
  if (input.building.buildingTypeId === "recycling_center" && input.recyclingCenterConfig && input.building.ownerPlayerId) {
    const recyclingCenterConfig = input.recyclingCenterConfig;
    const ownedCount = getOwnedRecyclingCenterCount(input.state, input.building.ownerPlayerId, recyclingCenterConfig);
    const network = resolveRecyclingCenterNetworkMultipliers(ownedCount, recyclingCenterConfig);
    const salvageStats = resolveRecyclingCenterSalvageStats({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: recyclingCenterConfig,
      tickRateMs: input.tickRateMs ?? 5000
    });
    const poolTotal = salvageStats.freshPool.reduce((total, entry) => total + Math.max(0, Number(entry.amount || 0)), 0);
    const nextExpiry = salvageStats.freshPool.reduce<number | null>((next, entry) => {
      const lostAtTick = Number(entry.lostAtTick);
      if (!Number.isFinite(lostAtTick)) return next;
      const expiresAtTick = lostAtTick + Math.ceil(recyclingCenterConfig.salvage.poolTtlMinutes * 60000 / Math.max(1, input.tickRateMs ?? 5000));
      const remaining = Math.max(0, expiresAtTick - input.tick);
      return next === null ? remaining : Math.min(next, remaining);
    }, null);
    return [
      { label: "Clean / min", value: `$${formatNumber(recyclingCenterConfig.cleanCashPerMinute * network.incomeMultiplier)}` },
      { label: "Heat / min", value: formatNumber(recyclingCenterConfig.heatPerMinute * network.heatMultiplier) },
      { label: "Owned centers", value: `${ownedCount}/${recyclingCenterConfig.countOnMap}` },
      { label: "Income multiplier", value: `x${formatNumber(network.incomeMultiplier)}` },
      { label: "Salvage rate", value: `${formatNumber(salvageStats.salvageRatePct)} %` },
      { label: "Material salvage pool", value: `${formatNumber(poolTotal)} materials` },
      { label: "Next expiry", value: nextExpiry === null ? "none" : formatTickLabel(nextExpiry) },
      { label: "Action cost", value: `$${formatNumber(recyclingCenterConfig.extractLosses.cleanCashCost)}` },
      { label: "Recovery scope", value: "lost materials only" }
    ];
  }
  if (input.building.buildingTypeId !== "strip_club" || !input.stripClubConfig || !input.building.ownerPlayerId) {
    if (input.building.buildingTypeId !== "power_station" || !input.powerStationConfig || !input.building.ownerPlayerId) {
      if (input.building.buildingTypeId !== "restaurant" || !input.restaurantConfig || !input.building.ownerPlayerId) {
        if (input.building.buildingTypeId !== "convenience_store" || !input.convenienceStoreConfig || !input.building.ownerPlayerId) {
          if (input.building.buildingTypeId !== "recruitment_center" || !input.recruitmentCenterConfig || !input.building.ownerPlayerId) {
            return baseStats;
          }
          const ownedCount = getOwnedRecruitmentCenterCount(input.state, input.building.ownerPlayerId, input.recruitmentCenterConfig);
          const network = resolveRecruitmentCenterNetworkMultipliers(ownedCount, input.recruitmentCenterConfig);
          const support = resolveRecruitmentCenterSupportBonuses({
            state: input.state,
            playerId: input.building.ownerPlayerId,
            config: input.recruitmentCenterConfig
          });
          return [
            { label: "Clean / min", value: `$${formatNumber(input.recruitmentCenterConfig.cleanCashPerMinute * network.incomeMultiplier)}` },
            { label: "Heat / min", value: formatNumber(input.recruitmentCenterConfig.heatPerMinute * network.heatMultiplier) },
            { label: "Owned centers", value: `${ownedCount}/${input.recruitmentCenterConfig.countOnMap}` },
            { label: "Income multiplier", value: `x${formatNumber(network.incomeMultiplier)}` },
            { label: "Apartment production bonus", value: `+${formatNumber(support.populationProductionBonusPct)} %` },
            { label: "Apartment capacity bonus", value: `+${formatNumber(support.apartmentCapacityBonusPct)} %` },
            { label: "Attack weapon strength", value: `+${formatNumber(support.attackWeaponStrengthBonusPct)} %` },
            { label: "Defense item strength", value: `+${formatNumber(support.defenseItemStrengthBonusPct)} %` },
            { label: "Camera/alarm combined cap", value: `max +${formatNumber(support.combinedCameraAlarmCapPct)} %` }
          ];
          }
          const ownedCount = getOwnedConvenienceStoreCount(input.state, input.building.ownerPlayerId, input.convenienceStoreConfig);
        const network = resolveConvenienceStoreNetworkMultipliers(ownedCount, input.convenienceStoreConfig);
        const rumorStats = resolveConvenienceStoreRumorStats({
          state: input.state,
          playerId: input.building.ownerPlayerId,
          config: input.convenienceStoreConfig,
          restaurantConfig: input.restaurantConfig
        });
        const civilNetworkBonus = rumorStats.civilRumorChanceBonusPct > 0
          ? `+${formatNumber(rumorStats.civilRumorChanceBonusPct)} %`
          : "inactive";
        return [
          { label: "Clean / min", value: `$${formatNumber(input.convenienceStoreConfig.cleanCashPerMinute * network.cleanIncomeMultiplier)}` },
          { label: "Dirty / min", value: `$${formatNumber(input.convenienceStoreConfig.dirtyCashPerMinute * network.dirtyIncomeMultiplier)}` },
          { label: "Influence / min", value: formatNumber(input.convenienceStoreConfig.influencePerMinute * network.influenceMultiplier) },
          { label: "Heat / min", value: formatNumber(input.convenienceStoreConfig.heatPerMinute * network.heatMultiplier) },
          { label: "Owned stores", value: `${ownedCount}/${input.convenienceStoreConfig.countOnMap}` },
          { label: "Clean income multiplier", value: `x${formatNumber(network.cleanIncomeMultiplier)}` },
          { label: "Dirty income multiplier", value: `x${formatNumber(network.dirtyIncomeMultiplier)}` },
          { label: "Influence multiplier", value: `x${formatNumber(network.influenceMultiplier)}` },
          { label: "Rumor multiplier", value: `x${formatNumber(network.rumorMultiplier)}` },
          { label: "Passive rumor chance", value: `${formatNumber(rumorStats.passiveRumorChancePct)} %` },
          { label: "Rumor truth chance", value: `${formatNumber(rumorStats.truthChancePct)} %` },
          { label: "Civil network bonus", value: civilNetworkBonus }
        ];
      }
      const ownedCount = getOwnedRestaurantCount(input.state, input.building.ownerPlayerId, input.restaurantConfig);
      const network = resolveRestaurantNetworkMultipliers(ownedCount, input.restaurantConfig);
      const rumorStats = resolveRestaurantRumorStats({
        state: input.state,
        playerId: input.building.ownerPlayerId,
        config: input.restaurantConfig
      });
      return [
        { label: "Clean / min", value: `$${formatNumber(input.restaurantConfig.cleanCashPerMinute * network.incomeMultiplier)}` },
        { label: "Influence / min", value: formatNumber(input.restaurantConfig.influencePerMinute * network.influenceMultiplier) },
        { label: "Heat / min", value: formatNumber(input.restaurantConfig.heatPerMinute * network.heatMultiplier) },
        { label: "Owned restaurants", value: `${ownedCount}/${input.restaurantConfig.countOnMap}` },
        { label: "Income multiplier", value: `x${formatNumber(network.incomeMultiplier)}` },
        { label: "Influence multiplier", value: `x${formatNumber(network.influenceMultiplier)}` },
        { label: "Rumor multiplier", value: `x${formatNumber(network.rumorMultiplier)}` },
        { label: "Passive rumor chance", value: `${formatNumber(rumorStats.passiveRumorChancePct)} %` },
        { label: "Rumor truth chance", value: `${formatNumber(rumorStats.truthChancePct)} %` }
      ];
    }
    const ownedCount = getOwnedPowerStationCount(input.state, input.building.ownerPlayerId, input.powerStationConfig);
    const network = resolvePowerStationNetworkMultipliers(ownedCount, input.powerStationConfig);
    const metadata = getPowerStationMetadata(input.building);
    const infrastructureBonusPct = resolvePowerStationInfrastructureBonusPct({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.powerStationConfig,
      tick: input.tick
    });
    const remaining = Math.max(0, (metadata.backupGridSwitchExpiresAtTick ?? 0) - input.tick);
    return [
      { label: "Clean / min", value: `$${formatNumber(input.powerStationConfig.cleanCashPerMinute * network.incomeMultiplier)}` },
      { label: "Heat / min", value: formatNumber(input.powerStationConfig.heatPerMinute * network.heatMultiplier) },
      { label: "Owned stations", value: `${ownedCount}/${input.powerStationConfig.countOnMap}` },
      { label: "Infrastructure bonus", value: `${formatNumber(infrastructureBonusPct)} %` },
      { label: "Station income multiplier", value: `x${formatNumber(network.incomeMultiplier)}` },
      { label: "Camera bonus", value: `${formatNumber(network.cameraStrengthBonusPct + (remaining > 0 ? input.powerStationConfig.backupGridSwitch.cameraStrengthBonusPct : 0))} %` },
      { label: "Alarm bonus", value: `${formatNumber(network.alarmStrengthBonusPct + (remaining > 0 ? input.powerStationConfig.backupGridSwitch.alarmStrengthBonusPct : 0))} %` },
      { label: "Backup grid boost", value: remaining > 0 ? formatTickLabel(remaining) : "inactive" }
    ];
  }
  const ownedCount = getOwnedStripClubCount(input.state, input.building.ownerPlayerId, input.stripClubConfig);
  const network = resolveStripClubNetworkMultipliers(ownedCount, input.stripClubConfig);
  const metadata = getStripClubMetadata(input.building);
  const rumorStats = resolveStripClubRumorStats({
    state: input.state,
    playerId: input.building.ownerPlayerId,
    config: input.stripClubConfig,
    vipActive: (metadata.vipLoungeExpiresAtTick ?? 0) > input.tick
  });
  const activeContacts = metadata.contacts
    .filter((contact) => contact.expiresAtTick === null || contact.expiresAtTick > input.tick)
    .map((contact) => contact.label)
    .join(", ");
  return [
    { label: "Clean / min", value: `$${formatNumber(input.stripClubConfig.cleanCashPerMinute * network.incomeMultiplier)}` },
    { label: "Dirty / min", value: `$${formatNumber(input.stripClubConfig.dirtyCashPerMinute * network.incomeMultiplier)}` },
    { label: "Influence / min", value: formatNumber(input.stripClubConfig.influencePerMinute * network.influenceMultiplier) },
    { label: "Heat / min", value: formatNumber(input.stripClubConfig.heatPerMinute * network.heatMultiplier) },
    { label: "Owned clubs", value: `${ownedCount}/${input.stripClubConfig.countOnMap}` },
    { label: "Income multiplier", value: `x${formatNumber(network.incomeMultiplier)}` },
    { label: "Influence multiplier", value: `x${formatNumber(network.influenceMultiplier)}` },
    { label: "Rumor multiplier", value: `x${formatNumber(network.rumorMultiplier)}` },
    { label: "Passive rumor chance", value: `${formatNumber(rumorStats.passiveRumorChancePct)} %` },
    { label: "Rumor truth chance", value: `${formatNumber(rumorStats.truthChancePct)} %` },
    { label: "Active contacts", value: activeContacts || "none" },
    { label: "Scandal risk", value: `${input.stripClubConfig.privateParty.scandalChancePct} %` }
  ];
};

const normalizeBuildingDisplayName = (value: string | null | undefined): string | null => {
  const normalized = String(value || "").trim();
  return normalized || null;
};

const resolveCatalogVariantName = (
  definition: CreateDistrictPanelBuildingViewsInput["buildCatalog"][number] | undefined,
  seed: string
): string | null => {
  const variants = definition?.nameVariants ?? [];
  if (variants.length < 1) {
    return null;
  }
  return variants[hashString(seed) % variants.length] ?? null;
};

const hashString = (value: string): number => {
  const text = String(value || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const createSpecialActionViews = (
  definition: CreateDistrictPanelBuildingViewsInput["buildCatalog"][number] | undefined,
  actions: ReturnType<typeof createBuildingActionViews>
) =>
  (definition?.specialActions ?? []).map((specialAction) => {
    const commandAction = actions.find((action) => action.actionId === specialAction.actionId);

    return {
      actionId: specialAction.actionId,
      label: specialAction.label,
      description: specialAction.description,
      effectSummary: specialAction.effectSummary,
      durationMs: specialAction.durationMs,
      cooldownMs: specialAction.cooldownMs,
      cooldownRemainingTicks: commandAction?.cooldownRemainingTicks ?? 0,
      heatGain: specialAction.heatGain,
      enabled: commandAction?.enabled ?? false,
      disabledReason: commandAction?.disabledReason ?? "This special action is not wired to the command dispatcher yet."
    };
  });

const createBuildingActionViews = (input: {
  actionCatalog: Readonly<Record<string, BuildingActionBalanceConfig>>;
  state: CoreGameState;
  stripClubConfig?: StripClubBalanceConfig;
  restaurantConfig?: RestaurantBalanceConfig;
  convenienceStoreConfig?: ConvenienceStoreBalanceConfig;
  shoppingMallConfig?: ShoppingMallBalanceConfig;
  stockExchangeConfig?: StockExchangeBalanceConfig;
  centralBankConfig?: CentralBankBalanceConfig;
  airportConfig?: AirportBalanceConfig;
  cityHallConfig?: CityHallBalanceConfig;
  vipLoungeConfig?: VipLoungeBalanceConfig;
  powerStationConfig?: PowerStationBalanceConfig;
  recruitmentCenterConfig?: RecruitmentCenterBalanceConfig;
  fitnessClubConfig?: FitnessClubBalanceConfig;
  garageConfig?: GarageBalanceConfig;
  carDealerConfig?: CarDealerBalanceConfig;
  smugglingTunnelConfig?: SmugglingTunnelBalanceConfig;
  streetDealersConfig?: StreetDealersBalanceConfig;
  schoolConfig?: SchoolBalanceConfig;
  recyclingCenterConfig?: RecyclingCenterBalanceConfig;
  building: CoreGameState["buildingsById"][string];
  district: CoreGameState["districtsById"][string];
  playerId: string;
  playerBalances: Record<string, number>;
  tick: number;
  tickRateMs?: number;
}) =>
  Object.values(input.actionCatalog)
    .filter((action) => action.buildingType === input.building.buildingTypeId)
    .map((action) => {
      const cooldownUntilTick = Math.max(0, Number((input.building.actionCooldowns ?? {})[action.actionId] || 0));
      const cooldownRemainingTicks = Math.max(0, cooldownUntilTick - input.tick);
      const missingCosts = Object.entries(action.inputCost).filter(
        ([resourceKey, requiredAmount]) => Math.max(0, Number(input.playerBalances[resourceKey] || 0)) < requiredAmount
      );
      const ownerBlocked =
        action.requiredOwner &&
        (input.district.ownerPlayerId !== input.playerId || input.building.ownerPlayerId !== input.playerId);
      const stripClubDisabledReason = resolveStripClubDisabledReason({
        state: input.state,
        district: input.district,
        building: input.building,
        action,
        stripClubConfig: input.stripClubConfig,
        tick: input.tick
      });
      const powerStationDisabledReason = resolvePowerStationDisabledReason({
        state: input.state,
        building: input.building,
        action,
        powerStationConfig: input.powerStationConfig,
        tick: input.tick
      });
      const recyclingCenterDisabledReason = resolveRecyclingCenterDisabledReason({
        state: input.state,
        building: input.building,
        action,
        recyclingCenterConfig: input.recyclingCenterConfig,
        tickRateMs: input.tickRateMs ?? 5000
      });
      const smugglingTunnelDisabledReason = resolveSmugglingTunnelDisabledReason({
        state: input.state,
        building: input.building,
        action,
        smugglingTunnelConfig: input.smugglingTunnelConfig,
        tick: input.tick
      });
      const stockExchangeDisabledReason = resolveStockExchangeDisabledReason({
        state: input.state,
        district: input.district,
        building: input.building,
        action,
        stockExchangeConfig: input.stockExchangeConfig,
        playerBalances: input.playerBalances,
        tick: input.tick
      });
      const airportDisabledReason = resolveAirportDisabledReason({
        state: input.state,
        building: input.building,
        action,
        airportConfig: input.airportConfig,
        playerBalances: input.playerBalances,
        tick: input.tick
      });
      const cityHallDisabledReason = resolveCityHallDisabledReason({
        state: input.state,
        district: input.district,
        building: input.building,
        action,
        cityHallConfig: input.cityHallConfig,
        playerBalances: input.playerBalances,
        tick: input.tick
      });
      const centralBankDisabledReason = resolveCentralBankDisabledReason({
        state: input.state,
        district: input.district,
        building: input.building,
        action,
        centralBankConfig: input.centralBankConfig,
        playerBalances: input.playerBalances,
        tick: input.tick
      });
      const schoolDisabledReason = resolveSchoolDisabledReason({
        state: input.state,
        building: input.building,
        action,
        schoolConfig: input.schoolConfig,
        tick: input.tick
      });
      const streetDealerDisabledReason = resolveStreetDealerDisabledReason({
        state: input.state,
        building: input.building,
        action,
        streetDealersConfig: input.streetDealersConfig,
        playerBalances: input.playerBalances,
        tick: input.tick
      });
      const disabledReason = ownerBlocked
        ? "Only the district owner can run this building action."
        : input.building.status !== "active"
          ? "Only active fixed buildings can run actions."
          : input.district.status === "contested" && !action.allowedIfContested
            ? "This action is blocked while the district is contested."
            : stripClubDisabledReason
              ? stripClubDisabledReason
              : powerStationDisabledReason
                ? powerStationDisabledReason
                : recyclingCenterDisabledReason
                  ? recyclingCenterDisabledReason
                  : smugglingTunnelDisabledReason
                    ? smugglingTunnelDisabledReason
                    : stockExchangeDisabledReason
                      ? stockExchangeDisabledReason
                      : airportDisabledReason
                        ? airportDisabledReason
                        : cityHallDisabledReason
                          ? cityHallDisabledReason
                          : centralBankDisabledReason
                            ? centralBankDisabledReason
                            : schoolDisabledReason
                              ? schoolDisabledReason
                              : streetDealerDisabledReason
                                ? streetDealerDisabledReason
                              : cooldownRemainingTicks > 0
                                ? `Cooldown ${formatTickLabel(cooldownRemainingTicks)}.`
                                : missingCosts.length > 0
                                  ? `Need ${formatInputSummary(Object.fromEntries(missingCosts))}.`
                                  : null;

      return {
        actionId: action.actionId,
        label: action.label,
        description: action.description,
        durationMs: action.durationMs,
        cooldownMs: action.cooldownMs,
        cooldownRemainingTicks,
        inputCost: { ...action.inputCost },
        outputGain: { ...action.outputGain },
        heatGain: action.heatGain,
        influenceChange: action.influenceChange,
        reportText: action.reportText,
        enabled: disabledReason === null,
        disabledReason
      };
    });

const formatInputSummary = (inputCosts: Record<string, number>): string =>
  Object.entries(inputCosts)
    .map(([resourceKey, amount]) => `${amount} ${formatResourceLabel(resourceKey)}`)
    .join(" + ");

const formatResourceLabel = (resourceKey: string): string =>
  resourceKey
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const formatCategoryList = (categories: string[]): string =>
  categories.length > 0
    ? categories.map((category) => GARAGE_CATEGORY_LABELS[category] ?? formatResourceLabel(category)).join(", ")
    : "none";

const GARAGE_CATEGORY_LABELS: Record<string, string> = {
  gangMovement: "Gang movement",
  attackPreparation: "Attack preparation",
  districtRobbery: "District robbery",
  equipmentTransfer: "Equipment transfer",
  resourceTransfer: "Resource transfer",
  defenseRepair: "Defense repair",
  defenseRestore: "Defense restore",
  districtSpy: "District spy",
  trapDetection: "Trap detection",
  clinicRecovery: "Clinic recovery",
  factoryProductionActions: "Factory production actions",
  armoryProductionActions: "Armory production actions",
  moneyLaundering: "Money laundering",
  casinoActions: "Casino actions",
  exchangeOfficeActions: "Exchange office actions",
  arcadeLaunderingActions: "Arcade laundering actions",
  vipBoosts: "VIP boosts",
  rumorGeneration: "Rumor generation",
  passiveProduction: "Passive production"
};

const formatNumber = (value: number): string => {
  const normalized = Number(value || 0);
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1);
};

const formatTickLabel = (tickCount: number): string => `${tickCount} ${tickCount === 1 ? "tick" : "ticks"}`;

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

const resolveStripClubDisabledReason = (input: {
  state: CoreGameState;
  district: CoreGameState["districtsById"][string];
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  stripClubConfig?: StripClubBalanceConfig;
  tick: number;
}): string | null => {
  const config = input.stripClubConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) {
    return null;
  }
  const metadata = getStripClubMetadata(input.building);
  if (input.action.actionId === config.vipLounge.actionId && (metadata.vipLoungeExpiresAtTick ?? 0) > input.tick) {
    return `VIP salonek active ${formatTickLabel((metadata.vipLoungeExpiresAtTick ?? input.tick) - input.tick)}.`;
  }
  if (input.action.actionId === config.privateParty.actionId && (metadata.privatePartyExpiresAtTick ?? 0) > input.tick) {
    return `Soukromá party active ${formatTickLabel((metadata.privatePartyExpiresAtTick ?? input.tick) - input.tick)}.`;
  }
  if (input.action.actionId === config.barWhispers.actionId && Math.max(0, Number(input.district.influence || 0)) < config.barWhispers.influenceCost) {
    return `Need ${config.barWhispers.influenceCost} influence.`;
  }
  return null;
};

const resolvePowerStationDisabledReason = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  powerStationConfig?: PowerStationBalanceConfig;
  tick: number;
}): string | null => {
  const config = input.powerStationConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId || input.action.actionId !== config.backupGridSwitch.actionId) {
    return null;
  }
  const expiresAtTick = getPowerStationMetadata(input.building).backupGridSwitchExpiresAtTick ?? 0;
  if (expiresAtTick > input.tick) {
    return `Záložní síť active ${formatTickLabel(expiresAtTick - input.tick)}.`;
  }
  return null;
};

const resolveRecyclingCenterDisabledReason = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  recyclingCenterConfig?: RecyclingCenterBalanceConfig;
  tickRateMs: number;
}): string | null => {
  const config = input.recyclingCenterConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId || input.action.actionId !== config.extractLosses.actionId) {
    return null;
  }
  const stats = resolveRecyclingCenterSalvageStats({
    state: input.state,
    playerId: input.building.ownerPlayerId,
    config,
    tickRateMs: input.tickRateMs
  });
  if (stats.freshPool.length <= 0) {
    return "Salvage pool is empty.";
  }
  return null;
};

const resolveSmugglingTunnelDisabledReason = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  smugglingTunnelConfig?: SmugglingTunnelBalanceConfig;
  tick: number;
}): string | null => {
  const config = input.smugglingTunnelConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) {
    return null;
  }
  if (input.action.actionId !== config.openChannel.actionId) {
    return null;
  }
  const channel = resolveOpenChannelStats({
    state: input.state,
    playerId: input.building.ownerPlayerId,
    config,
    tick: input.tick
  });
  if (channel.active) {
    return `Otevřený kanál active ${formatTickLabel(channel.remainingTicks)}.`;
  }
  return null;
};

const resolveStockExchangeDisabledReason = (input: {
  state: CoreGameState;
  district: CoreGameState["districtsById"][string];
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  stockExchangeConfig?: StockExchangeBalanceConfig;
  playerBalances: Record<string, number>;
  tick: number;
}): string | null => {
  const config = input.stockExchangeConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) return null;
  const metadata = getStockExchangeMetadata(input.building, input.tick);
  if (input.action.actionId === config.marketPressure.actionId) {
    if (Math.max(0, Number(input.district.influence || 0)) < config.marketPressure.costInfluence) {
      return `Need ${config.marketPressure.costInfluence} influence.`;
    }
    if (metadata.marketEffects.some((effect) => effect.expiresAtTick > input.tick)) {
      return "Market pressure is already active.";
    }
  }
  if (input.action.actionId === config.insiderWindow.actionId && Number(metadata.insiderWindowExpiresAtTick || 0) > input.tick) {
    return `Insider Window active ${formatTickLabel(Number(metadata.insiderWindowExpiresAtTick) - input.tick)}.`;
  }
  if (input.action.actionId === config.speculativeBuy.actionId) {
    const minimumTotal = config.speculativeBuy.costCleanCash + 1;
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < minimumTotal) {
      return `Need at least ${minimumTotal} clean cash.`;
    }
  }
  return null;
};

const resolveAirportDisabledReason = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  airportConfig?: AirportBalanceConfig;
  playerBalances: Record<string, number>;
  tick: number;
}): string | null => {
  const config = input.airportConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) return null;
  const metadata = getAirportMetadata(input.building, input.tick);
  if (input.action.actionId === config.expressImport.actionId) {
    const penaltyPct = Math.max(0, Number(metadata.nextImportCostPenaltyPct || 0));
    const cost = Math.ceil(config.expressImport.costCleanCash * (1 + penaltyPct / 100));
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < cost) {
      return `Need ${cost} clean cash.`;
    }
  }
  if (input.action.actionId === config.blackCharter.actionId) {
    if (Number(metadata.blackCharterExpiresAtTick || 0) > input.tick) {
      return `Černý charter active ${formatTickLabel(Number(metadata.blackCharterExpiresAtTick) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.playerBalances["dirty-cash"] || 0)) < config.blackCharter.costDirtyCash) {
      return `Need ${config.blackCharter.costDirtyCash} dirty cash.`;
    }
  }
  if (input.action.actionId === config.evacuationCorridor.actionId) {
    if (Number(metadata.evacuationCorridorExpiresAtTick || 0) > input.tick) {
      return `Evakuační koridor active ${formatTickLabel(Number(metadata.evacuationCorridorExpiresAtTick) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < config.evacuationCorridor.costCleanCash) {
      return `Need ${config.evacuationCorridor.costCleanCash} clean cash.`;
    }
  }
  return null;
};

const resolveCityHallDisabledReason = (input: {
  state: CoreGameState;
  district: CoreGameState["districtsById"][string];
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  cityHallConfig?: CityHallBalanceConfig;
  playerBalances: Record<string, number>;
  tick: number;
}): string | null => {
  const config = input.cityHallConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) return null;
  const metadata = getCityHallMetadata(input.building, input.tick);
  if (input.action.actionId === config.officialCover.actionId) {
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < config.officialCover.costCleanCash) {
      return `Need ${config.officialCover.costCleanCash} clean cash.`;
    }
    if (Math.max(0, Number(input.district.influence || 0)) < config.officialCover.costInfluence) {
      return `Need ${config.officialCover.costInfluence} influence.`;
    }
    if (metadata.officialCoverByDistrictId[input.district.id]?.expiresAtTick > input.tick) {
      return `Úřední krytí active ${formatTickLabel(metadata.officialCoverByDistrictId[input.district.id].expiresAtTick - input.tick)}.`;
    }
  }
  if (input.action.actionId === config.cityContract.actionId) {
    if (Number(metadata.cityContractBlockedUntilTick || 0) > input.tick) {
      return `Městská zakázka blocked ${formatTickLabel(Number(metadata.cityContractBlockedUntilTick) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.district.influence || 0)) < config.cityContract.costInfluence) {
      return `Need ${config.cityContract.costInfluence} influence.`;
    }
  }
  if (input.action.actionId === config.emergencyDecree.actionId) {
    if (Number(metadata.emergencyDecree?.expiresAtTick || 0) > input.tick) {
      return `Nouzová vyhláška active ${formatTickLabel(Number(metadata.emergencyDecree?.expiresAtTick || 0) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < config.emergencyDecree.costCleanCash) {
      return `Need ${config.emergencyDecree.costCleanCash} clean cash.`;
    }
    if (Math.max(0, Number(input.district.influence || 0)) < config.emergencyDecree.costInfluence) {
      return `Need ${config.emergencyDecree.costInfluence} influence.`;
    }
  }
  return null;
};

const resolveCentralBankDisabledReason = (input: {
  state: CoreGameState;
  district: CoreGameState["districtsById"][string];
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  centralBankConfig?: CentralBankBalanceConfig;
  playerBalances: Record<string, number>;
  tick: number;
}): string | null => {
  const config = input.centralBankConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) return null;
  const metadata = getCentralBankMetadata(input.building, input.tick);
  if (input.action.actionId === config.liquidityInjection.actionId) {
    if (Number(metadata.liquidityBlockedUntilTick || 0) > input.tick) {
      return `Likviditní injekce blocked ${formatTickLabel(Number(metadata.liquidityBlockedUntilTick) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.district.influence || 0)) < config.liquidityInjection.costInfluence) {
      return `Need ${config.liquidityInjection.costInfluence} influence.`;
    }
  }
  if (input.action.actionId === config.frozenAccounts.actionId) {
    if (Number(metadata.frozenAccountsExpiresAtTick || 0) > input.tick) {
      return `Zmrazené účty active ${formatTickLabel(Number(metadata.frozenAccountsExpiresAtTick) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < config.frozenAccounts.costCleanCash) {
      return `Need ${config.frozenAccounts.costCleanCash} clean cash.`;
    }
  }
  if (input.action.actionId === config.currencyIntervention.actionId) {
    if (metadata.currencyInterventions.some((effect) => effect.expiresAtTick > input.tick)) {
      return "Kurzovní intervence is already active.";
    }
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < config.currencyIntervention.costCleanCash) {
      return `Need ${config.currencyIntervention.costCleanCash} clean cash.`;
    }
    if (Math.max(0, Number(input.district.influence || 0)) < config.currencyIntervention.costInfluence) {
      return `Need ${config.currencyIntervention.costInfluence} influence.`;
    }
  }
  return null;
};

const resolveSchoolDisabledReason = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  schoolConfig?: SchoolBalanceConfig;
  tick: number;
}): string | null => {
  const config = input.schoolConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) {
    return null;
  }
  const metadata = getSchoolMetadata(input.building, input.tick);
  if (input.action.actionId === config.collectStudents.actionId) {
    return metadata.storedStudents > 0 ? null : "Škola zatím nemá studenty k vybrání.";
  }
  if (input.action.actionId !== config.eveningCourse.actionId) {
    return null;
  }
  if (isEveningCourseActive(metadata, input.tick)) {
    return `Večerní kurz active ${formatTickLabel(Math.max(0, Number(metadata.eveningCourseExpiresAtTick || 0) - input.tick))}.`;
  }
  return null;
};

const resolveStreetDealerDisabledReason = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  streetDealersConfig?: StreetDealersBalanceConfig;
  playerBalances: Record<string, number>;
  tick: number;
}): string | null => {
  const config = input.streetDealersConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId || input.action.actionId !== config.startDrugSale.actionId) {
    return null;
  }
  if (!input.building.ownerPlayerId) return "Street dealers need an owner.";
  const player = input.state.playersById[input.building.ownerPlayerId];
  const ownedCount = getOwnedStreetDealerCount(input.state, input.building.ownerPlayerId, config);
  const slotCount = resolveStreetDealerSlotCount(ownedCount, config);
  const metadata = player ? getStreetDealersPlayerMetadata(player) : { slots: [], saleHistory: [] };
  const lockedSlots = metadata.slots.filter((slot) => slot.saleId || Number(slot.cooldownUntilTick || 0) > input.tick).length;
  if (slotCount <= 0 || lockedSlots >= slotCount) return "No free dealer slot.";
  const hasDrugStock = config.sellableDrugs.some((drug) => Number(input.playerBalances[drug.itemId] || 0) > 0);
  return hasDrugStock ? null : "Need a Drug Lab product in storage.";
};
