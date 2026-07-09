import { describe, expect, it } from "vitest";
import {
  applyCommand,
  calculateIncomeByPlayerId,
  completeProduction
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { createCraftItemCommandFixture, createUpgradeBuildingCommandFixture } from "../../fixtures/command-fixtures";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

const context = {
  config: resolveModeConfig("free")
};

describe("upgrade-building command flow", () => {
  it("upgrades casino through server cost validation and level mutation", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("casino", {
      playerBalances: {
        cash: 10000,
        "tech-core": 3,
        "combat-module": 0
      }
    });

    const result = applyCommand(
      state,
      createUpgradeBuildingCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id
        }
      }),
      context
    );

    expect(result.errors).toEqual([]);
    expect(result.nextState.buildingsById[building.id].level).toBe(2);
    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(2500);
    expect(result.nextState.resourceStatesById["resource:1"].balances["tech-core"]).toBe(0);
    expect(result.events[0]).toMatchObject({
      type: "building-upgraded",
      payload: {
        buildingId: building.id,
        buildingTypeId: "casino",
        level: 1,
        nextLevel: 2
      }
    });
  });

  it("rejects upgrade without required resources and does not change level", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("casino", {
      playerBalances: {
        cash: 7499,
        "tech-core": 3
      }
    });

    const result = applyCommand(
      state,
      createUpgradeBuildingCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("insufficient_upgrade_resources");
    expect(result.nextState.buildingsById[building.id].level).toBe(1);
    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(7499);
  });

  it("rejects upgrade of another player's building", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("warehouse", {
      buildingOverrides: {
        ownerPlayerId: "player:2"
      },
      playerBalances: {
        cash: 50000
      }
    });

    const result = applyCommand(
      state,
      createUpgradeBuildingCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("building_not_owned");
    expect(result.nextState.buildingsById[building.id].level).toBe(1);
  });

  it("rejects upgrade above max level", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("warehouse", {
      buildingOverrides: {
        level: 4
      },
      playerBalances: {
        cash: 50000
      }
    });

    const result = applyCommand(
      state,
      createUpgradeBuildingCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("building_upgrade_unavailable");
    expect(result.nextState.buildingsById[building.id].level).toBe(4);
  });

  it("applies generic fixed building level multiplier to server income", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("port", {
      buildingOverrides: {
        level: 1
      }
    });

    const baseIncome = calculateIncomeByPlayerId(state, context)["player:1"]["cash"];
    const upgradedIncome = calculateIncomeByPlayerId({
      ...state,
      buildingsById: {
        ...state.buildingsById,
        [building.id]: {
          ...building,
          level: 2
        }
      }
    }, context)["player:1"]["cash"];

    expect(upgradedIncome).toBeGreaterThan(baseIncome);
    expect(upgradedIncome / baseIncome).toBeCloseTo(1.14, 2);
  });

  it("applies production building level multiplier to server production ticks", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      buildingOverrides: {
        level: 2
      },
      productionResourceKey: "metal-parts",
      productionStoredAmount: 0
    });
    state.resourceStatesById[`resource:${building.id}`] = {
      ...state.resourceStatesById[`resource:${building.id}`],
      lastUpdatedTick: 0
    };
    state.root.tick = 1;

    const nextState = completeProduction(state, context);

    expect(nextState.resourceStatesById[`resource:${building.id}`].balances["metal-parts"]).toBe(6);
  });

  it("applies production level multiplier to craft processing duration", () => {
    const base = createCoreStateWithFixedBuildingFixture("armory", {
      buildingOverrides: {
        level: 1
      },
      playerBalances: {
        cash: 1000,
        "metal-parts": 10
      }
    });
    const { state, building } = createCoreStateWithFixedBuildingFixture("armory", {
      buildingOverrides: {
        level: 2
      },
      playerBalances: {
        cash: 1000,
        "metal-parts": 10
      }
    });

    const result = applyCommand(
      state,
      createCraftItemCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          recipeId: "baseball-bat"
        }
      }),
      context
    );
    const baseResult = applyCommand(
      base.state,
      createCraftItemCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: base.building.id,
          recipeId: "baseball-bat"
        }
      }),
      context
    );

    expect(result.errors).toEqual([]);
    expect(baseResult.errors).toEqual([]);
    expect(result.nextState.buildingsById[building.id].processing?.startedAtTick).toBe(0);
    expect(result.nextState.buildingsById[building.id].processing?.completesAtTick).toBeLessThan(
      baseResult.nextState.buildingsById[base.building.id].processing?.completesAtTick ?? 0
    );
    expect(result.nextState.buildingsById[building.id].processing?.completesAtTick).toBe(33);
  });

  it("does not upgrade buildings with max level one", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("restaurant", {
      playerBalances: {
        cash: 50000
      }
    });

    const result = applyCommand(
      state,
      createUpgradeBuildingCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("building_upgrade_unavailable");
    expect(result.nextState.buildingsById[building.id].level).toBe(1);
  });
});
