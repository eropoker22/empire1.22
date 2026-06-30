import { describe, expect, it } from "vitest";
import {
  createBuildingDetailActionRows,
  createBuildingDetailViewModel
} from "../../page-assets/js/app/runtime/buildingDetailViewModel.js";
import {
  DISTRICT_BUILDING_DETAIL_PROFILES,
  DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES
} from "../../page-assets/js/app/runtime/buildingDetailData.js";
import {
  createBuildingSpecialActionAuditRows
} from "../../page-assets/js/app/runtime/buildingSpecialActionRegistry.js";
import {
  createBaseBuildingMechanics,
  expectNoGenericBuildingCardCopy
} from "./helpers/building-card-test-helpers.js";

describe("next zone building card readiness", () => {
  it("builds existing Industrial card data without runtime errors or generic upgrade copy", () => {
    const fixtures = [
      createIndustrialFixture("Sklad", "sklad", {
        mechanicsType: "warehouse",
        ownedWarehouses: 2,
        warehouseNetwork: { incomeMultiplier: 1.05, storageCapacityMultiplier: 1.08, heatMultiplier: 1.02 },
        warehouseCapacity: createWarehouseResourceMap(120),
        warehouseUsage: createWarehouseResourceMap(10),
        warehouseWarnings: []
      }),
      createIndustrialFixture("Energetická stanice", "energeticka stanice", {
        mechanicsType: "power-plant"
      }),
      createIndustrialFixture("Recyklační centrum", "recyklacni centrum", {
        mechanicsType: "recycling-center",
        recyclingSalvagePool: { fresh: [], totalFreshAmount: 0 }
      }),
      createIndustrialFixture("Továrna", "tovarna", {
        mechanicsType: "generic"
      }),
      createIndustrialFixture("Zbrojovka", "zbrojovka", {
        mechanicsType: "generic"
      })
    ];

    for (const fixture of fixtures) {
      const model = createBuildingDetailViewModel(fixture);
      expect(model.title).toBeTruthy();
      expect(model.stats.length).toBeGreaterThan(0);
      expectNoGenericBuildingCardCopy(model);
      for (const action of model.actions) {
        expect(action.actionId).toBeTruthy();
      }
    }
  });

  it("keeps Downtown server actions implemented through server-authoritative handlers instead of legacy fallback", () => {
    const auditRows = createBuildingSpecialActionAuditRows();
    const serverActionIds = [
      "speculative_buy",
      "market_pressure",
      "insider_window",
      "liquidity_injection",
      "frozen_accounts",
      "currency_intervention",
      "official_cover",
      "city_contract",
      "emergency_decree",
      "backroom_pressure",
      "quiet_negotiation",
      "media_screen",
      "express_import",
      "black_charter",
      "evacuation_corridor"
    ];

    for (const actionId of serverActionIds) {
      const row = auditRows.find((candidate) => candidate.actionId === actionId);
      expect(row).toMatchObject({
        actionId,
        status: "implemented",
        hasRuntimeHandler: true,
        hasServerConfig: true
      });
      expect(row?.note).toBe("Server-authoritative handler");
    }

    const stockExchangeRows = createBuildingDetailActionRows({
      buildingName: "Burza",
      profile: DISTRICT_BUILDING_DETAIL_PROFILES.burza,
      mechanics: createBaseBuildingMechanics({ mechanicsType: "stock-exchange" }),
      economyState: { cleanMoney: 50_000, dirtyMoney: 50_000 },
      actionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.burza
    });
    expect(stockExchangeRows).toHaveLength(3);
    expect(stockExchangeRows.every((row) => row.disabled)).toBe(false);
    expect(stockExchangeRows.every((row) => row.handlerId === "server-run-building-action")).toBe(true);
  });

  it("keeps Park action profiles aligned with UI rows and stable action ids", () => {
    for (const buildingKey of ["pasovaci tunel", "poulicni dealeri", "strip club"]) {
      const profile = DISTRICT_BUILDING_DETAIL_PROFILES[buildingKey];
      const actionProfiles = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES[buildingKey];
      const rows = createBuildingDetailActionRows({
        buildingName: buildingKey,
        profile,
        mechanics: createBaseBuildingMechanics({
          mechanicsType: buildingKey === "pasovaci tunel" ? "smuggling-tunnel" : buildingKey === "poulicni dealeri" ? "street-dealers" : "strip-club",
          clinicRecoveryPool: { fresh: [], totalFreshAmount: 0 },
          smugglingOpenChannelActive: false,
          smugglingOpenChannelRemainingMs: 0,
          actionCooldowns: {}
        }),
        economyState: { cleanMoney: 50_000, dirtyMoney: 50_000 },
        actionProfiles
      });

      expect(profile.actions).toHaveLength(actionProfiles.length);
      expect(rows).toHaveLength(actionProfiles.length);
      expect(rows.every((row) => row.actionId && row.title)).toBe(true);
      expectNoGenericBuildingCardCopy(rows);
    }
  });

  it("records current data gap for Datové centrum instead of faking a card profile", () => {
    expect(DISTRICT_BUILDING_DETAIL_PROFILES["datove centrum"]).toBeUndefined();
    expect(DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES["datove centrum"]).toBeUndefined();
  });
});

function createIndustrialFixture(buildingName, profileKey, mechanicsOverrides = {}) {
  return {
    buildingName,
    displayName: buildingName,
    profile: DISTRICT_BUILDING_DETAIL_PROFILES[profileKey] || { role: "Industrial", actions: [] },
    mechanics: createBaseBuildingMechanics({
      cleanHourly: 2_700,
      dirtyHourly: 0,
      dailyHeat: 86.4,
      dailyInfluence: 0,
      mechanicsType: "generic",
      ...mechanicsOverrides
    }),
    actionProfiles: DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES[profileKey] || [],
    buildingProfile: { typeKey: "industrial", tier: "mid", setTitle: "Industrial" },
    economyState: { cleanMoney: 50_000, dirtyMoney: 50_000 }
  };
}

function createWarehouseResourceMap(value) {
  return {
    genericResources: value,
    chemicals: value,
    biomass: value,
    metalParts: value,
    techCore: value,
    combatModule: value,
    drugsAndBoosts: value,
    weaponsAndDefense: value
  };
}
