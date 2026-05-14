import { describe, expect, it } from "vitest";
import {
  applyCommand,
  checkVictory,
  triggerRaid
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import {
  createAllianceFixture,
  createCombatStateFixture,
  createCoreStateFixture
} from "../../fixtures/game-state-fixtures";
import {
  createAttackDistrictCommandFixture,
  createPlaceTrapCommandFixture
} from "../../fixtures/command-fixtures";

describe("authoritative gameplay rules", () => {
  it("resolves free player victory after 75 percent control and required hold", () => {
    const state = createStateWithDistrictControl({
      totalDistricts: 20,
      playerControlledDistricts: 15
    });
    seedDominanceHold(state, {
      subjectType: "player",
      subjectId: "player:1",
      startedAtTick: 51840,
      currentTick: 56160
    });

    const result = checkVictory(state, {
      config: resolveModeConfig("free")
    });

    expect(result.summary).toMatchObject({
      hasWinner: true,
      winnerType: "player",
      winnerId: "player:1",
      controlledDistricts: 15,
      totalActiveDistricts: 20,
      controlPercent: 75,
      mode: "free"
    });
    expect(result.nextState.victoryState?.progressPayload).toMatchObject(result.summary);
  });

  it("resolves free alliance victory after 75 percent control and required hold", () => {
    const state = createStateWithDistrictControl({
      totalDistricts: 20,
      playerControlledDistricts: 15,
      allianceControlledDistricts: 15
    });
    state.alliancesById["alliance:1"] = createAllianceFixture({
      memberIds: ["player:1"]
    });
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      allianceId: "alliance:1"
    };
    state.root.allianceIds.push("alliance:1");
    seedDominanceHold(state, {
      subjectType: "alliance",
      subjectId: "alliance:1",
      startedAtTick: 51840,
      currentTick: 56160
    });

    const result = checkVictory(state, {
      config: resolveModeConfig("free")
    });

    expect(result.summary).toMatchObject({
      hasWinner: true,
      winnerType: "alliance",
      winnerId: "alliance:1",
      controlledDistricts: 15,
      totalActiveDistricts: 20,
      controlPercent: 75,
      mode: "free"
    });
    expect(result.nextState.matchResult).toMatchObject({
      winnerAllianceId: "alliance:1",
      reason: "control:fast-control"
    });
  });

  it("resolves war victory after duration by authoritative score", () => {
    const state = createCoreStateFixture();
    const warConfig = {
      ...resolveModeConfig("war"),
      technical: {
        ...resolveModeConfig("war").technical,
        gameDurationMs: 1
      }
    };

    state.serverInstance.mode = "war";
    state.root.tick = 1;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      influence: 40
    };

    const result = checkVictory(state, {
      config: warConfig
    });

    expect(result.summary).toMatchObject({
      hasWinner: true,
      winnerType: "player",
      winnerId: "player:1",
      reason: "duration:long-war-control",
      mode: "war"
    });
  });

  it("keeps free attacks at a minimum of three minutes", () => {
    const state = createCombatStateFixture();
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      defenseLoadout: {}
    };

    const result = applyCommand(
      state,
      createAttackDistrictCommandFixture(),
      {
        config: createFreeConfigWithoutDayNight()
      }
    );

    const cooldown = result.nextState.cooldownStatesById["cooldown:1"]?.cooldowns["attack:district:2"];
    const report = result.nextState.notificationsById["notification:command:attack:1:battle:player:1"];

    expect(result.errors).toEqual([]);
    expect(cooldown).toBe(36);
    expect(report?.payload).toMatchObject({
      attackDurationTicks: 36,
      outcomeTier: "clean_capture",
      districtCaptured: true
    });
  });

  it("allows an attack from an owned neighboring district", () => {
    const state = createCombatStateFixture();
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      defenseLoadout: {}
    };

    const result = applyCommand(
      state,
      createAttackDistrictCommandFixture(),
      {
        config: resolveModeConfig("free")
      }
    );

    expect(result.errors).toEqual([]);
    expect(result.nextState.districtsById["district:2"].ownerPlayerId).toBe("player:1");
  });

  it("applies active district attack modifiers during combat", () => {
    const state = createCombatStateFixture();
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      defenseLoadout: {
        barricades: 7
      }
    };
    state.effectStatesById["effect:district:1"] = {
      id: "effect:district:1",
      ownerType: "district",
      ownerId: "district:1",
      effects: [
        {
          effectId: "effect:test:attack",
          effectType: "building_action_effect",
          sourceType: "building",
          sourceId: "building:test",
          startedAtTick: 0,
          expiresAtTick: 10,
          stackPolicyKey: "test_attack_boost",
          payload: {
            attackMultiplier: 1.2
          }
        }
      ],
      version: 1
    };

    const result = applyCommand(
      state,
      createAttackDistrictCommandFixture(),
      {
        config: resolveModeConfig("free")
      }
    );

    expect(result.errors).toEqual([]);
    expect(result.nextState.districtsById["district:2"].ownerPlayerId).toBe("player:1");
    expect(result.events[0]?.payload).toMatchObject({
      attackMultiplier: 1.2,
      districtCaptured: true
    });
  });

  it("rejects an attack against a non-neighboring district", () => {
    const state = createCombatStateFixture();
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      adjacentDistrictIds: []
    };

    const result = applyCommand(
      state,
      createAttackDistrictCommandFixture(),
      {
        config: resolveModeConfig("free")
      }
    );

    expect(result.errors).toMatchObject([
      {
        code: "target_not_adjacent"
      }
    ]);
  });

  it("applies toxic trap damage without breaking combat resolution", () => {
    const state = createCombatStateFixture();
    const config = {
      ...resolveModeConfig("free"),
      balance: {
        ...resolveModeConfig("free").balance,
        conflict: {
          ...resolveModeConfig("free").balance.conflict!,
          trapAttackLosses: 4
        }
      }
    };
    const trappedState = applyCommand(state, createPlaceTrapCommandFixture(), { config }).nextState;

    const result = applyCommand(trappedState, createAttackDistrictCommandFixture(), { config });
    const report = result.nextState.notificationsById["notification:command:attack:1:battle:player:1"];
    const losses = report?.payload.attackerLosses as Record<string, number>;
    const totalLosses = Object.values(losses).reduce((total, amount) => total + Number(amount), 0);

    expect(result.errors).toEqual([]);
    expect(result.nextState.trapsById["trap:district:2"]?.status).toBe("triggered");
    expect(totalLosses).toBeGreaterThanOrEqual(4);
    expect(report?.payload).toMatchObject({
      trapTriggered: true,
      trapType: "toxic"
    });
  });

  it("creates an authoritative pending police raid result for high heat", () => {
    const state = createCoreStateFixture();
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: {
        cash: 1000,
        "dirty-cash": 500,
        chemicals: 25,
        "gang-members": 40
      }
    };
    state.policeStatesById["police:1"] = {
      id: "police:1",
      ownerPlayerId: "player:1",
      heat: 140,
      wantedLevel: 4,
      lastDecayTick: 0,
      activeFlags: [],
      version: 1
    };

    const result = triggerRaid(state, {
      config: createFreeConfigWithoutDayNight()
    });

    expect(result.nextState.policeStatesById["police:1"].activeFlags).toContain("raid:pending");
    expect(result.events[0]?.payload).toMatchObject({
      playerId: "player:1",
      aggregatePressure: 126,
      severity: "high",
      cashSeized: {
        "dirty-cash": 60
      },
      resourcesSeized: {
        chemicals: 1
      },
      gangMembersLost: 0,
      districtLockdownTicks: 0,
      heatReduced: 30
    });
  });
});

const createStateWithDistrictControl = (input: {
  totalDistricts: number;
  playerControlledDistricts: number;
  allianceControlledDistricts?: number;
}) => {
  const state = createCoreStateFixture();

  state.root.districtIds = [];
  state.districtsById = {};

  for (let index = 1; index <= input.totalDistricts; index += 1) {
    const districtId = `district:${index}`;
    state.districtsById[districtId] = {
      id: districtId,
      serverInstanceId: "instance:1",
      templateId: `template:${index}`,
      name: `District ${index}`,
      zone: "test",
      adjacentDistrictIds: [],
      ownerPlayerId: index <= input.playerControlledDistricts ? "player:1" : null,
      controllerAllianceId: index <= (input.allianceControlledDistricts ?? 0) ? "alliance:1" : null,
      heat: 0,
      influence: index,
      buildingIds: [],
      defenseLoadout: {},
      slotCount: 3,
      status: "claimed",
      resourceModifiers: {},
      version: 1
    };
    state.root.districtIds.push(districtId);
  }

  return state;
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
    victoryType: "fast-control",
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
