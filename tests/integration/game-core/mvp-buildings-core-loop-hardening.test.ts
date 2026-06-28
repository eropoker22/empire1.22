import { describe, expect, it } from "vitest";
import {
  applyCommand,
  appendCityFeedEventsFromCoreEvents,
  createConflictReportViews,
  createPoliceReadModel,
  runTick
} from "@empire/game-core";
import { getAllPublicBuildingDefinitions, resolveModeConfig } from "@empire/game-config";
import {
  createCoreStateWithFixedBuildingFixture
} from "../../fixtures/game-state-fixtures";
import {
  createCraftItemCommandFixture,
  createRunBuildingActionCommandFixture
} from "../../fixtures/command-fixtures";

const context = {
  config: resolveModeConfig("free")
};

const MAFIAN_HEAT_GAIN_MULTIPLIER = 0.96;

const mafianHeat = (baseHeat: number): number => baseHeat * MAFIAN_HEAT_GAIN_MULTIPLIER;

const MVP_BUILDING_IDS = [
  "apartment_block",
  "pharmacy",
  "drug_lab",
  "factory",
  "armory",
  "warehouse",
  "exchange",
  "casino",
  "arcade",
  "smuggling_tunnel",
  "restaurant",
  "convenience_store",
  "clinic",
  "fitness_club",
  "power_station"
];

describe("MVP buildings core loop hardening", () => {
  it("keeps every MVP building in catalog, free fixed config, and the expected core loop config", () => {
    const catalog = Object.fromEntries(
      getAllPublicBuildingDefinitions().map((definition) => [definition.buildingTypeId, definition])
    );
    const fixedBuildings = context.config.balance.fixedBuildings ?? {};
    const actions = context.config.balance.buildingActions ?? {};
    const productionBuildings = context.config.balance.productionBuildings ?? {};
    const craftBuildings = context.config.balance.craftBuildings ?? {};

    for (const buildingId of MVP_BUILDING_IDS) {
      expect(catalog[buildingId]?.label, buildingId).toBeTruthy();
      expect(fixedBuildings[buildingId], buildingId).toBeTruthy();
    }

    expect(productionBuildings).toMatchObject({
      pharmacy: { resourceKey: "chemicals" },
      factory: { resourceKey: "metal-parts" },
      drug_lab: { resourceKey: "neon-dust" }
    });
    expect(craftBuildings.armory?.recipes.pistol).toMatchObject({
      outputResourceKey: "pistol",
      inputCosts: { "metal-parts": 3, "tech-core": 1 }
    });
    expect(craftBuildings.factory?.recipes["tech-core"]?.outputResourceKey).toBe("tech-core");
    expect(craftBuildings.drug_lab?.recipes["pulse-shot"]?.outputResourceKey).toBe("pulse-shot");
    expect(actions.collect_population).toMatchObject({
      buildingType: "apartment_block",
      heatGain: 0
    });
    expect(actions.good_rate).toMatchObject({
      buildingType: "exchange"
    });
    expect(actions.backup_grid_switch).toMatchObject({
      buildingType: "power_station"
    });
  });

  it("returns a safe unified building action payload and exposes heat through PoliceReadModel", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("exchange", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 10_000
      }
    });

    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:mvp:exchange:good-rate",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "good_rate"
        }
      }),
      context
    );
    const report = createConflictReportViews(result.nextState, { playerId: "player:1", limit: 1 })[0];
    const police = createPoliceReadModel(result.nextState, "player:1", context);

    expect(result.errors).toEqual([]);
    expect(report?.reportType).toBe("building-action");
    if (report?.reportType !== "building-action") {
      throw new Error("Expected building action report.");
    }
    expect(report).toMatchObject({
      reportType: "building-action",
      success: true,
      buildingId: building.id,
      buildingTypeId: "exchange",
      buildingType: "exchange",
      buildingActionId: "good_rate",
      actionId: "good_rate",
      cashDelta: 1408,
      dirtyCashDelta: -1600,
      heatDelta: mafianHeat(4),
      influenceDelta: 1.5,
      producedItems: { cash: 1408 },
      consumedItems: { "dirty-cash": 1600 },
      resourceDelta: {
        cash: 1408,
        "dirty-cash": -1600
      },
      message: expect.stringContaining("Výhodný kurz"),
      policeImpact: {
        heatDelta: mafianHeat(4),
        playerHeat: mafianHeat(4)
      }
    });
    expect(Number.isNaN(report.cashDelta)).toBe(false);
    expect(police.heat).toBe(mafianHeat(4));
    expect(police.totalHeat).toBeGreaterThanOrEqual(mafianHeat(8));
    expect(police.heatSources.map((source) => source.kind)).toContain("player");
    expect(police.heatSources.map((source) => source.kind)).toContain("district");
  });

  it("creates one deduped city feed event for significant drug lab building actions", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("drug_lab", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0,
        chemicals: 10,
        biomass: 6
      }
    });

    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:mvp:drug-lab:neon",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "produce_neon_dust"
        }
      }),
      context
    );
    const once = Object.values(result.nextState.cityFeedEventsById ?? {});
    const duplicateAppend = appendCityFeedEventsFromCoreEvents(result.nextState, result.events);
    const twice = Object.values(duplicateAppend.cityFeedEventsById ?? {});

    expect(result.errors).toEqual([]);
    expect(once).toHaveLength(1);
    expect(once[0]).toMatchObject({
      sourceType: "building_action",
      category: "economy",
      severity: "high",
      payload: {
        actionId: "produce_neon_dust",
        buildingTypeId: "drug_lab"
      }
    });
    expect(once[0]?.payload).not.toHaveProperty("heatGain");
    expect(twice).toHaveLength(once.length);
  });

  it("completes the factory to armory equipment path and emits a significant craft feed event", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("armory", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0,
        "metal-parts": 10,
        "tech-core": 4
      }
    });

    const started = applyCommand(
      state,
      createCraftItemCommandFixture({
        id: "command:mvp:armory:pistol",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          recipeId: "pistol"
        }
      }),
      context
    );
    let completed = runTick(started.nextState, context);
    for (let index = 1; index < 60; index += 1) {
      completed = runTick(completed.nextState, context);
    }
    const balances = completed.nextState.resourceStatesById["resource:1"].balances;
    const feedEvents = Object.values(completed.nextState.cityFeedEventsById ?? {});

    expect(started.errors).toEqual([]);
    expect(balances["metal-parts"]).toBe(7);
    expect(balances["tech-core"]).toBe(3);
    expect(balances.pistol).toBe(2);
    expect(completed.nextState.buildingsById[building.id].processing).toBeNull();
    expect(feedEvents.some((event) =>
      event.sourceType === "building_action"
      && event.payload?.outputResourceKey === "pistol"
      && event.payload?.recipeId === "pistol"
    )).toBe(true);
  });
});
