export function createBuildingNetworkRuntime(deps = {}) {
  const resolveWorldGamePhase = (worldState = {}) => (
    String(worldState.phaseState?.gamePhase || worldState.phase || "live").trim().toLowerCase() === "launch"
      ? "launch"
      : "live"
  );

  const getOwnedDistrictIdsForBuildingCounts = () => {
    const worldState = deps.getResolvedWorldState();
    const interactionState = {
      ownedDistrictIds: new Set(worldState.ownedDistrictIds || []),
      gamePhase: resolveWorldGamePhase(worldState),
      launchOwnerByDistrictId: deps.startPhaseOwnerByDistrictId
    };
    const destroyedDistrictIds = new Set(worldState.destroyedDistrictIds || []);
    return new Set(
      Array.from(deps.getCurrentPlayerOwnedDistrictIds(interactionState) || [])
        .map((districtId) => Number(districtId))
        .filter((districtId) => districtId > 0 && !destroyedDistrictIds.has(districtId))
    );
  };

  const getMinimumOwnedBuildingCountByBaseName = (baseName, worldState = {}) => {
    const value = deps.getMinimumOwnedBuildingCountByBaseName?.(baseName, worldState);
    const normalized = Math.floor(Number(value));
    return Number.isFinite(normalized) ? Math.max(0, normalized) : 0;
  };

  const countActualOwnedBuildingByBaseName = (baseName) => {
    const ownedDistrictIds = getOwnedDistrictIdsForBuildingCounts();
    return deps.getDistrictResourceCatalog().reduce((count, district) => {
      if (!ownedDistrictIds.has(Number(district.id))) return count;
      const profile = deps.resolveDistrictBuildingProfile(district);
      const hasBuilding = (profile?.buildings || []).some((building) => deps.normalizeBuildingLookupKey(building.baseName) === baseName);
      return count + (hasBuilding ? 1 : 0);
    }, 0);
  };

  const countOwnedBuildingByBaseName = (baseName) => {
    const actualCount = countActualOwnedBuildingByBaseName(baseName);
    return Math.max(actualCount, getMinimumOwnedBuildingCountByBaseName(baseName, deps.getResolvedWorldState()));
  };

  const getOwnedShoppingMallCountForMarket = () => countOwnedBuildingByBaseName("obchodni centrum");

  const getShoppingMallMarketDiscountForTab = (tabId) => {
    const ownedMalls = getOwnedShoppingMallCountForMarket();
    const baseDiscountPct = Math.min(14, Math.max(0, ownedMalls) * 2);
    const discountPct = tabId === "market"
      ? baseDiscountPct
      : tabId === "black-market"
        ? baseDiscountPct * 0.4
        : 0;
    return {
      ownedMalls,
      discountPct,
      feeReductionPct: Math.min(30, Math.max(0, ownedMalls) * 5),
      minFinalPriceMultiplier: 0.7
    };
  };

  const getShoppingMallNetworkMultipliers = (count = getOwnedShoppingMallCountForMarket()) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    const config = deps.shoppingMallNetworkConfig;
    return {
      cleanIncomeMultiplier: Math.min(config.maxCleanIncomeMultiplier, 1 + extra * config.cleanIncomeBonusPctPerExtraMall / 100),
      dirtyIncomeMultiplier: Math.min(config.maxDirtyIncomeMultiplier, 1 + extra * config.dirtyIncomeBonusPctPerExtraMall / 100),
      influenceMultiplier: Math.min(config.maxInfluenceMultiplier, 1 + extra * config.influenceBonusPctPerExtraMall / 100),
      heatMultiplier: Math.min(config.maxHeatMultiplier, 1 + extra * config.heatBonusPctPerExtraMall / 100)
    };
  };

  const getOwnedRestaurantCount = () => countOwnedBuildingByBaseName("restaurace");
  const getRestaurantNetworkMultipliers = (count = getOwnedRestaurantCount()) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    const config = deps.restaurantNetworkConfig;
    return {
      incomeMultiplier: Math.min(config.maxIncomeMultiplier, 1 + extra * config.incomeBonusPctPerExtraRestaurant / 100),
      influenceMultiplier: Math.min(config.maxInfluenceMultiplier, 1 + extra * config.influenceBonusPctPerExtraRestaurant / 100),
      rumorMultiplier: Math.min(config.maxRumorMultiplier, 1 + extra * config.rumorChanceBonusPctPerExtraRestaurant / 100),
      heatMultiplier: Math.min(config.maxHeatMultiplier, 1 + extra * config.heatBonusPctPerExtraRestaurant / 100)
    };
  };

  const getOwnedAutoSalonCount = () => countOwnedBuildingByBaseName("autosalon");
  const getAutoSalonNetworkMultipliers = (count = getOwnedAutoSalonCount()) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    const config = deps.autoSalonSupportConfig;
    return {
      cleanIncomeMultiplier: Math.min(config.maxCleanIncomeMultiplier, 1 + extra * config.cleanIncomeBonusPctPerExtraDealer / 100),
      dirtyIncomeMultiplier: Math.min(config.maxDirtyIncomeMultiplier, 1 + extra * config.dirtyIncomeBonusPctPerExtraDealer / 100),
      heatMultiplier: Math.min(config.maxHeatMultiplier, 1 + extra * config.heatBonusPctPerExtraDealer / 100)
    };
  };
  const getAutoSalonSupportStats = (count = getOwnedAutoSalonCount()) => {
    const ownedCount = Math.max(0, Math.floor(Number(count || 0)));
    const config = deps.autoSalonSupportConfig;
    return {
      ownedCount,
      mobilityBonusPct: Math.min(config.maxMobilityBonusPct, ownedCount * config.mobilityBonusPctPerDealer),
      cooldownReductionPct: Math.min(config.maxCooldownReductionPct, ownedCount * config.cooldownReductionPctPerDealer),
      escapeChanceBonusPct: Math.min(config.maxEscapeChanceBonusPct, ownedCount * config.escapeChanceBonusPctPerDealer)
    };
  };

  const getOwnedGarageCount = () => countOwnedBuildingByBaseName("garage");
  const getGarageNetworkMultipliers = (count = getOwnedGarageCount()) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    const config = deps.garageSupportConfig;
    return {
      incomeMultiplier: Math.min(config.maxIncomeMultiplier, 1 + extra * config.incomeBonusPctPerExtraGarage / 100),
      heatMultiplier: Math.min(config.maxHeatMultiplier, 1 + extra * config.heatBonusPctPerExtraGarage / 100)
    };
  };
  const getGarageSupportStats = (count = getOwnedGarageCount()) => {
    const ownedCount = Math.max(0, Math.floor(Number(count || 0)));
    const config = deps.garageSupportConfig;
    return {
      ownedCount,
      cooldownReductionPct: Math.min(config.maxCooldownReductionPct, ownedCount * config.cooldownReductionPctPerGarage),
      maxCooldownReductionPct: config.maxCooldownReductionPct,
      fullBonusCategories: [...config.fullBonusCategories],
      halfBonusCategories: [...config.halfBonusCategories],
      excludedCategories: [...config.excludedCategories]
    };
  };

  const getOwnedFitnessClubCount = () => countOwnedBuildingByBaseName("fitness club");
  const getFitnessClubNetworkMultipliers = (count = getOwnedFitnessClubCount()) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    const config = deps.fitnessClubSupportConfig;
    return {
      incomeMultiplier: Math.min(config.maxIncomeMultiplier, 1 + extra * config.incomeBonusPctPerExtraClub / 100),
      heatMultiplier: Math.min(config.maxHeatMultiplier, 1 + extra * config.heatBonusPctPerExtraClub / 100)
    };
  };
  const getFitnessClubSupportStats = (count = getOwnedFitnessClubCount()) => {
    const ownedCount = Math.max(0, Math.floor(Number(count || 0)));
    const config = deps.fitnessClubSupportConfig;
    return {
      ownedCount,
      attackStrengthBonusPct: Math.min(config.maxAttackStrengthBonusPct, ownedCount * config.attackStrengthBonusPctPerClub),
      defenseStrengthBonusPct: Math.min(config.maxDefenseStrengthBonusPct, ownedCount * config.defenseStrengthBonusPctPerClub),
      combinedRecruitmentFitnessAttackCapPct: config.combinedRecruitmentFitnessAttackCapPct,
      combinedRecruitmentFitnessDefenseCapPct: config.combinedRecruitmentFitnessDefenseCapPct
    };
  };

  const getOwnedSmugglingTunnelCount = () => countOwnedBuildingByBaseName("pasovaci tunel");
  const getSmugglingTunnelNetworkMultipliers = (count = getOwnedSmugglingTunnelCount()) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    const config = deps.smugglingTunnelConfig;
    return {
      dirtyProductionMultiplier: Math.min(config.maxDirtyProductionMultiplier, 1 + extra * config.dirtyProductionBonusPctPerExtraTunnel / 100),
      batchCapacityMultiplier: 1,
      heatMultiplier: Math.min(config.maxHeatMultiplier ?? config.maxPassiveHeatMultiplier, 1 + extra * (config.heatBonusPctPerExtraTunnel ?? config.passiveHeatBonusPctPerExtraTunnel) / 100),
      passiveHeatMultiplier: Math.min(config.maxHeatMultiplier ?? config.maxPassiveHeatMultiplier, 1 + extra * (config.heatBonusPctPerExtraTunnel ?? config.passiveHeatBonusPctPerExtraTunnel) / 100)
    };
  };
  const getSmugglingTunnelCollectHeat = (amount) => {
    const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
    if (safeAmount >= 5000) return 16;
    if (safeAmount >= 3000) return 11;
    if (safeAmount >= 2000) return 7;
    if (safeAmount >= 1000) return 4;
    if (safeAmount >= 1) return 2;
    return 0;
  };

  const getOwnedExchangeOfficeCount = () => countOwnedBuildingByBaseName("smenarna");
  const getExchangeOfficeNetworkMultipliers = (count = getOwnedExchangeOfficeCount()) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    const config = deps.exchangeOfficeNetworkConfig;
    return {
      incomeMultiplier: Math.min(config.maxIncomeMultiplier, 1 + extra * config.incomeBonusPctPerExtraExchange / 100),
      launderingLimitMultiplier: Math.min(config.maxLaunderingLimitMultiplier, 1 + extra * config.launderingLimitBonusPctPerExtraExchange / 100),
      heatMultiplier: Math.min(config.maxHeatMultiplier, 1 + extra * config.heatBonusPctPerExtraExchange / 100)
    };
  };

  const getOwnedArcadeCount = () => countOwnedBuildingByBaseName("herna");
  const getArcadeNetworkMultipliers = (count = getOwnedArcadeCount()) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    const config = deps.arcadeNetworkConfig;
    return {
      incomeMultiplier: Math.min(config.maxIncomeMultiplier, 1 + extra * config.incomeBonusPctPerExtraArcade / 100),
      launderingLimitMultiplier: Math.min(config.maxLaunderingLimitMultiplier, 1 + extra * config.launderingLimitBonusPctPerExtraArcade / 100),
      heatMultiplier: Math.min(config.maxHeatMultiplier, 1 + extra * config.heatBonusPctPerExtraArcade / 100)
    };
  };

  const getOwnedApartmentBlockCount = () => countOwnedBuildingByBaseName("bytovy blok");
  const getApartmentBlockNetworkMultipliers = (count = getOwnedApartmentBlockCount()) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    const config = deps.apartmentBlockNetworkConfig;
    return {
      populationProductionMultiplier: Math.min(config.maxPopulationProductionMultiplier, 1 + extra * config.populationProductionBonusPctPerExtraBlock / 100),
      capacityMultiplier: Math.min(config.maxCapacityMultiplier, 1 + extra * config.capacityBonusPctPerExtraBlock / 100)
    };
  };

  const getOwnedSchoolCount = () => countOwnedBuildingByBaseName("skola");
  const getSchoolNetworkMultipliers = (count = getOwnedSchoolCount()) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    const config = deps.schoolConfig;
    return {
      populationProductionMultiplier: Math.min(config.maxPopulationProductionMultiplier, 1 + extra * config.populationProductionBonusPctPerExtraSchool / 100),
      studentCapacityMultiplier: Math.min(config.maxStudentCapacityMultiplier, 1 + extra * config.studentCapacityBonusPctPerExtraSchool / 100),
      incomeMultiplier: Math.min(config.maxIncomeMultiplier, 1 + extra * config.incomeBonusPctPerExtraSchool / 100)
    };
  };
  const getSchoolTalentChancePct = (count = getOwnedSchoolCount(), eveningCourseActive = false) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    const config = deps.schoolConfig;
    const baseChance = Math.min(config.maxTalentChancePct, config.baseTalentChancePct + extra * config.talentChancePctPerExtraSchool);
    return Math.min(100, baseChance + (eveningCourseActive ? config.eveningCourseTalentChanceBonusPct : 0));
  };

  const getOwnedWarehouseCount = () => {
    const actualCount = countActualOwnedBuildingByBaseName("sklad") + countActualOwnedBuildingByBaseName("skladiste");
    return Math.max(actualCount, getMinimumOwnedBuildingCountByBaseName("skladiste", deps.getResolvedWorldState()));
  };
  const getWarehouseNetworkMultipliers = (count = getOwnedWarehouseCount()) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    const config = deps.warehouseNetworkConfig;
    return {
      incomeMultiplier: Math.min(config.maxIncomeMultiplier, 1 + extra * config.incomeBonusPctPerExtraWarehouse / 100),
      storageCapacityMultiplier: Math.min(config.maxStorageCapacityMultiplier, 1 + extra * config.storageCapacityBonusPctPerExtraWarehouse / 100),
      heatMultiplier: Math.min(config.maxHeatMultiplier, 1 + extra * config.heatBonusPctPerExtraWarehouse / 100)
    };
  };
  const getWarehouseCapacityBreakdown = (count = getOwnedWarehouseCount()) => {
    const network = getWarehouseNetworkMultipliers(count);
    const scale = (value) => Math.floor(Math.max(0, count) * Number(value || 0) * network.storageCapacityMultiplier);
    const capacities = deps.warehouseBaseStorageCapacities;
    return {
      genericResources: scale(capacities.genericResources),
      chemicals: scale(capacities.chemicals),
      biomass: scale(capacities.biomass),
      metalParts: scale(capacities.metalParts),
      techCore: scale(capacities.techCore),
      combatModule: scale(capacities.combatModule),
      drugsAndBoosts: scale(capacities.drugsAndBoosts),
      weaponsAndDefense: scale(capacities.weaponsAndDefense)
    };
  };
  const getWarehouseStorageUsage = (capacity = getWarehouseCapacityBreakdown()) => {
    const materials = deps.getStoredMaterialInventory();
    const supplies = deps.getStoredFactorySupplies();
    const drugs = deps.getStoredDrugInventory();
    const weapons = deps.getStoredWeaponInventory();
    const value = (source, key) => Math.max(0, Math.floor(Number(source?.[key] || 0)));
    return {
      chemicals: value(materials, "chemicals"),
      biomass: value(materials, "biomass"),
      metalParts: value(supplies, "metalParts") + value(materials, "metal-parts"),
      techCore: value(supplies, "techCore") + value(materials, "tech-core"),
      combatModule: value(supplies, "combatModule") + value(materials, "combat-module"),
      drugsAndBoosts: Object.values(drugs || {}).reduce((total, amount) => total + Math.max(0, Math.floor(Number(amount || 0))), value(materials, "stim-pack")),
      weaponsAndDefense: Object.values(weapons || {}).reduce((total, amount) => total + Math.max(0, Math.floor(Number(amount || 0))), 0),
      genericResources: Object.values(materials || {}).reduce((total, amount) => total + Math.max(0, Math.floor(Number(amount || 0))), 0),
      capacity
    };
  };
  const getWarehouseCapacityWarnings = (usage) => {
    const capacities = usage?.capacity || {};
    const pairs = [
      ["chemicals", usage.chemicals, capacities.chemicals],
      ["biomass", usage.biomass, capacities.biomass],
      ["metalParts", usage.metalParts, capacities.metalParts],
      ["techCore", usage.techCore, capacities.techCore],
      ["combatModule", usage.combatModule, capacities.combatModule],
      ["drugsAndBoosts", usage.drugsAndBoosts, capacities.drugsAndBoosts],
      ["weaponsAndDefense", usage.weaponsAndDefense, capacities.weaponsAndDefense],
      ["genericResources", usage.genericResources, capacities.genericResources]
    ];
    const full = pairs.some(([, current, cap]) => Number(cap || 0) > 0 && Number(current || 0) >= Number(cap || 0));
    const near = pairs.some(([, current, cap]) => Number(cap || 0) > 0 && Number(current || 0) >= Number(cap || 0) * 0.85);
    return [
      near && !full ? "Zásoby ve skladištích se blíží maximu." : "",
      full ? "Skladiště je plné. Produkce některých surovin je pozastavena." : "",
      near || full ? "Získej další skladiště nebo spotřebuj zásoby." : ""
    ].filter(Boolean);
  };

  const getOwnedClinicCount = () => countOwnedBuildingByBaseName("klinika");
  const getClinicNetworkMultipliers = (count = getOwnedClinicCount()) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    return {
      incomeMultiplier: Math.min(1.4, 1 + extra * 0.05),
      heatMultiplier: Math.min(1.24, 1 + extra * 0.03)
    };
  };
  const getClinicRecoveryRatePct = (count = getOwnedClinicCount()) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    return Math.min(deps.clinicMaxRecoveryRatePct, deps.clinicBaseRecoveryRatePct + extra * deps.clinicRecoveryRatePctPerExtra);
  };

  return {
    getApartmentBlockNetworkMultipliers,
    getArcadeNetworkMultipliers,
    getAutoSalonNetworkMultipliers,
    getAutoSalonSupportStats,
    getClinicNetworkMultipliers,
    getClinicRecoveryRatePct,
    getExchangeOfficeNetworkMultipliers,
    getFitnessClubNetworkMultipliers,
    getFitnessClubSupportStats,
    getGarageNetworkMultipliers,
    getGarageSupportStats,
    getOwnedApartmentBlockCount,
    getOwnedArcadeCount,
    getOwnedAutoSalonCount,
    getOwnedClinicCount,
    getOwnedExchangeOfficeCount,
    getOwnedFitnessClubCount,
    getOwnedGarageCount,
    getOwnedRestaurantCount,
    getOwnedSchoolCount,
    getOwnedShoppingMallCountForMarket,
    getOwnedSmugglingTunnelCount,
    getOwnedWarehouseCount,
    getRestaurantNetworkMultipliers,
    getSchoolNetworkMultipliers,
    getSchoolTalentChancePct,
    getShoppingMallMarketDiscountForTab,
    getShoppingMallNetworkMultipliers,
    getSmugglingTunnelCollectHeat,
    getSmugglingTunnelNetworkMultipliers,
    getWarehouseCapacityBreakdown,
    getWarehouseCapacityWarnings,
    getWarehouseNetworkMultipliers,
    getWarehouseStorageUsage
  };
}

if (typeof window !== "undefined") {
  window.EmpireBuildingNetworkRuntime = {
    createBuildingNetworkRuntime
  };
}
