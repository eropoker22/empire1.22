import { describe, expect, it } from "vitest";
import { applyCommand } from "../../../packages/game-core/src/engine";
import {
  hasValidAttackAuthorization,
  migrateConflictState
} from "../../../packages/game-core/src";
import { resolveModeConfig } from "@empire/game-config";
import {
  createAttackDistrictCommandFixture,
  createOccupyDistrictCommandFixture,
  createPlaceTrapCommandFixture,
  createSpyDistrictCommandFixture
} from "../../fixtures/command-fixtures";
import {
  createCombatStateFixture,
  createDistrictFixture,
  seedSuccessfulSpyIntel
} from "../../fixtures/game-state-fixtures";

const freeConfig = resolveModeConfig("free");
const context = {
  config: {
    ...freeConfig,
    balance: {
      ...freeConfig.balance,
      conflict: {
        ...freeConfig.balance.conflict!,
        spyCooldownTicks: 2,
        attackCooldownTicks: 2,
        spyBaseSuccessChance: 0.72,
        spyTrapRevealChance: 0.22,
        trapAttackLosses: 1,
        reportsLimit: 6
      }
    }
  }
};

describe("conflict command flow", () => {
  it("spy returns a server-authored report notification", () => {
    const state = createCombatStateFixture();
    removeSeededSpyIntel(state, "player:1", "district:2");
    state.serverInstance.worldSeed = "spy-seed-1";
    const command = createSpyDistrictCommandFixture();

    const result = applyCommand(state, command, context);

    expect(result.errors).toEqual([]);
    const notification = result.nextState.notificationsById["notification:command:spy:1:spy-report"];

    expect(notification?.category).toBe("report.spy");
    expect(notification?.payload).toMatchObject({
      actionType: "spy-district",
      attackerPlayerId: "player:1",
      targetDistrictId: "district:2",
      targetSecurityRevision: 1,
      issuedAtTick: 0
    });
  });

  it("keeps spy authorization across passive version changes but invalidates security changes", () => {
    const state = createCombatStateFixture();
    expect(hasValidAttackAuthorization(state, "player:1", "district:2")).toBe(true);

    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      version: state.districtsById["district:2"].version + 1
    };
    expect(hasValidAttackAuthorization(state, "player:1", "district:2")).toBe(true);

    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      securityRevision: state.districtsById["district:2"].securityRevision + 1,
      version: state.districtsById["district:2"].version + 1
    };
    expect(hasValidAttackAuthorization(state, "player:1", "district:2")).toBe(false);
  });

  it("does not consume a spy slot for duplicate active intel", () => {
    const state = createCombatStateFixture();
    const result = applyCommand(state, createSpyDistrictCommandFixture(), context);

    expect(result.errors[0]?.code).toBe("SPY_INTEL_ALREADY_ACTIVE");
    expect(result.nextState).toBe(state);
    expect(result.nextState.playerSpyOperationStatesByPlayerId?.["player:1"]).toBeUndefined();
  });

  it("migrates missing district security and conflict revisions once", () => {
    const state = createCombatStateFixture();
    const legacyDistrict = { ...state.districtsById["district:2"] } as Record<string, unknown>;
    delete legacyDistrict.securityRevision;
    delete legacyDistrict.conflictRevision;
    state.districtsById["district:2"] = legacyDistrict as unknown as typeof state.districtsById[string];

    const once = migrateConflictState(state);
    const twice = migrateConflictState(once);

    expect(once.districtsById["district:2"].securityRevision).toBe(
      once.districtsById["district:2"].version
    );
    expect(twice.districtsById["district:2"].securityRevision).toBe(
      once.districtsById["district:2"].securityRevision
    );
    expect(once.districtsById["district:2"].conflictRevision).toBe(
      once.districtsById["district:2"].version
    );
    expect(twice.districtsById["district:2"].conflictRevision).toBe(
      once.districtsById["district:2"].conflictRevision
    );
  });

  it("place trap stores hidden trap state on the target district", () => {
    const state = createCombatStateFixture();
    const command = createPlaceTrapCommandFixture();

    const result = applyCommand(state, command, context);

    expect(result.errors).toEqual([]);
    expect(result.nextState.trapsById["trap:district:2"]).toMatchObject({
      districtId: "district:2",
      ownerPlayerId: "player:2",
      status: "active"
    });
    expect(result.nextState.root.trapIds).toContain("trap:district:2");
  });

  it("spy can deterministically reveal an active trap from the server seed", () => {
    const worldSeed = findTrapRevealSeed();
    expect(worldSeed, "Expected at least one deterministic trap reveal seed.").toBeTruthy();
    const state = createCombatStateFixture();
    state.serverInstance.worldSeed = worldSeed!;
    const trappedState = applyCommand(state, createPlaceTrapCommandFixture(), context).nextState;

    const result = applyCommand(trappedState, createSpyDistrictCommandFixture(), context);
    const notification = result.nextState.notificationsById["notification:command:spy:1:spy-report"];

    expect(result.errors).toEqual([]);
    expect(notification?.payload).toMatchObject({
      result: "success",
      trapDetected: true
    });
  });

  it("successful spy intel unlocks neutral district occupation", () => {
    const state = createCombatStateFixture();
    removeSeededSpyIntel(state, "player:1", "district:2");
    state.serverInstance.worldSeed = "spy-seed-10";
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      population: 100
    };
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: {
        ...state.resourceStatesById["resource:1"]?.balances,
        population: 100
      }
    };
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      influence: 20
    };
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      ownerPlayerId: null,
      status: "neutral",
      defenseLoadout: {}
    };

    const spy = applyCommand(state, createSpyDistrictCommandFixture(), context);
    const report = spy.nextState.notificationsById["notification:command:spy:1:spy-report"];

    expect(spy.errors).toEqual([]);
    expect(report?.payload).toMatchObject({
      result: "success",
      targetDistrictId: "district:2"
    });

    const occupied = applyCommand(spy.nextState, createOccupyDistrictCommandFixture({
      payload: {
        expectedConflictRevision: spy.nextState.districtsById["district:2"].conflictRevision
      }
    }), context);

    expect(occupied.errors).toEqual([]);
    expect(occupied.nextState.districtsById["district:2"]?.ownerPlayerId).toBe("player:1");
  });

  it("partial spy intel reveals limited info but does not unlock neutral district occupation", () => {
    const spy = findSpyOutcome("partial");

    expect(spy, "Expected at least one deterministic partial spy seed.").toBeTruthy();
    const partialSpy = spy!;
    const report = partialSpy.nextState.notificationsById["notification:command:spy:1:spy-report"];

    expect(partialSpy.errors).toEqual([]);
    expect(report?.payload).toMatchObject({
      result: "partial",
      targetDistrictId: "district:2",
      revealedType: true,
      revealedDefense: false,
      occupyUnlocked: false
    });

    const occupied = applyCommand(partialSpy.nextState, createOccupyDistrictCommandFixture({
      payload: {
        expectedConflictRevision: partialSpy.nextState.districtsById["district:2"].conflictRevision
      }
    }), context);

    expect(occupied.errors).toContainEqual(expect.objectContaining({
      code: "OCCUPY_SPY_REQUIRED"
    }));
    expect(occupied.nextState.districtsById["district:2"]?.ownerPlayerId).toBeNull();
  });

  it.each(["failed", "critical_failed"] as const)(
    "%s spy intel does not unlock neutral district occupation and blocks a spy slot",
    (outcome) => {
      const spy = findSpyOutcome(outcome);

      expect(spy, `Expected at least one deterministic ${outcome} spy seed.`).toBeTruthy();
      const blockedSpy = spy!;
      const report = blockedSpy.nextState.notificationsById["notification:command:spy:1:spy-report"];

      expect(blockedSpy.errors).toEqual([]);
      expect(report?.payload).toMatchObject({
        result: outcome,
        targetDistrictId: "district:2",
        occupyUnlocked: false
      });
      expect(report?.payload.blockedUntilTick).toBeGreaterThan(blockedSpy.nextState.root.tick);
      expect(blockedSpy.nextState.playerSpyOperationStatesByPlayerId?.["player:1"]?.slots[0]?.availableAtTick)
        .toBeGreaterThan(blockedSpy.nextState.root.tick);
      if (outcome === "critical_failed") {
        expect(blockedSpy.nextState.policeStatesById["police:1"]?.heat).toBeGreaterThan(0);
      }

      const occupied = applyCommand(blockedSpy.nextState, createOccupyDistrictCommandFixture({
        payload: {
          expectedConflictRevision: blockedSpy.nextState.districtsById["district:2"].conflictRevision
        }
      }), context);

      expect(occupied.errors).toContainEqual(expect.objectContaining({
        code: "OCCUPY_SPY_REQUIRED"
      }));
      expect(occupied.nextState.districtsById["district:2"]?.ownerPlayerId).toBeNull();
    }
  );

  it("uses exactly two slots for successful spy commands and releases them by tick", () => {
    const worldSeed = findSuccessCapacitySeed();
    expect(worldSeed, "Expected a deterministic seed with two successful spy outcomes.").toBeTruthy();
    const state = createThreeTargetSpyState(worldSeed!);
    const first = applyCommand(state, createSpyDistrictCommandFixture({
      id: "command:spy:slot:1",
      payload: {
        districtId: "district:2",
        sourceDistrictId: "district:1"
      }
    }), context);
    const second = applyCommand(first.nextState, createSpyDistrictCommandFixture({
      id: "command:spy:slot:2",
      payload: {
        districtId: "district:3",
        sourceDistrictId: "district:1"
      }
    }), context);
    const third = applyCommand(second.nextState, createSpyDistrictCommandFixture({
      id: "command:spy:slot:3",
      payload: {
        districtId: "district:4",
        sourceDistrictId: "district:1"
      }
    }), context);

    expect(first.errors).toEqual([]);
    expect(second.errors).toEqual([]);
    expect([
      first.nextState.notificationsById["notification:command:spy:slot:1:spy-report"]?.payload.result,
      second.nextState.notificationsById["notification:command:spy:slot:2:spy-report"]?.payload.result
    ]).toEqual(["success", "success"]);
    expect(third.errors).toContainEqual(expect.objectContaining({
      code: "SPY_SLOT_LIMIT_REACHED"
    }));

    second.nextState.root.tick = second.nextState.playerSpyOperationStatesByPlayerId?.["player:1"]?.slots[0]
      ?.availableAtTick ?? second.nextState.root.tick;
    const afterExpiry = applyCommand(second.nextState, createSpyDistrictCommandFixture({
      id: "command:spy:slot:4",
      payload: {
        districtId: "district:4",
        sourceDistrictId: "district:1"
      }
    }), context);
    expect(afterExpiry.errors).toEqual([]);
  });

  it("attack triggers an active trap and applies attacker losses", () => {
    const state = createCombatStateFixture();
    const trappedState = applyCommand(state, createPlaceTrapCommandFixture(), context).nextState;
    seedSuccessfulSpyIntel(trappedState, "player:1", "district:1", "district:2", "player:2");

    const result = applyCommand(trappedState, createAttackDistrictCommandFixture({
      payload: { expectedConflictRevision: trappedState.districtsById["district:2"].conflictRevision }
    }), context);
    const notification = result.nextState.notificationsById["notification:command:attack:1:battle:player:1"];

    expect(result.errors).toEqual([]);
    expect(result.nextState.trapsById["trap:district:2"]?.status).toBe("triggered");
    expect(result.nextState.playersById["player:1"]?.attackLoadout["baseball-bat"]).toBe(0);
    expect(notification?.payload).toMatchObject({
      trapTriggered: true,
      attackerLosses: {
        "baseball-bat": 1
      }
    });
  });

  it("attack without trap computes the basic battle outcome and can capture the district", () => {
    const state = createCombatStateFixture();
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      defenseLoadout: {}
    };

    const result = applyCommand(state, createAttackDistrictCommandFixture(), context);
    const notification = result.nextState.notificationsById["notification:command:attack:1:battle:player:1"];

    expect(result.errors).toEqual([]);
    expect(result.nextState.districtsById["district:2"].ownerPlayerId).toBe("player:1");
    expect(notification?.payload).toMatchObject({
      result: "success",
      districtCaptured: true,
      trapTriggered: false
    });
  });

  it("does not let players change attack randomness by changing only command id", () => {
    const firstState = createCombatStateFixture();
    const secondState = createCombatStateFixture();
    firstState.serverInstance.worldSeed = "rng-hardening";
    secondState.serverInstance.worldSeed = "rng-hardening";

    const hardenedContext = {
      config: {
        ...context.config,
        balance: {
          ...context.config.balance,
          conflict: {
            ...context.config.balance.conflict,
            catastropheChance: 0.052
          }
        }
      }
    };
    const first = applyCommand(
      firstState,
      createAttackDistrictCommandFixture({ id: "command:1" }),
      hardenedContext
    );
    const second = applyCommand(
      secondState,
      createAttackDistrictCommandFixture({ id: "command:2" }),
      hardenedContext
    );

    expect(first.errors).toEqual([]);
    expect(second.errors).toEqual([]);
    expect(first.nextState.districtsById["district:2"].status).toBe(second.nextState.districtsById["district:2"].status);
    expect(first.nextState.districtsById["district:2"].ownerPlayerId).toBe(second.nextState.districtsById["district:2"].ownerPlayerId);
    expect(first.events.map((event) => event.type)).toEqual(second.events.map((event) => event.type));
  });
});

const createNeutralSpyState = (worldSeed: string) => {
  const state = createCombatStateFixture();
  state.serverInstance.worldSeed = worldSeed;
  state.districtsById["district:1"] = {
    ...state.districtsById["district:1"],
    influence: 20
  };
  state.districtsById["district:2"] = {
    ...state.districtsById["district:2"],
    ownerPlayerId: null,
    status: "neutral",
    defenseLoadout: {
      vest: 6,
      barricades: 6,
      cameras: 5,
      "defense-tower": 2,
      alarm: 5
    }
  };
  return state;
};

const findSpyOutcome = (outcome: "partial" | "failed" | "critical_failed") =>
  Array.from({ length: 200 }, (_, index) => {
    const state = createNeutralSpyState(`spy-parity-${outcome}-${index}`);
    return applyCommand(state, createSpyDistrictCommandFixture(), context);
  }).find((candidate) =>
    candidate.nextState.notificationsById["notification:command:spy:1:spy-report"]?.payload.result === outcome
  );

const removeSeededSpyIntel = (
  state: ReturnType<typeof createCombatStateFixture>,
  playerId: string,
  targetDistrictId: string
) => {
  const notificationId = `notification:spy-success:${playerId}:${targetDistrictId}`;
  delete state.notificationsById[notificationId];
  state.root.notificationIds = state.root.notificationIds.filter((id) => id !== notificationId);
};

const findTrapRevealSeed = () =>
  Array.from({ length: 500 }, (_, index) => `spy-trap-reveal-${index}`).find((worldSeed) => {
    const state = createCombatStateFixture();
    removeSeededSpyIntel(state, "player:1", "district:2");
    state.serverInstance.worldSeed = worldSeed;
    const trappedState = applyCommand(state, createPlaceTrapCommandFixture(), context).nextState;
    const result = applyCommand(trappedState, createSpyDistrictCommandFixture(), context);
    const payload = result.nextState.notificationsById["notification:command:spy:1:spy-report"]?.payload;
    return payload?.result === "success" && payload.trapDetected === true;
  });

const findSuccessCapacitySeed = () =>
  Array.from({ length: 500 }, (_, index) => `spy-capacity-seed-${index}`).find((worldSeed) => {
    const state = createThreeTargetSpyState(worldSeed);
    const first = applyCommand(state, createSpyDistrictCommandFixture({
      id: "command:spy:slot:1",
      payload: {
        districtId: "district:2",
        sourceDistrictId: "district:1"
      }
    }), context);
    const second = applyCommand(first.nextState, createSpyDistrictCommandFixture({
      id: "command:spy:slot:2",
      payload: {
        districtId: "district:3",
        sourceDistrictId: "district:1"
      }
    }), context);
    const firstResult = first.nextState.notificationsById["notification:command:spy:slot:1:spy-report"]?.payload.result;
    const secondResult = second.nextState.notificationsById["notification:command:spy:slot:2:spy-report"]?.payload.result;
    return (
      firstResult === "success" && secondResult === "success"
    );
  });

const createThreeTargetSpyState = (worldSeed: string) => {
  const state = createCombatStateFixture();
  removeSeededSpyIntel(state, "player:1", "district:2");
  state.serverInstance.worldSeed = worldSeed;
  state.districtsById["district:1"] = {
    ...state.districtsById["district:1"],
    adjacentDistrictIds: ["district:2", "district:3", "district:4"]
  };
  for (const districtId of ["district:2", "district:3", "district:4"]) {
    state.districtsById[districtId] = createDistrictFixture({
      id: districtId,
      serverInstanceId: state.serverInstance.id,
      adjacentDistrictIds: ["district:1"],
      ownerPlayerId: "player:2",
      defenseLoadout: {
        vest: 6,
        barricades: 6,
        cameras: 5,
        "defense-tower": 2,
        alarm: 5
      }
    });
  }
  state.root.districtIds = Array.from(new Set([...state.root.districtIds, "district:3", "district:4"]));
  return state;
};
