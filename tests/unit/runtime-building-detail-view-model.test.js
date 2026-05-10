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
    expect(createBuildingDetailMechanicRows({ buildingName: "Škola", mechanics: schoolMechanics }).some((row) => row.label === "Talent Pool")).toBe(true);
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
    expect(rows.map((row) => row.label)).toEqual(["Lokální zásobník", "Produkce", "Síť"]);
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

  it("keeps shopping mall passive market info in the info-tab view model", () => {
    const rows = createBuildingDetailInfoRows({
      buildingName: "Obchodní centrum",
      profile: { role: "Market" },
      mechanics: {
        ...baseMechanics,
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

    expect(rows.find((row) => row.label === "Pasivní market bonus")?.value).toBe("Sleva se aplikuje automaticky bez speciální akce.");
  });
});
