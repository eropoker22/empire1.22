import { describe, expect, it } from "vitest";
import { createBuildingNetworkRuntime } from "../../page-assets/js/app/runtime/buildingNetworkRuntime.js";

function createRuntime(overrides = {}) {
  const profiles = {
    1: [{ baseName: "autosalon" }, { baseName: "skladiste" }, { baseName: "obchodni centrum" }],
    2: [{ baseName: "autosalon" }, { baseName: "klinika" }],
    3: [{ baseName: "skola" }]
  };
  return createBuildingNetworkRuntime({
    apartmentBlockNetworkConfig: { maxPopulationProductionMultiplier: 2, populationProductionBonusPctPerExtraBlock: 10, maxCapacityMultiplier: 2, capacityBonusPctPerExtraBlock: 10 },
    arcadeNetworkConfig: { maxIncomeMultiplier: 2, incomeBonusPctPerExtraArcade: 10, maxLaunderingLimitMultiplier: 2, launderingLimitBonusPctPerExtraArcade: 10, maxHeatMultiplier: 2, heatBonusPctPerExtraArcade: 10 },
    autoSalonSupportConfig: {
      maxCleanIncomeMultiplier: 2,
      cleanIncomeBonusPctPerExtraDealer: 10,
      maxDirtyIncomeMultiplier: 2,
      dirtyIncomeBonusPctPerExtraDealer: 10,
      maxHeatMultiplier: 2,
      heatBonusPctPerExtraDealer: 10,
      maxMobilityBonusPct: 50,
      mobilityBonusPctPerDealer: 5,
      maxCooldownReductionPct: 40,
      cooldownReductionPctPerDealer: 4,
      maxEscapeChanceBonusPct: 30,
      escapeChanceBonusPctPerDealer: 3
    },
    clinicBaseRecoveryRatePct: 10,
    clinicMaxRecoveryRatePct: 30,
    clinicRecoveryRatePctPerExtra: 5,
    currentPlayerId: 1,
    exchangeOfficeNetworkConfig: { maxIncomeMultiplier: 2, incomeBonusPctPerExtraExchange: 10, maxLaunderingLimitMultiplier: 2, launderingLimitBonusPctPerExtraExchange: 10, maxHeatMultiplier: 2, heatBonusPctPerExtraExchange: 10 },
    fitnessClubSupportConfig: { maxIncomeMultiplier: 2, incomeBonusPctPerExtraClub: 10, maxHeatMultiplier: 2, heatBonusPctPerExtraClub: 10, maxAttackStrengthBonusPct: 40, attackStrengthBonusPctPerClub: 5, maxDefenseStrengthBonusPct: 40, defenseStrengthBonusPctPerClub: 5, combinedRecruitmentFitnessAttackCapPct: 20, combinedRecruitmentFitnessDefenseCapPct: 20 },
    garageSupportConfig: {
      cooldownReductionPctPerGarage: 2,
      maxCooldownReductionPct: 16,
      fullBonusCategories: ["attackPreparation", "districtOccupy"],
      halfBonusCategories: ["districtSpy", "clinicRecovery"],
      excludedCategories: ["moneyLaundering"],
      maxIncomeMultiplier: 2,
      incomeBonusPctPerExtraGarage: 10,
      maxHeatMultiplier: 2,
      heatBonusPctPerExtraGarage: 10
    },
    getCurrentPlayerOwnedDistrictIds: () => new Set([1, 2]),
    getDistrictResourceCatalog: () => [{ id: 1 }, { id: 2 }, { id: 3 }],
    getResolvedWorldState: () => ({ ownedDistrictIds: [1, 2], phase: "live" }),
    getStoredDrugInventory: () => ({ "neon-dust": 3 }),
    getStoredFactorySupplies: () => ({ metalParts: 2, techCore: 1, combatModule: 4 }),
    getStoredMaterialInventory: () => ({ chemicals: 3, biomass: 4, "metal-parts": 5, "tech-core": 6, "combat-module": 7, "stim-pack": 1 }),
    getStoredWeaponInventory: () => ({ pistol: 2 }),
    normalizeBuildingLookupKey: (value) => String(value || "").toLowerCase(),
    recruitmentCenterSupportConfig: {
      maxIncomeMultiplier: 2,
      incomeBonusPctPerExtraCenter: 10,
      maxHeatMultiplier: 2,
      heatBonusPctPerExtraCenter: 10,
      maxPopulationProductionBonusPct: 24,
      populationProductionBonusPctPerCenter: 3,
      maxApartmentCapacityBonusPct: 32,
      apartmentCapacityBonusPctPerCenter: 4,
      maxAttackWeaponStrengthBonusPct: 16,
      attackWeaponStrengthBonusPctPerCenter: 2,
      maxDefenseItemStrengthBonusPct: 12,
      defenseItemStrengthBonusPctPerCenter: 1.5,
      maxCombinedCameraAlarmBonusPct: 50
    },
    restaurantNetworkConfig: { maxIncomeMultiplier: 2, incomeBonusPctPerExtraRestaurant: 10, maxInfluenceMultiplier: 2, influenceBonusPctPerExtraRestaurant: 10, maxRumorMultiplier: 2, rumorChanceBonusPctPerExtraRestaurant: 10, maxHeatMultiplier: 2, heatBonusPctPerExtraRestaurant: 10 },
    resolveDistrictBuildingProfile: (district) => ({ buildings: profiles[district.id] || [] }),
    schoolConfig: { maxPopulationProductionMultiplier: 2, populationProductionBonusPctPerExtraSchool: 10, maxStudentCapacityMultiplier: 2, studentCapacityBonusPctPerExtraSchool: 10, maxIncomeMultiplier: 2, incomeBonusPctPerExtraSchool: 10, maxTalentChancePct: 50, baseTalentChancePct: 10, talentChancePctPerExtraSchool: 5, eveningCourseTalentChanceBonusPct: 20 },
    shoppingMallNetworkConfig: { maxCleanIncomeMultiplier: 2, cleanIncomeBonusPctPerExtraMall: 10, maxDirtyIncomeMultiplier: 2, dirtyIncomeBonusPctPerExtraMall: 10, maxInfluenceMultiplier: 2, influenceBonusPctPerExtraMall: 10, maxHeatMultiplier: 2, heatBonusPctPerExtraMall: 10 },
    smugglingTunnelConfig: { maxDirtyProductionMultiplier: 2, dirtyProductionBonusPctPerExtraTunnel: 10, maxHeatMultiplier: 2, heatBonusPctPerExtraTunnel: 10 },
    startPhaseOwnerByDistrictId: new Map([[1, 1], [2, 1], [3, 2]]),
    warehouseBaseStorageCapacities: { genericResources: 10, chemicals: 10, biomass: 10, metalParts: 10, techCore: 10, combatModule: 10, drugsAndBoosts: 10, weaponsAndDefense: 10 },
    warehouseNetworkConfig: { maxIncomeMultiplier: 2, incomeBonusPctPerExtraWarehouse: 10, maxStorageCapacityMultiplier: 2, storageCapacityBonusPctPerExtraWarehouse: 10, maxHeatMultiplier: 2, heatBonusPctPerExtraWarehouse: 10 },
    ...overrides
  });
}

describe("building network runtime", () => {
  it("counts owned support buildings and calculates multipliers", () => {
    const runtime = createRuntime();

    expect(runtime.getOwnedAutoSalonCount()).toBe(2);
    expect(runtime.getOwnedShoppingMallCountForMarket()).toBe(1);
    expect(runtime.getAutoSalonNetworkMultipliers(2).cleanIncomeMultiplier).toBe(1.1);
    expect(runtime.getAutoSalonSupportStats(2).mobilityBonusPct).toBe(10);
  });

  it("counts every owned garage occurrence when resolving cooldown reduction", () => {
    const runtime = createRuntime({
      resolveDistrictBuildingProfile: (district) => ({
        buildings: {
          1: [{ baseName: "garage" }, { baseName: "garage" }],
          2: [{ baseName: "garage" }],
          3: [{ baseName: "garage" }]
        }[district.id] || []
      })
    });

    expect(runtime.getOwnedGarageCount()).toBe(3);
    expect(runtime.getGarageSupportStats().cooldownReductionPct).toBe(6);
    expect(runtime.getGarageNetworkMultipliers()).toMatchObject({
      incomeMultiplier: 1.2,
      heatMultiplier: 1.2
    });
  });

  it("counts recruitment centers and exposes support bonuses", () => {
    const runtime = createRuntime({
      resolveDistrictBuildingProfile: (district) => ({
        buildings: {
          1: [{ baseName: "rekrutacni centrum" }, { baseName: "rekrutacni centrum" }],
          2: [{ baseName: "rekrutacni centrum" }]
        }[district.id] || []
      })
    });

    expect(runtime.getOwnedRecruitmentCenterCount()).toBe(3);
    expect(runtime.getRecruitmentCenterNetworkMultipliers()).toMatchObject({
      incomeMultiplier: 1.2,
      heatMultiplier: 1.2
    });
    expect(runtime.getRecruitmentCenterSupportStats()).toMatchObject({
      populationProductionBonusPct: 9,
      apartmentCapacityBonusPct: 12,
      attackWeaponStrengthBonusPct: 6,
      defenseItemStrengthBonusPct: 4.5,
      cameraStrengthBonusPct: 4.5,
      combinedCameraAlarmCapPct: 50
    });
  });

  it("counts owned restaurants and resolves restaurant network multipliers", () => {
    const runtime = createRuntime({
      resolveDistrictBuildingProfile: (district) => ({
        buildings: {
          1: [{ baseName: "Restaurace" }],
          2: [{ baseName: "restaurace" }],
          3: [{ baseName: "Restaurace" }]
        }[district.id] || []
      })
    });

    expect(runtime.getOwnedRestaurantCount()).toBe(2);
    expect(runtime.getRestaurantNetworkMultipliers(2)).toMatchObject({
      incomeMultiplier: 1.1,
      influenceMultiplier: 1.1,
      rumorMultiplier: 1.1,
      heatMultiplier: 1.1
    });
  });

  it("uses phaseState gamePhase and ignores destroyed districts when counting owned buildings", () => {
    const runtime = createRuntime({
      getResolvedWorldState: () => ({
        ownedDistrictIds: [],
        destroyedDistrictIds: [2],
        phaseState: { gamePhase: "launch" }
      }),
      getCurrentPlayerOwnedDistrictIds: (interactionState = {}) => {
        const ownedDistrictIds = new Set(interactionState.ownedDistrictIds || []);
        if (interactionState.gamePhase === "launch") {
          for (const [districtId, ownerId] of interactionState.launchOwnerByDistrictId || []) {
            if (Number(ownerId) === 1) ownedDistrictIds.add(Number(districtId));
          }
        }
        return ownedDistrictIds;
      }
    });

    expect(runtime.getOwnedAutoSalonCount()).toBe(1);
  });

  it("counts shopping malls from the same ownership source as other building networks", () => {
    const runtime = createRuntime({
      getResolvedWorldState: () => ({
        ownedDistrictIds: [3],
        destroyedDistrictIds: [],
        phaseState: { gamePhase: "live" }
      }),
      getCurrentPlayerOwnedDistrictIds: (interactionState = {}) => new Set(interactionState.ownedDistrictIds || []),
      resolveDistrictBuildingProfile: (district) => ({
        buildings: {
          1: [],
          2: [],
          3: [{ baseName: "obchodni centrum" }]
        }[district.id] || []
      })
    });

    expect(runtime.getOwnedShoppingMallCountForMarket()).toBe(1);
  });

  it("caps demo live minimum counts to buildings available in the current map", () => {
    const runtime = createRuntime({
      getResolvedWorldState: () => ({
        ownedDistrictIds: [],
        destroyedDistrictIds: [],
        phaseState: { gamePhase: "live" }
      }),
      getCurrentPlayerOwnedDistrictIds: () => new Set(),
      resolveDistrictBuildingProfile: () => ({ buildings: [] }),
      getMinimumOwnedBuildingCountByBaseName: (baseName) => (baseName === "sklad" ? 0 : 2)
    });

    expect(runtime.getOwnedApartmentBlockCount()).toBe(0);
    expect(runtime.getOwnedRestaurantCount()).toBe(0);
    expect(runtime.getOwnedSchoolCount()).toBe(0);
    expect(runtime.getOwnedWarehouseCount()).toBe(0);
  });

  it("caps apartment block counts at the current generated-map count", () => {
    const runtime = createRuntime({
      getResolvedWorldState: () => ({
        ownedDistrictIds: [],
        destroyedDistrictIds: [],
        phaseState: { gamePhase: "live" }
      }),
      getCurrentPlayerOwnedDistrictIds: () => new Set(),
      resolveDistrictBuildingProfile: (district) => ({
        buildings: Number(district.id) <= 2
          ? [{ baseName: "bytovy blok" }]
          : []
      }),
      getMinimumOwnedBuildingCountByBaseName: () => 30
    });

    expect(runtime.getOwnedApartmentBlockCount()).toBe(2);
  });

  it("keeps warehouse capacity and usage helpers deterministic", () => {
    const runtime = createRuntime();
    const capacity = runtime.getWarehouseCapacityBreakdown(1);
    const usage = runtime.getWarehouseStorageUsage(capacity);

    expect(capacity.chemicals).toBe(10);
    expect(usage.metalParts).toBe(7);
    expect(usage.techCore).toBe(7);
    expect(runtime.getWarehouseCapacityWarnings({
      chemicals: 9,
      biomass: 0,
      metalParts: 0,
      techCore: 0,
      combatModule: 0,
      drugsAndBoosts: 0,
      weaponsAndDefense: 0,
      genericResources: 0,
      capacity
    })).toContain("Zásoby ve skladištích se blíží maximu.");
  });
});
