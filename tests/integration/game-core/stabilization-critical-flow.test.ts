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
    expect(freeConfig.balance.victoryConditionKey).toBe("fast-control");
    expect(freeConfig.balance.districtControlVictoryThreshold).toBe(0.85);
    expect(freeConfig.balance.conflict?.minAttackDurationTicks).toBe(36);
    expect(freeConfig.balance.conflict?.attackHeatGain).toBe(8);
    expect(warConfig.balance.victoryConditionKey).toBe("long-war-control");
    expect(warConfig.balance.conflict?.attackHeatGain).toBe(14);
    expect(freeConfig.technical.sessionTtlMs).toBe(1000 * 60 * 60 * 2);
    expect(warConfig.technical.sessionTtlMs).toBe(1000 * 60 * 60 * 24 * 10);
    expect(freeConfig.technical.gameDurationMs).toBe(1000 * 60 * 60 * 2);
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

    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(1025);
  });

  it("tracks heat server-side and flags police raid pressure at threshold", () => {
    const state = createCoreStateFixture();
    const context = {
      config: resolveModeConfig("free")
    };

    state.policeStatesById["police:1"] = {
      id: "police:1",
      ownerPlayerId: "player:1",
      heat: 120,
      wantedLevel: 3,
      lastDecayTick: 0,
      activeFlags: [],
      version: 1
    };

    expect(evaluatePolicePressure(state, context)).toBe(108);

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
          heat: 120
        }
      }
    ]);
  });

  it("adds building action heat to the authoritative player police state", () => {
    const { state, building } = createCoreStateFixtureWithActionBuilding("pharmacy");
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "produce_chemicals"
        }
      }),
      {
        config: resolveModeConfig("free")
      }
    );

    expect(result.errors).toEqual([]);
    expect(result.nextState.policeStatesById["police:1"]).toMatchObject({
      ownerPlayerId: "player:1",
      heat: 1,
      wantedLevel: 0
    });
  });

  it("resolves victory when one player controls all active districts", () => {
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

    const result = checkVictory(state, context);

    expect(result.resolved).toBe(true);
    expect(result.nextState.victoryState).toMatchObject({
      status: "resolved",
      victoryType: "fast-control",
      leaderPlayerId: "player:1"
    });
    expect(result.nextState.matchResult).toMatchObject({
      winnerPlayerId: "player:1",
      reason: "control:fast-control"
    });
  });

  it("resolves free victory at the configured 85 percent district control threshold", () => {
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
        ownerPlayerId: index <= 17 ? "player:1" : null
      };
      state.root.districtIds.push(districtId);
    }

    const result = checkVictory(state, context);

    expect(result.resolved).toBe(true);
    expect(result.nextState.victoryState?.progressPayload).toMatchObject({
      controlledDistrictCount: 17,
      totalActiveDistrictCount: 20,
      requiredControlledDistricts: 17
    });
  });

  it("resolves victory from configured match duration during tick", () => {
    const state = createCoreStateFixture();
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      ownerPlayerId: null
    };
    const result = runTick(state, {
      config: {
        ...resolveModeConfig("free"),
        technical: {
          ...resolveModeConfig("free").technical,
          gameDurationMs: 1
        }
      }
    });

    expect(result.nextState.root.phase).toBe("resolved");
    expect(result.nextState.serverInstance.status).toBe("ended");
    expect(result.nextState.matchResult?.reason).toBe("duration:fast-control");
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
