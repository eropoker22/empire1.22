import {
  applyCommand,
  applyDefenseCombatLosses,
  cleanupAllianceDefense,
  getPlayerSpyOperationState,
  hasValidAttackAuthorization,
  resolveImmediateHeist,
  seedNeutralDistrictLootPool
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import {
  createAttackDistrictCommandFixture,
  createHeistDistrictCommandFixture,
  createPlaceDefenseCommandFixture,
  createRemoveDefenseCommandFixture,
  createRobDistrictCommandFixture,
  createSpyDistrictCommandFixture
} from "../../fixtures/command-fixtures";
import {
  createAllianceFixture,
  createCombatStateFixture,
  createCoreStateFixture,
  createDistrictFixture,
  createPlayerFixture,
  createResourceStateFixture,
  seedSuccessfulSpyIntel
} from "../../fixtures/game-state-fixtures";

declare const process: { argv: string[] };

const assert = Object.assign(
  (condition: unknown, message = "Assertion failed") => {
    if (!condition) throw new Error(message);
  },
  {
    equal: (actual: unknown, expected: unknown) => {
      if (!Object.is(actual, expected)) {
        throw new Error(`Expected ${String(expected)}, received ${String(actual)}.`);
      }
    },
    deepEqual: (actual: unknown, expected: unknown) => {
      const actualJson = JSON.stringify(actual);
      const expectedJson = JSON.stringify(expected);
      if (actualJson !== expectedJson) {
        throw new Error(`Expected ${expectedJson}, received ${actualJson}.`);
      }
    },
    ok: (condition: unknown, message = "Assertion failed") => {
      if (!condition) throw new Error(message);
    }
  }
);

const config = resolveModeConfig("free");
const context = {
  config,
  clock: {
    now: () => new Date("2026-07-15T12:00:00.000Z"),
    nowIso: () => "2026-07-15T12:00:00.000Z"
  }
};

const runAllianceDefense = () => {
  const state = createCoreStateFixture();
  state.playersById["player:1"] = { ...state.playersById["player:1"], allianceId: "alliance:1" };
  state.playersById["player:2"] = createPlayerFixture({
    id: "player:2",
    accountId: "account:2",
    allianceId: "alliance:1",
    homeDistrictId: "district:2",
    resourceStateId: "resource:2",
    cooldownStateId: "cooldown:2",
    effectStateId: "effect:2",
    policeStateId: "police:2"
  });
  state.resourceStatesById["resource:2"] = createResourceStateFixture({
    id: "resource:2",
    ownerType: "player",
    ownerId: "player:2",
    balances: { vest: 10 }
  });
  state.districtsById["district:2"] = createDistrictFixture({ id: "district:2", ownerPlayerId: "player:2" });
  state.alliancesById["alliance:1"] = createAllianceFixture({ memberIds: ["player:1", "player:2"] });
  state.root.playerIds.push("player:2");
  state.root.districtIds.push("district:2");
  state.root.allianceIds.push("alliance:1");

  const placed = applyCommand(state, createPlaceDefenseCommandFixture({
    id: "e2e:defense:place",
    playerId: "player:2",
    payload: { targetDistrictId: "district:1", defenseItemId: "vest", amount: 10 }
  }), context);
  assert.deepEqual(placed.errors, []);
  assert.equal(placed.nextState.resourceStatesById["resource:2"].balances.vest, 0);

  const hostRemoval = applyCommand(placed.nextState, createRemoveDefenseCommandFixture({
    id: "e2e:defense:host-remove",
    playerId: "player:1",
    payload: { targetDistrictId: "district:1", defenseItemId: "vest", amount: 1 }
  }), context);
  assert.equal(hostRemoval.errors[0]?.code, "DEFENSE_NOT_OWNED");

  const damaged = applyDefenseCombatLosses(placed.nextState, {
    districtId: "district:1",
    losses: { vest: 3 },
    snapshotId: "e2e:defense:combat",
    createdAtTick: state.root.tick
  });
  const cleanupInput = {
    allianceId: "alliance:1",
    playerId: "player:2",
    sourceEventId: "e2e:defense:exit",
    nowIso: context.clock.nowIso()
  };
  const cleaned = cleanupAllianceDefense(damaged, cleanupInput);
  const replay = cleanupAllianceDefense(cleaned, cleanupInput);
  assert.equal(cleaned.resourceStatesById["resource:2"].balances.vest, 7);
  assert.equal(cleaned.districtsById["district:1"].defenseLoadout.vest ?? 0, 0);
  assert.equal(replay.resourceStatesById["resource:2"].balances.vest, 7);
};

const runAttackStabilization = () => {
  const state = createCombatStateFixture();
  state.playersById["player:1"] = { ...state.playersById["player:1"], population: 500, attackLoadout: { bazooka: 10 } };
  state.resourceStatesById["resource:1"] = {
    ...state.resourceStatesById["resource:1"],
    balances: { ...state.resourceStatesById["resource:1"].balances, population: 500, bazooka: 10 }
  };
  state.districtsById["district:2"] = { ...state.districtsById["district:2"], defenseLoadout: { vest: 7 } };
  const third = createDistrictFixture({
    id: "district:3",
    ownerPlayerId: "player:2",
    adjacentDistrictIds: ["district:1"],
    defenseLoadout: {}
  });
  state.districtsById["district:1"].adjacentDistrictIds.push(third.id);
  state.districtsById[third.id] = third;
  state.root.districtIds.push(third.id);
  seedSuccessfulSpyIntel(state, "player:1", "district:1", third.id, "player:2");

  const captured = applyCommand(state, createAttackDistrictCommandFixture({
    id: "e2e:attack:capture",
    payload: { districtId: "district:2", sourceDistrictId: "district:1", weapons: { bazooka: 10 } }
  }), context);
  assert.deepEqual(captured.errors, []);
  assert.equal(captured.nextState.districtsById["district:2"].ownerPlayerId, "player:1");
  assert.deepEqual(captured.nextState.districtsById["district:2"].defenseLoadout, {});
  assert.ok((captured.nextState.districtsById["district:2"].stabilizingUntilTick ?? 0) > state.root.tick);
  assert.ok(Number(captured.nextState.resourceStatesById["resource:1"].balances.population) < 500);

  const second = applyCommand(captured.nextState, createAttackDistrictCommandFixture({
    id: "e2e:attack:second",
    payload: { districtId: "district:3", sourceDistrictId: "district:1", weapons: { bazooka: 1 } }
  }), context);
  assert.equal(second.errors[0]?.code, "DISTRICT_CONFLICT_STATE_CHANGED");
};

const runSpyHeistRob = () => {
  const spyState = createCombatStateFixture();
  for (const districtId of ["district:3", "district:4"]) {
    spyState.districtsById[districtId] = createDistrictFixture({
      id: districtId,
      ownerPlayerId: "player:2",
      adjacentDistrictIds: ["district:1"]
    });
    spyState.districtsById["district:1"].adjacentDistrictIds.push(districtId);
    spyState.root.districtIds.push(districtId);
  }
  const securityRevision = spyState.districtsById["district:2"].securityRevision;
  spyState.districtsById["district:2"].version += 1;
  assert.equal(spyState.districtsById["district:2"].securityRevision, securityRevision);
  assert.equal(hasValidAttackAuthorization(spyState, "player:1", "district:2"), true);
  spyState.notificationsById = {};
  const firstSpy = applyCommand(spyState, createSpyDistrictCommandFixture({ id: "e2e:spy:1" }), context);
  const secondSpy = applyCommand(firstSpy.nextState, createSpyDistrictCommandFixture({
    id: "e2e:spy:2",
    payload: { districtId: "district:3", sourceDistrictId: "district:1" }
  }), context);
  const thirdSpy = applyCommand(secondSpy.nextState, createSpyDistrictCommandFixture({
    id: "e2e:spy:3",
    payload: { districtId: "district:4", sourceDistrictId: "district:1" }
  }), context);
  assert.equal(getPlayerSpyOperationState(secondSpy.nextState, "player:1").slots.every(
    (slot) => slot.availableAtTick > secondSpy.nextState.root.tick
  ), true);
  assert.equal(thirdSpy.errors[0]?.code, "SPY_SLOT_LIMIT_REACHED");

  const heistState = createCombatStateFixture();
  heistState.playersById["player:1"] = { ...heistState.playersById["player:1"], population: 120 };
  const heistCommand = createHeistDistrictCommandFixture({ id: "e2e:heist:deterministic" });
  const heistConfig = config.balance.conflict!.heist!;
  assert.deepEqual(
    resolveImmediateHeist(heistState, heistCommand, "district:1", heistConfig),
    resolveImmediateHeist(heistState, heistCommand, "district:1", heistConfig)
  );

  const robState = createCombatStateFixture();
  robState.districtsById["district:2"] = {
    ...robState.districtsById["district:2"],
    ownerPlayerId: null,
    controllerAllianceId: null,
    status: "neutral",
    defenseLoadout: {}
  };
  const pool = seedNeutralDistrictLootPool(
    robState.serverInstance.worldSeed,
    robState.districtsById["district:2"],
    0,
    config.balance.conflict!.robbery!
  );
  robState.districtsById["district:2"].neutralLootPool = pool;
  const robbed = applyCommand(robState, createRobDistrictCommandFixture({ id: "e2e:rob:finite" }), context);
  assert.deepEqual(robbed.errors, []);
  const nextPool = robbed.nextState.districtsById["district:2"].neutralLootPool!;
  assert.ok(nextPool.cash + nextPool.dirtyCash <= pool.cash + pool.dirtyCash);
};

const scenario = process.argv.find((arg) => arg.startsWith("--scenario="))?.slice("--scenario=".length);
if (scenario === "alliance-defense") runAllianceDefense();
else if (scenario === "attack-stabilization") runAttackStabilization();
else if (scenario === "spy-heist-rob") runSpyHeistRob();
else throw new Error(`Unknown conflict hardening scenario: ${scenario ?? "missing"}`);

console.log(JSON.stringify({ scenario, passed: true }));
