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
import {
  DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES
} from "../../page-assets/js/app/runtime/buildingDetailData.js";
import { expectNoGenericBuildingCardCopy } from "./helpers/building-card-test-helpers.js";

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
  it("keeps restaurant special action duration and cooldown aligned at thirty minutes", () => {
    const restaurantActions = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.restaurace;

    expect(restaurantActions).toHaveLength(3);
    expect(restaurantActions.every((action) => action.durationMs === 30 * 60 * 1000)).toBe(true);
    expect(restaurantActions.every((action) => action.cooldownMs === 30 * 60 * 1000)).toBe(true);
  });

  it("keeps strip club special action timings aligned with card copy", () => {
    const stripClubActions = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES["strip club"];

    expect(stripClubActions).toHaveLength(3);
    expect(stripClubActions[0].cooldownMs).toBe(10 * 60 * 1000);
    expect(stripClubActions[1].durationMs).toBe(30 * 60 * 1000);
    expect(stripClubActions[1].cooldownMs).toBe(60 * 60 * 1000);
    expect(stripClubActions[2].cooldownMs).toBe(30 * 60 * 1000);
  });

  it("keeps smuggling tunnel open channel cost, duration, and cooldown aligned with card copy", () => {
    const [openChannel] = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES["pasovaci tunel"];

    expect(openChannel.smugglingOpenChannel).toBe(true);
    expect(openChannel.cleanCost).toBe(800);
    expect(openChannel.heat).toBe(5);
    expect(openChannel.durationMs).toBe(15 * 60 * 1000);
    expect(openChannel.cooldownMs).toBe(30 * 60 * 1000);
    expect(openChannel.dirtyIncomeBoostPct).toBe(45);
  });

  it("keeps park special action profiles explicit for action, income, heat, and cooldown", () => {
    const streetDealerActions = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES["poulicni dealeri"];
    const stripClubActions = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES["strip club"];
    const smugglingTunnelActions = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES["pasovaci tunel"];

    expect(streetDealerActions.map((action) => action.cooldownMs)).toEqual([
      0,
      10 * 60 * 1000,
      10 * 60 * 1000
    ]);
    expect(streetDealerActions.map((action) => action.heat || 0)).toEqual([0, 3, 1]);
    expect(streetDealerActions.map((action) => action.dirty || 0)).toEqual([0, 280, 1000]);
    expect(stripClubActions.map((action) => action.cooldownMs)).toEqual([
      10 * 60 * 1000,
      60 * 60 * 1000,
      30 * 60 * 1000
    ]);
    expect(stripClubActions.map((action) => action.heat)).toEqual([3, undefined, 6]);
    expect(smugglingTunnelActions).toHaveLength(1);
    expect(smugglingTunnelActions[0]).toMatchObject({
      cleanCost: 800,
      heat: 5,
      durationMs: 15 * 60 * 1000,
      cooldownMs: 30 * 60 * 1000
    });
    expect(DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.vecerka).toEqual([]);
  });

  it("shows strip club passive rumor cadence in mechanics", () => {
    const mechanics = createBuildingDetailMechanicRows({
      buildingName: "Strip club",
      mechanics: { ...baseMechanics, mechanicsType: "strip-club" }
    });

    expect(mechanics.some((row) =>
      row.label === "Drby" && row.value === "každý Strip club vytvoří 1 drb každých 30 min"
    )).toBe(true);
  });

  it("shows warehouse capacities as separate mechanic rows with base capacity at zero owned warehouses", () => {
    const mechanics = createBuildingDetailMechanicRows({
      buildingName: "Skladiště",
      mechanics: {
        ...baseMechanics,
        mechanicsType: "warehouse",
        ownedWarehouses: 0,
        warehouseCapacity: {
          genericResources: 0,
          chemicals: 0,
          biomass: 0,
          metalParts: 0,
          techCore: 0,
          combatModule: 0,
          drugsAndBoosts: 0,
          weaponsAndDefense: 0
        },
        warehouseUsage: {
          chemicals: 0,
          biomass: 0,
          metalParts: 0,
          techCore: 0,
          combatModule: 0,
          drugsAndBoosts: 0,
          weaponsAndDefense: 0
        },
        warehouseWarnings: []
      }
    });

    expect(mechanics).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Materiál", value: "Chemicals 0/350" }),
      expect.objectContaining({ label: "Materiál", value: "Biomass 0/350" }),
      expect.objectContaining({ label: "Materiál", value: "Metal parts 0/400" }),
      expect.objectContaining({ label: "Materiál", value: "Tech core 0/120" }),
      expect.objectContaining({ label: "Materiál", value: "Bojové moduly 0/80" }),
      expect.objectContaining({ label: "Materiál", value: "Drogy a boosty 0/220" }),
      expect.objectContaining({ label: "Materiál", value: "Zbraně a obrana 0/160" }),
      expect.objectContaining({ label: "Stav kapacity", value: "Kapacity jsou v pořádku." })
    ]));
    expect(mechanics.some((row) => row.value === "vlastníš 0/18 skladů")).toBe(false);
    expect(mechanics.filter((row) => row.label === "Materiál").every((row) => row.tone === "warehouse-low")).toBe(true);
  });

  it("colors warehouse material mechanic rows by used capacity", () => {
    const mechanics = createBuildingDetailMechanicRows({
      buildingName: "Skladiště",
      mechanics: {
        ...baseMechanics,
        mechanicsType: "warehouse",
        warehouseCapacity: {
          chemicals: 100,
          biomass: 100,
          metalParts: 100,
          techCore: 100,
          combatModule: 100,
          drugsAndBoosts: 100,
          weaponsAndDefense: 100
        },
        warehouseUsage: {
          chemicals: 30,
          biomass: 31,
          metalParts: 85,
          techCore: 86,
          combatModule: 0,
          drugsAndBoosts: 70,
          weaponsAndDefense: 99
        },
        warehouseWarnings: []
      }
    });

    expect(mechanics).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: "Chemicals 30/100", tone: "warehouse-low" }),
      expect.objectContaining({ value: "Biomass 31/100", tone: "warehouse-medium" }),
      expect.objectContaining({ value: "Metal parts 85/100", tone: "warehouse-medium" }),
      expect.objectContaining({ value: "Tech core 86/100", tone: "warehouse-high" }),
      expect.objectContaining({ value: "Bojové moduly 0/100", tone: "warehouse-low" }),
      expect.objectContaining({ value: "Drogy a boosty 70/100", tone: "warehouse-medium" }),
      expect.objectContaining({ value: "Zbraně a obrana 99/100", tone: "warehouse-high" })
    ]));
  });

  it("does not show generic infrastructure restriction copy in power station mechanics", () => {
    const mechanics = createBuildingDetailMechanicRows({
      buildingName: "Energetická stanice",
      mechanics: { ...baseMechanics, mechanicsType: "power-plant" }
    });

    expect(JSON.stringify(mechanics)).not.toContain("infrastruktura bez skladu");
    expect(mechanics.map((row) => row.label)).toEqual([
      "Stabilizovat síť",
      "Napájet výrobu",
      "Snížit heat"
    ]);
  });

  it("keeps power station action cooldowns and durations aligned with card copy", () => {
    const powerStationActions = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES["energeticka stanice"];

    expect(powerStationActions).toHaveLength(3);
    expect(powerStationActions.every((action) => action.cooldownMs === 60 * 60 * 1000)).toBe(true);
    expect(powerStationActions[0].durationMs).toBe(25 * 60 * 1000);
    expect(powerStationActions[1].durationMs).toBe(25 * 60 * 1000);
    expect(powerStationActions[2].durationMs).toBeUndefined();
    expect(powerStationActions[2].heat).toBe(-2);
  });

  it("keeps recycling center card copy focused on item recovery", () => {
    const stats = createBuildingDetailStatRows({
      buildingName: "Recyklační centrum",
      mechanics: { ...baseMechanics, mechanicsType: "recycling-center" }
    });
    const mechanics = createBuildingDetailMechanicRows({
      buildingName: "Recyklační centrum",
      mechanics: { ...baseMechanics, mechanicsType: "recycling-center" }
    });
    const [extractLosses] = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES["recyklacni centrum"];
    const copy = JSON.stringify({ stats, mechanics, extractLosses });

    expect(stats.find((row) => row.label === "Akce")?.value).toBe("itemové ztráty");
    expect(copy).not.toContain("salvage pool");
    expect(copy).not.toContain("populaci ani");
    expect(copy).not.toContain("členy gangu");
  });

  it("defines school evening course as apartment population speed boost without talents", () => {
    const [schoolAction] = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.skola;

    expect(schoolAction.schoolEveningCourse).toBe(true);
    expect(schoolAction.durationMs).toBe(20 * 60 * 1000);
    expect(schoolAction.durationBonusMsPerLevel).toBe(2 * 60 * 1000);
    expect(schoolAction.cooldownMs).toBe(35 * 60 * 1000);
    expect(schoolAction.apartmentPopulationBoostPct).toBe(60);
    expect(schoolAction.talentChanceBonusPct).toBeUndefined();
    expect(schoolAction.betterTalentChancePct).toBeUndefined();
  });

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
    expect(model.effects).toEqual([{ text: "Žádné aktivní mechaniky.", tone: "neutral" }]);
    expect(model.actions).toEqual([]);
  });

  it("adds current night income, heat, and rumor effects to affected building cards", () => {
    const model = createBuildingDetailViewModel({
      district: { id: 7 },
      buildingName: "Restaurace",
      displayName: "Restaurace",
      profile: { role: "Cashflow", actions: [] },
      mechanics: { ...baseMechanics, mechanicsType: "restaurant" },
      buildingProfile: { typeKey: "downtown", tier: "mid", setTitle: "District" },
      phaseState: { mapPhase: "night" }
    });

    expect(model.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: "NOC: clean $120/h -> $114/h · drby +10 %",
        tone: "day-night-night"
      })
    ]));
  });

  it("shows illegal income buildings as stronger at night instead of applying legal clean income copy", () => {
    const model = createBuildingDetailViewModel({
      buildingName: "Kasino",
      displayName: "Kasino",
      profile: { role: "Dirty cash", actions: [] },
      mechanics: { ...baseMechanics, mechanicsType: "casino" },
      phaseState: { mapPhase: "night" }
    });

    expect(model.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: "NOC: dirty $45/h -> $56/h",
        tone: "day-night-night"
      })
    ]));
  });

  it("resolves production day/night copy from the displayed building name when mechanics are generic", () => {
    const model = createBuildingDetailViewModel({
      buildingName: "Továrna",
      displayName: "Továrna",
      profile: { role: "Výroba", actions: [] },
      mechanics: {
        ...baseMechanics,
        cleanHourly: 0,
        dirtyHourly: 0,
        dailyHeat: 0,
        mechanicsType: "generic"
      },
      phaseState: { mapPhase: "day" }
    });

    expect(model.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: "DEN: produkce +10 %",
        tone: "day-night-day"
      })
    ]));
  });

  it("does not add day/night copy to buildings without a day/night affected output", () => {
    const model = createBuildingDetailViewModel({
      buildingName: "Bytový blok",
      displayName: "Bytový blok",
      profile: { role: "Populace", actions: [] },
      mechanics: {
        ...baseMechanics,
        cleanHourly: 0,
        dirtyHourly: 0,
        dailyHeat: 0,
        mechanicsType: "apartment-block",
        apartmentWholePopulation: 0,
        apartmentCapacity: 20,
        apartmentPopulationPerMinute: 0.3,
        apartmentIsFull: true,
        ownedApartmentBlocks: 1,
        apartmentNetwork: {
          populationProductionMultiplier: 1,
          capacityMultiplier: 1
        }
      },
      phaseState: { mapPhase: "night" }
    });

    expect(model.effects.some((effect) => /^DEN:|^NOC:/u.test(effect.text))).toBe(false);
  });

  it("marks downtown district buildings for the premium card treatment", () => {
    const model = createBuildingDetailViewModel({
      district: { id: 12, districtType: "downtown" },
      buildingName: "Centrální banka",
      displayName: "Centrální banka",
      profile: { role: "Rare / elite rumors / high truth intel / influence", actions: [] },
      mechanics: baseMechanics,
      detailEntry: {},
      buildingProfile: { typeKey: "downtown", tier: "core", setTitle: "Downtown" }
    });

    expect(model.districtType).toBe("downtown");
    expect(model.isDowntownBuilding).toBe(true);
    expect(model.badge).toBe("");
    expect(model.meta).toBe("District 12 · Downtown");
    expect(model.meta).not.toContain("Rare");
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
      schoolTalentChancePct: 0,
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
    const stats = createBuildingDetailStatRows({ buildingName: "Škola", mechanics: schoolMechanics });
    const mechanics = createBuildingDetailMechanicRows({ buildingName: "Škola", mechanics: schoolMechanics });
    expect(stats.some((row) => row.label === "Talent")).toBe(false);
    expect(mechanics.find((row) => row.label === "Večerní kurz")?.value).toBe("zrychlí výrobu lidí v bytových blocích");
    expect(mechanics.some((row) => row.label === "Pravidla")).toBe(false);
    expect(JSON.stringify(mechanics)).not.toContain("žádný dirty cash");
    expect(JSON.stringify({ stats, mechanics })).not.toContain("talent");
  });

  it("shows current day student production as real phase numbers", () => {
    const model = createBuildingDetailViewModel({
      buildingName: "Škola",
      displayName: "Škola",
      profile: { role: "Vzdělání", actions: [] },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "school",
        schoolPopulationPerMinute: 0.25,
        schoolWholeStudents: 4,
        schoolCapacity: 12,
        schoolIsFull: false,
        schoolNetwork: {
          incomeMultiplier: 1,
          studentCapacityMultiplier: 1
        },
        schoolEveningCourseActive: false
      },
      phaseState: { mapPhase: "day" }
    });

    expect(model.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: "DEN: clean $120/h -> $126/h · studenti 0.25/min -> 0.3/min",
        tone: "day-night-day"
      })
    ]));
  });

  it("formats restaurant network effects as percent bonus copy", () => {
    const model = createBuildingDetailViewModel({
      district: { id: 4 },
      buildingName: "Restaurace",
      displayName: "Restaurace",
      profile: { role: "Lokální cashflow", actions: ["Vybrat tržby"] },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "restaurant",
        effectsLabel: "Clean cash +180/hod · Dirty cash +120/hod · Level multiplier x1.42"
      },
      buildingProfile: { setTitle: "District set" }
    });

    expect(model.effects).toEqual([
      { text: "Clean cash +180/hod", tone: "clean" },
      { text: "Dirty cash +120/hod", tone: "dirty" },
      { text: "Multiplier 1x42: čím víc restaurací, tím větší keš i menší cooldowny", tone: "network" }
    ]);
  });

  it("moves owned building count to the header and hides zero network bonuses", () => {
    const model = createBuildingDetailViewModel({
      district: { id: 4 },
      buildingName: "Restaurace",
      displayName: "Restaurace",
      profile: { role: "Lokální cashflow", actions: ["Vybrat tržby"] },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "restaurant",
        ownedBuildingCount: 1,
        effectsLabel: "Clean cash +180/hod · Level multiplier x1.00"
      },
      buildingProfile: { setTitle: "District set" }
    });

    expect(model.countLabel).toBe("Počet: 1");
    expect(model.effects).toEqual([
      { text: "Clean cash +180/hod", tone: "clean" }
    ]);
  });

  it("explains apartment block network multiplier as population production and capacity", () => {
    const model = createBuildingDetailViewModel({
      district: { id: 4 },
      buildingName: "Bytový blok",
      displayName: "Bytový blok",
      profile: { role: "Členové gangu", actions: ["Vybrat obyvatele"] },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "apartment-block",
        ownedApartmentBlocks: 3,
        apartmentWholePopulation: 8,
        apartmentCapacity: 20,
        apartmentPopulationPerMinute: 0.3,
        apartmentIsFull: false,
        effectsLabel: "Level multiplier x1.20"
      },
      buildingProfile: { setTitle: "District set" }
    });

    expect(model.effects).toContainEqual({
      text: "Síť bytových bloků: produkce a kapacita obyvatel +20 %",
      tone: "network"
    });
    expect(JSON.stringify(model.effects)).not.toContain("Multiplier");
  });

  it("renders restaurant count and network multiplier from owned restaurant mechanics", () => {
    const rows = createBuildingDetailStatRows({
      buildingName: "Restaurace",
      mechanics: {
        ...baseMechanics,
        mechanicsType: "restaurant",
        cleanHourly: 360,
        dirtyHourly: 120,
        dailyHeat: 120,
        dailyInfluence: 20,
        ownedRestaurants: 4,
        restaurantNetwork: {
          incomeMultiplier: 1.08,
          influenceMultiplier: 1.09,
          rumorMultiplier: 1.12,
          heatMultiplier: 1.06
        }
      }
    });

    expect(rows.find((row) => row.label === "Počet")?.value).toBe("4/36");
    expect(rows.find((row) => row.label === "Síť výnosu")?.value).toBe("x1.08");
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
        canCollect: false,
        ownedApartmentBlocks: 1,
        apartmentNetwork: {
          populationProductionMultiplier: 1,
          capacityMultiplier: 1
        }
      },
      actionProfiles: [{ apartmentCollectPopulation: true }]
    });

    expect(model.collect.visible).toBe(true);
    expect(model.collect.enabled).toBe(false);
    expect(model.collect.title).toContain("alespoň 10 lidí");
    expect(model.actions).toEqual([]);
  });

  it("colors apartment block local storage mechanic below ten as pending and ten as ready", () => {
    const createApartmentModel = (apartmentWholePopulation) => createBuildingDetailViewModel({
      buildingName: "Bytový blok",
      profile: { role: "Členové gangu", actions: ["Vybrat obyvatele"] },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "apartment-block",
        apartmentWholePopulation,
        apartmentCapacity: 20,
        apartmentPopulationPerMinute: 0.3,
        apartmentIsFull: false,
        apartmentTimeToFullMs: 60000,
        canCollect: apartmentWholePopulation >= 10,
        ownedApartmentBlocks: 1,
        apartmentNetwork: {
          populationProductionMultiplier: 1,
          capacityMultiplier: 1
        }
      },
      actionProfiles: [{ apartmentCollectPopulation: true }]
    });

    const pending = createApartmentModel(9);
    const ready = createApartmentModel(10);

    expect(pending.mechanics.find((row) => row.label === "Lokální zásobník")).toMatchObject({
      value: "9/20",
      tone: "collect-pending"
    });
    expect(pending.effects).toContainEqual({ text: "Může se vybrat od 10 členů", tone: "silver" });
    expect(pending.collect.enabled).toBe(false);
    expect(ready.mechanics.find((row) => row.label === "Lokální zásobník")).toMatchObject({
      value: "10/20",
      tone: "collect-ready"
    });
    expect(ready.collect.enabled).toBe(true);
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
    expect(model.mechanics.find((row) => row.label === "Síť garáží")?.value).toBe("Každá další garáž zvedá čistý výnos o +6 % a heat o +4 %.");
    expect(model.mechanics.find((row) => row.label === "Plný cooldown bonus")?.value).toContain("útoky");
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
        buildingName: "Skladiště",
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
        profile: { role: "Skladiště zásob", info: "Skladiště drží zásoby města pohromadě.", actions: [] },
        expectedTitle: "Skladiště",
        expectedBadge: "Skladiště zásob",
        expectedActionCount: 0
      },
      {
        buildingName: "Energetická stanice",
        mechanics: { ...baseMechanics, mechanicsType: "power-plant" },
        profile: { role: "Infrastruktura", info: "Energetická stanice drží provoz districtu stabilní.", actions: ["Stabilizovat síť", "Napájet výrobu", "Snížit heat"] },
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
        profile: { role: "Noční provoz", info: "Strip club generuje cashflow, kontakty a vliv.", actions: ["Vybrat cash", "Hostit VIP klienty", "Získat kompro"] },
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
      economyState: { cleanMoney: 0, dirtyMoney: 1000 },
      actionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES["pasovaci tunel"],
      now: 1000
    });

    expect(rows[0].disabled).toBe(true);
    expect(rows[0].description).toContain("clean cash");
    expect(rows[0].buttonCostLabel).toBe("$800 clean cash");
    expect(rows[0].cooldownMs).toBe(30 * 60 * 1000);
    expect(rows[0].rewardSummary).toContain("Trvání 15m 00s");
  });

  it("adds stable action ids and keeps server-backed downtown actions out of legacy fallback", () => {
    const rows = createBuildingDetailActionRows({
      buildingName: "Burza",
      profile: { actions: ["Spekulativní nákup", "Tržní tlak", "Insider Window"] },
      mechanics: { ...baseMechanics, mechanicsType: "stock-exchange" },
      economyState: { cleanMoney: 100000, dirtyMoney: 100000 },
      actionProfiles: [
        { stockSpeculativeBuy: true, cleanCost: 2500, heat: 5, cooldownMs: 16 * 60 * 1000 },
        { stockMarketPressure: true, cleanCost: 3000, influenceCost: 15, heat: 8, durationMs: 10 * 60 * 1000, cooldownMs: 22 * 60 * 1000 },
        { stockInsiderWindow: true, cleanCost: 1500, heat: 4, durationMs: 6 * 60 * 1000, cooldownMs: 18 * 60 * 1000 }
      ],
      now: 1000
    });

    expect(rows.map((row) => row.actionId)).toEqual(["speculative_buy", "market_pressure", "insider_window"]);
    expect(rows.every((row) => row.disabledReason.includes("serverový handler"))).toBe(false);
    expect(rows.some((row) => !row.disabled)).toBe(true);
  });

  it("enables recycling extract losses only when item salvage exists", () => {
    const profile = { actions: ["Vytěžit ztráty"] };
    const actionProfiles = [{ recyclingExtractLosses: true, cleanCost: 900, heat: 2, cooldownMs: 16 * 60 * 1000 }];
    const emptyRows = createBuildingDetailActionRows({
      buildingName: "Recyklační centrum",
      profile,
      mechanics: {
        ...baseMechanics,
        mechanicsType: "recycling-center",
        recyclingSalvagePool: { fresh: [] }
      },
      economyState: { cleanMoney: 2000, dirtyMoney: 0 },
      actionProfiles,
      now: 1000
    });
    const readyRows = createBuildingDetailActionRows({
      buildingName: "Recyklační centrum",
      profile,
      mechanics: {
        ...baseMechanics,
        mechanicsType: "recycling-center",
        recyclingSalvagePool: { fresh: [{ id: "loss-1", itemType: "metal-parts", amount: 8 }] }
      },
      economyState: { cleanMoney: 2000, dirtyMoney: 0 },
      actionProfiles,
      now: 1000
    });

    expect(emptyRows[0].actionId).toBe("extract_losses");
    expect(emptyRows[0].disabled).toBe(true);
    expect(emptyRows[0].disabledReason).toBe("Nemáš žádné ztráty k vytěžení.");
    expect(readyRows[0].disabled).toBe(false);
    expect(readyRows[0].cooldownLabel).toBe("Cooldown 16m 00s");
  });

  it("keeps street dealer UI actions aligned with all special action profiles", () => {
    const createRows = (materials = { biomass: 3 }) => createBuildingDetailActionRows({
      buildingName: "Pouliční dealeři",
      profile: { actions: ["Spustit prodej", "Vybrat hot cash", "Přesunout stash"] },
      mechanics: { ...baseMechanics, mechanicsType: "street-dealers" },
      economyState: { cleanMoney: 0, dirtyMoney: 0, materials },
      actionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES["poulicni dealeri"],
      now: 1000
    });
    const rows = createRows();
    const missingBiomassRows = createRows({ biomass: 2 });

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.actionId)).toEqual([
      "start_drug_sale",
      "street_dealers_collect_hot_cash",
      "street_dealers_move_stash"
    ]);
    expect(rows.every((row) => !row.disabled)).toBe(true);
    expect(rows.every((row) => row.handlerId === "server-run-building-action")).toBe(true);
    expect(rows.map((row) => row.cooldownMs)).toEqual([0, 10 * 60 * 1000, 10 * 60 * 1000]);
    expect(rows[0].rewardSummary).toContain("Dealer slot prodá vybranou látku");
    expect(rows[2].costSummary).toBe("biomass x3");
    expect(rows[2].rewardSummary).toContain("Dirty cash +$1000");
    expect(missingBiomassRows[2]).toMatchObject({
      disabled: true,
      disabledReason: "Potřebuješ biomass x3.",
      disabledTone: "insufficient-funds"
    });
  });

  it("removes production and craft special action rows from building detail cards", () => {
    for (const buildingName of ["Lékárna", "Drug lab", "Lab", "Továrna", "Zbrojovka"]) {
      const key = buildingName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const rows = createBuildingDetailActionRows({
        buildingName,
        profile: { actions: [] },
        mechanics: { ...baseMechanics, mechanicsType: "generic" },
        actionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES[key] || [],
        now: 1000
      });

      expect(rows, buildingName).toEqual([]);
    }
  });

  it("renders action cooldown countdown from stored actionId deadlines", () => {
    const rows = createBuildingDetailActionRows({
      buildingName: "Restaurace",
      profile: { actions: ["Vybrat tržby"] },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "restaurant",
        actionCooldowns: { restaurant_collect_revenue: 61000 }
      },
      economyState: { cleanMoney: 0, dirtyMoney: 0 },
      actionProfiles: [{ clean: 180, dirty: 90, heat: 1, cooldownMs: 90000 }],
      now: 1000
    });

    expect(rows[0].disabled).toBe(true);
    expect(rows[0].cooldownLabel).toBe("Zbývá 1m 00s");
    expect(rows[0].disabledReason).toBe("Cooldown 1m 00s.");
  });

  it("shows casino action cost on the button model and grays out actions when cash is missing", () => {
    const rows = createBuildingDetailActionRows({
      buildingName: "Kasino",
      profile: { actions: ["Tichý backroom", "VIP noc", "Podplacený inspektor"] },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "casino",
        actionCooldowns: {}
      },
      economyState: { cleanMoney: 1200, dirtyMoney: 5000 },
      actionProfiles: [
        { casinoQuietBackroom: true, minimumDirty: 12000, dirtyCost: 12000, cooldownMs: 18 * 60 * 1000 },
        { casinoVipNight: true, cleanCost: 900, cooldownMs: 30 * 60 * 1000 },
        { casinoBribedInspector: true, cleanCost: 3000, cooldownMs: 45 * 60 * 1000 }
      ],
      now: 1000
    });

    expect(rows.map((row) => row.buttonCostLabel)).toEqual([
      "$12000 dirty cash",
      "$900 clean cash",
      "$3000 clean cash"
    ]);
    expect(rows[0].disabled).toBe(true);
    expect(rows[0].disabledTone).toBe("insufficient-funds");
    expect(rows[0].disabledReason).toContain("$12000");
    expect(rows[1].disabled).toBe(false);
    expect(rows[2].disabled).toBe(true);
    expect(rows[2].disabledTone).toBe("insufficient-funds");
  });

  it("shows special action boosts as real current numbers instead of only percentages", () => {
    const rows = createBuildingDetailActionRows({
      buildingName: "Kasino",
      profile: { actions: ["Tichý backroom", "VIP noc", "Podplacený inspektor"] },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "casino",
        cleanHourly: 120,
        dirtyHourly: 45,
        dailyInfluence: 20,
        dailyHeat: 10,
        actionCooldowns: {}
      },
      economyState: { cleanMoney: 10000, dirtyMoney: 20000 },
      actionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.kasino,
      now: 1000
    });

    expect(rows[1].rewardSummary).toContain("Clean $120/h -> $204/h");
    expect(rows[1].rewardSummary).toContain("Dirty $45/h -> $69/h");
    expect(rows[1].rewardSummary).toContain("Vliv 20/den -> 25/den");
    expect(rows[1].riskSummary).toContain("Heat 10/den -> 16/den");
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
    expect(model.rows).toEqual([]);
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

  it("renders school evening course availability, resource lock and cooldown from real state", () => {
    const schoolActionProfile = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.skola[0];
    const profile = { role: "Vzdělání", actions: ["Večerní kurz"] };
    const createRows = ({ cleanMoney = 600, active = false, cooldownUntil = 0 } = {}) => createBuildingDetailActionRows({
      buildingName: "Škola",
      profile,
      mechanics: {
        ...baseMechanics,
        mechanicsType: "school",
        schoolEveningCourseActive: active,
        schoolEveningCourseRemainingMs: 90_000,
        actionCooldowns: cooldownUntil > 0 ? { evening_course: cooldownUntil } : {}
      },
      economyState: { cleanMoney },
      actionProfiles: [schoolActionProfile],
      now: 1_000
    });

    const ready = createRows();
    expect(ready).toHaveLength(1);
    expect(ready[0]).toMatchObject({
      actionId: "evening_course",
      title: "Večerní kurz",
      disabled: false,
      cooldownLabel: "Cooldown 35m 00s"
    });
    expect(ready[0].description).not.toContain("talent");

    const withoutCash = createRows({ cleanMoney: 599 });
    expect(withoutCash[0].disabled).toBe(true);
    expect(withoutCash[0].disabledReason).toContain("$600");

    const active = createRows({ active: true });
    expect(active[0].disabled).toBe(true);
    expect(active[0].disabledReason).toContain("Večerní kurz běží");

    const coolingDown = createRows({ cooldownUntil: 61_000 });
    expect(coolingDown[0].disabled).toBe(true);
    expect(coolingDown[0].cooldownRemainingMs).toBe(60_000);
    expect(coolingDown[0].cooldownLabel).toBe("Zbývá 1m 00s");
  });

  it("renders clinic stabilization disabled only when recovery pool or cash is missing", () => {
    const clinicActionProfile = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.klinika[0];
    const profile = { role: "Recovery", actions: ["Stabilizační protokol"] };
    const createRows = ({ cleanMoney = 1_200, fresh = [], cooldownUntil = 0 } = {}) => createBuildingDetailActionRows({
      buildingName: "Klinika",
      profile,
      mechanics: {
        ...baseMechanics,
        mechanicsType: "clinic",
        actionCooldowns: cooldownUntil > 0 ? { stabilization_protocol: cooldownUntil } : {},
        clinicRecoveryPool: {
          totalFreshAmount: fresh.reduce((total, entry) => total + entry.amount, 0),
          fresh,
          nextExpiryMs: fresh.length > 0 ? 120_000 : null
        }
      },
      economyState: { cleanMoney },
      actionProfiles: [clinicActionProfile],
      now: 1_000
    });

    const empty = createRows();
    expect(empty[0]).toMatchObject({
      actionId: "stabilization_protocol",
      disabled: true,
      disabledReason: "Recovery pool je prázdný."
    });

    const ready = createRows({ fresh: [{ itemType: "gang-members", amount: 3 }] });
    expect(ready[0].disabled).toBe(false);
    expect(ready[0].cooldownLabel).toBe("Cooldown 18m 00s");

    const withoutCash = createRows({ cleanMoney: 1_199, fresh: [{ itemType: "gang-members", amount: 3 }] });
    expect(withoutCash[0].disabled).toBe(true);
    expect(withoutCash[0].disabledReason).toContain("$1200");

    const coolingDown = createRows({ fresh: [{ itemType: "population", amount: 4 }], cooldownUntil: 61_000 });
    expect(coolingDown[0].disabled).toBe(true);
    expect(coolingDown[0].cooldownLabel).toBe("Zbývá 1m 00s");
  });

  it("keeps recruitment center passive and free of nonexistent special actions", () => {
    const model = createBuildingDetailViewModel({
      buildingName: "Rekrutační centrum",
      displayName: "Urban Soldiers Hub",
      profile: {
        role: "Nábor",
        info: "Rekrutační centrum není zdroj populace.",
        actions: []
      },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "recruitment-center",
        cleanHourly: 2_100,
        dailyHeat: 100.8
      }
    });

    expect(model.title).toBe("Rekrutační centrum");
    expect(model.badge).toBe("Nábor");
    expect(model.actions).toEqual([]);
    expect(model.mechanics.map((row) => row.label)).toEqual(["Populace", "Útok", "Obrana"]);
    expectNoGenericBuildingCardCopy(model);
  });

  it("keeps residential cards on type labels and without generic upgrade copy", () => {
    const residentialModels = [
      createBuildingDetailViewModel({
        buildingName: "Bytový blok",
        displayName: "First Tower",
        profile: { role: "Členové gangu", actions: ["Vybrat obyvatele"] },
        mechanics: {
          ...baseMechanics,
          mechanicsType: "apartment-block",
          apartmentWholePopulation: 10,
          apartmentCapacity: 50,
          apartmentPopulationPerMinute: 2,
          apartmentIsFull: false,
          apartmentTimeToFullMs: 60_000,
          canCollect: true,
          ownedApartmentBlocks: 1,
          apartmentNetwork: {
            populationProductionMultiplier: 1,
            capacityMultiplier: 1
          }
        },
        actionProfiles: [{ apartmentCollectPopulation: true }]
      }),
      createBuildingDetailViewModel({
        buildingName: "Rekrutační centrum",
        displayName: "Urban Soldiers Hub",
        profile: { role: "Nábor", actions: [] },
        mechanics: { ...baseMechanics, mechanicsType: "recruitment-center" }
      }),
      createBuildingDetailViewModel({
        buildingName: "Škola",
        displayName: "Backstreet Academy",
        profile: { role: "Vzdělání", actions: ["Večerní kurz"] },
        mechanics: {
          ...baseMechanics,
          mechanicsType: "school",
          schoolWholeStudents: 4,
          schoolCapacity: 12,
          schoolPopulationPerMinute: 0.25,
          schoolIsFull: false,
          schoolTimeToFullMs: 120_000,
          ownedSchools: 1,
          schoolNetwork: {
            incomeMultiplier: 1,
            studentCapacityMultiplier: 1
          },
          schoolEveningCourseActive: false
        },
        actionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.skola
      }),
      createBuildingDetailViewModel({
        buildingName: "Klinika",
        displayName: "BlackCross Medical",
        profile: { role: "Recovery", actions: ["Stabilizační protokol"] },
        mechanics: {
          ...baseMechanics,
          mechanicsType: "clinic",
          ownedClinics: 1,
          clinicNetwork: { incomeMultiplier: 1, heatMultiplier: 1 },
          clinicRecoveryRatePct: 15,
          clinicRecoveryPool: { totalFreshAmount: 0, fresh: [], nextExpiryMs: null }
        },
        actionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.klinika
      })
    ];

    expect(residentialModels.map((model) => model.title)).toEqual([
      "Bytový blok",
      "Rekrutační centrum",
      "Škola",
      "Klinika"
    ]);
    for (const model of residentialModels) {
      expectNoGenericBuildingCardCopy(model);
    }
  });
});
