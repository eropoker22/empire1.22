import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "../../../packages/game-config/src";
import { applyCommand } from "../../../packages/game-core/src/engine";
import { seedNeutralDistrictLootPool } from "../../../packages/game-core/src/rules";
import {
  createAttackDistrictCommandFixture,
  createOccupyDistrictCommandFixture,
  createPlaceDefenseCommandFixture,
  createRobDistrictCommandFixture
} from "../../fixtures/command-fixtures";
import {
  createCombatStateFixture,
  createDistrictFixture,
  createPlayerFixture,
  createResourceStateFixture,
  seedSuccessfulSpyIntel
} from "../../fixtures/game-state-fixtures";

const config = resolveModeConfig("free");
const context = {
  config,
  clock: {
    now: () => new Date("2026-01-01T00:00:00.000Z"),
    nowIso: () => "2026-01-01T00:00:00.000Z"
  }
};

describe("conflict concurrency integrity", () => {
  it("accepts one of three same-target attacks and leaves stale losers unchanged", () => {
    const state = createCombatStateFixture();
    state.playersById["player:2"] = { ...state.playersById["player:2"], lastStandUsedAtTick: 0 };
    state.districtsById["district:2"] = { ...state.districtsById["district:2"], defenseLoadout: {} };
    configureAttacker(state, "player:1", "district:1");
    addAttacker(state, "player:3", "district:3", "district:2");
    addAttacker(state, "player:4", "district:4", "district:2");
    const expectedConflictRevision = state.districtsById["district:2"].conflictRevision;
    const commands = [
      ["player:1", "district:1"],
      ["player:3", "district:3"],
      ["player:4", "district:4"]
    ].map(([playerId, sourceDistrictId], index) => createAttackDistrictCommandFixture({
      id: `command:race:attack:${index + 1}`,
      playerId,
      payload: {
        districtId: "district:2",
        sourceDistrictId,
        weapons: { bazooka: 10 },
        expectedConflictRevision
      }
    }));

    const first = applyCommand(state, commands[0], context);
    expect(first.errors).toEqual([]);
    const protectionAfterFirst = first.nextState.districtsById["district:2"].attackProtectedUntilTick;
    const loserResourceBefore = JSON.stringify(first.nextState.resourceStatesById["resource:player:3"]);
    const second = applyCommand(first.nextState, commands[1], context);
    const third = applyCommand(first.nextState, commands[2], context);

    expect(second.errors[0]?.code).toBe("DISTRICT_CONFLICT_STATE_CHANGED");
    expect(third.errors[0]?.code).toBe("DISTRICT_CONFLICT_STATE_CHANGED");
    expect(second.nextState).toBe(first.nextState);
    expect(third.nextState).toBe(first.nextState);
    expect(JSON.stringify(first.nextState.resourceStatesById["resource:player:3"])).toBe(loserResourceBefore);
    expect(first.nextState.districtsById["district:2"].attackProtectedUntilTick).toBe(protectionAfterFirst);

    for (let index = 0; index < 10; index += 1) {
      const retry = applyCommand(first.nextState, {
        ...commands[1],
        id: `command:race:attack:retry:${index}`,
        payload: {
          ...commands[1].payload,
          expectedConflictRevision: first.nextState.districtsById["district:2"].conflictRevision
        }
      }, context);
      expect(["TARGET_ATTACK_PROTECTED", "TARGET_OWNER_CHANGED", "TARGET_STABILIZING"]).toContain(retry.errors[0]?.code);
      expect(retry.nextState).toBe(first.nextState);
      expect(first.nextState.districtsById["district:2"].attackProtectedUntilTick).toBe(protectionAfterFirst);
    }
  });

  it("rejects an attack preview made before a defense placement without partial mutation", () => {
    const state = createCombatStateFixture();
    state.districtsById["district:2"] = { ...state.districtsById["district:2"], defenseLoadout: {} };
    state.resourceStatesById[state.playersById["player:2"].resourceStateId] = {
      ...state.resourceStatesById[state.playersById["player:2"].resourceStateId],
      balances: { barricades: 1 }
    };
    const attack = createAttackDistrictCommandFixture({
      payload: {
        districtId: "district:2",
        sourceDistrictId: "district:1",
        weapons: { "baseball-bat": 1 },
        expectedConflictRevision: state.districtsById["district:2"].conflictRevision
      }
    });
    const defended = applyCommand(state, createPlaceDefenseCommandFixture({
      playerId: "player:2",
      payload: { targetDistrictId: "district:2", defenseItemId: "barricades", amount: 1 }
    }), context);
    const attackerBefore = JSON.stringify(defended.nextState.resourceStatesById["resource:1"]);
    const rejected = applyCommand(defended.nextState, attack, context);

    expect(defended.errors).toEqual([]);
    expect(rejected.errors[0]?.code).toBe("DISTRICT_CONFLICT_STATE_CHANGED");
    expect(rejected.nextState).toBe(defended.nextState);
    expect(JSON.stringify(defended.nextState.resourceStatesById["resource:1"])).toBe(attackerBefore);
  });

  it("blocks a second major operation after an accepted attack", () => {
    const state = createCombatStateFixture();
    state.playersById["player:2"] = { ...state.playersById["player:2"], lastStandUsedAtTick: 0 };
    state.districtsById["district:1"] = { ...state.districtsById["district:1"], influence: 10_000 };
    state.playersById["player:1"] = { ...state.playersById["player:1"], population: 500, attackLoadout: { bazooka: 10 } };
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: { ...state.resourceStatesById["resource:1"].balances, population: 500, bazooka: 10 }
    };
    const neutral = createDistrictFixture({
      id: "district:3",
      ownerPlayerId: null,
      status: "neutral",
      adjacentDistrictIds: ["district:1"]
    });
    state.districtsById["district:1"].adjacentDistrictIds.push(neutral.id);
    state.districtsById[neutral.id] = neutral;
    state.root.districtIds.push(neutral.id);
    seedSuccessfulSpyIntel(state, "player:1", "district:1", neutral.id, null);

    const attack = applyCommand(state, createAttackDistrictCommandFixture({
      payload: { weapons: { bazooka: 10 }, expectedConflictRevision: state.districtsById["district:2"].conflictRevision }
    }), context);
    const occupy = applyCommand(attack.nextState, createOccupyDistrictCommandFixture({
      id: "command:race:occupy-after-attack",
      payload: {
        districtId: neutral.id,
        sourceDistrictId: "district:1",
        expectedConflictRevision: attack.nextState.districtsById[neutral.id].conflictRevision
      }
    }), context);

    expect(attack.errors).toEqual([]);
    expect(occupy.errors[0]?.code).toBe("PLAYER_MAJOR_OPERATION_ACTIVE");
    expect(occupy.nextState).toBe(attack.nextState);
  });

  it("serializes competitive robbery against the current finite pool", () => {
    const state = createCombatStateFixture();
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      ownerPlayerId: null,
      controllerAllianceId: null,
      status: "neutral",
      defenseLoadout: {}
    };
    addAttacker(state, "player:3", "district:3", "district:2");
    const pool = seedNeutralDistrictLootPool(
      state.serverInstance.worldSeed,
      state.districtsById["district:2"],
      0,
      config.balance.conflict!.robbery!
    );
    state.districtsById["district:2"].neutralLootPool = pool;
    const initialTotal = poolTotal(pool);
    const beforeA = Number(state.resourceStatesById["resource:1"].balances.cash ?? 0);
    const beforeB = Number(state.resourceStatesById["resource:player:3"].balances.cash ?? 0);
    const expectedConflictRevision = state.districtsById["district:2"].conflictRevision;

    const first = applyCommand(state, createRobDistrictCommandFixture({
      id: "command:race:rob:1",
      payload: { expectedConflictRevision }
    }), context);
    const second = applyCommand(first.nextState, createRobDistrictCommandFixture({
      id: "command:race:rob:2",
      playerId: "player:3",
      payload: {
        targetDistrictId: "district:2",
        sourceDistrictId: "district:3",
        expectedConflictRevision
      }
    }), context);

    expect(first.errors).toEqual([]);
    expect(second.errors).toEqual([]);
    const finalPool = second.nextState.districtsById["district:2"].neutralLootPool!;
    const cashCredits = Number(second.nextState.resourceStatesById["resource:1"].balances.cash ?? 0) - beforeA
      + Number(second.nextState.resourceStatesById["resource:player:3"].balances.cash ?? 0) - beforeB;
    expect(poolTotal(finalPool)).toBeGreaterThanOrEqual(0);
    expect(cashCredits).toBeLessThanOrEqual(pool.cash);
    expect(initialTotal - poolTotal(finalPool)).toBeGreaterThanOrEqual(cashCredits);
  });
});

const configureAttacker = (state: ReturnType<typeof createCombatStateFixture>, playerId: string, sourceDistrictId: string) => {
  const player = state.playersById[playerId];
  state.playersById[playerId] = { ...player, population: 500, attackLoadout: { bazooka: 10 } };
  state.resourceStatesById[player.resourceStateId] = {
    ...state.resourceStatesById[player.resourceStateId],
    balances: { ...state.resourceStatesById[player.resourceStateId].balances, population: 500, bazooka: 10 }
  };
  seedSuccessfulSpyIntel(state, playerId, sourceDistrictId, "district:2", "player:2");
};

const addAttacker = (
  state: ReturnType<typeof createCombatStateFixture>,
  playerId: string,
  sourceDistrictId: string,
  targetDistrictId: string
) => {
  const suffix = playerId.split(":").at(-1)!;
  const resourceStateId = `resource:${playerId}`;
  const cooldownStateId = `cooldown:${playerId}`;
  const policeStateId = `police:${playerId}`;
  state.playersById[playerId] = createPlayerFixture({
    id: playerId,
    accountId: `account:${suffix}`,
    homeDistrictId: sourceDistrictId,
    resourceStateId,
    cooldownStateId,
    policeStateId,
    population: 500,
    attackLoadout: { bazooka: 10 }
  });
  state.resourceStatesById[resourceStateId] = createResourceStateFixture({
    id: resourceStateId,
    ownerType: "player",
    ownerId: playerId,
    balances: { cash: 1_000, population: 500, bazooka: 10 }
  });
  state.cooldownStatesById[cooldownStateId] = {
    id: cooldownStateId,
    ownerType: "player",
    ownerId: playerId,
    cooldowns: {},
    version: 1
  };
  state.policeStatesById[policeStateId] = {
    id: policeStateId,
    ownerPlayerId: playerId,
    heat: 0,
    wantedLevel: 0,
    lastDecayTick: 0,
    activeFlags: [],
    version: 1
  };
  state.districtsById[sourceDistrictId] = createDistrictFixture({
    id: sourceDistrictId,
    ownerPlayerId: playerId,
    adjacentDistrictIds: [targetDistrictId]
  });
  state.districtsById[targetDistrictId].adjacentDistrictIds = [
    ...new Set([...state.districtsById[targetDistrictId].adjacentDistrictIds, sourceDistrictId])
  ];
  state.root.playerIds.push(playerId);
  state.root.districtIds.push(sourceDistrictId);
  seedSuccessfulSpyIntel(state, playerId, sourceDistrictId, targetDistrictId, state.districtsById[targetDistrictId].ownerPlayerId);
};

const poolTotal = (pool: NonNullable<ReturnType<typeof createCombatStateFixture>["districtsById"][string]["neutralLootPool"]>) =>
  pool.cash + pool.dirtyCash + Object.values(pool.resources).reduce((sum, amount) => sum + Number(amount), 0);
