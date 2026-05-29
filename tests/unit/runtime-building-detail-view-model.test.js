import { describe, expect, it } from "vitest";
import {
  createBuildingDetailActionRows,
  createBuildingDetailMechanicRows,
  createBuildingDetailStatRows,
  createBuildingDetailViewModel
} from "../../page-assets/js/app/runtime/buildingDetailViewModel.js";
import {
  createBuildingDetailInfoRows,
  createBuildingDetailInfoViewModel
} from "../../page-assets/js/app/runtime/buildingDetailInfoViewModel.js";

const baseMechanics = {
  level: 2,
  cleanHourly: 120,
  dirtyHourly: 45,
  dailyHeat: 3,
  dailyInfluence: 2,
  storedOutputLabel: "$250",
  nextLevel: 3,
  upgradeCostLabel: "$1,500",
  hasManualCollect: true,
  canCollect: true,
  mechanicsType: "generic",
  actionCooldowns: {},
  effectsLabel: "Žádné aktivní mechaniky."
};

describe("building detail view-model builder", () => {
  it("builds the generic building detail view model without DOM access", () => {
    const model = createBuildingDetailViewModel({
      district: { id: 7 },
      buildingName: "Továrna",
      displayName: "Továrna",
      profile: { role: "Výroba", actions: ["Rychlá směna"] },
      mechanics: baseMechanics,
      detailEntry: {},
      buildingProfile: { typeKey: "industry", tier: "mid", setTitle: "Industrial" },
      economyState: { cleanMoney: 5000, dirtyMoney: 5000 },
      actionProfiles: [{ cooldownMs: 60000 }],
      now: 1000
    });

    expect(model.title).toBe("Továrna");
    expect(model.levelLabel).toBe("L2");
    expect(model.meta).toContain("District 7");
    expect(model.districtType).toBe("industry");
    expect(model.isDowntownBuilding).toBe(false);
    expect(model.collect).toEqual({
      visible: true,
      enabled: true,
      title: "Vybrat připravený výstup: $250"
    });
    expect(model.stats.find((row) => row.label === "Čisté / hod")?.value).toBe("$120");
    expect(model.mechanics.find((row) => row.label === "Výnos")?.value).toBe("$165 / hod");
    expect(model.actions).toHaveLength(1);
    expect(model.actions[0].index).toBe(0);
  });

  it("marks downtown district buildings for the premium card treatment", () => {
    const model = createBuildingDetailViewModel({
      district: { id: 12, districtType: "downtown" },
      buildingName: "Centrální banka",
      displayName: "Centrální banka",
      profile: { role: "Finance", actions: [] },
      mechanics: baseMechanics,
      detailEntry: {},
      buildingProfile: { typeKey: "downtown", tier: "core", setTitle: "Downtown" }
    });

    expect(model.districtType).toBe("downtown");
    expect(model.isDowntownBuilding).toBe(true);
  });

  it("handles empty action lists and non-collect buildings", () => {
    const model = createBuildingDetailViewModel({
      buildingName: "Prázdná budova",
      profile: { role: "Info", actions: [] },
      mechanics: {
        ...baseMechanics,
        hasManualCollect: false,
        canCollect: false,
        nextLevel: null
      },
      buildingProfile: {}
    });

    expect(model.collect.visible).toBe(false);
    expect(model.upgrade.disabled).toBe(true);
    expect(model.actions).toEqual([]);
    expect(model.mechanics.some((row) => row.label === "Collect")).toBe(false);
  });

  it("builds school-specific stat and mechanic rows from supplied mechanics", () => {
    const schoolMechanics = {
      ...baseMechanics,
      mechanicsType: "school",
      cleanHourly: 600,
      schoolWholeStudents: 4,
      schoolCapacity: 12,
      schoolPopulationPerMinute: 0.25,
      schoolIsFull: false,
      schoolTimeToFullMs: 120000,
      ownedSchools: 3,
      schoolTalentChancePct: 12,
      schoolNetwork: {
        incomeMultiplier: 1.1,
        studentCapacityMultiplier: 1.2
      },
      schoolEveningCourseActive: false
    };

    expect(createBuildingDetailStatRows({ buildingName: "Škola", mechanics: schoolMechanics })[0]).toEqual({
      label: "Clean / min",
      value: "+$10"
    });
    expect(createBuildingDetailMechanicRows({ buildingName: "Škola", mechanics: schoolMechanics }).some((row) => row.label === "Večerní kurz")).toBe(true);
  });

  it("keeps focused support buildings compact and understandable", () => {
    const clinicModel = createBuildingDetailViewModel({
      district: { id: 9 },
      buildingName: "Klinika",
      displayName: "BlackCross Medical",
      profile: {
        role: "Recovery",
        info: "Klinika drží gang při životě.",
        actions: ["Stabilizační protokol"]
      },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "clinic",
        cleanHourly: 3300,
        dailyHeat: 43.2,
        ownedClinics: 2,
        clinicNetwork: { incomeMultiplier: 1.1, heatMultiplier: 1.05 },
        clinicRecoveryRatePct: 15,
        clinicRecoveryPool: {
          totalFreshAmount: 2,
          fresh: [{ itemId: "gang-members", amount: 2 }],
          label: "2 položky",
          nextExpiryMs: 120000
        }
      },
      actionProfiles: [{ clinicStabilizationProtocol: true, cleanCost: 1200, cooldownMs: 18 * 60 * 1000 }]
    });

    expect(clinicModel.title).toBe("Klinika");
    expect(clinicModel.badge).toBe("Recovery");
    expect(clinicModel.meta).toBe("");
    expect(clinicModel.intro).toBe("Klinika drží gang při životě.");
    expect(clinicModel.showActionsInSinglePanel).toBe(true);
    expect(clinicModel.stats.map((row) => row.label)).toEqual(["Clean / min", "Heat / min", "Recovery rate", "Recovery pool", "Kliniky"]);
    expect(clinicModel.mechanics.find((row) => row.label === "Stabilizace")?.value).toBe("připravená");
    expect(clinicModel.actions).toHaveLength(1);

    expect(createBuildingDetailInfoRows({ buildingName: "Klinika", mechanics: clinicModel })).toEqual([]);
  });

  it("does not render a collect mechanic row for apartment blocks", () => {
    const rows = createBuildingDetailMechanicRows({
      buildingName: "Bytový blok",
      mechanics: {
        ...baseMechanics,
        mechanicsType: "apartment-block",
        apartmentWholePopulation: 2,
        apartmentCapacity: 50,
        apartmentPopulationPerMinute: 2,
        ownedApartmentBlocks: 1
      }
    });

    expect(rows.some((row) => row.label === "Collect")).toBe(false);
    expect(rows.map((row) => row.label)).toEqual(["Lokální zásobník", "Produkce"]);
  });

  it("uses the collect button instead of special action rows for apartment blocks", () => {
    const model = createBuildingDetailViewModel({
      buildingName: "Bytový blok",
      profile: { role: "Členové gangu", actions: ["Vybrat obyvatele"] },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "apartment-block",
        apartmentWholePopulation: 8,
        apartmentCapacity: 20,
        apartmentPopulationPerMinute: 0.3,
        apartmentIsFull: false,
        apartmentTimeToFullMs: 60000,
        ownedApartmentBlocks: 1,
        apartmentNetwork: {
          populationProductionMultiplier: 1,
          capacityMultiplier: 1
        }
      },
      actionProfiles: [{ apartmentCollectPopulation: true }]
    });

    expect(model.collect.visible).toBe(true);
    expect(model.actions).toEqual([]);
  });

  it("renders garage as passive support info and hides building upgrades", () => {
    const garageMechanics = {
      ...baseMechanics,
      mechanicsType: "garage",
      level: 1,
      maxLevel: 1,
      nextLevel: null,
      cleanHourly: 2520,
      dirtyHourly: 0,
      dailyHeat: 86.4,
      dailyInfluence: 0,
      hasManualCollect: false,
      canCollect: false,
      ownedGarages: 3,
      garageNetwork: {
        incomeMultiplier: 1.06,
        heatMultiplier: 1.04
      },
      garageSupport: {
        cooldownReductionPct: 6,
        maxCooldownReductionPct: 16,
        fullBonusCategories: ["attackPreparation", "districtOccupy"],
        halfBonusCategories: ["districtSpy"],
        excludedCategories: ["moneyLaundering"]
      }
    };

    const model = createBuildingDetailViewModel({
      district: { id: 15 },
      buildingName: "Garage",
      displayName: "NightRide Workshop",
      profile: {
        role: "Economy / logistics / cooldown multiplier",
        actions: []
      },
      mechanics: garageMechanics,
      buildingProfile: { setTitle: "Startovní růst" }
    });

    expect(model.title).toBe("Garáž");
    expect(model.badge).toBe("Logistika");
    expect(model.meta).toBe("");
    expect(model.collect.visible).toBe(false);
    expect(model.upgrade.visible).toBe(false);
    expect(model.upgrade.disabled).toBe(true);
    expect(model.stats.map((row) => row.label)).toEqual(["Clean / min", "Heat / min", "Garáže", "Cooldowny"]);
    expect(model.mechanics.find((row) => row.label === "Plný bonus")?.value).toContain("útok");
    expect(model.mechanics.find((row) => row.label === "Upgrade")).toBeUndefined();
    expect(model.actions).toEqual([]);

    const infoModel = createBuildingDetailInfoViewModel({
      buildingName: "Garáž",
      profile: {
        role: "Logistika",
        info: "Garáž je pasivní logistické zázemí."
      },
      mechanics: garageMechanics,
      actionProfiles: [{ cooldownMs: 60000 }]
    });

    expect(createBuildingDetailInfoRows({ buildingName: "Garáž", mechanics: garageMechanics })).toEqual([]);
    expect(infoModel.title).toBe("");
    expect(infoModel.pinIntroToTop).toBe(true);
    expect(infoModel.actionsTitle).toBe("");
    expect(infoModel.actions).toEqual([]);
  });

  it("keeps commerce and support buildings compact without a second info tab", () => {
    const fixtures = [
      {
        buildingName: "Restaurace",
        mechanics: { ...baseMechanics, mechanicsType: "restaurant" },
        profile: { role: "Lokální cashflow", info: "Restaurace živí lokální peněžní tok.", actions: ["Vybrat tržby"] },
        expectedTitle: "Restaurace",
        expectedBadge: "Lokální cashflow",
        expectedActionCount: 1
      },
      {
        buildingName: "Autosalon",
        mechanics: {
          ...baseMechanics,
          mechanicsType: "auto-salon",
          ownedAutoSalons: 2,
          autoSalonNetwork: { cleanIncomeMultiplier: 1.1, dirtyIncomeMultiplier: 1.05, heatMultiplier: 1.02 },
          autoSalonSupport: { mobilityBonusPct: 8, cooldownReductionPct: 4, escapeChanceBonusPct: 3, combinedGarageDealerMaxReductionPct: 18 }
        },
        profile: { role: "Mobilita", info: "Autosalon drží gang v pohybu.", actions: [] },
        expectedTitle: "Autosalon",
        expectedBadge: "Mobilita",
        expectedActionCount: 0
      },
      {
        buildingName: "Fitness Club",
        mechanics: {
          ...baseMechanics,
          mechanicsType: "fitness-club",
          ownedFitnessClubs: 3,
          fitnessClubNetwork: { incomeMultiplier: 1.14, heatMultiplier: 1.04 },
          fitnessClubSupport: {
            attackStrengthBonusPct: 9,
            defenseStrengthBonusPct: 7,
            combinedRecruitmentFitnessAttackCapPct: 28,
            combinedRecruitmentFitnessDefenseCapPct: 24
          }
        },
        profile: { role: "Síla gangu", info: "Fitness Club zvedá fyzickou sílu gangu.", actions: [] },
        expectedTitle: "Fitness Club",
        expectedBadge: "Síla gangu",
        expectedActionCount: 0
      },
      {
        buildingName: "Kasino",
        mechanics: {
          ...baseMechanics,
          mechanicsType: "casino",
          casinoLaunderingCapacity: 8000,
          casinoLaunderingFeePct: 9
        },
        profile: { role: "High-risk praní", info: "Kasino pere velké částky s velkým rizikem.", actions: ["Tichá herna", "VIP noc"] },
        expectedTitle: "Kasino",
        expectedBadge: "High-risk praní",
        expectedActionCount: 2
      },
      {
        buildingName: "Karina shopping center",
        mechanics: {
          ...baseMechanics,
          mechanicsType: "retail",
          ownedShoppingMalls: 2,
          shoppingMallMarketDiscount: { discountPct: 4, feeReductionPct: 2, minFinalPriceMultiplier: 0.85 },
          shoppingMallBlackMarketDiscount: { discountPct: 1 },
          shoppingMallNetwork: { cleanIncomeMultiplier: 1.1, dirtyIncomeMultiplier: 1.05, influenceMultiplier: 1.02, heatMultiplier: 0.98 }
        },
        profile: { role: "Market", info: "Obchodní centrum pasivně zlevňuje market.", actions: [] },
        expectedTitle: "Obchodní centrum",
        expectedBadge: "Market",
        expectedActionCount: 0
      },
      {
        buildingName: "Směnárna",
        mechanics: {
          ...baseMechanics,
          mechanicsType: "exchange",
          ownedExchangeOffices: 4,
          exchangeNetwork: { incomeMultiplier: 1.2, launderingLimitMultiplier: 1.3, heatMultiplier: 1.08 },
          exchangeLaunderingCapacity: 3200,
          exchangeAuditRisk: "12 %"
        },
        profile: { role: "Praní peněz", info: "Směnárna pere menší částky bezpečněji.", actions: ["Výhodný kurz"] },
        expectedTitle: "Směnárna",
        expectedBadge: "Praní peněz",
        expectedActionCount: 1
      },
      {
        buildingName: "Sklad",
        mechanics: {
          ...baseMechanics,
          mechanicsType: "warehouse",
          ownedWarehouses: 4,
          warehouseNetwork: { incomeMultiplier: 1.2, storageCapacityMultiplier: 1.4, heatMultiplier: 1.08 },
          warehouseCapacity: {
            genericResources: 140,
            chemicals: 40,
            biomass: 35,
            metalParts: 30,
            techCore: 12,
            combatModule: 8,
            drugsAndBoosts: 20,
            weaponsAndDefense: 24
          },
          warehouseUsage: {
            genericResources: 30,
            chemicals: 8,
            biomass: 5,
            metalParts: 12,
            techCore: 2,
            combatModule: 1,
            drugsAndBoosts: 7,
            weaponsAndDefense: 9
          },
          warehouseWarnings: []
        },
        profile: { role: "Sklad zásob", info: "Sklad drží zásoby města pohromadě.", actions: [] },
        expectedTitle: "Sklad",
        expectedBadge: "Sklad zásob",
        expectedActionCount: 0
      },
      {
        buildingName: "Energetická stanice",
        mechanics: { ...baseMechanics, mechanicsType: "power-plant" },
        profile: { role: "Infrastruktura", info: "Energetická stanice drží provoz districtu stabilní.", actions: ["Stabilizovat síť", "Napájet výrobu", "Snížit výpadky"] },
        expectedTitle: "Energetická stanice",
        expectedBadge: "Infrastruktura",
        expectedActionCount: 3
      },
      {
        buildingName: "Recyklační centrum",
        mechanics: { ...baseMechanics, mechanicsType: "recycling-center" },
        profile: { role: "Salvage", info: "Recyklační centrum vrací itemové ztráty ze šrotu.", actions: ["Vytěžit ztráty"] },
        expectedTitle: "Recyklační centrum",
        expectedBadge: "Salvage",
        expectedActionCount: 1
      },
      {
        buildingName: "Pašovací tunel",
        mechanics: {
          ...baseMechanics,
          mechanicsType: "smuggling-tunnel",
          smugglingDirtyPerMinute: 22,
          ownedSmugglingTunnels: 3,
          smugglingTunnelNetwork: { dirtyProductionMultiplier: 1.3, heatMultiplier: 1.08 },
          smugglingDealerSupplyBonusPct: 12,
          smugglingContrabandFlowLabel: "stabilní",
          smugglingOpenChannelActive: false,
          smugglingOpenChannelRemainingMs: 0
        },
        profile: { role: "Pašování", info: "Pašovací tunel drží dirty proud mimo světlo.", actions: ["Otevřít kanál"] },
        expectedTitle: "Pašovací tunel",
        expectedBadge: "Pašování",
        expectedActionCount: 1
      },
      {
        buildingName: "Pouliční dealeři",
        mechanics: { ...baseMechanics, mechanicsType: "street-dealers" },
        profile: { role: "Distribuce", info: "Pouliční dealeři mění lab produkty na dirty cash.", actions: ["Spustit prodej"] },
        expectedTitle: "Pouliční dealeři",
        expectedBadge: "Distribuce",
        expectedActionCount: 1
      },
      {
        buildingName: "Večerka",
        mechanics: { ...baseMechanics, mechanicsType: "convenience-store" },
        profile: { role: "Pouliční provoz", info: "Večerka drží malé cashflow a drby.", actions: [] },
        expectedTitle: "Večerka",
        expectedBadge: "Pouliční provoz",
        expectedActionCount: 0
      },
      {
        buildingName: "Strip club",
        mechanics: { ...baseMechanics, mechanicsType: "strip-club" },
        profile: { role: "Noční provoz", info: "Strip club generuje cashflow, kontakty a vliv.", actions: ["Vybrat cash", "Hostit VIP klienty", "Získat kompromat"] },
        expectedTitle: "Strip club",
        expectedBadge: "Noční provoz",
        expectedActionCount: 3
      }
    ];

    for (const fixture of fixtures) {
      const model = createBuildingDetailViewModel({
        district: { id: 4 },
        buildingName: fixture.buildingName,
        displayName: `${fixture.buildingName} variant`,
        profile: fixture.profile,
        mechanics: fixture.mechanics,
        buildingProfile: { setTitle: "District set" }
      });
      const infoModel = createBuildingDetailInfoViewModel({
        buildingName: fixture.buildingName,
        profile: fixture.profile,
        mechanics: fixture.mechanics
      });

      expect(model.title).toBe(fixture.expectedTitle);
      expect(model.badge).toBe(fixture.expectedBadge);
      expect(model.meta).toBe("");
      expect(model.stats.length).toBeGreaterThan(0);
      expect(model.actions).toHaveLength(fixture.expectedActionCount);
      expect(infoModel.title).toBe("");
      expect(infoModel.pinIntroToTop).toBe(true);
      expect(infoModel.rows).toEqual([]);
      expect(infoModel.actions).toEqual([]);
    }
  });

  it("disables smuggling tunnel open channel when dirty cash is missing", () => {
    const rows = createBuildingDetailActionRows({
      buildingName: "Pašovací tunel",
      profile: { actions: ["Otevřít kanál"] },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "smuggling-tunnel",
        smugglingOpenChannelActive: false,
        smugglingOpenChannelRemainingMs: 0
      },
      economyState: { dirtyMoney: 0 },
      actionProfiles: [{ smugglingOpenChannel: true, dirtyCost: 800, cooldownMs: 18 * 60 * 1000 }],
      now: 1000
    });

    expect(rows[0].disabled).toBe(true);
    expect(rows[0].description).toContain("dirty cash");
  });

  it("builds info-tab rows and action copy without touching runtime state", () => {
    const model = createBuildingDetailInfoViewModel({
      buildingName: "Továrna",
      profile: {
        role: "Výroba",
        info: "Lokální provoz.",
        actions: ["Vybrat lokální výnos"]
      },
      mechanics: baseMechanics,
      entry: {},
      actionProfiles: [{ clean: 150, cooldownMs: 60000 }],
      now: 1000
    });

    expect(model.title).toBe("Co hráč musí vědět");
    expect(model.intro).toBe("Lokální provoz.");
    expect(model.rows.find((row) => row.label === "Role")?.value).toBe("Výroba · Továrna");
    expect(model.rows.find((row) => row.label === "Další level")?.value).toContain("Multiplier x1.28");
    expect(model.actions).toHaveLength(1);
    expect(model.actions[0].title).toBe("Vybrat lokální výnos");
    expect(model.actions[0].result).toContain("Cooldown 1m 00s");
  });

  it("omits apartment block info title and special action copy", () => {
    const model = createBuildingDetailInfoViewModel({
      buildingName: "Bytový blok",
      profile: {
        role: "Členové gangu",
        info: "Bytový blok negeneruje cash ani heat. Jen lidi. A v tomhle městě jsou lidi palivo každé války.",
        actions: ["Vybrat obyvatele"]
      },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "apartment-block",
        apartmentWholePopulation: 8,
        apartmentCapacity: 20,
        apartmentIsFull: false,
        apartmentTimeToFullMs: 60000,
        ownedApartmentBlocks: 1,
        apartmentNetwork: {
          populationProductionMultiplier: 1,
          capacityMultiplier: 1
        }
      },
      actionProfiles: [{ apartmentCollectPopulation: true }]
    });

    expect(model.title).toBe("");
    expect(model.intro).toBe("Bytový blok negeneruje cash ani heat. Jen lidi. A v tomhle městě jsou lidi palivo každé války.");
    expect(model.actionsTitle).toBe("");
    expect(model.actions).toEqual([]);
    expect(model.rows.map((row) => row.label)).toEqual([
      "Čas do naplnění",
      "Vlastněné bloky",
      "Upgrade",
      "Network multiplier",
      "Síť",
      "Další level"
    ]);
  });

  it("keeps shopping mall passive market info out of the merged info tab", () => {
    const rows = createBuildingDetailInfoRows({
      buildingName: "Obchodní centrum",
      profile: { role: "Market" },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "retail",
        ownedShoppingMalls: 2,
        shoppingMallMarketDiscount: {
          discountPct: 4,
          feeReductionPct: 2,
          minFinalPriceMultiplier: 0.85
        },
        shoppingMallBlackMarketDiscount: {
          discountPct: 1
        },
        shoppingMallNetwork: {
          cleanIncomeMultiplier: 1.1,
          dirtyIncomeMultiplier: 1.05,
          influenceMultiplier: 1.02,
          heatMultiplier: 0.98
        }
      }
    });

    expect(rows).toEqual([]);
  });
});
