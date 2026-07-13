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

  const isActiveBuilding = (building) => String(building?.status || "active").trim().toLowerCase() === "active";

  const countActualOwnedBuildingByBaseName = (baseName) => {
    const ownedDistrictIds = getOwnedDistrictIdsForBuildingCounts();
    return deps.getDistrictResourceCatalog().reduce((count, district) => {
      if (!ownedDistrictIds.has(Number(district.id))) return count;
      const profile = deps.resolveDistrictBuildingProfile(district);
      return count + (profile?.buildings || []).reduce((total, building) => (
        isActiveBuilding(building) && deps.normalizeBuildingLookupKey(building.baseName) === baseName ? total + 1 : total
      ), 0);
    }, 0);
  };

  const getHighestActualOwnedBuildingLevelByBaseName = (baseName) => {
    const ownedDistrictIds = getOwnedDistrictIdsForBuildingCounts();
    return deps.getDistrictResourceCatalog().reduce((highest, district) => {
      if (!ownedDistrictIds.has(Number(district.id))) return highest;
      const profile = deps.resolveDistrictBuildingProfile(district);
      return (profile?.buildings || []).reduce((buildingHighest, building) => {
        if (!isActiveBuilding(building) || deps.normalizeBuildingLookupKey(building.baseName) !== baseName) {
          return buildingHighest;
        }
        const level = Math.max(1, Math.floor(Number(deps.getBuildingLevel?.(district, building) ?? building.level ?? 1)));
        return Math.max(buildingHighest, level);
      }, highest);
    }, 0);
  };

  const countAvailableBuildingByBaseName = (baseName) => {
    const worldState = deps.getResolvedWorldState();
    const destroyedDistrictIds = new Set(worldState.destroyedDistrictIds || []);
    return deps.getDistrictResourceCatalog().reduce((count, district) => {
      if (destroyedDistrictIds.has(Number(district.id))) return count;
      const profile = deps.resolveDistrictBuildingProfile(district);
      return count + (profile?.buildings || []).reduce((total, building) => (
        deps.normalizeBuildingLookupKey(building.baseName) === baseName ? total + 1 : total
      ), 0);
    }, 0);
  };

  const countOwnedBuildingByBaseName = (baseName) => {
    const actualCount = countActualOwnedBuildingByBaseName(baseName);
    const availableCount = countAvailableBuildingByBaseName(baseName);
    const visibleCount = Math.max(actualCount, getMinimumOwnedBuildingCountByBaseName(baseName, deps.getResolvedWorldState()));
    return availableCount > 0 ? Math.min(visibleCount, availableCount) : 0;
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
      maxCooldownReductionPct: config.maxCooldownReductionPct,
      combinedGarageDealerMaxReductionPct: config.combinedGarageDealerMaxReductionPct,
      escapeChanceBonusPct: Math.min(config.maxEscapeChanceBonusPct, ownedCount * config.escapeChanceBonusPctPerDealer),
      fullBonusCategories: [...config.fullBonusCategories],
      halfBonusCategories: [...config.halfBonusCategories],
      smallBonusCategories: [...config.smallBonusCategories],
      excludedCategories: [...config.excludedCategories]
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

  const getOwnedRecruitmentCenterCount = () => countOwnedBuildingByBaseName("rekrutacni centrum");
  const getRecruitmentCenterNetworkMultipliers = (count = getOwnedRecruitmentCenterCount()) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    const config = deps.recruitmentCenterSupportConfig;
    return {
      incomeMultiplier: Math.min(config.maxIncomeMultiplier, 1 + extra * config.incomeBonusPctPerExtraCenter / 100),
      heatMultiplier: Math.min(config.maxHeatMultiplier, 1 + extra * config.heatBonusPctPerExtraCenter / 100)
    };
  };
  const getRecruitmentCenterSupportStats = (count = getOwnedRecruitmentCenterCount()) => {
    const ownedCount = Math.max(0, Math.floor(Number(count || 0)));
    const config = deps.recruitmentCenterSupportConfig;
    return {
      ownedCount,
      populationProductionBonusPct: Math.min(config.maxPopulationProductionBonusPct, ownedCount * config.populationProductionBonusPctPerCenter),
      apartmentCapacityBonusPct: Math.min(config.maxApartmentCapacityBonusPct, ownedCount * config.apartmentCapacityBonusPctPerCenter),
      attackWeaponStrengthBonusPct: Math.min(config.maxAttackWeaponStrengthBonusPct, ownedCount * config.attackWeaponStrengthBonusPctPerCenter),
      defenseItemStrengthBonusPct: Math.min(config.maxDefenseItemStrengthBonusPct, ownedCount * config.defenseItemStrengthBonusPctPerCenter),
      cameraStrengthBonusPct: Math.min(config.maxDefenseItemStrengthBonusPct, ownedCount * config.defenseItemStrengthBonusPctPerCenter),
      alarmStrengthBonusPct: Math.min(config.maxDefenseItemStrengthBonusPct, ownedCount * config.defenseItemStrengthBonusPctPerCenter),
      combinedCameraAlarmCapPct: config.maxCombinedCameraAlarmBonusPct
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
  const getOwnedWarehouseCount = () => (
    countActualOwnedBuildingByBaseName("sklad") + countActualOwnedBuildingByBaseName("skladiste")
  );
  const getWarehouseNetworkMultipliers = (count = getOwnedWarehouseCount()) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    const config = deps.warehouseNetworkConfig;
    const storageConfig = deps.warehouseStorageConfig;
    const safeCount = Math.max(0, Math.floor(Number(count || 0)));
    const countKey = Math.min(5, safeCount);
    const highestLevel = safeCount > 0
      ? Math.max(1, Math.min(4, Math.max(
          getHighestActualOwnedBuildingLevelByBaseName("sklad"),
          getHighestActualOwnedBuildingLevelByBaseName("skladiste")
        )))
      : 0;
    const countMultiplier = Number(storageConfig?.warehouseCountMultipliers?.[countKey] || 1);
    const levelMultiplier = highestLevel > 0
      ? Number(storageConfig?.warehouseLevelMultipliers?.[highestLevel] || 1)
      : 1;
    return {
      incomeMultiplier: Math.min(config.maxIncomeMultiplier, 1 + extra * config.incomeBonusPctPerExtraWarehouse / 100),
      storageCapacityMultiplier: countMultiplier * levelMultiplier,
      warehouseCountMultiplier: countMultiplier,
      warehouseLevelMultiplier: levelMultiplier,
      highestLevel,
      heatMultiplier: Math.min(config.maxHeatMultiplier, 1 + extra * config.heatBonusPctPerExtraWarehouse / 100)
    };
  };
  const getWarehouseCapacityBreakdown = (count = getOwnedWarehouseCount()) => {
    const network = getWarehouseNetworkMultipliers(count);
    const groups = Object.fromEntries(Object.entries(deps.warehouseStorageConfig?.groups || {}).map(([groupId, group]) => [
      groupId,
      Math.ceil(Number(group.baseCapacity || 0) * network.warehouseCountMultiplier * network.warehouseLevelMultiplier)
    ]));
    const byResource = {};
    for (const [groupId, group] of Object.entries(deps.warehouseStorageConfig?.groups || {})) {
      for (const resourceKey of group.resourceKeys || []) {
        byResource[resourceKey] = groups[groupId];
      }
    }
    return {
      groups,
      byResource,
      bulk: groups.bulk || 0,
      tactical: groups.tactical || 0,
      strategic: groups.strategic || 0
    };
  };
  const getWarehouseStorageUsage = (capacity = getWarehouseCapacityBreakdown()) => {
    const materials = deps.getStoredMaterialInventory();
    const supplies = deps.getStoredFactorySupplies();
    const drugs = deps.getStoredDrugInventory();
    const weapons = deps.getStoredWeaponInventory();
    const value = (source, key) => Math.max(0, Math.floor(Number(source?.[key] || 0)));
    const byResource = {};
    for (const resourceKey of Object.keys(capacity.byResource || {})) {
      byResource[resourceKey] = resourceKey === "metal-parts"
        ? value(supplies, "metalParts") + value(materials, resourceKey)
        : resourceKey === "tech-core"
          ? value(supplies, "techCore") + value(materials, resourceKey)
          : resourceKey === "combat-module"
            ? value(supplies, "combatModule") + value(materials, resourceKey)
            : Object.prototype.hasOwnProperty.call(weapons, resourceKey)
              ? value(weapons, resourceKey)
              : Object.prototype.hasOwnProperty.call(drugs, resourceKey)
                ? value(drugs, resourceKey)
                : value(materials, resourceKey);
    }
    return { byResource, capacity };
  };
  const getWarehouseCapacityWarnings = (usage) => {
    const pairs = Object.entries(usage?.capacity?.byResource || {}).map(([resourceKey, cap]) => [
      resourceKey,
      usage?.byResource?.[resourceKey] || 0,
      cap
    ]);
    const full = pairs.some(([, current, cap]) => Number(cap || 0) > 0 && Number(current || 0) >= Number(cap || 0));
    const near = pairs.some(([, current, cap]) => Number(cap || 0) > 0 && Number(current || 0) >= Number(cap || 0) * 0.85);
    return [
      near && !full ? "Některá položka v globálním SKLADU se blíží maximu." : "",
      full ? "Některá položka v globálním SKLADU je plná." : "",
      near || full ? "Získej další Skladiště nebo spotřebuj konkrétní položku." : ""
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

  const getOwnedPowerStationCount = () => countOwnedBuildingByBaseName("energeticka stanice");
  const getPowerStationNetworkMultipliers = (count = getOwnedPowerStationCount()) => {
    const safeCount = Math.max(0, Math.floor(Number(count || 0)));
    const extra = Math.max(0, safeCount - 1);
    const config = deps.powerStationConfig;
    return {
      infrastructureBonusPct: Math.min(config.maxInfrastructureBonusPct, safeCount * config.infrastructureBonusPctPerStation),
      incomeMultiplier: Math.min(config.maxIncomeMultiplier, 1 + extra * config.incomeBonusPctPerExtraStation / 100),
      heatMultiplier: Math.min(config.maxHeatMultiplier, 1 + extra * config.heatBonusPctPerExtraStation / 100),
      cameraStrengthBonusPct: Math.min(config.maxCameraStrengthBonusPct, safeCount * config.cameraStrengthBonusPctPerStation),
      alarmStrengthBonusPct: Math.min(config.maxAlarmStrengthBonusPct, safeCount * config.alarmStrengthBonusPctPerStation)
    };
  };

  const getOwnedRecyclingCenterCount = () => countOwnedBuildingByBaseName("recyklacni centrum");
  const getRecyclingCenterNetworkMultipliers = (count = getOwnedRecyclingCenterCount()) => {
    const safeCount = Math.max(0, Math.floor(Number(count || 0)));
    const extra = Math.max(0, safeCount - 1);
    const config = deps.recyclingCenterConfig;
    return {
      incomeMultiplier: Math.min(config.maxIncomeMultiplier, 1 + extra * config.incomeBonusPctPerExtraCenter / 100),
      heatMultiplier: Math.min(config.maxHeatMultiplier, 1 + extra * config.heatBonusPctPerExtraCenter / 100),
      salvageRatePct: Math.min(config.maxSalvageRatePct, config.baseSalvageRatePct + extra * config.salvageRatePctPerExtraCenter)
    };
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
    getOwnedPowerStationCount,
    getOwnedRecruitmentCenterCount,
    getOwnedRecyclingCenterCount,
    getOwnedRestaurantCount,
    getOwnedSchoolCount,
    getOwnedShoppingMallCountForMarket,
    getOwnedSmugglingTunnelCount,
    getOwnedWarehouseCount,
    getPowerStationNetworkMultipliers,
    getRecyclingCenterNetworkMultipliers,
    getRecruitmentCenterNetworkMultipliers,
    getRecruitmentCenterSupportStats,
    getRestaurantNetworkMultipliers,
    getSchoolNetworkMultipliers,
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
