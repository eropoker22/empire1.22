import { describe, expect, it } from "vitest";
import {
  applyCommand,
  applyDefenseCombatLosses,
  cleanupAllianceDefense
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import {
  createPlaceDefenseCommandFixture,
  createRemoveDefenseCommandFixture
} from "../../fixtures/command-fixtures";
import {
  createAllianceFixture,
  createCoreStateFixture,
  createDistrictFixture,
  createPlayerFixture,
  createResourceStateFixture
} from "../../fixtures/game-state-fixtures";

const context = { config: resolveModeConfig("free") };

describe("alliance defense conservation", () => {
  it("conserves multiple contributions through removal, combat, exit and cleanup replay", () => {
    const state = createDefenseState();
    const firstPlacement = applyCommand(state, createPlaceDefenseCommandFixture({
      id: "command:defense:b:place",
      playerId: "player:2",
      payload: { targetDistrictId: "district:1", defenseItemId: "vest", amount: 10 }
    }), context);

    expect(firstPlacement.errors).toEqual([]);
    expect(firstPlacement.nextState.resourceStatesById["resource:2"].balances.vest).toBe(0);
    expect(firstPlacement.nextState.districtsById["district:1"].defenseLoadout.vest).toBe(10);
    expect(firstPlacement.nextState.allianceDefenseContributionsById?.["alliance-defense:command:defense:b:place"])
      .toMatchObject({ originalAmount: 10, remainingAmount: 10, lostAmount: 0, returnedAmount: 0 });

    const hostRemoval = applyCommand(firstPlacement.nextState, createRemoveDefenseCommandFixture({
      id: "command:defense:host:remove",
      playerId: "player:1",
      payload: { targetDistrictId: "district:1", defenseItemId: "vest", amount: 1 }
    }), context);
    expect(hostRemoval.errors).toContainEqual(expect.objectContaining({ code: "DEFENSE_NOT_OWNED" }));
    expect(hostRemoval.nextState).toBe(firstPlacement.nextState);

    const partialReturn = applyCommand(firstPlacement.nextState, createRemoveDefenseCommandFixture({
      id: "command:defense:b:return",
      playerId: "player:2",
      payload: { targetDistrictId: "district:1", defenseItemId: "vest", amount: 4 }
    }), context);
    expect(partialReturn.errors).toEqual([]);
    expect(partialReturn.nextState.districtsById["district:1"].defenseLoadout.vest).toBe(6);
    expect(partialReturn.nextState.resourceStatesById["resource:2"].balances.vest).toBe(4);
    expect(partialReturn.nextState.allianceDefenseContributionsById?.["alliance-defense:command:defense:b:place"])
      .toMatchObject({ remainingAmount: 6, returnedAmount: 4, status: "active" });

    const secondPlacement = applyCommand(partialReturn.nextState, createPlaceDefenseCommandFixture({
      id: "command:defense:c:place",
      playerId: "player:3",
      payload: { targetDistrictId: "district:1", defenseItemId: "vest", amount: 10 }
    }), context);
    expect(secondPlacement.errors).toEqual([]);
    expect(secondPlacement.nextState.districtsById["district:1"].defenseLoadout.vest).toBe(16);

    const afterCombat = applyDefenseCombatLosses(secondPlacement.nextState, {
      districtId: "district:1",
      losses: { vest: 3 },
      snapshotId: "defense-combat:test:1",
      createdAtTick: 1
    });
    expect(afterCombat.districtsById["district:1"].defenseLoadout.vest).toBe(13);
    expect(afterCombat.allianceDefenseContributionsById?.["alliance-defense:command:defense:b:place"])
      .toMatchObject({ remainingAmount: 5, lostAmount: 1, status: "partially_lost" });
    expect(afterCombat.allianceDefenseContributionsById?.["alliance-defense:command:defense:c:place"])
      .toMatchObject({ remainingAmount: 8, lostAmount: 2, status: "partially_lost" });
    expect(afterCombat.allianceDefenseCombatSnapshotsById?.["defense-combat:test:1"]?.contributionImpacts)
      .toEqual([
        { contributionId: "alliance-defense:command:defense:b:place", lostAmount: 1, remainingAmount: 5 },
        { contributionId: "alliance-defense:command:defense:c:place", lostAmount: 2, remainingAmount: 8 }
      ]);
    expect(applyDefenseCombatLosses(afterCombat, {
      districtId: "district:1",
      losses: { vest: 3 },
      snapshotId: "defense-combat:test:1",
      createdAtTick: 1
    })).toBe(afterCombat);

    const cleaned = cleanupAllianceDefense(afterCombat, {
      allianceId: "alliance:1",
      playerId: "player:2",
      sourceEventId: "alliance-exit:test:1",
      nowIso: "2026-07-15T12:00:00.000Z"
    });
    expect(cleaned.districtsById["district:1"].defenseLoadout.vest).toBe(8);
    expect(cleaned.resourceStatesById["resource:2"].balances.vest).toBe(9);
    expect(cleaned.allianceDefenseContributionsById?.["alliance-defense:command:defense:b:place"])
      .toMatchObject({ remainingAmount: 0, lostAmount: 1, returnedAmount: 9, status: "returned" });

    const replay = cleanupAllianceDefense(cleaned, {
      allianceId: "alliance:1",
      playerId: "player:2",
      sourceEventId: "alliance-exit:test:1",
      nowIso: "2026-07-15T12:00:00.000Z"
    });
    expect(replay.resourceStatesById["resource:2"].balances.vest).toBe(9);
    expect(replay.districtsById["district:1"].defenseLoadout.vest).toBe(8);
  });

  it("checks defense capacity before inventory debit", () => {
    const state = createDefenseState();
    state.districtsById["district:1"].defenseLoadout = { vest: 20 };
    const result = applyCommand(state, createPlaceDefenseCommandFixture({
      id: "command:defense:capacity",
      playerId: "player:2",
      payload: { targetDistrictId: "district:1", defenseItemId: "vest", amount: 1 }
    }), context);

    expect(result.errors).toContainEqual(expect.objectContaining({ code: "DEFENSE_CAPACITY_EXCEEDED" }));
    expect(result.nextState).toBe(state);
    expect(state.resourceStatesById["resource:2"].balances.vest).toBe(10);
  });
});

const createDefenseState = () => {
  const state = createCoreStateFixture();
  state.playersById["player:1"] = {
    ...state.playersById["player:1"],
    allianceId: "alliance:1"
  };
  state.alliancesById["alliance:1"] = createAllianceFixture({
    memberIds: ["player:1", "player:2", "player:3"]
  });
  for (const number of [2, 3]) {
    const playerId = `player:${number}`;
    const resourceStateId = `resource:${number}`;
    state.playersById[playerId] = createPlayerFixture({
      id: playerId,
      accountId: `account:${number}`,
      allianceId: "alliance:1",
      homeDistrictId: `district:${number}`,
      resourceStateId,
      cooldownStateId: `cooldown:${number}`,
      effectStateId: `effect:${number}`,
      policeStateId: `police:${number}`
    });
    state.resourceStatesById[resourceStateId] = createResourceStateFixture({
      id: resourceStateId,
      ownerType: "player",
      ownerId: playerId,
      balances: { vest: 10 }
    });
    state.districtsById[`district:${number}`] = createDistrictFixture({
      id: `district:${number}`,
      ownerPlayerId: playerId,
      adjacentDistrictIds: ["district:1"]
    });
  }
  state.districtsById["district:1"] = {
    ...state.districtsById["district:1"],
    adjacentDistrictIds: ["district:2", "district:3"],
    defenseLoadout: {}
  };
  state.root.playerIds.push("player:2", "player:3");
  state.root.districtIds.push("district:2", "district:3");
  return state;
};
