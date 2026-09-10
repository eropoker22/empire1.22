import { describe, expect, it } from "vitest";
import { clearDepartedPlayerState } from "@empire/game-core";
import { createCoreStateFixture, createDistrictFixture } from "../../fixtures/game-state-fixtures";
import { createSpyDistrictCommandFixture } from "../../fixtures/command-fixtures";

describe("departed player cleanup", () => {
  it("leaves active players alone and clears a departed player's old spy order and lock", () => {
    const state = createCoreStateFixture();
    const command = createSpyDistrictCommandFixture();
    const playerId = command.playerId;
    const targetDistrictId = command.payload.districtId;
    state.pendingDistrictActionOperationsById = {
      old: { id: "old", operationType: "spy", command, playerId,
        sourceDistrictId: "district:1", targetDistrictId,
        issuedAtTick: 0, resolveAtTick: 20, cooldownKeys: ["spy:pending"], version: 1 }
    };
    state.districtsById[targetDistrictId] = createDistrictFixture({ id: targetDistrictId, operationLocks: { spy: 20 } });
    expect(clearDepartedPlayerState(state, playerId)).toBe(state);
    state.playersById[playerId] = { ...state.playersById[playerId], status: "left" };
    const next = clearDepartedPlayerState(state, playerId);
    expect(next.pendingDistrictActionOperationsById).toEqual({});
    expect(next.districtsById[targetDistrictId].operationLocks?.spy).toBeUndefined();
    expect(state.pendingDistrictActionOperationsById.old).toBeDefined();
    expect(state.districtsById[targetDistrictId].operationLocks?.spy).toBe(20);
  });
});
