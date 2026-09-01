import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand, runTick, type CoreGameState } from "@empire/game-core";
import {
  createAttackDistrictCommandFixture,
  createHeistDistrictCommandFixture,
  createRobDistrictCommandFixture,
  createSpyDistrictCommandFixture
} from "../../fixtures/command-fixtures";
import { createCombatStateFixture } from "../../fixtures/game-state-fixtures";

const context = { config: resolveModeConfig("free") };

describe("pending operation and post-resolution cooldown separation", () => {
  it("keeps the resolved spy slot and actor cooldown without leaving an in-flight district lock", () => {
    const state = createCombatStateFixture();
    state.notificationsById = {};
    state.root.notificationIds = [];
    const started = applyCommand(state, createSpyDistrictCommandFixture(), context);
    const operation = onlyPending(started.nextState);
    const completed = advanceToTick(started.nextState, operation.resolveAtTick);

    expect(started.errors).toEqual([]);
    expect(completed.pendingDistrictActionOperationsById).toEqual({});
    expect(completed.cooldownStatesById["cooldown:1"]?.cooldowns[`spy:${operation.targetDistrictId}`])
      .toBeGreaterThan(completed.root.tick);
    expect(completed.playerSpyOperationStatesByPlayerId?.["player:1"]?.slots
      .some((slot) => slot.availableAtTick > completed.root.tick)).toBe(true);
    expect(Number(completed.districtsById[operation.targetDistrictId].operationLocks?.spy ?? 0))
      .toBeLessThanOrEqual(completed.root.tick);
  });

  it("keeps attack and robbery actor cooldowns without presenting resolved work as in-flight", () => {
    const attackState = createCombatStateFixture();
    attackState.districtsById["district:2"] = {
      ...attackState.districtsById["district:2"],
      defenseLoadout: {}
    };
    const attackStarted = applyCommand(attackState, createAttackDistrictCommandFixture(), context);
    const attackOperation = onlyPending(attackStarted.nextState);
    const attackCompleted = advanceToTick(attackStarted.nextState, attackOperation.resolveAtTick);
    expect(attackCompleted.cooldownStatesById["cooldown:1"]?.cooldowns["attack:global"])
      .toBeGreaterThan(attackCompleted.root.tick);
    expect(Number(attackCompleted.districtsById[attackOperation.targetDistrictId].operationLocks?.attack ?? 0))
      .toBeLessThanOrEqual(attackCompleted.root.tick);

    const robState = createCombatStateFixture();
    robState.playersById["player:1"] = { ...robState.playersById["player:1"], population: 2 };
    robState.districtsById["district:2"] = {
      ...robState.districtsById["district:2"],
      ownerPlayerId: null,
      controllerAllianceId: null,
      status: "neutral",
      defenseLoadout: {},
      heat: 0
    };
    const robStarted = applyCommand(robState, createRobDistrictCommandFixture(), context);
    const robOperation = onlyPending(robStarted.nextState);
    const robCompleted = advanceToTick(robStarted.nextState, robOperation.resolveAtTick);
    expect(robCompleted.cooldownStatesById["cooldown:1"]?.cooldowns[`rob:${robOperation.targetDistrictId}`])
      .toBeGreaterThan(robCompleted.root.tick);
    expect(Number(robCompleted.districtsById[robOperation.targetDistrictId].operationLocks?.rob ?? 0))
      .toBeLessThanOrEqual(robCompleted.root.tick);
  });

  it("keeps heist cooldown and victim protection without leaving an in-flight district lock", () => {
    const state = createCombatStateFixture();
    const started = applyCommand(state, createHeistDistrictCommandFixture(), context);
    const operation = onlyPending(started.nextState);
    const completed = advanceToTick(started.nextState, operation.resolveAtTick);

    expect(started.errors).toEqual([]);
    expect(completed.cooldownStatesById["cooldown:1"]?.cooldowns["heist:global"])
      .toBeGreaterThan(completed.root.tick);
    expect(completed.districtsById[operation.targetDistrictId].heistProtectedUntilTick)
      .toBeGreaterThan(completed.root.tick);
    expect(Number(completed.districtsById[operation.targetDistrictId].operationLocks?.heist ?? 0))
      .toBeLessThanOrEqual(completed.root.tick);
  });
});

const onlyPending = (state: CoreGameState) => Object.values(
  state.pendingDistrictActionOperationsById ?? {}
)[0]!;

const advanceToTick = (state: CoreGameState, targetTick: number): CoreGameState => {
  let nextState = state;
  while (nextState.root.tick < targetTick) nextState = runTick(nextState, context).nextState;
  return nextState;
};
