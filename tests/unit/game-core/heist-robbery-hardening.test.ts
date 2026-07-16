import { describe, expect, it } from "vitest";
import {
  applyCommand,
  regenerateNeutralDistrictLootPool,
  resolveImmediateHeist,
  resolveNeutralRobbery,
  seedNeutralDistrictLootPool
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import {
  createHeistDistrictCommandFixture,
  createRobDistrictCommandFixture
} from "../../fixtures/command-fixtures";
import { createCombatStateFixture, createDistrictFixture } from "../../fixtures/game-state-fixtures";

const context = { config: resolveModeConfig("free") };
const heistConfig = context.config.balance.conflict!.heist!;
const robberyConfig = context.config.balance.conflict!.robbery!;

describe("immediate deterministic heist", () => {
  it("produces the same result 100 times and all-in carries greater detection risk", () => {
    const state = createHeistState();
    const command = createHeistDistrictCommandFixture({ id: "command:heist:deterministic" });
    const expected = resolveImmediateHeist(state, command, "district:1", heistConfig);

    expect(Array.from({ length: 100 }, () =>
      resolveImmediateHeist(state, command, "district:1", heistConfig)
    )).toEqual(Array.from({ length: 100 }, () => expected));

    const allIn = resolveImmediateHeist(state, createHeistDistrictCommandFixture({
      id: command.id,
      payload: {
        targetDistrictId: "district:2",
        sourceDistrictId: "district:1",
        style: "all_in",
        gangMembersSent: 25
      }
    }), "district:1", heistConfig);
    expect(allIn.detectionChance).toBeGreaterThan(expected.detectionChance);
    expect(heistConfig.styles.all_in.baseSuccessChance).toBeLessThan(
      heistConfig.styles.stealth.baseSuccessChance
    );
  });

  it("uses alarms and cameras in detection chance", () => {
    const state = createHeistState();
    state.districtsById["district:2"].defenseLoadout = {};
    const command = createHeistDistrictCommandFixture({ id: "command:heist:security" });
    const unsecured = resolveImmediateHeist(state, command, "district:1", heistConfig);
    state.districtsById["district:2"].defenseLoadout = { alarm: 2, cameras: 3 };
    const secured = resolveImmediateHeist(state, command, "district:1", heistConfig);

    expect(secured.detectionChance).toBeGreaterThan(unsecured.detectionChance);
  });

  it("resolves every non-trap canonical outcome from server seeds", () => {
    const state = createHeistState();
    for (const outcome of ["clean_success", "success", "detected", "failed"] as const) {
      const command = findHeistCommand(state, [outcome]);
      expect(resolveImmediateHeist(state, command, "district:1", heistConfig).outcome).toBe(outcome);
    }
  });

  it("blocks a second target on the player-global cooldown", () => {
    const state = createHeistState();
    state.districtsById["district:1"].adjacentDistrictIds.push("district:3");
    state.districtsById["district:3"] = createDistrictFixture({
      id: "district:3",
      ownerPlayerId: "player:2",
      adjacentDistrictIds: ["district:1"]
    });
    state.root.districtIds.push("district:3");
    const first = applyCommand(state, createHeistDistrictCommandFixture({
      id: "command:heist:global:1"
    }), context);
    const second = applyCommand(first.nextState, createHeistDistrictCommandFixture({
      id: "command:heist:global:2",
      payload: {
        targetDistrictId: "district:3",
        sourceDistrictId: "district:1",
        style: "balanced",
        gangMembersSent: 10
      }
    }), context);

    expect(first.errors).toEqual([]);
    expect(second.errors).toContainEqual(expect.objectContaining({
      code: "PLAYER_MAJOR_OPERATION_ACTIVE"
    }));
  });

  it("transfers only existing allowed resources, records real losses and canonical heat", () => {
    const state = createHeistState();
    state.resourceStatesById["resource:1"].balances["metal-parts"] = 100_000;
    state.resourceStatesById["resource:2"].balances = {
      cash: 1000,
      "dirty-cash": 500,
      chemicals: 40,
      biomass: 30,
      "metal-parts": 50,
      "tech-core": 20,
      "combat-module": 9,
      bazooka: 4
    };
    const command = findHeistCommand(state, ["clean_success", "success", "detected"]);
    const beforeAttacker = { ...state.resourceStatesById["resource:1"].balances };
    const beforeDefender = { ...state.resourceStatesById["resource:2"].balances };
    const result = applyCommand(state, command, context);
    const eventPayload = result.events[0]?.payload as Record<string, unknown>;
    const loot = eventPayload.loot as Record<string, number>;

    expect(result.errors).toEqual([]);
    for (const key of ["cash", "dirty-cash", "chemicals", "biomass", "metal-parts", "tech-core"]) {
      expect(
        Number(result.nextState.resourceStatesById["resource:1"].balances[key] ?? 0)
        - Number(beforeAttacker[key] ?? 0)
      ).toBe(loot[key] ?? 0);
      expect(
        Number(beforeDefender[key] ?? 0)
        - Number(result.nextState.resourceStatesById["resource:2"].balances[key] ?? 0)
      ).toBe(loot[key] ?? 0);
    }
    expect(result.nextState.resourceStatesById["resource:2"].balances["combat-module"]).toBe(9);
    expect(result.nextState.resourceStatesById["resource:2"].balances.bazooka).toBe(4);
    expect(loot["metal-parts"]).toBe(0);
    expect(result.nextState.policeStatesById["police:1"]?.heat).toBeGreaterThan(0);
    expect(result.nextState.districtsById["district:2"].heistProtectedUntilTick)
      .toBe(context.config.balance.conflict!.heist!.victimProtectionTicks);
  });

  it("consumes a triggered trap once and gives no loot", () => {
    const state = createHeistState();
    state.trapsById["trap:test"] = {
      id: "trap:test",
      serverInstanceId: state.serverInstance.id,
      districtId: "district:2",
      ownerPlayerId: "player:2",
      status: "active",
      placedAtTick: 0,
      triggeredAtTick: null,
      version: 1
    };
    state.root.trapIds.push("trap:test");
    const command = findHeistCommand(state, ["trap_triggered"]);
    const result = applyCommand(state, command, context);

    expect(result.errors).toEqual([]);
    const eventPayload = result.events[0]?.payload as Record<string, unknown>;
    expect(eventPayload.outcome).toBe("trap_triggered");
    expect(eventPayload.loot).toMatchObject({
      cash: 0,
      "dirty-cash": 0,
      chemicals: 0,
      biomass: 0,
      "metal-parts": 0,
      "tech-core": 0
    });
    expect(result.nextState.trapsById["trap:test"].status).toBe("triggered");
  });
});

describe("finite neutral robbery", () => {
  it("seeds deterministically and debits exactly what the attacker receives", () => {
    const state = createNeutralRobState();
    const firstPool = seedNeutralDistrictLootPool(
      state.serverInstance.worldSeed,
      state.districtsById["district:2"],
      0,
      robberyConfig
    );
    const secondPool = seedNeutralDistrictLootPool(
      state.serverInstance.worldSeed,
      state.districtsById["district:2"],
      0,
      robberyConfig
    );
    expect(firstPool).toEqual(secondPool);
    state.districtsById["district:2"].neutralLootPool = firstPool;
    const command = findRobCommand(state, "success");
    const beforeCash = Number(state.resourceStatesById["resource:1"].balances.cash ?? 0);
    const result = applyCommand(state, command, context);
    const eventPayload = result.events[0]?.payload as Record<string, unknown>;
    const loot = eventPayload.loot as Record<string, number>;
    const pool = result.nextState.districtsById["district:2"].neutralLootPool!;

    expect(result.errors).toEqual([]);
    expect(Number(result.nextState.resourceStatesById["resource:1"].balances.cash ?? 0) - beforeCash).toBe(loot.cash);
    expect(firstPool.cash - pool.cash).toBe(loot.cash);
    expect(result.nextState.policeStatesById["police:1"]?.heat).toBe(eventPayload.playerHeat);
  });

  it("rejects an exhausted pool without creating any gameplay mutation", () => {
    const state = createNeutralRobState();
    state.districtsById["district:2"].neutralLootPool = {
      initialSeed: "empty",
      initialCash: 100,
      initialDirtyCash: 50,
      initialResources: { chemicals: 10, biomass: 10, "metal-parts": 10 },
      cash: 0,
      dirtyCash: 0,
      resources: { chemicals: 0, biomass: 0, "metal-parts": 0 },
      lastRegenerationCityDay: 0,
      version: 1
    };
    const before = JSON.stringify(state);
    const result = applyCommand(state, createRobDistrictCommandFixture({ id: "command:rob:empty" }), context);

    expect(result.errors[0]?.code).toBe("TARGET_LOOT_EXHAUSTED");
    expect(result.events).toEqual([]);
    expect(result.nextState).toBe(state);
    expect(JSON.stringify(result.nextState)).toBe(before);
  });

  it("regenerates at most once per city day and never above initial cap", () => {
    const pool = {
      initialSeed: "regen",
      initialCash: 100,
      initialDirtyCash: 40,
      initialResources: { chemicals: 20, biomass: 8, "metal-parts": 12 },
      cash: 0,
      dirtyCash: 0,
      resources: { chemicals: 0, biomass: 0, "metal-parts": 0 },
      lastRegenerationCityDay: 0,
      version: 1
    };
    const dayOne = regenerateNeutralDistrictLootPool(pool, 1, 0.25);
    const repeated = regenerateNeutralDistrictLootPool(dayOne, 1, 0.25);
    const muchLater = regenerateNeutralDistrictLootPool(repeated, 20, 0.25);

    expect(dayOne.cash).toBe(25);
    expect(repeated).toBe(dayOne);
    expect(muchLater.cash).toBe(100);
    expect(muchLater.dirtyCash).toBe(40);
    expect(muchLater.resources).toEqual(pool.initialResources);
  });

  it("has deterministic partial and failed branches without client outcome input", () => {
    const state = createNeutralRobState();
    const pool = seedNeutralDistrictLootPool(
      state.serverInstance.worldSeed,
      state.districtsById["district:2"],
      0,
      robberyConfig
    );
    for (const outcome of ["partial", "failed"] as const) {
      const commandId = Array.from({ length: 2000 }, (_, index) => `command:rob:${outcome}:${index}`)
        .find((id) => resolveNeutralRobbery(state.serverInstance.worldSeed, id, "district:2", pool).outcome === outcome);
      expect(commandId).toBeTruthy();
      expect(resolveNeutralRobbery(state.serverInstance.worldSeed, commandId!, "district:2", pool).outcome)
        .toBe(outcome);
    }
  });
});

const createHeistState = () => {
  const state = createCombatStateFixture();
  state.playersById["player:1"] = { ...state.playersById["player:1"], population: 120 };
  state.playersById["player:2"] = {
    ...state.playersById["player:2"],
    population: 120,
    resourceStateId: "resource:2"
  };
  state.resourceStatesById["resource:1"].balances = { cash: 1000, population: 120 };
  state.resourceStatesById["resource:2"] = {
    ...state.resourceStatesById["resource:1"],
    id: "resource:2",
    ownerId: "player:2",
    balances: { cash: 1000, "dirty-cash": 500 }
  };
  return state;
};

const createNeutralRobState = () => {
  const state = createHeistState();
  state.districtsById["district:2"] = {
    ...state.districtsById["district:2"],
    ownerPlayerId: null,
    controllerAllianceId: null,
    status: "neutral",
    defenseLoadout: {}
  };
  return state;
};

const findHeistCommand = (
  state: ReturnType<typeof createHeistState>,
  outcomes: string[]
) => {
  for (let index = 0; index < 5000; index += 1) {
    const command = createHeistDistrictCommandFixture({ id: `command:heist:outcome:${index}` });
    if (outcomes.includes(resolveImmediateHeist(state, command, "district:1", heistConfig).outcome)) {
      return command;
    }
  }
  throw new Error(`No deterministic heist seed found for ${outcomes.join(",")}.`);
};

const findRobCommand = (state: ReturnType<typeof createNeutralRobState>, outcome: string) => {
  const pool = state.districtsById["district:2"].neutralLootPool!;
  for (let index = 0; index < 2000; index += 1) {
    const command = createRobDistrictCommandFixture({ id: `command:rob:outcome:${index}` });
    if (resolveNeutralRobbery(state.serverInstance.worldSeed, command.id, "district:2", pool).outcome === outcome) {
      return command;
    }
  }
  throw new Error(`No deterministic robbery seed found for ${outcome}.`);
};
