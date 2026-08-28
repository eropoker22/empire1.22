import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import {
  createGameplayEconomyRatesView,
  createPlayerView,
  runTick
} from "@empire/game-core";
import {
  createCoreStateWithFixedBuildingFixture
} from "../../fixtures/game-state-fixtures";

const config = resolveModeConfig("free");
const context = {
  config,
  clock: {
    now: () => new Date("2026-07-31T18:00:00.000Z"),
    nowIso: () => "2026-07-31T18:00:00.000Z"
  }
};

describe("gameplay economy rates projection", () => {
  it.each([
    ["park", 3],
    ["commercial", 1],
    ["industrial", 1],
    ["downtown", 5],
    ["residential", 2]
  ] as const)("generates %s district heat at %s per hour", (zone, heatPerHour) => {
    const { state } = createCoreStateWithFixedBuildingFixture("restaurant");
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      zone,
      resourceModifiers: {}
    };
    const neutralContext = {
      ...context,
      config: {
        ...context.config,
        balance: {
          ...context.config.balance,
          factions: undefined,
          fixedBuildings: undefined
        }
      }
    };

    const projected = createGameplayEconomyRatesView(
      state,
      "player:1",
      "district:1",
      neutralContext
    );
    const ticked = runTick(state, neutralContext).nextState;
    const heatDelta = Number(ticked.districtsById["district:1"].heat)
      - Number(state.districtsById["district:1"].heat);
    const ticksPerHour = 60 * 60 * 1000 / neutralContext.config.tickRateMs;

    expect(projected.selectedDistrict?.heatPerHour).toBeCloseTo(heatPerHour);
    expect(heatDelta * ticksPerHour).toBeCloseTo(heatPerHour);
  });

  it("matches the next authoritative tick for player balances and district pressure", () => {
    const { state } = createCoreStateWithFixedBuildingFixture("restaurant", {
      playerBalances: {
        cash: 1_000,
        "dirty-cash": 200,
        population: 50,
        chemicals: 7
      }
    });
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      resourceModifiers: {
        chemicals: 0.25
      },
      lastHeatDecayTick: 0
    };

    const projected = createGameplayEconomyRatesView(
      state,
      "player:1",
      "district:1",
      context
    );
    const ticked = runTick(state, context).nextState;
    const beforeBalances = state.resourceStatesById["resource:1"].balances;
    const afterBalances = ticked.resourceStatesById["resource:1"].balances;
    const beforeDistrict = state.districtsById["district:1"];
    const afterDistrict = ticked.districtsById["district:1"];

    expect(projected).toMatchObject({
      basis: "next-authoritative-economy-tick",
      tickRateMs: config.tickRateMs,
      fromTick: 0,
      toTick: 1,
      selectedDistrict: {
        districtId: "district:1",
        cleanCashPerTick: projected.playerBalancePerTick.cash,
        dirtyCashPerTick: projected.playerBalancePerTick["dirty-cash"],
        cleanCashPerHour: projected.playerBalancePerHour.cash,
        dirtyCashPerHour: projected.playerBalancePerHour["dirty-cash"],
        passivePopulationSources: [],
        passivePopulationSourceSummary:
          "Pasivní populace: 0 / h · žádný zdroj v districtu"
      }
    });
    expect(projected.playerBalancePerTick.cash).toBeCloseTo(
      Number(afterBalances.cash) - Number(beforeBalances.cash)
    );
    expect(projected.playerBalancePerTick["dirty-cash"]).toBeCloseTo(
      Number(afterBalances["dirty-cash"]) - Number(beforeBalances["dirty-cash"])
    );
    expect(projected.playerBalancePerTick.chemicals).toBe(
      Number(afterBalances.chemicals) - Number(beforeBalances.chemicals)
    );
    expect(projected.playerBalancePerTick.population).toBe(0);
    expect(projected.selectedDistrict?.heatPerTick).toBeCloseTo(
      Number(afterDistrict.heat) - Number(beforeDistrict.heat)
    );
    expect(projected.selectedDistrict?.influencePerTick).toBeCloseTo(
      Number(afterDistrict.influence) - Number(beforeDistrict.influence)
    );

    const ticksPerHour = 60 * 60 * 1000 / config.tickRateMs;
    expect(projected.playerBalancePerHour.cash).toBeCloseTo(
      projected.playerBalancePerTick.cash * ticksPerHour
    );
    expect(projected.selectedDistrict?.heatPerHour).toBeCloseTo(
      Number(projected.selectedDistrict?.heatPerTick) * ticksPerHour
    );
  });

  it("moves district population modifiers into canonical population while enumerating stored sources", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture(
      "apartment_block",
      {
        playerBalances: {
          cash: 1_000
        }
      }
    );
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      population: 50
    };
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      resourceModifiers: {
        population: 0.5
      }
    };
    state.buildingsById[building.id] = {
      ...state.buildingsById[building.id],
      metadata: {
        apartmentBlock: {
          storedPopulation: 10,
          lastUpdatedTick: 0,
          lastCapacity: 50,
          wasFull: false
        }
      }
    };

    const beforePlayerView = createPlayerView(state, "player:1", context);
    const projected = createGameplayEconomyRatesView(
      state,
      "player:1",
      "district:1",
      context
    );
    const ticked = runTick(state, context).nextState;
    const afterPlayerView = createPlayerView(ticked, "player:1", context);

    expect(ticked.resourceStatesById["resource:1"].balances.population).toBeUndefined();
    expect(ticked.resourceStatesById["resource:1"].balances).not.toHaveProperty("gang-members");
    expect(ticked.playersById["player:1"].population).toBeCloseTo(50.5);
    expect(beforePlayerView.economy.population).toBe(50);
    expect(afterPlayerView.economy.population).toBeCloseTo(50.5);
    expect(afterPlayerView.resourceBalances.population).toBeCloseTo(50.5);
    expect(afterPlayerView.attackWeapons?.availablePopulation).toBe(50);
    expect(projected.playerBalancePerTick.population).toBeCloseTo(0.5);
    expect(projected.playerBalancePerHour.population).toBeGreaterThan(0);
    const sources = projected.selectedDistrict?.passivePopulationSources ?? [];
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      sourceId: `${building.id}:stored-population`,
      sourceKind: "building-storage",
      districtId: "district:1",
      buildingId: building.id,
      buildingTypeId: "apartment_block",
      target: "building-storage",
      playerBalanceAmountPerTick: 0,
      storedAmount: 10,
      capacity: 50,
      isFull: false,
      status: "producing"
    });
    expect(sources[0]?.amountPerTick).toBeGreaterThan(0);
    expect(sources[0]?.amountPerHour).toBeGreaterThan(0);
    expect(projected.selectedDistrict?.passivePopulationSourceSummary)
      .toContain("apartment_block:");
    expect(projected.selectedDistrict?.passivePopulationSourceSummary)
      .toContain("do zásoby (10/50; topbar +0; produkce aktivní)");

    const fullState = structuredClone(state);
    fullState.buildingsById[building.id].metadata = {
      apartmentBlock: {
        storedPopulation: 50,
        lastUpdatedTick: 0,
        lastCapacity: 50,
        wasFull: true
      }
    };
    const fullSource = createGameplayEconomyRatesView(
      fullState,
      "player:1",
      "district:1",
      context
    ).selectedDistrict?.passivePopulationSources.find(
      (source) => source.target === "building-storage"
    );
    expect(fullSource).toMatchObject({
      amountPerTick: 0,
      amountPerHour: 0,
      playerBalanceAmountPerTick: 0,
      storedAmount: 50,
      capacity: 50,
      isFull: true,
      status: "capacity-full"
    });
  });

  it("stays pure and honors district effects expiring at the next tick boundary", () => {
    const { state } = createCoreStateWithFixedBuildingFixture("restaurant", {
      playerBalances: {
        cash: 1_000,
        "dirty-cash": 200,
        population: 50
      }
    });
    const boundaryTick = 1;
    state.root.tick = boundaryTick - 1;
    state.serverInstance.currentTick = boundaryTick - 1;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 12,
      lastHeatDecayTick: 0
    };
    state.effectStatesById["effect:district:income-boundary"] = {
      id: "effect:district:income-boundary",
      ownerType: "district",
      ownerId: "district:1",
      effects: [
        {
          effectId: "effect:income-boundary",
          effectType: "building_action_effect",
          sourceType: "building",
          sourceId: "building:test",
          startedAtTick: 0,
          expiresAtTick: boundaryTick,
          stackPolicyKey: "income-boundary",
          payload: {
            incomeMultiplier: 2,
            heatMultiplier: 2,
            influenceMultiplier: 2
          }
        }
      ],
      version: 1
    };
    const stateBeforeProjection = structuredClone(state);

    const projected = createGameplayEconomyRatesView(
      state,
      "player:1",
      "district:1",
      context
    );
    const ticked = runTick(state, context).nextState;
    const beforeBalances = state.resourceStatesById["resource:1"].balances;
    const afterBalances = ticked.resourceStatesById["resource:1"].balances;

    expect(state).toEqual(stateBeforeProjection);
    expect(projected.playerBalancePerTick.cash).toBeCloseTo(
      Number(afterBalances.cash) - Number(beforeBalances.cash)
    );
    expect(projected.playerBalancePerTick["dirty-cash"]).toBeCloseTo(
      Number(afterBalances["dirty-cash"]) - Number(beforeBalances["dirty-cash"])
    );
    expect(projected.selectedDistrict?.heatPerTick).toBeCloseTo(
      Number(ticked.districtsById["district:1"].heat)
        - Number(state.districtsById["district:1"].heat)
    );
    expect(projected.selectedDistrict?.influencePerTick).toBeCloseTo(
      Number(ticked.districtsById["district:1"].influence)
        - Number(state.districtsById["district:1"].influence)
    );

    const activeNextTickState = structuredClone(state);
    activeNextTickState.effectStatesById["effect:district:income-boundary"]
      .effects[0].expiresAtTick = boundaryTick + 1;
    const activeNextTick = createGameplayEconomyRatesView(
      activeNextTickState,
      "player:1",
      "district:1",
      context
    );
    expect(activeNextTick.playerBalancePerTick.cash)
      .toBeGreaterThan(projected.playerBalancePerTick.cash);
  });
});
