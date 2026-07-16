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
  createCoreStateFixture,
  seedSuccessfulSpyIntel
} from "../../fixtures/game-state-fixtures";
import {
  createAttackDistrictCommandFixture,
  createPlaceTrapCommandFixture
} from "../../fixtures/command-fixtures";

describe("authoritative gameplay rules", () => {
  it("does not treat 75 percent free control as a victory threshold before Final Lockdown", () => {
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
      mode: "free",
      reason: "final_lockdown_waiting_for_top8"
    });
    expect(result.resolved).toBe(false);
    expect(result.nextState.matchResult).toBeNull();
    expect(result.nextState.victoryState?.progressPayload).toMatchObject({
      ...result.summary,
      controlProgressReason: "below_control_threshold",
      requiredControlledDistricts: 20,
      canResolveControlVictoryNow: false,
      finalLockdown: {
        enabled: true,
        status: "inactive",
        triggerActivePlayers: 8
      }
    });
  });

  it("does not treat 75 percent free alliance control as a victory threshold before Final Lockdown", () => {
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
      mode: "free",
      reason: "final_lockdown_waiting_for_top8"
    });
    expect(result.resolved).toBe(false);
    expect(result.nextState.matchResult).toBeNull();
    expect(result.nextState.victoryState?.progressPayload).toMatchObject({
      controlProgressReason: "below_control_threshold",
      requiredControlledDistricts: 20,
      canResolveControlVictoryNow: false,
      finalLockdown: {
        enabled: true,
        status: "inactive",
        triggerActivePlayers: 8
      }
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

  it("uses the strategic Free BR attack baseline when day/night is disabled", () => {
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

    const cooldown = result.nextState.cooldownStatesById["cooldown:1"]?.cooldowns["attack:global"];
    const report = Object.values(result.nextState.notificationsById).find(
      (notification) => notification.category === "report.battle" && notification.recipientId === "player:1"
    );

    expect(result.errors).toEqual([]);
    expect(cooldown).toBe(264);
    expect(report?.payload).toMatchObject({
      attackDurationTicks: 264,
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
        code: "TARGET_NOT_ADJACENT"
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
    seedSuccessfulSpyIntel(trappedState, "player:1", "district:1", "district:2", "player:2");

    const result = applyCommand(trappedState, createAttackDistrictCommandFixture(), { config });
    const report = result.events.find((event) => event.type === "district-attacked");
    const trapEvent = result.events.find((event) => event.type === "trap-triggered");
    const losses = (trapEvent?.payload as { attackerLosses?: Record<string, number> } | undefined)
      ?.attackerLosses ?? {};
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
      securityRevision: 1,
      conflictRevision: 1,
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
