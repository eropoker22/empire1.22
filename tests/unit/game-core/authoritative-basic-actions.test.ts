import { describe, expect, it } from "vitest";
import { applyCommand, createDistrictPanelView, type CoreGameState } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { createCombatStateFixture } from "../../fixtures/game-state-fixtures";
import {
  createHeistDistrictCommandFixture,
  createPlaceDefenseCommandFixture,
  createRemoveDefenseCommandFixture,
  createRobDistrictCommandFixture
} from "../../fixtures/command-fixtures";

const context = { config: resolveModeConfig("free") };

describe("authoritative basic action commands", () => {
  it("robs an adjacent neutral district without changing ownership", () => {
    const state = createNeutralRobState();
    const result = applyCommand(state, createRobDistrictCommandFixture(), context);

    expect(result.errors).toEqual([]);
    expect(result.nextState.districtsById["district:2"]).toMatchObject({
      ownerPlayerId: null,
      heat: 2
    });
    expect(result.nextState.resourceStatesById["resource:1"].balances).toMatchObject({
      cash: 1025,
      "dirty-cash": 10
    });
    expect(result.events[0]).toMatchObject({
      type: "district-robbed",
      payload: expect.objectContaining({
        sourceDistrictId: "district:1",
        targetDistrictId: "district:2"
      })
    });
  });

  it("rejects robbing enemy districts and leaves state unchanged", () => {
    const state = createCombatStateFixture();
    const result = applyCommand(state, createRobDistrictCommandFixture(), context);

    expect(result.errors).toMatchObject([{ code: "TARGET_NOT_EMPTY" }]);
    expect(result.nextState).toBe(state);
  });

  it("heists an adjacent enemy district without changing ownership", () => {
    const state = createHeistState();
    const result = applyCommand(state, createHeistDistrictCommandFixture(), context);

    expect(result.errors).toEqual([]);
    expect(result.nextState.districtsById["district:2"].ownerPlayerId).toBe("player:2");
    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(1010);
    expect(result.nextState.resourceStatesById["resource:2"].balances.cash).toBe(990);
    expect(result.events[0]).toMatchObject({
      type: "district-heisted",
      payload: expect.objectContaining({
        style: "balanced",
        gangMembersSent: 10
      })
    });
  });

  it("rejects heist outcome fields at transport and invalid enemy relation in core", () => {
    const state = createNeutralRobState();
    state.playersById["player:1"] = { ...state.playersById["player:1"], population: 100 };
    const result = applyCommand(state, createHeistDistrictCommandFixture(), context);

    expect(result.errors).toMatchObject([{ code: "TARGET_NOT_ENEMY" }]);
    expect(result.nextState).toBe(state);
  });

  it("places and removes defense on own district using player inventory", () => {
    const state = createHeistState();
    state.resourceStatesById["resource:1"].balances.barricades = 2;

    const placed = applyCommand(state, createPlaceDefenseCommandFixture(), context);
    expect(placed.errors).toEqual([]);
    expect(placed.nextState.districtsById["district:1"].defenseLoadout.barricades).toBe(1);
    expect(placed.nextState.resourceStatesById["resource:1"].balances.barricades).toBe(1);

    const removed = applyCommand(placed.nextState, createRemoveDefenseCommandFixture(), context);
    expect(removed.errors).toEqual([]);
    expect(removed.nextState.districtsById["district:1"].defenseLoadout.barricades).toBe(0);
    expect(removed.nextState.resourceStatesById["resource:1"].balances.barricades).toBe(2);
  });

  it("projects rob, heist and defense capabilities into the district panel", () => {
    const state = createHeistState();
    state.resourceStatesById["resource:1"].balances.barricades = 1;
    const panel = createDistrictPanelView(state, {
      districtId: "district:1",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      ...minimalPanelConfig()
    });

    expect(panel?.heistTargets).toEqual([
      expect.objectContaining({
        districtId: "district:2",
        enabled: true,
        disabledCode: null
      })
    ]);
    expect(panel?.robTargets).toEqual([
      expect.objectContaining({
        districtId: "district:2",
        enabled: false,
        disabledCode: "TARGET_NOT_EMPTY"
      })
    ]);
    expect(panel?.placeDefense).toEqual(expect.objectContaining({ enabled: true }));
  });
});

const createNeutralRobState = (): CoreGameState => {
  const state = createCombatStateFixture();
  state.districtsById["district:2"] = {
    ...state.districtsById["district:2"],
    ownerPlayerId: null,
    controllerAllianceId: null,
    status: "neutral",
    defenseLoadout: {},
    heat: 0
  };
  return state;
};

const createHeistState = (): CoreGameState => {
  const state = createCombatStateFixture();
  state.playersById["player:1"] = { ...state.playersById["player:1"], population: 100 };
  state.playersById["player:2"] = { ...state.playersById["player:2"], population: 100, resourceStateId: "resource:2" };
  state.resourceStatesById["resource:1"] = {
    ...state.resourceStatesById["resource:1"],
    ownerId: "player:1",
    balances: { cash: 1000 }
  };
  state.resourceStatesById["resource:2"] = {
    ...state.resourceStatesById["resource:1"],
    id: "resource:2",
    ownerId: "player:2",
    balances: { cash: 1000, "dirty-cash": 50 }
  };
  state.districtsById["district:1"] = {
    ...state.districtsById["district:1"],
    defenseLoadout: {}
  };
  return state;
};

const minimalPanelConfig = () => {
  const config = resolveModeConfig("free");
  return {
    buildCatalog: [],
    productionCatalog: {},
    craftCatalog: {},
    buildingActionCatalog: {},
    productionMultiplier: 1,
    tickRateMs: config.tickRateMs,
    conflictConfig: config.balance.conflict
  };
};
