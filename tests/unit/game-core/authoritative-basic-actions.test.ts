import { describe, expect, it } from "vitest";
import {
  applyCommand,
  createDistrictPanelView,
  createHeistCooldownKey,
  createHeistSourceCooldownKey,
  createRobCooldownKey,
  createRobSourceCooldownKey,
  type CoreGameState
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { createAllianceFixture, createCombatStateFixture, createDistrictFixture } from "../../fixtures/game-state-fixtures";
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
    state.playersById["player:1"] = { ...state.playersById["player:1"], population: 2 };
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
    expect(result.nextState.cooldownStatesById["cooldown:1"]?.cooldowns).toMatchObject({
      [createRobCooldownKey("district:2")]: context.config.balance.conflict!.robCooldownTicks,
      [createRobSourceCooldownKey("district:1")]: context.config.balance.conflict!.robCooldownTicks
    });
    expect(result.events[0]).toMatchObject({
      type: "district-robbed",
      payload: expect.objectContaining({
        sourceDistrictId: "district:1",
        targetDistrictId: "district:2",
        cooldownTicks: context.config.balance.conflict!.robCooldownTicks
      })
    });
  });

  it("blocks repeated robbing on the same target and from the same source while cooldown is active", () => {
    const state = createNeutralRobState();
    state.playersById["player:1"] = { ...state.playersById["player:1"], population: 2 };
    const first = applyCommand(state, createRobDistrictCommandFixture({ id: "command:rob:cooldown:1" }), context);

    const sameTarget = applyCommand(first.nextState, createRobDistrictCommandFixture({ id: "command:rob:cooldown:2" }), context);
    expect(sameTarget.errors).toContainEqual(expect.objectContaining({
      code: "rob_cooldown_active",
      details: expect.objectContaining({
        cooldownKey: createRobCooldownKey("district:2"),
        remainingTicks: context.config.balance.conflict!.robCooldownTicks
      })
    }));
    expect(sameTarget.nextState).toBe(first.nextState);

    const otherTargetState = {
      ...first.nextState,
      districtsById: {
        ...first.nextState.districtsById,
        "district:1": {
          ...first.nextState.districtsById["district:1"],
          adjacentDistrictIds: ["district:2", "district:3"]
        },
        "district:3": createDistrictFixture({
          id: "district:3",
          serverInstanceId: first.nextState.serverInstance.id,
          ownerPlayerId: null,
          controllerAllianceId: null,
          status: "neutral",
          adjacentDistrictIds: ["district:1"]
        })
      },
      root: {
        ...first.nextState.root,
        districtIds: [...first.nextState.root.districtIds, "district:3"]
      }
    };
    const sameSource = applyCommand(otherTargetState, createRobDistrictCommandFixture({
      id: "command:rob:cooldown:3",
      payload: {
        targetDistrictId: "district:3",
        sourceDistrictId: "district:1"
      }
    }), context);

    expect(sameSource.errors).toContainEqual(expect.objectContaining({
      code: "rob_cooldown_active",
      details: expect.objectContaining({
        cooldownKey: createRobSourceCooldownKey("district:1"),
        remainingTicks: context.config.balance.conflict!.robCooldownTicks
      })
    }));
  });

  it("rejects robbing enemy districts and leaves state unchanged", () => {
    const state = createCombatStateFixture();
    state.playersById["player:1"] = { ...state.playersById["player:1"], population: 2 };
    const result = applyCommand(state, createRobDistrictCommandFixture(), context);

    expect(result.errors).toMatchObject([{ code: "TARGET_NOT_EMPTY" }]);
    expect(result.nextState).toBe(state);
  });

  it("rejects rob when player does not have enough population", () => {
    const state = createNeutralRobState();
    state.playersById["player:1"] = { ...state.playersById["player:1"], population: 0 };
    const result = applyCommand(state, createRobDistrictCommandFixture(), context);

    expect(result.errors).toMatchObject([{ code: "INSUFFICIENT_POPULATION" }]);
    expect(result.nextState).toBe(state);
  });

  it("heists an adjacent enemy district without changing ownership", () => {
    const state = createHeistState();
    const result = applyCommand(state, createHeistDistrictCommandFixture(), context);

    expect(result.errors).toEqual([]);
    expect(result.nextState.districtsById["district:2"].ownerPlayerId).toBe("player:2");
    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(1010);
    expect(result.nextState.resourceStatesById["resource:2"].balances.cash).toBe(990);
    expect(result.nextState.cooldownStatesById["cooldown:1"]?.cooldowns).toMatchObject({
      [createHeistCooldownKey("district:2")]: context.config.balance.conflict!.heistCooldownTicks,
      [createHeistSourceCooldownKey("district:1")]: context.config.balance.conflict!.heistCooldownTicks
    });
    expect(result.events[0]).toMatchObject({
      type: "district-heisted",
      payload: expect.objectContaining({
        style: "balanced",
        gangMembersSent: 10,
        cooldownTicks: context.config.balance.conflict!.heistCooldownTicks
      })
    });
  });

  it("blocks repeated heists while the authoritative cooldown is active", () => {
    const state = createHeistState();
    const first = applyCommand(state, createHeistDistrictCommandFixture({ id: "command:heist:cooldown:1" }), context);
    const repeated = applyCommand(first.nextState, createHeistDistrictCommandFixture({ id: "command:heist:cooldown:2" }), context);

    expect(repeated.errors).toContainEqual(expect.objectContaining({
      code: "heist_cooldown_active",
      details: expect.objectContaining({
        cooldownKey: createHeistCooldownKey("district:2"),
        remainingTicks: context.config.balance.conflict!.heistCooldownTicks
      })
    }));
    expect(repeated.nextState).toBe(first.nextState);
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

  it("allows allied defense with owner-aware contribution records", () => {
    const state = createAlliedDefenseState();
    state.resourceStatesById["resource:1"].balances.barricades = 2;

    const placed = applyCommand(state, createPlaceDefenseCommandFixture({
      payload: {
        targetDistrictId: "district:2",
        defenseItemId: "barricades",
        amount: 1
      }
    }), context);
    expect(placed.errors).toEqual([]);
    expect(placed.nextState.districtsById["district:2"].defenseLoadout.barricades).toBe(
      Number(state.districtsById["district:2"].defenseLoadout.barricades || 0) + 1
    );
    expect(Object.values(placed.nextState.allianceDefenseContributionsById ?? {})[0]).toMatchObject({
      allianceId: "alliance:1",
      ownerPlayerId: "player:1",
      hostPlayerId: "player:2",
      districtId: "district:2",
      itemId: "barricades",
      amount: 1,
      status: "active"
    });

    const panel = createDistrictPanelView(state, {
      districtId: "district:2",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      ...minimalPanelConfig()
    });
    expect(panel?.placeDefense).toEqual(expect.objectContaining({
      enabled: true,
      disabledCode: null
    }));
    expect(panel?.capabilities?.canPlaceDefense).toBe(true);
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
        disabledCode: null,
        cooldownRemainingTicks: 0
      })
    ]);
    expect(panel?.robTargets).toEqual([
      expect.objectContaining({
        districtId: "district:2",
        enabled: false,
        disabledCode: "TARGET_NOT_EMPTY",
        cooldownRemainingTicks: 0
      })
    ]);
    expect(panel?.placeDefense).toEqual(expect.objectContaining({ enabled: true }));
  });

  it("disables rob targets when player has no population", () => {
    const state = createNeutralRobState();
    state.playersById["player:1"] = { ...state.playersById["player:1"], population: 0 };
    const panel = createDistrictPanelView(state, {
      districtId: "district:1",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      ...minimalPanelConfig()
    });

    expect(panel?.robTargets).toEqual([
      expect.objectContaining({
        districtId: "district:2",
        enabled: false,
        disabledCode: "INSUFFICIENT_POPULATION",
        cooldownRemainingTicks: 0
      })
    ]);
  });

  it("projects rob and heist cooldown reasons into the district panel", () => {
    const robState = createNeutralRobState();
    robState.playersById["player:1"] = { ...robState.playersById["player:1"], population: 2 };
    const robbed = applyCommand(robState, createRobDistrictCommandFixture({ id: "command:rob:projection" }), context);
    const robPanel = createDistrictPanelView(robbed.nextState, {
      districtId: "district:1",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      ...minimalPanelConfig()
    });

    expect(robPanel?.robTargets).toEqual([
      expect.objectContaining({
        districtId: "district:2",
        enabled: false,
        disabledCode: "rob_cooldown_active",
        cooldownRemainingTicks: context.config.balance.conflict!.robCooldownTicks,
        disabledReason: expect.stringContaining("obnoví")
      })
    ]);

    const heisted = applyCommand(createHeistState(), createHeistDistrictCommandFixture({ id: "command:heist:projection" }), context);
    const heistPanel = createDistrictPanelView(heisted.nextState, {
      districtId: "district:1",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      ...minimalPanelConfig()
    });

    expect(heistPanel?.heistTargets).toEqual([
      expect.objectContaining({
        districtId: "district:2",
        enabled: false,
        disabledCode: "heist_cooldown_active",
        cooldownRemainingTicks: context.config.balance.conflict!.heistCooldownTicks,
        disabledReason: expect.stringContaining("obnoví")
      })
    ]);
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

const createAlliedDefenseState = (): CoreGameState => {
  const state = createHeistState();
  state.playersById["player:1"] = {
    ...state.playersById["player:1"],
    allianceId: "alliance:1"
  };
  state.playersById["player:2"] = {
    ...state.playersById["player:2"],
    allianceId: "alliance:1"
  };
  state.alliancesById["alliance:1"] = createAllianceFixture({
    id: "alliance:1",
    memberIds: ["player:1", "player:2"],
    ownerPlayerId: "player:1",
    status: "active"
  });
  state.root.allianceIds.push("alliance:1");
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
