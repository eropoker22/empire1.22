import type { DistrictPanelBuildingView } from "@empire/shared-types";
import type { BuildingActionBalanceConfig } from "../contracts/game-mode-config";
import type { CoreGameState } from "../entities/game-state";
import type { DistrictPanelBuildingCatalogEntry } from "./district-building-catalog-types";
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
  getOwnedShoppingMallCount,
  resolveShoppingMallMarketBonuses,
  resolveShoppingMallNetworkMultipliers
} from "../handlers/shoppingMallBuildingActions";
import {
  getOwnedSmugglingTunnelCount,
  getSmugglingTunnelMetadata,
  isSilentChannelActive,
  resolveSmugglingTunnelCapacity,
  resolveSmugglingTunnelCollectHeat,
  resolveSmugglingTunnelNetworkMultipliers
} from "../handlers/smugglingTunnelBuildingActions";
import type { CarDealerBalanceConfig, FitnessClubBalanceConfig, GarageBalanceConfig, PowerStationBalanceConfig, RecruitmentCenterBalanceConfig, RecyclingCenterBalanceConfig, RestaurantBalanceConfig, ShoppingMallBalanceConfig, SmugglingTunnelBalanceConfig, StripClubBalanceConfig } from "../contracts/game-mode-config";
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
  powerStationConfig?: PowerStationBalanceConfig;
  recruitmentCenterConfig?: RecruitmentCenterBalanceConfig;
  fitnessClubConfig?: FitnessClubBalanceConfig;
  garageConfig?: GarageBalanceConfig;
  carDealerConfig?: CarDealerBalanceConfig;
  smugglingTunnelConfig?: SmugglingTunnelBalanceConfig;
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
      powerStationConfig: input.powerStationConfig,
      recruitmentCenterConfig: input.recruitmentCenterConfig,
      fitnessClubConfig: input.fitnessClubConfig,
      garageConfig: input.garageConfig,
      carDealerConfig: input.carDealerConfig,
      smugglingTunnelConfig: input.smugglingTunnelConfig,
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
        stripClubConfig: input.stripClubConfig,
        restaurantConfig: input.restaurantConfig,
        convenienceStoreConfig: input.convenienceStoreConfig,
        shoppingMallConfig: input.shoppingMallConfig,
        powerStationConfig: input.powerStationConfig,
        recruitmentCenterConfig: input.recruitmentCenterConfig,
        fitnessClubConfig: input.fitnessClubConfig,
        garageConfig: input.garageConfig,
        carDealerConfig: input.carDealerConfig,
        smugglingTunnelConfig: input.smugglingTunnelConfig,
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
  stripClubConfig?: StripClubBalanceConfig;
  restaurantConfig?: RestaurantBalanceConfig;
  convenienceStoreConfig?: ConvenienceStoreBalanceConfig;
  shoppingMallConfig?: ShoppingMallBalanceConfig;
  powerStationConfig?: PowerStationBalanceConfig;
  recruitmentCenterConfig?: RecruitmentCenterBalanceConfig;
  fitnessClubConfig?: FitnessClubBalanceConfig;
  garageConfig?: GarageBalanceConfig;
  carDealerConfig?: CarDealerBalanceConfig;
  smugglingTunnelConfig?: SmugglingTunnelBalanceConfig;
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
    const metadata = getSmugglingTunnelMetadata(input.building);
    const activeSilentChannel = isSilentChannelActive(metadata, input.tick);
    const capacity = resolveSmugglingTunnelCapacity({
      state: input.state,
      building: input.building,
      config: input.smugglingTunnelConfig,
      tick: input.tick
    });
    const stored = Math.min(capacity, metadata.storedDirtyCash);
    const productionPerMinute = input.smugglingTunnelConfig.dirtyCashPerMinute
      * network.dirtyProductionMultiplier
      * (activeSilentChannel ? input.smugglingTunnelConfig.silentChannel.dirtyProductionMultiplier : 1);
    const heatPerMinute = input.smugglingTunnelConfig.passiveHeatPerMinute
      * network.passiveHeatMultiplier
      * (activeSilentChannel ? input.smugglingTunnelConfig.silentChannel.passiveHeatMultiplier : 1);
    const timeToFullTicks = productionPerMinute > 0 && stored < capacity
      ? Math.ceil((capacity - stored) / productionPerMinute * 60000 / Math.max(1, input.tickRateMs ?? 5000))
      : 0;
    return [
      { label: "Dirty / min", value: `$${formatNumber(productionPerMinute)}` },
      { label: "Passive heat / min", value: formatNumber(heatPerMinute) },
      { label: "Stored batch", value: `$${formatNumber(stored)} / $${formatNumber(capacity)}` },
      { label: "Time to full", value: stored >= capacity ? "Dávka připravena" : formatTickLabel(timeToFullTicks) },
      { label: "Owned tunnels", value: `${ownedCount}/${input.smugglingTunnelConfig.countOnMap}` },
      { label: "Dirty production multiplier", value: `x${formatNumber(network.dirtyProductionMultiplier)}` },
      { label: "Batch capacity multiplier", value: `x${formatNumber(network.batchCapacityMultiplier)}` },
      { label: "Passive heat multiplier", value: `x${formatNumber(network.passiveHeatMultiplier)}` },
      { label: "Collect heat now", value: `+${formatNumber(resolveSmugglingTunnelCollectHeat(stored, input.smugglingTunnelConfig))}` },
      { label: "Silent Channel", value: activeSilentChannel ? `active ${formatTickLabel(Math.max(0, Number(metadata.silentChannelExpiresAtTick || 0) - input.tick))}` : "ready when off cooldown" },
      { label: "Raid risk after boost", value: `${formatNumber(input.smugglingTunnelConfig.silentChannel.raidChancePct)} %` }
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
      { label: "Salvage pool", value: `${formatNumber(poolTotal)} items` },
      { label: "Next expiry", value: nextExpiry === null ? "none" : formatTickLabel(nextExpiry) },
      { label: "Action cost", value: `$${formatNumber(recyclingCenterConfig.extractLosses.cleanCashCost)}` },
      { label: "Population recovery", value: "never returns gang members or population" }
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
  powerStationConfig?: PowerStationBalanceConfig;
  recruitmentCenterConfig?: RecruitmentCenterBalanceConfig;
  fitnessClubConfig?: FitnessClubBalanceConfig;
  garageConfig?: GarageBalanceConfig;
  carDealerConfig?: CarDealerBalanceConfig;
  smugglingTunnelConfig?: SmugglingTunnelBalanceConfig;
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
  const metadata = getSmugglingTunnelMetadata(input.building);
  if (input.action.actionId === config.collectBatch.actionId) {
    const stored = Math.floor(metadata.storedDirtyCash);
    return stored >= config.collectBatch.minStoredDirtyCash
      ? null
      : `Need at least ${config.collectBatch.minStoredDirtyCash} dirty cash in this tunnel.`;
  }
  if (input.action.actionId !== config.silentChannel.actionId) {
    return null;
  }
  if (isSilentChannelActive(metadata, input.tick)) {
    return `Tichý kanál active ${formatTickLabel(Math.max(0, Number(metadata.silentChannelExpiresAtTick || 0) - input.tick))}.`;
  }
  const blockedUntil = Math.max(0, Number(metadata.silentChannelBlockedUntilTick || 0));
  if (blockedUntil > input.tick) {
    return `Uzavřený vstup ${formatTickLabel(blockedUntil - input.tick)}.`;
  }
  return null;
};
