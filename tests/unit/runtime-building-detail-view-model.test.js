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
  it("keeps restaurant special action durations and cooldowns aligned with server config", () => {
    const restaurantActions = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.restaurace;

    expect(restaurantActions).toHaveLength(3);
    expect(restaurantActions.map((action) => action.durationMs)).toEqual([
      0,
      30 * 60 * 1000,
      30 * 60 * 1000
    ]);
    expect(restaurantActions.map((action) => action.cooldownMs)).toEqual([
      30 * 60 * 1000,
      45 * 60 * 1000,
      30 * 60 * 1000
    ]);
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
    expect(openChannel.cleanCost).toBe(1800);
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
      cleanCost: 1800,
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

  it("renders park building cards with current stat labels and network copy except drug lab", () => {
    const parkCards = [
      {
        buildingName: "Pouliční dealeři",
        mechanics: {
          ...baseMechanics,
          mechanicsType: "street-dealers",
          cleanHourly: 0,
          dirtyHourly: 36 * 60,
          dailyHeat: 0.06 * 1440,
          dailyInfluence: 0
        },
        statLabels: ["Špinavé / hod", "Heat / den", "Zdroj", "Akce"],
        mechanicLabels: ["Distribuce", "Hot cash", "Stash", "Riziko"]
      },
      {
        buildingName: "Večerka",
        mechanics: {
          ...baseMechanics,
          mechanicsType: "convenience-store",
          cleanHourly: 32 * 60,
          dirtyHourly: 18 * 60,
          dailyHeat: 0.05 * 1440,
          dailyInfluence: 0.1 * 1440
        },
        statLabels: ["Čisté / hod", "Špinavé / hod", "Heat / den", "Vliv / den", "Drby", "Akce"],
        mechanicLabels: ["Cashflow", "Drby", "Síť večerek", "Synergie"]
      },
      {
        buildingName: "Strip club",
        mechanics: {
          ...baseMechanics,
          mechanicsType: "strip-club",
          cleanHourly: 75 * 60,
          dirtyHourly: 65 * 60,
          dailyHeat: 0.18 * 1440,
          dailyInfluence: 0.38 * 1440
        },
        statLabels: ["Čisté / hod", "Špinavé / hod", "Heat / den", "Vliv / den", "Drby", "Akce"],
        mechanicLabels: ["Noční cash", "VIP klienti", "Drby", "Kompromat", "Síť clubů"]
      },
      {
        buildingName: "Pašovací tunel",
        mechanics: {
          ...baseMechanics,
          mechanicsType: "smuggling-tunnel",
          smugglingDirtyPerMinute: 54,
          dailyHeat: 0.07 * 1440,
          ownedSmugglingTunnels: 2,
          smugglingDealerSupplyBonusPct: 4,
          smugglingOpenChannelActive: false,
          smugglingTunnelNetwork: {
            dirtyProductionMultiplier: 1.05,
            heatMultiplier: 1.04
          }
        },
        statLabels: ["Špinavé / hod", "Heat / den", "Tunely", "Pouliční dealeři", "Kanál", "Síť"],
        mechanicLabels: ["Tok dirty cash", "Pouliční dealeři", "Pouliční riziko"]
      }
    ];

    for (const card of parkCards) {
      const stats = createBuildingDetailStatRows(card);
      const mechanics = createBuildingDetailMechanicRows(card);
      const rendered = JSON.stringify({ stats, mechanics });

      expect(stats.map((row) => row.label), card.buildingName).toEqual(card.statLabels);
      expect(mechanics.map((row) => row.label), card.buildingName).toEqual(card.mechanicLabels);
      expect(rendered, card.buildingName).not.toContain("/ min");
      expect(rendered, card.buildingName).not.toContain("Max level");
      expect(rendered, card.buildingName).not.toContain("Upgrade");
      expect(rendered, card.buildingName).not.toContain("x1.");
    }

    const smugglingStats = createBuildingDetailStatRows(parkCards[3]);
    expect(smugglingStats.find((row) => row.label === "Síť")?.value).toBe("dirty tok +5 % · heat +4 %");
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
    expect(schoolAction.durationBonusMsPerLevel).toBeUndefined();
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

  it("shows a clear heavy day penalty for smuggling tunnel dirty income", () => {
    const model = createBuildingDetailViewModel({
      buildingName: "Pašovací tunel",
      displayName: "Pašovací tunel",
      profile: { role: "Pašování", actions: [] },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "smuggling-tunnel",
        cleanHourly: 0,
        dirtyHourly: 100,
        dailyHeat: 10
      },
      phaseState: { mapPhase: "day" }
    });

    expect(model.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: "DEN: dirty $100/h -> $50/h · heat 10/den -> 11/den",
        tone: "day-night-day"
      })
    ]));
  });

  it("blocks arcade night machines during day and rewrites arcade phase effects", () => {
    const createArcadeModel = (phase) => createBuildingDetailViewModel({
      buildingName: "Herna",
      displayName: "Herna",
      profile: { role: "Dirty cash", actions: ["Noční automaty", "Zadní pokladna"] },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "arcade",
        cleanHourly: 1800,
        dirtyHourly: 1200,
        arcadeNetwork: {
          incomeMultiplier: 1,
          launderingLimitMultiplier: 1,
          heatMultiplier: 1
        },
        arcadeLaunderingCapacity: 3800,
        arcadeAuditRisk: "3 %",
        ownedArcades: 1,
        actionCooldowns: {}
      },
      economyState: { cleanMoney: 10000, dirtyMoney: 10000 },
      actionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.herna,
      phaseState: { mapPhase: phase },
      now: 1000
    });

    const dayModel = createArcadeModel("day");
    const nightModel = createArcadeModel("night");

    expect(dayModel.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: "DEN: dirty $1200/h -> $1080/h",
        tone: "day-night-day"
      })
    ]));
    expect(dayModel.actions[0]).toMatchObject({
      actionId: "night_machines",
      disabled: true,
      disabledReason: "Noční automaty se rozjíždí až po setmění.",
      phaseLockLabel: "Jen v noci",
      phaseLockTone: "night"
    });

    expect(nightModel.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: "NOC: clean $1800/h -> $1890/h · dirty $1200/h -> $1440/h",
        tone: "day-night-night"
      })
    ]));
    expect(nightModel.actions[0]).toMatchObject({
      actionId: "night_machines",
      disabled: false,
      disabledReason: "",
      phaseLockLabel: "Jen v noci",
      phaseLockTone: "night"
    });
    expect(nightModel.actions.map((action) => action.cooldownMs)).toEqual([
      16 * 60 * 1000,
      16 * 60 * 1000
    ]);
  });

  it("blocks every phase-only building action in the wrong phase with its explicit message", () => {
    const cases = [
      {
        buildingName: "Herna",
        phase: "day",
        profile: { role: "Dirty cash", actions: ["Noční automaty", "Zadní pokladna"] },
        mechanics: { ...baseMechanics, mechanicsType: "arcade", actionCooldowns: {} },
        actionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.herna,
        expected: {
          actionId: "night_machines",
          disabledReason: "Noční automaty se rozjíždí až po setmění."
        }
      },
      {
        buildingName: "Kasino",
        phase: "day",
        profile: { role: "High-risk praní", actions: ["Tichá herna", "VIP noc", "Podplacený inspektor"] },
        mechanics: { ...baseMechanics, mechanicsType: "casino", actionCooldowns: {} },
        actionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.kasino,
        expected: {
          actionId: "vip_night",
          disabledReason: "VIP noc můžeš spustit jen v noci."
        }
      },
      {
        buildingName: "Letiště",
        phase: "day",
        profile: { role: "Logistika", actions: ["Expresní dovoz", "Černý charter", "Evakuační koridor"] },
        mechanics: { ...baseMechanics, mechanicsType: "airport", actionCooldowns: {} },
        economyState: { cleanMoney: 10000, dirtyMoney: 10000 },
        actionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.letiste,
        expected: {
          actionId: "black_charter",
          disabledReason: "Černý charter odlétá jen v noci."
        }
      },
      {
        buildingName: "Parlament",
        phase: "night",
        profile: { role: "Politika", actions: ["Policy Window"] },
        mechanics: { ...baseMechanics, mechanicsType: "parliament", actionCooldowns: {} },
        actionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.parlament,
        expected: {
          actionId: "parliament_policy_window",
          disabledReason: "Policy Window se otevírá jen přes den."
        }
      },
      {
        buildingName: "Směnárna",
        phase: "night",
        profile: { role: "Praní peněz", actions: ["Výhodný kurz"] },
        mechanics: {
          ...baseMechanics,
          mechanicsType: "exchange",
          exchangeLaunderingCapacity: 6000,
          exchangeNetwork: { incomeMultiplier: 1, launderingLimitMultiplier: 1, heatMultiplier: 1 },
          actionCooldowns: {}
        },
        actionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.smenarna,
        expected: {
          actionId: "good_rate",
          disabledReason: "Výhodný kurz můžeš spustit jen přes den."
        }
      }
    ];

    for (const item of cases) {
      const rows = createBuildingDetailActionRows({
        buildingName: item.buildingName,
        profile: item.profile,
        mechanics: item.mechanics,
        economyState: item.economyState || { cleanMoney: 10000, dirtyMoney: 10000 },
        actionProfiles: item.actionProfiles,
        phaseState: { mapPhase: item.phase },
        now: 1000
      });
      const row = rows.find((candidate) => candidate.actionId === item.expected.actionId);

      expect(row).toMatchObject({
        disabled: true,
        disabledReason: item.expected.disabledReason,
        phaseLockLabel: item.expected.actionId === "parliament_policy_window" || item.expected.actionId === "good_rate"
          ? "Jen ve dne"
          : "Jen v noci"
      });
    }
  });

  it("keeps phase-only labels visible when the action is available", () => {
    const cases = [
      {
        buildingName: "Kasino",
        phase: "night",
        profile: { role: "High-risk praní", actions: ["Tichá herna", "VIP noc", "Podplacený inspektor"] },
        mechanics: { ...baseMechanics, mechanicsType: "casino", actionCooldowns: {} },
        actionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.kasino,
        expected: { actionId: "vip_night", phaseLockLabel: "Jen v noci", phaseLockTone: "night" }
      },
      {
        buildingName: "Parlament",
        phase: "day",
        profile: { role: "Politika", actions: ["Policy Window"] },
        mechanics: { ...baseMechanics, mechanicsType: "parliament", actionCooldowns: {} },
        actionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.parlament,
        expected: { actionId: "parliament_policy_window", phaseLockLabel: "Jen ve dne", phaseLockTone: "day" }
      }
    ];

    for (const item of cases) {
      const rows = createBuildingDetailActionRows({
        buildingName: item.buildingName,
        profile: item.profile,
        mechanics: item.mechanics,
        economyState: { cleanMoney: 10000, dirtyMoney: 10000 },
        actionProfiles: item.actionProfiles,
        phaseState: { mapPhase: item.phase },
        now: 1000
      });
      const row = rows.find((candidate) => candidate.actionId === item.expected.actionId);

      expect(row).toMatchObject({
        disabled: false,
        disabledReason: "",
        phaseLockLabel: item.expected.phaseLockLabel,
        phaseLockTone: item.expected.phaseLockTone
      });
    }
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
    expect(mechanics.find((row) => row.label === "K výběru")?.value).toBe("4/12");
    expect(mechanics.find((row) => row.label === "Večerní kurz")?.value).toBe("zrychlí nábor členů v bytových blocích");
    expect(mechanics.some((row) => row.label === "Pravidla")).toBe(false);
    expect(JSON.stringify(mechanics)).not.toContain("žádný dirty cash");
    expect(JSON.stringify({ stats, mechanics })).not.toContain("talent");
  });

  it("shows current day school population production as real phase numbers", () => {
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
        text: "DEN: clean $120/h -> $126/h · populace 0.25/min -> 0.3/min",
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
      { text: "Síť restaurací: cashflow, vliv, drby a heat +42 %", tone: "network" }
    ]);
  });

  it("keeps restaurant mechanics focused on passive network effects", () => {
    const mechanics = createBuildingDetailMechanicRows({
      buildingName: "Restaurace",
      mechanics: {
        ...baseMechanics,
        mechanicsType: "restaurant",
        restaurantNetwork: {
          incomeMultiplier: 1.08,
          influenceMultiplier: 1.09,
          rumorMultiplier: 1.12,
          heatMultiplier: 1.06
        }
      }
    });

    expect(mechanics).toEqual([
      { label: "Denní provoz", value: "Restaurace vydělává čisté peníze a přidává lokální vliv." },
      { label: "Pouliční drby", value: "Čím víc restaurací vlastníš, tím častěji se dozvíš, co se ve městě chystá." },
      { label: "Síť restaurací", value: "Více restaurací zvedá příjem, vliv a drby, ale taky trochu zvyšuje heat." }
    ]);
    expect(JSON.stringify(mechanics)).not.toContain("Vybrat tržby");
    expect(JSON.stringify(mechanics)).not.toContain("Krýt schůzky");
    expect(JSON.stringify(mechanics)).not.toContain("Posílit síť");
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

  it("shows shopping mall network effect only when the retail network is active", () => {
    const createRetailModel = (ownedShoppingMalls) => createBuildingDetailViewModel({
      district: { id: 4 },
      buildingName: "Obchodní centrum",
      displayName: "Obchodní centrum",
      profile: { role: "Market", actions: [] },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "retail",
        ownedShoppingMalls,
        effectsLabel: "Clean cash +3700/hod · Síť obchodních center: clean +5 % · vliv +4 % · heat +3 %",
        shoppingMallMarketDiscount: { discountPct: 4, feeReductionPct: 10, minFinalPriceMultiplier: 0.7 },
        shoppingMallBlackMarketDiscount: { discountPct: 2 },
        shoppingMallNetwork: {
          cleanIncomeMultiplier: ownedShoppingMalls >= 2 ? 1.05 : 1,
          dirtyIncomeMultiplier: ownedShoppingMalls >= 2 ? 1.05 : 1,
          influenceMultiplier: ownedShoppingMalls >= 2 ? 1.04 : 1,
          heatMultiplier: ownedShoppingMalls >= 2 ? 1.03 : 1
        }
      },
      buildingProfile: { setTitle: "District set" }
    });

    const singleMall = createRetailModel(1);
    const twoMalls = createRetailModel(2);

    expect(singleMall.effects.map((effect) => effect.text)).toEqual(["Clean cash +3700/hod"]);
    expect(twoMalls.effects).toContainEqual({
      text: "Síť obchodních center zvyšuje Income +5 %, Vliv +4 % i Heat +3 %.",
      tone: "network"
    });
    expect(twoMalls.effects.map((effect) => effect.text)).toEqual([
      "Clean cash +3700/hod",
      "Síť obchodních center zvyšuje Income +5 %, Vliv +4 % i Heat +3 %."
    ]);
    expect(JSON.stringify(twoMalls.effects)).not.toContain("Síť obchodních center:");
  });

  it("rewrites active network labels into one truthful effect row for every network building", () => {
    const commonProfile = { role: "Síť", actions: [] };
    const fixtures = [
      {
        buildingName: "Restaurace",
        mechanics: {
          mechanicsType: "restaurant",
          ownedRestaurants: 2,
          restaurantNetwork: { incomeMultiplier: 1.03, influenceMultiplier: 1.03, rumorMultiplier: 1.04, heatMultiplier: 1.02 },
          effectsLabel: "Clean cash +100/hod · Síť restaurací: income +3 %, vliv +3 %, drby +4 %, heat +2 %"
        },
        expected: "Síť restaurací zvyšuje Income +3 %, Vliv +3 %, Drby +4 % i Heat +2 %."
      },
      {
        buildingName: "Škola",
        mechanics: {
          mechanicsType: "school",
          ownedSchools: 2,
          schoolWholeStudents: 4,
          schoolCapacity: 20,
          schoolIsFull: false,
          schoolTimeToFullMs: 60_000,
          schoolPopulationPerMinute: 0.6,
          schoolNetwork: { populationProductionMultiplier: 1.08, studentCapacityMultiplier: 1.1, incomeMultiplier: 1.04 },
          schoolEveningCourseActive: false,
          effectsLabel: "Clean cash +100/hod · Síť škol: populace +8 %, kapacita +10 %, income +4 %"
        },
        expected: "Síť škol zvyšuje populaci +8 %, kapacitu +10 % i Income +4 %."
      },
      {
        buildingName: "Bytový blok",
        mechanics: {
          mechanicsType: "apartment-block",
          ownedApartmentBlocks: 2,
          apartmentWholePopulation: 6,
          apartmentCapacity: 58,
          apartmentPopulationPerMinute: 2.12,
          apartmentIsFull: false,
          apartmentTimeToFullMs: 60_000,
          apartmentNetwork: { populationProductionMultiplier: 1.06, capacityMultiplier: 1.08 },
          effectsLabel: "Populace +2.12/min · Síť bytových bloků: produkce +6 %, kapacita +8 %"
        },
        expected: "Síť bytových bloků zvyšuje produkci +6 % a kapacitu +8 %."
      },
      {
        buildingName: "Skladiště",
        mechanics: {
          mechanicsType: "warehouse",
          ownedWarehouses: 2,
          warehouseNetwork: { incomeMultiplier: 1.04, storageCapacityMultiplier: 1.1, heatMultiplier: 1.03 },
          warehouseCapacity: { genericResources: 1000, chemicals: 700, biomass: 700, metalParts: 800, techCore: 240, combatModule: 160, drugsAndBoosts: 440, weaponsAndDefense: 320 },
          warehouseUsage: {},
          warehouseWarnings: [],
          effectsLabel: "Clean cash +100/hod · Síť skladišť: income +4 %, kapacita +10 %, heat +3 %"
        },
        expected: "Síť skladišť zvyšuje Income +4 %, kapacitu +10 % i Heat +3 %."
      },
      {
        buildingName: "Klinika",
        mechanics: {
          mechanicsType: "clinic",
          ownedClinics: 2,
          clinicNetwork: { incomeMultiplier: 1.05, heatMultiplier: 1.03 },
          clinicRecoveryRatePct: 18,
          clinicRecoveryPool: { totalFreshAmount: 0 },
          effectsLabel: "Clean cash +100/hod · Síť klinik: income +5 %, heat +3 %"
        },
        expected: "Síť klinik zvyšuje Income +5 % a Heat +3 %."
      },
      {
        buildingName: "Garáž",
        mechanics: {
          mechanicsType: "garage",
          ownedGarages: 2,
          garageNetwork: { incomeMultiplier: 1.03, heatMultiplier: 1.02 },
          garageSupport: { cooldownReductionPct: 4, maxCooldownReductionPct: 16, fullBonusCategories: [], halfBonusCategories: [], excludedCategories: [] },
          effectsLabel: "Clean cash +100/hod · Síť garáží: income +3 %, heat +2 %"
        },
        expected: "Síť garáží zvyšuje Income +3 % a Heat +2 %."
      },
      {
        buildingName: "Autosalon",
        mechanics: {
          mechanicsType: "auto-salon",
          ownedAutoSalons: 2,
          autoSalonNetwork: { cleanIncomeMultiplier: 1.04, dirtyIncomeMultiplier: 1.04, heatMultiplier: 1.03 },
          autoSalonSupport: { mobilityBonusPct: 6, cooldownReductionPct: 3, escapeChanceBonusPct: 4, combinedGarageDealerMaxReductionPct: 22 },
          effectsLabel: "Clean cash +100/hod · Síť autosalonů: clean +4 %, dirty +4 %, heat +3 %"
        },
        expected: "Síť autosalonů zvyšuje clean +4 %, dirty +4 % i Heat +3 %."
      },
      {
        buildingName: "Fitness Club",
        mechanics: {
          mechanicsType: "fitness-club",
          ownedFitnessClubs: 2,
          fitnessClubNetwork: { incomeMultiplier: 1.05, heatMultiplier: 1.03 },
          fitnessClubSupport: { attackStrengthBonusPct: 6, defenseStrengthBonusPct: 4, combinedRecruitmentFitnessAttackCapPct: 24, combinedRecruitmentFitnessDefenseCapPct: 18 },
          effectsLabel: "Clean cash +100/hod · Síť fitness clubů: income +5 %, heat +3 %"
        },
        expected: "Síť fitness clubů zvyšuje Income +5 % a Heat +3 %."
      },
      {
        buildingName: "Směnárna",
        mechanics: {
          mechanicsType: "exchange",
          ownedExchangeOffices: 2,
          exchangeNetwork: { incomeMultiplier: 1.08, launderingLimitMultiplier: 1.1, heatMultiplier: 1.04 },
          exchangeLaunderingCapacity: 6600,
          exchangeAuditRisk: "4 %",
          effectsLabel: "Clean cash +100/hod · Síť směnáren: výnos +8 %, limit praní +10 %, heat +4 %"
        },
        expected: "Síť směnáren zvyšuje výnos +8 %, limit praní +10 % i Heat +4 %."
      },
      {
        buildingName: "Herna",
        mechanics: {
          mechanicsType: "arcade",
          ownedArcades: 2,
          arcadeNetwork: { incomeMultiplier: 1.05, launderingLimitMultiplier: 1.06, heatMultiplier: 1.03 },
          arcadeLaunderingCapacity: 4028,
          arcadeAuditRisk: "3 %",
          effectsLabel: "Clean cash +100/hod · Síť heren: income +5 %, limit praní +6 %, heat +3 %"
        },
        expected: "Síť heren zvyšuje Income +5 %, limit praní +6 % i Heat +3 %."
      },
      {
        buildingName: "Pašovací tunel",
        mechanics: {
          mechanicsType: "smuggling-tunnel",
          ownedSmugglingTunnels: 2,
          smugglingTunnelNetwork: { dirtyProductionMultiplier: 1.05, heatMultiplier: 1.04, passiveHeatMultiplier: 1.04 },
          smugglingDirtyPerMinute: 56.7,
          smugglingDealerSupplyBonusPct: 8,
          smugglingOpenChannelActive: false,
          effectsLabel: "Dirty cash +100/hod · Síť pašovacích tunelů: dirty +5 %, heat +4 %"
        },
        expected: "Síť pašovacích tunelů zvyšuje dirty tok +5 % a Heat +4 %."
      },
      {
        buildingName: "Rekrutační centrum",
        mechanics: {
          mechanicsType: "recruitment-center",
          ownedRecruitmentCenters: 2,
          recruitmentCenterNetwork: { incomeMultiplier: 1.03, heatMultiplier: 1.03 },
          recruitmentCenterSupport: {
            populationProductionBonusPct: 6,
            apartmentCapacityBonusPct: 8,
            attackWeaponStrengthBonusPct: 4,
            defenseItemStrengthBonusPct: 3,
            cameraStrengthBonusPct: 3
          },
          effectsLabel: "Clean cash +100/hod · Síť rekrutačních center: income +3 %, heat +3 %"
        },
        expected: "Síť rekrutačních center zvyšuje Income +3 % a Heat +3 %."
      }
    ];

    for (const fixture of fixtures) {
      const model = createBuildingDetailViewModel({
        district: { id: 4 },
        buildingName: fixture.buildingName,
        displayName: fixture.buildingName,
        profile: commonProfile,
        mechanics: {
          ...baseMechanics,
          ...fixture.mechanics
        },
        buildingProfile: { setTitle: "District set" }
      });
      const effectTexts = model.effects.map((effect) => effect.text);

      expect(effectTexts).toContain(fixture.expected);
      expect(effectTexts.some((text) => /^Síť [^:]+:/u.test(text))).toBe(false);
    }
  });

  it("does not show inactive single-building network bonuses as effects", () => {
    const model = createBuildingDetailViewModel({
      buildingName: "Restaurace",
      displayName: "Restaurace",
      profile: { role: "Lokální cashflow", actions: [] },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "restaurant",
        ownedRestaurants: 1,
        restaurantNetwork: { incomeMultiplier: 1, influenceMultiplier: 1, rumorMultiplier: 1, heatMultiplier: 1 },
        effectsLabel: "Clean cash +100/hod · Síť restaurací: income +0 %, vliv +0 %, drby +0 %, heat +0 %"
      }
    });

    expect(model.effects.map((effect) => effect.text)).toEqual(["Clean cash +100/hod"]);
  });

  it("renders restaurant stats without zero dirty income, fake upgrade, or raw network multipliers", () => {
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
    expect(rows.find((row) => row.label === "Čisté / hod")?.value).toBe("+$360");
    expect(rows.find((row) => row.label === "Síť")?.value).toBe("income +8 % · vliv +9 % · drby +12 % · heat +6 %");
    expect(rows.some((row) => row.label === "Dirty / min")).toBe(false);
    expect(rows.some((row) => row.label === "Upgrade")).toBe(false);
    expect(JSON.stringify(rows)).not.toContain("x1.");
  });

  it("renders commercial network stats as percent bonuses instead of raw multipliers", () => {
    const fixtures = [
      {
        buildingName: "Směnárna",
        mechanics: {
          ...baseMechanics,
          mechanicsType: "exchange",
          cleanHourly: 4200,
          dirtyHourly: 5700,
          dailyHeat: 70,
          ownedExchangeOffices: 4,
          exchangeLaunderingCapacity: 7800,
          exchangeAuditRisk: "12 %",
          exchangeNetwork: { incomeMultiplier: 1.24, launderingLimitMultiplier: 1.3, heatMultiplier: 1.12 }
        },
        expectedNetwork: "výnos +24 % · limit praní +30 % · heat +12 %"
      },
      {
        buildingName: "Autosalon",
        mechanics: {
          ...baseMechanics,
          mechanicsType: "auto-salon",
          cleanHourly: 2145,
          dirtyHourly: 650,
          dailyHeat: 60,
          dailyInfluence: 24,
          ownedAutoSalons: 3,
          autoSalonNetwork: { cleanIncomeMultiplier: 1.08, dirtyIncomeMultiplier: 1.08, heatMultiplier: 1.06 },
          autoSalonSupport: { cooldownReductionPct: 4.5, escapeChanceBonusPct: 6, combinedGarageDealerMaxReductionPct: 22 }
        },
        expectedNetwork: "clean +8 % · dirty +8 % · heat +6 %"
      },
      {
        buildingName: "Fitness Club",
        mechanics: {
          ...baseMechanics,
          mechanicsType: "fitness-club",
          cleanHourly: 4320,
          dailyHeat: 57.6,
          ownedFitnessClubs: 3,
          fitnessClubNetwork: { incomeMultiplier: 1.1, heatMultiplier: 1.06 },
          fitnessClubSupport: {
            attackStrengthBonusPct: 9,
            defenseStrengthBonusPct: 6,
            combinedRecruitmentFitnessAttackCapPct: 24,
            combinedRecruitmentFitnessDefenseCapPct: 18
          }
        },
        expectedNetwork: "income +10 % · heat +6 %"
      }
    ];

    for (const fixture of fixtures) {
      const rows = createBuildingDetailStatRows({
        buildingName: fixture.buildingName,
        mechanics: fixture.mechanics
      });

      expect(rows.find((row) => row.label === "Síť")?.value).toBe(fixture.expectedNetwork);
      expect(rows.some((row) => row.label === "Upgrade")).toBe(false);
      expect(JSON.stringify(rows)).not.toContain("x1.");
    }
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
        cleanHourly: 3100,
        dailyHeat: 85,
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
    expect(clinicModel.stats.map((row) => row.label)).toEqual(["Clean / hod", "Heat / den", "Recovery rate", "Recovery pool", "Kliniky"]);
    expect(clinicModel.stats.find((row) => row.label === "Clean / hod")?.value).toBe("+$3100");
    expect(clinicModel.stats.find((row) => row.label === "Heat / den")?.value).toBe("+85");
    expect(clinicModel.mechanics.find((row) => row.label === "Stabilizace")?.value).toBe("připravená");
    expect(clinicModel.mechanics.some((row) => row.label === "Expirace poolu")).toBe(false);
    expect(clinicModel.actions).toHaveLength(1);

    expect(createBuildingDetailInfoRows({ buildingName: "Klinika", mechanics: clinicModel })).toEqual([]);
  });

  it("keeps clinic empty recovery wording concrete without expiry filler", () => {
    const model = createBuildingDetailViewModel({
      buildingName: "Klinika",
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
    });

    expect(model.mechanics.find((row) => row.label === "Stabilizace")?.value).toBe("Čeká na ztráty tvojich členů za posledních 90min");
    expect(model.mechanics.some((row) => row.label === "Expirace poolu" || row.value === "nic nečeká")).toBe(false);
  });

  it("shows garage-reduced cooldowns for supported building actions", () => {
    const model = createBuildingDetailViewModel({
      district: { id: 9 },
      buildingName: "Klinika",
      profile: {
        role: "Recovery",
        info: "Klinika drží gang při životě.",
        actions: ["Stabilizační protokol"]
      },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "clinic",
        cleanHourly: 3100,
        dailyHeat: 85,
        ownedClinics: 2,
        clinicNetwork: { incomeMultiplier: 1.1, heatMultiplier: 1.05 },
        clinicRecoveryRatePct: 15,
        clinicRecoveryPool: {
          totalFreshAmount: 2,
          fresh: [{ itemId: "gang-members", amount: 2 }],
          label: "2 položky",
          nextExpiryMs: 120000
        },
        garageSupport: {
          cooldownReductionPct: 10,
          maxCooldownReductionPct: 16,
          fullBonusCategories: ["attackPreparation"],
          halfBonusCategories: ["clinicRecovery"],
          excludedCategories: []
        }
      },
      actionProfiles: [{ clinicStabilizationProtocol: true, cleanCost: 1200, cooldownMs: 18 * 60 * 1000 }]
    });

    expect(model.actions[0]).toMatchObject({
      baseCooldownMs: 18 * 60 * 1000,
      effectiveCooldownMs: 17 * 60 * 1000 + 6 * 1000,
      garageCooldownReductionPct: 5,
      cooldownLabel: "Cooldown 17m 06s (-54s)"
    });
  });

  it("sums garage and auto salon cooldown reductions on supported building actions", () => {
    const model = createBuildingDetailViewModel({
      district: { id: 9 },
      buildingName: "Klinika",
      profile: {
        role: "Recovery",
        info: "Klinika drží gang při životě.",
        actions: ["Stabilizační protokol"]
      },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "clinic",
        cleanHourly: 3100,
        dailyHeat: 85,
        ownedClinics: 2,
        clinicNetwork: { incomeMultiplier: 1.1, heatMultiplier: 1.05 },
        clinicRecoveryRatePct: 15,
        clinicRecoveryPool: {
          totalFreshAmount: 2,
          fresh: [{ itemId: "population", amount: 2 }],
          label: "2 položky",
          nextExpiryMs: 120000
        },
        garageSupport: {
          cooldownReductionPct: 10,
          maxCooldownReductionPct: 16,
          fullBonusCategories: ["attackPreparation"],
          halfBonusCategories: ["clinicRecovery"],
          excludedCategories: []
        },
        autoSalonSupport: {
          cooldownReductionPct: 6,
          maxCooldownReductionPct: 10.5,
          combinedGarageDealerMaxReductionPct: 22,
          fullBonusCategories: ["districtRobbery", "districtOccupy", "attackPreparation"],
          halfBonusCategories: [],
          smallBonusCategories: ["clinicEvacuationRecovery"],
          excludedCategories: []
        }
      },
      actionProfiles: [{ clinicStabilizationProtocol: true, cleanCost: 1200, cooldownMs: 18 * 60 * 1000 }]
    });

    expect(model.actions[0]).toMatchObject({
      baseCooldownMs: 18 * 60 * 1000,
      effectiveCooldownMs: Math.ceil(18 * 60 * 1000 * (1 - 0.065)),
      garageCooldownReductionPct: 5,
      autoSalonCooldownReductionPct: 1.5,
      combinedCooldownReductionPct: 6.5,
      cooldownLabel: "Cooldown 16m 50s (-1m 11s)"
    });
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

  it("shows active school evening course boost in apartment block effects", () => {
    const model = createBuildingDetailViewModel({
      buildingName: "Bytový blok",
      profile: { role: "Členové gangu", actions: ["Vybrat obyvatele"] },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "apartment-block",
        apartmentWholePopulation: 4,
        apartmentCapacity: 20,
        apartmentPopulationPerMinute: 0.48,
        apartmentIsFull: false,
        apartmentTimeToFullMs: 120000,
        schoolApartmentBoostActive: true,
        schoolApartmentBoostPct: 60,
        schoolApartmentBoostRemainingMs: 90000,
        canCollect: false,
        ownedApartmentBlocks: 1,
        apartmentNetwork: {
          populationProductionMultiplier: 1,
          capacityMultiplier: 1
        }
      },
      actionProfiles: [{ apartmentCollectPopulation: true }]
    });

    expect(model.effects).toContainEqual({
      text: "Večerní kurz: nábor členů +60 % · zbývá 1m 30s",
      tone: "population"
    });
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
    expect(model.typeLabel).toBe("Logistika");
    expect(model.countLabel).toBe("Počet: 3");
    expect(model.meta).toBe("");
    expect(model.collect.visible).toBe(false);
    expect(model.upgrade.visible).toBe(false);
    expect(model.upgrade.disabled).toBe(true);
    expect(model.stats.map((row) => row.label)).toEqual(["Clean / min", "Heat / min", "Garáže", "Cooldowny"]);
    expect(model.mechanics.find((row) => row.label === "Síť garáží")?.value).toBe("Každá další garáž zvedá čistý výnos o +6 % a heat o +4 %.");
    const fullCooldownBonus = model.mechanics.find((row) => row.label === "Plný cooldown bonus")?.value || "";
    expect(fullCooldownBonus).toBe("Nejvíc zkracuje útoky, obsazení districtů a district loupeže.");
    expect(fullCooldownBonus).not.toContain("pohyb gangu");
    expect(fullCooldownBonus).not.toContain("zásob");
    expect(model.mechanics.find((row) => row.label === "Upgrade")).toBeUndefined();
    expect(model.actions).toEqual([]);
    expect(JSON.stringify(model.effects)).not.toContain("Počet:");

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
        expectedBadge: "Cooldowny",
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

  it("keeps auto salon mechanics aligned with implemented actions", () => {
    const model = createBuildingDetailViewModel({
      district: { id: 4 },
      buildingName: "Autosalon",
      profile: { role: "Cooldowny", info: "Autosalon drží akce rychlejší.", actions: [] },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "auto-salon",
        cleanHourly: 2145,
        dirtyHourly: 650,
        dailyHeat: 60,
        dailyInfluence: 24,
        effectsLabel: "Clean cash +$2145/hod · Dirty cash +$650/hod · Heat +60/den · Vliv +24/den",
        ownedAutoSalons: 2,
        autoSalonNetwork: { cleanIncomeMultiplier: 1.1, dirtyIncomeMultiplier: 1.05, heatMultiplier: 1.02 },
        autoSalonSupport: { mobilityBonusPct: 8, cooldownReductionPct: 4, escapeChanceBonusPct: 3, combinedGarageDealerMaxReductionPct: 18 }
      }
    });
    const copy = JSON.stringify({ stats: model.stats, mechanics: model.mechanics });

    expect(model.badge).toBe("Cooldowny");
    expect(model.stats).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Čisté / hod", value: "+$2145" }),
      expect.objectContaining({ label: "Špinavé / hod", value: "+$650" }),
      expect.objectContaining({ label: "Heat / den", value: "+60" }),
      expect.objectContaining({ label: "Vliv / hod", value: "+1" })
    ]));
    expect(model.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: "Vliv +24/den" })
    ]));
    expect(model.stats.map((row) => row.label)).not.toContain("Mobilita");
    expect(model.mechanics.find((row) => row.label === "Rychlejší akce")?.value).toContain("Vykrást district");
    expect(model.mechanics.find((row) => row.label === "Podpora zázemí")?.value).toContain("Stabilizační protokol");
    expect(model.mechanics.find((row) => row.label === "Únik po failu")?.value).toContain("neúspěšném útoku");
    expect(copy).not.toContain("návrat");
    expect(copy).not.toContain("ústup");
    expect(copy).not.toContain("cesta k útoku");
    expect(copy).not.toContain("obranný přesun");
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
    expect(rows[0].buttonCostLabel).toBe("$1800 clean cash");
    expect(rows[0].cooldownMs).toBe(30 * 60 * 1000);
    expect(rows[0].rewardSummary).toContain("Trvání 15m 00s");
  });

  it("keeps smuggling tunnel open channel action button server-backed and player-facing", () => {
    const rows = createBuildingDetailActionRows({
      buildingName: "Pašovací tunel",
      profile: { actions: ["Otevřít kanál"] },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "smuggling-tunnel",
        smugglingOpenChannelActive: false,
        smugglingOpenChannelRemainingMs: 0
      },
      economyState: { cleanMoney: 2000, dirtyMoney: 1000 },
      actionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES["pasovaci tunel"],
      now: 1000
    });

    expect(rows[0]).toMatchObject({
      actionId: "open_channel",
      buildingTypeId: "smuggling_tunnel",
      buttonCostLabel: "$1800 clean cash",
      disabled: false
    });
    expect(rows[0].rewardSummary).toContain("Pouliční dealeři cena +12%");
    expect(rows[0].rewardSummary).toContain("Pouliční dealeři čas prodeje -10%");
    expect(rows[0].riskSummary).toContain("Pouliční incident +5%");
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
    expect(rows[0].rewardSummary).toContain("Slot Pouličních dealerů prodá vybranou látku");
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

  it("keeps restaurant button text aligned with configured rewards, heat, influence, and cooldown", () => {
    const rows = createBuildingDetailActionRows({
      buildingName: "Restaurace",
      profile: { actions: ["Vybrat tržby", "Krýt schůzky", "Posílit lokální síť"] },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "restaurant",
        cleanHourly: 1800,
        dirtyHourly: 1200,
        dailyInfluence: 80,
        actionCooldowns: {}
      },
      economyState: { cleanMoney: 0, dirtyMoney: 0 },
      actionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.restaurace,
      now: 1000
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      actionId: "restaurant_collect_revenue",
      rewardSummary: "Clean +$869 · Dirty cash +$550 · Heat +5 · Cooldown 30m 00s",
      riskSummary: "Heat +5",
      cooldownLabel: "Cooldown 30m 00s"
    });
    expect(rows[1]).toMatchObject({
      actionId: "restaurant_cover_meetings",
      rewardSummary: "Vliv +8 · Heat +4 · Clean $1800/h -> $2124/h · Dirty $1200/h -> $1416/h · Trvání 30m 00s · Cooldown 45m 00s",
      riskSummary: "Heat +4",
      cooldownLabel: "Cooldown 45m 00s"
    });
    expect(rows[2]).toMatchObject({
      actionId: "restaurant_local_network",
      rewardSummary: "Vliv +4 · Heat +8 · Vliv 80/den -> 89/den · Trvání 30m 00s · Cooldown 30m 00s",
      riskSummary: "Heat +8",
      cooldownLabel: "Cooldown 30m 00s"
    });
  });

  it("keeps exchange office action text aligned with network laundering capacity", () => {
    const rows = createBuildingDetailActionRows({
      buildingName: "Směnárna",
      profile: { actions: ["Výhodný kurz"] },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "exchange",
        exchangeLaunderingCapacity: 7800,
        exchangeNetwork: {
          incomeMultiplier: 1.32,
          launderingLimitMultiplier: 1.3,
          heatMultiplier: 1.12
        },
        actionCooldowns: {}
      },
      economyState: { cleanMoney: 0, dirtyMoney: 10000 },
      actionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.smenarna,
      now: 1000
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actionId: "good_rate",
      rewardSummary: "Vypere 16% dirty cash, max $7800 · fee 12% · Vliv +3 · Heat +12 · Cooldown 18m 00s",
      riskSummary: "Heat +12 · Audit +4%",
      cooldownLabel: "Cooldown 18m 00s"
    });
  });

  it("uses player-facing exchange office mechanic copy", () => {
    const rows = createBuildingDetailMechanicRows({
      buildingName: "Směnárna",
      mechanics: {
        ...baseMechanics,
        mechanicsType: "exchange",
        exchangeLaunderingCapacity: 7800,
        exchangeNetwork: {
          incomeMultiplier: 1.24,
          launderingLimitMultiplier: 1.3,
          heatMultiplier: 1.12
        },
        exchangeAuditRisk: "12 %"
      }
    });

    expect(rows).toEqual([
      { label: "Denní praní", value: "Výhodný kurz funguje jen přes den a vypere část aktuálního dirty cash." },
      { label: "Limit směny", value: "Základ je 16 % dirty cash, síť směnáren zvedá strop na $7800." },
      { label: "Síť směnáren", value: "Více směnáren zvedá výnos o +24 % a limit praní o +30 %." },
      { label: "Riziko kontroly", value: "12 % audit risk · heat sítě +12 %" }
    ]);
  });

  it("shows exchange office map count from the shared runtime config", () => {
    const model = createBuildingDetailViewModel({
      district: { id: 4 },
      buildingName: "Směnárna",
      profile: {
        role: "Praní peněz",
        info: "Směnárna pere menší částky bezpečněji.",
        actions: ["Výhodný kurz"]
      },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "exchange",
        ownedExchangeOffices: 4,
        exchangeNetwork: {
          incomeMultiplier: 1.24,
          launderingLimitMultiplier: 1.3,
          heatMultiplier: 1.12
        },
        exchangeLaunderingCapacity: 7800,
        exchangeAuditRisk: "12 %",
        actionCooldowns: {}
      },
      actionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.smenarna,
      now: 1000
    });

    expect(model.stats).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Směnárny", value: "4/11" }),
      expect.objectContaining({ label: "Kapacita praní", value: "$7800" })
    ]));
  });

  it("uses player-facing casino mechanic copy with laundering cap, fee, and audit window", () => {
    const rows = createBuildingDetailMechanicRows({
      buildingName: "Kasino",
      mechanics: {
        ...baseMechanics,
        mechanicsType: "casino",
        casinoLaunderingCapacity: 22500,
        casinoLaunderingFeePct: 7
      }
    });

    expect(rows).toEqual([
      { label: "Tichá herna", value: "Vypere část dirty cash až do $22500 za 7% fee." },
      { label: "VIP noc", value: "Noční boost zvedne clean, dirty, vliv, heat a audit risk." },
      { label: "Inspektor", value: "Drahá ochrana sníží heat a audit risk, ale může selhat." },
      { label: "Riziko auditu", value: "Kontroly sledují objem vypraných peněz v posledních 30 minutách." }
    ]);
  });

  it("keeps casino quiet backroom preview aligned with upgraded laundering capacity and fee", () => {
    const rows = createBuildingDetailActionRows({
      buildingName: "Kasino",
      profile: { actions: ["Tichá herna", "VIP noc", "Podplacený inspektor"] },
      mechanics: {
        ...baseMechanics,
        mechanicsType: "casino",
        casinoLaunderingCapacity: 22500,
        casinoLaunderingFeePct: 7,
        actionCooldowns: {}
      },
      economyState: { cleanMoney: 10000, dirtyMoney: 50000 },
      actionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.kasino,
      now: 1000
    });

    expect(rows[0]).toMatchObject({
      actionId: "quiet_backroom",
      rewardSummary: "Vypere 24% dirty cash, max $22500 · fee 7% · Vliv +3 · Heat +7 · Trvání 10m 00s · Cooldown 14m 00s",
      riskSummary: "Heat +7 · Audit +6%",
      cooldownLabel: "Cooldown 14m 00s"
    });
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
    const createRows = ({ cleanMoney = 1000, active = false, cooldownUntil = 0 } = {}) => createBuildingDetailActionRows({
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

    const withoutCash = createRows({ cleanMoney: 999 });
    expect(withoutCash[0].disabled).toBe(true);
    expect(withoutCash[0].disabledReason).toContain("$1000");

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
        clinicRecoveryRatePct: 15,
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
      disabledReason: "Žádné ztráty k léčbě."
    });

    const ready = createRows({ fresh: [{ itemType: "gang-members", amount: 10 }, { itemType: "population", amount: 20 }] });
    expect(ready[0].disabled).toBe(false);
    expect(ready[0].rewardSummary).toBe("Návrat z léčby: Populace +4");
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
        dailyHeat: 100.8,
        ownedRecruitmentCenters: 4,
        recruitmentCenterNetwork: {
          incomeMultiplier: 1.09,
          heatMultiplier: 1.09
        },
        recruitmentCenterSupport: {
          populationProductionBonusPct: 12,
          apartmentCapacityBonusPct: 16,
          attackWeaponStrengthBonusPct: 8,
          defenseItemStrengthBonusPct: 6,
          cameraStrengthBonusPct: 6,
          alarmStrengthBonusPct: 6,
          combinedCameraAlarmCapPct: 50
        }
      }
    });

    expect(model.title).toBe("Rekrutační centrum");
    expect(model.badge).toBe("Nábor");
    expect(model.countLabel).toBe("Počet: 4");
    expect(model.actions).toEqual([]);
    expect(model.hideMechanicsSection).toBe(true);
    expect(model.stats).toEqual(expect.arrayContaining([
      { label: "Počet", value: "4/16" },
      { label: "Population", value: "+12% / cap +16%" },
      { label: "Boj", value: "útok +8% · obrana +6%" }
    ]));
    expect(model.mechanics).toEqual([]);
    expect(model.effects).toEqual(expect.arrayContaining([
      { text: "Population produkce +12 %", tone: "population" },
      { text: "Kapacita bloků +16 %", tone: "network" },
      { text: "Síla zbraní +8 %", tone: "attack" },
      { text: "Obrana +6 %", tone: "defense" },
      { text: "Kamery/alarmy +6 %", tone: "defense" },
      { text: "Síť rekrutačních center zvyšuje Income +9 % a Heat +9 %.", tone: "network" }
    ]));
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
