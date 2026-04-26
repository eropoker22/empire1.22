import { describe, expect, it } from "vitest";
import { applyCommand, createConflictReportViews } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import {
  createCoreStateWithFixedBuildingFixture,
  createDistrictFixture
} from "../../fixtures/game-state-fixtures";
import { createRunBuildingActionCommandFixture } from "../../fixtures/command-fixtures";

const context = {
  config: resolveModeConfig("free")
};

const createStateWithFixedBuilding = (buildingTypeId = "pharmacy", buildingOverrides = {}) =>
  createCoreStateWithFixedBuildingFixture(buildingTypeId, {
    buildingOverrides,
    playerBalances: {
      cash: 1000,
      "dirty-cash": 250,
      chemicals: 10,
      biomass: 6,
      "metal-parts": 8,
      "tech-core": 2
    }
  });

describe("run-building-action command flow", () => {
  it("runs a valid fixed building action and updates resources, district heat, influence, cooldown, and report", () => {
    const { state, building } = createStateWithFixedBuilding("pharmacy");
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "produce_stim_pack"
        }
      }),
      context
    );

    expect(result.errors).toEqual([]);
    expect(result.nextState.resourceStatesById["resource:1"].balances.chemicals).toBe(8);
    expect(result.nextState.resourceStatesById["resource:1"].balances.biomass).toBe(5);
    expect(result.nextState.resourceStatesById["resource:1"].balances["stim-pack"]).toBe(1);
    expect(result.nextState.districtsById["district:1"].heat).toBe(2);
    expect(result.nextState.districtsById["district:1"].influence).toBe(1);
    expect(result.nextState.buildingsById[building.id].actionCooldowns.produce_stim_pack).toBeGreaterThan(0);
    expect(Object.values(result.nextState.notificationsById).some((notification) => notification.category === "report.building-action")).toBe(true);
  });

  it("rejects an action when the building is not fixed in the district", () => {
    const { state, building } = createStateWithFixedBuilding("pharmacy");
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      buildingIds: []
    };
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "produce_chemicals"
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("building_not_in_district");
  });

  it("rejects an action for the wrong building type", () => {
    const { state, building } = createStateWithFixedBuilding("factory");
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "produce_chemicals"
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("building_action_type_mismatch");
  });

  it("rejects an action blocked by building cooldown", () => {
    const { state, building } = createStateWithFixedBuilding("pharmacy", {
      actionCooldowns: {
        produce_chemicals: 3
      }
    });
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "produce_chemicals"
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("building_action_cooldown");
  });

  it("rejects an action when player resources do not cover input costs", () => {
    const { state, building } = createStateWithFixedBuilding("casino");
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: {
        cash: 1000,
        "dirty-cash": 25
      }
    };
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "launder_dirty_cash"
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("building_action_insufficient_resources");
  });

  it("applies armory fortify as real district defense", () => {
    const { state, building } = createStateWithFixedBuilding("armory");
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "armory_fortify"
        }
      }),
      context
    );

    expect(result.errors).toEqual([]);
    expect(result.nextState.districtsById["district:1"].defenseLoadout).toMatchObject({
      barricades: 2,
      cameras: 1,
      alarm: 1
    });
    expect(result.events[0]?.payload).toMatchObject({
      defenseAdded: {
        barricades: 2,
        cameras: 1,
        alarm: 1
      }
    });
    expect(createConflictReportViews(result.nextState, { playerId: "player:1", limit: 1 })[0]).toMatchObject({
      reportType: "building-action",
      buildingActionId: "armory_fortify",
      defenseAdded: {
        barricades: 2,
        cameras: 1,
        alarm: 1
      }
    });
  });

  it("emits data center tracking intel for adjacent districts", () => {
    const { state, building } = createStateWithFixedBuilding("data_center");
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      adjacentDistrictIds: ["district:2", "district:3"]
    };
    state.districtsById["district:2"] = createDistrictFixture({
      id: "district:2",
      ownerPlayerId: "player:2",
      defenseLoadout: {
        cameras: 3,
        alarm: 2
      }
    });
    state.districtsById["district:3"] = createDistrictFixture({
      id: "district:3",
      ownerPlayerId: null,
      defenseLoadout: {
        barricades: 1
      }
    });
    state.root.districtIds.push("district:2", "district:3");

    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "data_center_tracking"
        }
      }),
      context
    );
    const report = createConflictReportViews(result.nextState, { playerId: "player:1", limit: 1 })[0];

    expect(result.errors).toEqual([]);
    expect(report).toMatchObject({
      reportType: "building-action",
      buildingActionId: "data_center_tracking",
      intelRevealedDistrictIds: ["district:2", "district:3"],
      intelDetectedDefense: {
        "district:2": {
          cameras: 3,
          alarm: 2
        },
        "district:3": {
          barricades: 1
        }
      }
    });
  });

  it("emits restaurant gossip intel without modifying district defense", () => {
    const { state, building } = createStateWithFixedBuilding("restaurant");
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      adjacentDistrictIds: ["district:2"]
    };
    state.districtsById["district:2"] = createDistrictFixture({
      id: "district:2",
      defenseLoadout: {
        cameras: 4
      }
    });
    state.root.districtIds.push("district:2");

    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "restaurant_street_gossip"
        }
      }),
      context
    );
    const report = createConflictReportViews(result.nextState, { playerId: "player:1", limit: 1 })[0];

    expect(result.errors).toEqual([]);
    expect(result.nextState.districtsById["district:1"].defenseLoadout).toEqual({});
    expect(report).toMatchObject({
      reportType: "building-action",
      buildingActionId: "restaurant_street_gossip",
      intelRevealedDistrictIds: ["district:2"],
      intelDetectedDefense: {}
    });
  });
});
