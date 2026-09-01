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
    const command = createSpyDistrictCommandFixture();
    const started = applyCommand(state, command, context);
    const operation = onlyPending(started.nextState);

    expect(started.errors).toEqual([]);
    expect(started.events).toEqual([]);
    expect(started.nextState.notificationsById).toEqual({});
    expect(started.nextState.policeStatesById["police:1"]?.heat ?? 0).toBe(0);

    const completed = advanceToTick(started.nextState, operation.resolveAtTick);
    const resolvedAt = scheduledResolveAt(command.issuedAt, operation);
    expect(completed.notificationsById["notification:command:spy:1:spy-report"]).toMatchObject({
      category: "report.spy",
      createdAt: resolvedAt,
      payload: {
        issuedAt: command.issuedAt,
        issuedAtTick: operation.issuedAtTick,
        resolveAt: resolvedAt,
        resolveAtTick: operation.resolveAtTick
      }
    });
    expect(completed.policeStatesById["police:1"]?.heat).toBeGreaterThan(0);
    expect(Object.values(completed.pendingDistrictActionOperationsById ?? {})).toEqual([]);
  });

  it("keeps the Ghost Network effects captured when the spy mission starts", () => {
    const state = createCombatStateFixture();
    state.notificationsById = {};
    state.root.notificationIds = [];
    const definition = context.config.balance.playerBoosts!["ghost-network"];
    const startTick = definition.activeDurationTicks - 1;
    state.root.tick = startTick;
    state.serverInstance.currentTick = startTick;
    state.playerBoostStatesByPlayerId = {
      "player:1": {
        version: 1,
        active: {
          boostId: "ghost-network",
          activatedAtTick: 0,
          expiresAtTick: definition.activeDurationTicks,
          status: "timed",
          effectSnapshot: { ...definition.effect }
        },
        cooldownUntilTickByBoostId: {}
      }
    };

    const started = applyCommand(state, createSpyDistrictCommandFixture({ id: "command:spy:ghost-snapshot" }), context);
    expect(started.errors).toEqual([]);
    const operation = onlyPending(started.nextState);

    expect(operation.spyBoostSnapshot).toMatchObject({
      boostId: "ghost-network",
      spyDurationMultiplier: 0.65,
      criticalFailureChanceMultiplier: 0.75,
      extraIntelBlocksOnSuccess: 1
    });
    expect(operation.resolveAtTick).toBeGreaterThan(definition.activeDurationTicks);

    const completed = advanceToTick(started.nextState, operation.resolveAtTick);
    expect(completed.playerBoostStatesByPlayerId?.["player:1"]?.active).toBeNull();
    expect(completed.notificationsById["notification:command:spy:ghost-snapshot:spy-report"]?.payload.boostSnapshot)
      .toEqual(operation.spyBoostSnapshot);
  });

  it("does not add Ghost Network effects to a spy mission that already started", () => {
    const state = createCombatStateFixture();
    state.notificationsById = {};
    state.root.notificationIds = [];
    const started = applyCommand(state, createSpyDistrictCommandFixture({ id: "command:spy:pre-ghost" }), context);
    expect(started.errors).toEqual([]);
    const operation = onlyPending(started.nextState);
    const definition = context.config.balance.playerBoosts!["ghost-network"];
    const stateActivatedAfterStart: CoreGameState = {
      ...started.nextState,
      playerBoostStatesByPlayerId: {
        ...started.nextState.playerBoostStatesByPlayerId,
        "player:1": {
          version: 1,
          active: {
            boostId: "ghost-network",
            activatedAtTick: started.nextState.root.tick,
            expiresAtTick: operation.resolveAtTick + 1,
            status: "timed",
            effectSnapshot: { ...definition.effect }
          },
          cooldownUntilTickByBoostId: {}
        }
      }
    };

    expect(operation.spyBoostSnapshot).toMatchObject({
      boostId: null,
      spyDurationMultiplier: 1,
      criticalFailureChanceMultiplier: 1,
      extraIntelBlocksOnSuccess: 0
    });

    const completed = advanceToTick(stateActivatedAfterStart, operation.resolveAtTick);
    expect(completed.notificationsById["notification:command:spy:pre-ghost:spy-report"]?.payload.boostSnapshot)
      .toBeNull();
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
    expect(completed.notificationsById["notification:command:attack:1:battle:player:1"]?.payload)
      .toMatchObject({ issuedAtTick: operation.issuedAtTick, resolveAtTick: operation.resolveAtTick });
  });

  it("reserves the exact attack loadout while the crew is in transit", () => {
    const state = createCombatStateFixture();
    const started = applyCommand(state, createAttackDistrictCommandFixture(), context);
    const operation = onlyPending(started.nextState);

    expect(started.errors).toEqual([]);
    expect(operation.reservedAttackLoadout).toEqual({
      "baseball-bat": 1,
      pistol: 1,
      grenade: 1,
      smg: 1,
      bazooka: 1
    });
    expect(started.nextState.resourceStatesById["resource:1"].balances).toMatchObject({
      "baseball-bat": 0,
      pistol: 0,
      grenade: 0,
      smg: 0,
      bazooka: 0
    });
  });

  it("cancels an invalidated attack, refunds reserved weapons and emits a terminal report", () => {
    const state = createCombatStateFixture();
    const started = applyCommand(state, createAttackDistrictCommandFixture(), context);
    const operation = onlyPending(started.nextState);
    const invalidated: CoreGameState = {
      ...started.nextState,
      districtsById: {
        ...started.nextState.districtsById,
        "district:1": {
          ...started.nextState.districtsById["district:1"],
          ownerPlayerId: "player:2"
        }
      }
    };

    const completed = advanceToTick(invalidated, operation.resolveAtTick);
    expect(completed.pendingDistrictActionOperationsById).toEqual({});
    expect(completed.districtsById["district:2"].ownerPlayerId).toBe("player:2");
    expect(completed.resourceStatesById["resource:1"].balances).toMatchObject({
      "baseball-bat": 1,
      pistol: 1,
      grenade: 1,
      smg: 1,
      bazooka: 1
    });
    expect(completed.notificationsById["notification:command:attack:1:battle:player:1"]?.payload)
      .toMatchObject({ cancelled: true, cancellationCode: "SOURCE_OWNER_CHANGED", result: "failure" });
  });

  it("does not redirect an in-flight attack to a different enemy owner", () => {
    const state = createCombatStateFixture();
    const started = applyCommand(state, createAttackDistrictCommandFixture(), context);
    const operation = onlyPending(started.nextState);
    const originalTargetOwner = started.nextState.playersById["player:2"];
    const changedOwnerState: CoreGameState = {
      ...started.nextState,
      playersById: {
        ...started.nextState.playersById,
        "player:3": {
          ...originalTargetOwner,
          id: "player:3",
          name: "Third gang",
          allianceId: null
        }
      },
      districtsById: {
        ...started.nextState.districtsById,
        "district:2": {
          ...started.nextState.districtsById["district:2"],
          ownerPlayerId: "player:3"
        }
      }
    };

    const completed = advanceToTick(changedOwnerState, operation.resolveAtTick);
    expect(completed.districtsById["district:2"].ownerPlayerId).toBe("player:3");
    expect(completed.resourceStatesById["resource:1"].balances).toMatchObject({
      "baseball-bat": 1,
      pistol: 1,
      grenade: 1,
      smg: 1,
      bazooka: 1
    });
    expect(completed.notificationsById["notification:command:attack:1:battle:player:1"]?.payload)
      .toMatchObject({ cancelled: true, cancellationCode: "TARGET_OWNER_CHANGED", result: "failure" });
  });

  it("keeps occupation pending and reports its result only at the due tick", () => {
    const state = createNeutralRobState();
    state.playersById["player:1"] = { ...state.playersById["player:1"], population: 100 };
    state.districtsById["district:1"] = { ...state.districtsById["district:1"], influence: 100 };
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2", null);
    const command = createOccupyDistrictCommandFixture({
      payload: { expectedConflictRevision: state.districtsById["district:2"].conflictRevision }
    });
    const started = applyCommand(state, command, context);
    const operation = Object.values(started.nextState.pendingOccupyOperationsById ?? {})[0]!;

    expect(started.errors).toEqual([]);
    expect(started.nextState.districtsById["district:2"].ownerPlayerId).toBeNull();
    expect(started.nextState.playersById["player:1"].population).toBe(100 - operation.populationCost);
    expect(started.nextState.notificationsById["notification:command:occupy:1:occupy-report"]).toBeUndefined();

    const completed = advanceToTick(started.nextState, operation.resolveAtTick);
    const report = completed.notificationsById["notification:command:occupy:1:occupy-report"];
    expect(report?.category).toBe("report.occupy");
    expect(report?.createdAt).toBe(scheduledResolveAt(command.issuedAt, operation));
    expect(completed.playersById["player:1"].population)
      .toBe(100 - Number(report?.payload.populationLost ?? 0));
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
    expect(completed.notificationsById["notification:command:rob:1:rob-report"]).toMatchObject({
      category: "report.rob",
      payload: { issuedAtTick: operation.issuedAtTick, resolveAtTick: operation.resolveAtTick }
    });
    expect(completed.resourceStatesById["resource:1"].balances.cash).toBeGreaterThanOrEqual(cashBefore);
  });

  it("moves heist loot and applies losses only after the heist duration", () => {
    const state = createHeistState();
    const attackerCashBefore = Number(state.resourceStatesById["resource:1"].balances.cash);
    const defenderCashBefore = Number(state.resourceStatesById["resource:2"].balances.cash);
    const started = applyCommand(state, createHeistDistrictCommandFixture(), context);
    const operation = onlyPending(started.nextState);

    expect(started.errors).toEqual([]);
    expect(started.nextState.playersById["player:1"].population).toBe(90);
    expect(started.nextState.resourceStatesById["resource:1"].balances.cash).toBe(attackerCashBefore);
    expect(started.nextState.resourceStatesById["resource:2"].balances.cash).toBe(defenderCashBefore);
    expect(started.nextState.notificationsById["notification:command:heist:1:heist-report"]).toBeUndefined();

    const completed = advanceToTick(started.nextState, operation.resolveAtTick);
    const report = completed.notificationsById["notification:command:heist:1:heist-report"];
    expect(report?.category).toBe("report.heist");
    expect(report?.payload).toMatchObject({
      issuedAtTick: operation.issuedAtTick,
      resolveAtTick: operation.resolveAtTick
    });
    expect(completed.playersById["player:1"].population)
      .toBe(100 - Number(report?.payload.populationLosses ?? 0));
    expect(completed.resourceStatesById["resource:1"].balances.cash).toBeGreaterThanOrEqual(attackerCashBefore);
    expect(completed.resourceStatesById["resource:2"].balances.cash).toBeLessThanOrEqual(defenderCashBefore);
  });
});

const onlyPending = (state: CoreGameState) => {
  const operations = Object.values(state.pendingDistrictActionOperationsById ?? {});
  expect(operations).toHaveLength(1);
  return operations[0]!;
};

const scheduledResolveAt = (
  issuedAt: string,
  operation: { issuedAtTick: number; resolveAtTick: number }
) => new Date(
  Date.parse(issuedAt)
    + (operation.resolveAtTick - operation.issuedAtTick) * context.config.tickRateMs
).toISOString();

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
