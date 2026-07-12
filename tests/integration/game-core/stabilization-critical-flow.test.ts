import { describe, expect, it } from "vitest";
import {
  applyCommand,
  checkVictory,
  collectIncome,
  evaluatePolicePressure,
  runTick,
  triggerRaid
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { createCoreStateFixture } from "../../fixtures/game-state-fixtures";
import { createRunBuildingActionCommandFixture } from "../../fixtures/command-fixtures";

describe("stabilization coverage for critical mode and placeholder hooks", () => {
  it("keeps free and war mode values separated through the canonical resolver", () => {
    const freeConfig = resolveModeConfig("free");
    const warConfig = resolveModeConfig("war");

    expect(freeConfig.mode).toBe("free");
    expect(warConfig.mode).toBe("war");
    expect(freeConfig.tickRateMs).toBe(5000);
    expect(warConfig.tickRateMs).toBe(15000);
    expect(freeConfig.balance.productionMultiplier).toBe(1.2);
    expect(warConfig.balance.productionMultiplier).toBe(0.85);
    expect(freeConfig.balance.cooldownMultiplier).toBe(0.8);
    expect(warConfig.balance.cooldownMultiplier).toBe(1.15);
    expect(freeConfig.balance.maxPlayersPerServer).toBe(20);
    expect(warConfig.balance.maxPlayersPerServer).toBe(150);
    expect(freeConfig.balance.maxAllianceSize).toBe(4);
    expect(freeConfig.balance.victoryConditionKey).toBe("final-lockdown");
    expect(freeConfig.balance.districtControlVictoryThreshold).toBe(1);
    expect(freeConfig.balance.districtControlVictoryThreshold).not.toBe(0.75);
    expect(freeConfig.balance.minimumVictoryTicks).toBeUndefined();
    expect(freeConfig.balance.districtControlHoldTicks).toBeUndefined();
    expect(freeConfig.balance.allowDurationVictoryFallback).toBe(false);
    expect(freeConfig.balance.hardTimeoutTicks).toBe(120960);
    expect(freeConfig.balance.dayLengthTicks).toBe(1440);
    expect(freeConfig.balance.nightLengthTicks).toBe(1440);
    expect(freeConfig.balance.conflict?.minAttackDurationTicks).toBe(264);
    expect(freeConfig.balance.conflict?.attackHeatGain).toBe(8);
    expect(warConfig.balance.victoryConditionKey).toBe("long-war-control");
    expect(warConfig.balance.conflict?.attackHeatGain).toBe(14);
    expect(freeConfig.technical.sessionTtlMs).toBe(1000 * 60 * 60 * 24 * 7);
    expect(warConfig.technical.sessionTtlMs).toBe(1000 * 60 * 60 * 24 * 10);
    expect(freeConfig.technical.gameDurationMs).toBe(1000 * 60 * 60 * 24 * 7);
    expect(warConfig.technical.gameDurationMs).toBe(1000 * 60 * 60 * 24 * 10);
    expect(freeConfig.technical.storageKeyPrefix).toBe("empire:free");
    expect(warConfig.technical.storageKeyPrefix).toBe("empire:war");
    expect(freeConfig.technical.debug.allowDebugTools).toBe(false);
    expect(warConfig.technical.debug.allowDebugTools).toBe(false);
  });

  it("keeps income unchanged when districts do not define authoritative modifiers", () => {
    const state = createCoreStateFixture();

    expect(collectIncome(state)).toBe(state);
  });

  it("collects fixed building income and passive pressure from mode balance during tick", () => {
    const { state } = createCoreStateFixtureWithActionBuilding("casino");
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: {
        cash: 1000,
        "dirty-cash": 250
      }
    };

    const result = runTick(state, {
      config: resolveModeConfig("free")
    });

    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(1000);
    expect(result.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBeGreaterThan(250);
    expect(result.nextState.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(result.nextState.districtsById["district:1"].influence).toBeGreaterThan(0);
  });

  it("collects district income from authoritative resource modifiers during tick", () => {
    const state = createCoreStateFixture();
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      resourceModifiers: {
        cash: 25
      }
    };

    const result = runTick(state, {
      config: resolveModeConfig("free")
    });

    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(1027.5);
  });

  it("tracks heat server-side and flags police raid pressure at threshold", () => {
    const state = createCoreStateFixture();
    const context = {
      config: createFreeConfigWithoutDayNight()
    };

    state.policeStatesById["police:1"] = {
      id: "police:1",
      ownerPlayerId: "player:1",
      heat: 130,
      wantedLevel: 3,
      lastDecayTick: 0,
      activeFlags: [],
      version: 1
    };

    expect(evaluatePolicePressure(state, context)).toBe(117);

    const raidResult = triggerRaid(state, context);

    expect(raidResult.nextState.policeStatesById["police:1"]).toMatchObject({
      wantedLevel: 5,
      activeFlags: ["raid:pending"]
    });
    expect(raidResult.events).toMatchObject([
      {
        type: "police-raid-triggered",
        payload: {
          playerId: "player:1",
          policeStateId: "police:1",
          heat: 130
        }
      }
    ]);
  });

  it("adds building action heat to the authoritative player police state", () => {
    const { state, building } = createCoreStateFixtureWithActionBuilding("port");
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "port_container_cut"
        }
      }),
      {
        config: resolveModeConfig("free")
      }
    );

    expect(result.errors).toEqual([]);
    expect(result.nextState.policeStatesById["police:1"]?.ownerPlayerId).toBe("player:1");
    expect(result.nextState.policeStatesById["police:1"]?.heat).toBeGreaterThan(0);
  });

  it("keeps full free control as audit progress until Final Lockdown resolves endgame", () => {
    const state = createCoreStateFixture();
    const context = {
      config: resolveModeConfig("free")
    };

    state.districtsById["district:2"] = {
      ...state.districtsById["district:1"],
      id: "district:2",
      name: "Second District",
      ownerPlayerId: "player:1"
    };
    state.root.districtIds.push("district:2");
    seedDominanceHold(state, {
      subjectType: "player",
      subjectId: "player:1",
      startedAtTick: 51840,
      currentTick: 56160
    });

    const result = checkVictory(state, context);

    expect(result.resolved).toBe(false);
    expect(result.nextState.matchResult).toBeNull();
    expect(result.nextState.victoryState?.progressPayload).toMatchObject({
      reason: "final_lockdown_waiting_for_top8",
      controlProgressReason: "control_victory_ready",
      controlledDistrictCount: 2,
      totalActiveDistrictCount: 2,
      finalLockdown: {
        enabled: true,
        status: "inactive",
        triggerActivePlayers: 8
      }
    });
  });

  it("does not treat 75 percent control as a free-mode victory threshold", () => {
    const state = createCoreStateFixture();
    const context = {
      config: resolveModeConfig("free")
    };

    for (let index = 2; index <= 20; index += 1) {
      const districtId = `district:${index}`;
      state.districtsById[districtId] = {
        ...state.districtsById["district:1"],
        id: districtId,
        name: `District ${index}`,
        ownerPlayerId: index <= 15 ? "player:1" : null
      };
      state.root.districtIds.push(districtId);
    }
    seedDominanceHold(state, {
      subjectType: "player",
      subjectId: "player:1",
      startedAtTick: 51840,
      currentTick: 56160
    });

    const result = checkVictory(state, context);

    expect(result.resolved).toBe(false);
    expect(result.nextState.matchResult).toBeNull();
    expect(result.nextState.victoryState?.progressPayload).toMatchObject({
      reason: "final_lockdown_waiting_for_top8",
      controlProgressReason: "below_control_threshold",
      controlledDistrictCount: 15,
      totalActiveDistrictCount: 20,
      requiredControlledDistricts: 20,
      canResolveControlVictoryNow: false,
      finalLockdown: {
        enabled: true,
        status: "inactive",
        triggerActivePlayers: 8
      }
    });
  });

  it("resolves legacy duration victory during tick when duration fallback is enabled", () => {
    const state = createCoreStateFixture();
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      ownerPlayerId: null
    };
    const result = runTick(state, {
      config: {
        ...resolveModeConfig("free"),
        balance: {
          ...resolveModeConfig("free").balance,
          allowDurationVictoryFallback: true,
          finalLockdown: {
            ...resolveModeConfig("free").balance.finalLockdown!,
            enabled: false
          },
          victoryConditionKey: "legacy-duration"
        },
        technical: {
          ...resolveModeConfig("free").technical,
          gameDurationMs: 1
        }
      }
    });

    expect(result.nextState.root.phase).toBe("resolved");
    expect(result.nextState.serverInstance.status).toBe("ended");
    expect(result.nextState.matchResult?.reason).toBe("duration:legacy-duration");
  });
});

const createCoreStateFixtureWithActionBuilding = (buildingTypeId: string) => {
  const state = createCoreStateFixture();
  const building = {
    id: `building:district-1:${buildingTypeId}:1`,
    serverInstanceId: "instance:1",
    districtId: "district:1",
    ownerPlayerId: "player:1",
    buildingTypeId,
    level: 1,
    status: "active" as const,
    processing: null,
    actionCooldowns: {},
    startedAt: new Date(0).toISOString(),
    completedAt: new Date(0).toISOString(),
    version: 1
  };

  state.buildingsById[building.id] = building;
  state.districtsById["district:1"] = {
    ...state.districtsById["district:1"],
    buildingIds: [building.id]
  };
  state.resourceStatesById["resource:1"] = {
    ...state.resourceStatesById["resource:1"],
    balances: {
      cash: 1000,
      chemicals: 10,
      biomass: 6,
      "metal-parts": 8,
      "tech-core": 2
    }
  };

  return { state, building };
};

const seedDominanceHold = (
  state: ReturnType<typeof createCoreStateFixture>,
  input: {
    subjectType: "player" | "alliance";
    subjectId: string;
    startedAtTick: number;
    currentTick: number;
  }
) => {
  state.root.tick = input.currentTick;
  state.root.victoryStateId = "victory:instance:1";
  state.victoryState = {
    id: "victory:instance:1",
    serverInstanceId: state.serverInstance.id,
    status: "ongoing",
    victoryType: "final-lockdown",
    leaderPlayerId: input.subjectType === "player" ? input.subjectId : null,
    leaderAllianceId: input.subjectType === "alliance" ? input.subjectId : null,
    progressPayload: {
      leadingSubjectType: input.subjectType,
      leadingSubjectId: input.subjectId,
      controlHoldStartedAtTick: input.startedAtTick
    },
    resolvedAtTick: null,
    version: 1
  };
};

const createFreeConfigWithoutDayNight = () => {
  const config = resolveModeConfig("free");
  return {
    ...config,
    balance: {
      ...config.balance,
      dayNight: {
        ...config.balance.dayNight!,
        enabled: false
      }
    }
  };
};
