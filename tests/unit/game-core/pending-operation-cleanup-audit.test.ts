import { describe, expect, it } from "vitest";
import { applyCommand } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { createCombatStateFixture } from "../../fixtures/game-state-fixtures";
import { createSpyDistrictCommandFixture } from "../../fixtures/command-fixtures";
import { preparePendingDistrictActionResolution } from "../../../packages/game-core/src/handlers/pendingDistrictActionShared";

describe("pending operation cleanup ownership", () => {
  it.each([false, true])("preserves later reservations while cleaning old work (membership changed: %s)", changedMembership => {
    const original = createCombatStateFixture();
    original.notificationsById = {};
    original.root.notificationIds = [];
    original.playersById["player:1"].metadata = { membershipId: "old" };
    const started = applyCommand(original, createSpyDistrictCommandFixture(), { config: resolveModeConfig("free") });
    expect(started.errors).toEqual([]);
    const state = started.nextState;
    const operation = Object.values(state.pendingDistrictActionOperationsById!)[0];
    const futureTick = operation.resolveAtTick + 100;
    state.root.tick = operation.resolveAtTick;
    if (changedMembership) state.playersById["player:1"].metadata = { membershipId: "new" };
    for (const key of operation.cooldownKeys) state.cooldownStatesById["cooldown:1"].cooldowns[key] = futureTick;
    state.districtsById[operation.targetDistrictId].operationLocks = { spy: futureTick };
    const slot = state.playerSpyOperationStatesByPlayerId!["player:1"].slots.find(entry => entry.slotId === operation.spySlotId)!;
    slot.availableAtTick = futureTick;
    slot.lastMissionId = "new-mission";
    const resolved = preparePendingDistrictActionResolution(state, operation);
    for (const key of operation.cooldownKeys) expect(resolved.cooldownStatesById["cooldown:1"].cooldowns[key]).toBe(futureTick);
    expect(resolved.districtsById[operation.targetDistrictId].operationLocks?.spy).toBe(futureTick);
    expect(resolved.playerSpyOperationStatesByPlayerId!["player:1"].slots.find(entry => entry.slotId === operation.spySlotId)!.availableAtTick).toBe(futureTick);
  });
});
