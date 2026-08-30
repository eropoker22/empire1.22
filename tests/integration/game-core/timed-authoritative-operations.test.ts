import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand, runTick, type CoreGameState } from "@empire/game-core";
import {
  createAttackDistrictCommandFixture,
  createCraftItemCommandFixture,
  createHeistDistrictCommandFixture,
  createOccupyDistrictCommandFixture,
  createRobDistrictCommandFixture,
  createSpyDistrictCommandFixture
} from "../../fixtures/command-fixtures";
import {
  createCombatStateFixture,
  createCoreStateWithFixedBuildingFixture,
  seedSuccessfulSpyIntel
} from "../../fixtures/game-state-fixtures";

const context = { config: resolveModeConfig("free") };

describe("server-timed authoritative operations", () => {
  it("starts production immediately but creates output only when its timer expires", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("pharmacy", {
      playerBalances: { cash: 2_000, chemicals: 0 }
    });
    const started = applyCommand(state, createCraftItemCommandFixture({
      payload: { districtId: "district:1", buildingId: building.id, recipeId: "chemicals", quantity: 1 }
    }), context);
    const line = started.nextState.buildingsById[building.id].productionLines?.chemicals;

    expect(started.errors).toEqual([]);
    expect(started.nextState.resourceStatesById["resource:1"].balances).toMatchObject({ cash: 1_640, chemicals: 0 });
    expect(line?.activeCompletesAtTick).toBeGreaterThan(state.root.tick);
    expect(started.nextState.resourceStatesById[`resource:${building.id}`]?.balances.chemicals ?? 0).toBe(0);

    const completed = advanceToTick(started.nextState, line!.activeCompletesAtTick!);
    expect(completed.resourceStatesById[`resource:${building.id}`]?.balances.chemicals).toBe(1);
  });

  it("does not disclose or apply spy results before the pending operation is due", () => {
    const state = createCombatStateFixture();
    state.notificationsById = {};
    state.root.notificationIds = [];
    const started = applyCommand(state, createSpyDistrictCommandFixture(), context);
    const operation = onlyPending(started.nextState);

    expect(started.errors).toEqual([]);
    expect(started.events).toEqual([]);
    expect(started.nextState.notificationsById).toEqual({});
    expect(started.nextState.policeStatesById["police:1"]?.heat ?? 0).toBe(0);

    const completed = advanceToTick(started.nextState, operation.resolveAtTick);
    expect(completed.notificationsById["notification:command:spy:1:spy-report"]?.category).toBe("report.spy");
    expect(completed.policeStatesById["police:1"]?.heat).toBeGreaterThan(0);
    expect(Object.values(completed.pendingDistrictActionOperationsById ?? {})).toEqual([]);
  });

  it("keeps attack ownership, defenses and losses unchanged until resolution", () => {
    const state = createCombatStateFixture();
    state.districtsById["district:2"] = { ...state.districtsById["district:2"], defenseLoadout: {} };
    const started = applyCommand(state, createAttackDistrictCommandFixture(), context);
    const operation = onlyPending(started.nextState);

    expect(started.errors).toEqual([]);
    expect(started.events).toEqual([]);
    expect(started.nextState.districtsById["district:2"].ownerPlayerId).toBe("player:2");
    expect(started.nextState.notificationsById["notification:command:attack:1:battle:player:1"]).toBeUndefined();

    const completed = advanceToTick(started.nextState, operation.resolveAtTick);
    expect(completed.districtsById["district:2"].ownerPlayerId).toBe("player:1");
    expect(completed.notificationsById["notification:command:attack:1:battle:player:1"]?.payload.resolveAtTick)
      .toBe(completed.root.tick);
  });

  it("keeps occupation pending and reports its result only at the due tick", () => {
    const state = createNeutralRobState();
    state.playersById["player:1"] = { ...state.playersById["player:1"], population: 100 };
    state.districtsById["district:1"] = { ...state.districtsById["district:1"], influence: 100 };
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2", null);
    const started = applyCommand(state, createOccupyDistrictCommandFixture({
      payload: { expectedConflictRevision: state.districtsById["district:2"].conflictRevision }
    }), context);
    const operation = Object.values(started.nextState.pendingOccupyOperationsById ?? {})[0]!;

    expect(started.errors).toEqual([]);
    expect(started.nextState.districtsById["district:2"].ownerPlayerId).toBeNull();
    expect(started.nextState.notificationsById["notification:command:occupy:1:occupy-report"]).toBeUndefined();

    const completed = advanceToTick(started.nextState, operation.resolveAtTick);
    expect(completed.notificationsById["notification:command:occupy:1:occupy-report"]?.category).toBe("report.occupy");
    expect(Object.values(completed.pendingOccupyOperationsById ?? {})).toEqual([]);
  });

  it("moves neutral robbery loot only after the robbery duration", () => {
    const state = createNeutralRobState();
    const cashBefore = Number(state.resourceStatesById["resource:1"].balances.cash);
    const started = applyCommand(state, createRobDistrictCommandFixture(), context);
    const operation = onlyPending(started.nextState);

    expect(started.errors).toEqual([]);
    expect(started.nextState.resourceStatesById["resource:1"].balances.cash).toBe(cashBefore);
    expect(started.nextState.notificationsById["notification:command:rob:1:rob-report"]).toBeUndefined();

    const completed = advanceToTick(started.nextState, operation.resolveAtTick);
    expect(completed.notificationsById["notification:command:rob:1:rob-report"]?.category).toBe("report.rob");
    expect(completed.resourceStatesById["resource:1"].balances.cash).toBeGreaterThanOrEqual(cashBefore);
  });

  it("moves heist loot and applies losses only after the heist duration", () => {
    const state = createHeistState();
    const attackerCashBefore = Number(state.resourceStatesById["resource:1"].balances.cash);
    const defenderCashBefore = Number(state.resourceStatesById["resource:2"].balances.cash);
    const started = applyCommand(state, createHeistDistrictCommandFixture(), context);
    const operation = onlyPending(started.nextState);

    expect(started.errors).toEqual([]);
    expect(started.nextState.resourceStatesById["resource:1"].balances.cash).toBe(attackerCashBefore);
    expect(started.nextState.resourceStatesById["resource:2"].balances.cash).toBe(defenderCashBefore);
    expect(started.nextState.notificationsById["notification:command:heist:1:heist-report"]).toBeUndefined();

    const completed = advanceToTick(started.nextState, operation.resolveAtTick);
    expect(completed.notificationsById["notification:command:heist:1:heist-report"]?.category).toBe("report.heist");
    expect(completed.resourceStatesById["resource:1"].balances.cash).toBeGreaterThanOrEqual(attackerCashBefore);
    expect(completed.resourceStatesById["resource:2"].balances.cash).toBeLessThanOrEqual(defenderCashBefore);
  });
});

const onlyPending = (state: CoreGameState) => {
  const operations = Object.values(state.pendingDistrictActionOperationsById ?? {});
  expect(operations).toHaveLength(1);
  return operations[0]!;
};

const advanceToTick = (state: CoreGameState, targetTick: number): CoreGameState => {
  let nextState = state;
  while (nextState.root.tick < targetTick) nextState = runTick(nextState, context).nextState;
  return nextState;
};

const createNeutralRobState = (): CoreGameState => {
  const state = createCombatStateFixture();
  state.playersById["player:1"] = { ...state.playersById["player:1"], population: 2 };
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
  state.playersById["player:2"] = {
    ...state.playersById["player:2"],
    population: 100,
    resourceStateId: "resource:2"
  };
  state.resourceStatesById["resource:1"].balances = { cash: 1_000 };
  state.resourceStatesById["resource:2"] = {
    ...state.resourceStatesById["resource:1"],
    id: "resource:2",
    ownerId: "player:2",
    balances: { cash: 1_000, "dirty-cash": 50 }
  };
  return state;
};
