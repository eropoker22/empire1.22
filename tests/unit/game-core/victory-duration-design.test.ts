import { describe, expect, it } from "vitest";
import { checkVictory } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import {
  createAllianceFixture,
  createCoreStateFixture
} from "../../fixtures/game-state-fixtures";

const OLD_FREE_MINIMUM_VICTORY_TICKS = 51_840;
const OLD_FREE_CONTROL_HOLD_TICKS = 4_320;
const FREE_HARD_TIMEOUT_TICKS = 120_960;

describe("victory duration design", () => {
  it("does not resolve when a player controls 74 percent of active districts", () => {
    const state = createStateWithDistrictControl({
      totalDistricts: 100,
      playerControlledDistricts: 74
    });
    state.root.tick = OLD_FREE_MINIMUM_VICTORY_TICKS + OLD_FREE_CONTROL_HOLD_TICKS;

    const result = checkVictory(state, { config: resolveModeConfig("free") });

    expect(result.resolved).toBe(false);
    expect(result.nextState.matchResult).toBeNull();
    expect(result.nextState.victoryState?.progressPayload).toMatchObject({
      requiredControlledDistricts: 100,
      reason: "final_lockdown_waiting_for_top8",
      controlProgressReason: "below_control_threshold",
      canResolveControlVictoryNow: false
    });
  });

  it("does not resolve 75 percent control before the old 72h minimum server age", () => {
    const state = createStateWithDistrictControl({
      totalDistricts: 20,
      playerControlledDistricts: 15
    });
    seedDominanceHold(state, {
      subjectType: "player",
      subjectId: "player:1",
      startedAtTick: 40_000,
      currentTick: OLD_FREE_MINIMUM_VICTORY_TICKS - 1
    });

    const result = checkVictory(state, { config: resolveModeConfig("free") });

    expect(result.resolved).toBe(false);
    expect(result.nextState.matchResult).toBeNull();
    expect(result.nextState.victoryState?.progressPayload).toMatchObject({
      reason: "final_lockdown_waiting_for_top8",
      controlProgressReason: "below_control_threshold",
      requiredControlledDistricts: 20,
      minimumVictoryTicks: 0,
      canResolveControlVictoryNow: false
    });
  });

  it("does not resolve 75 percent control after the old 72h minimum and 6h hold window", () => {
    const state = createStateWithDistrictControl({
      totalDistricts: 20,
      playerControlledDistricts: 15
    });
    seedDominanceHold(state, {
      subjectType: "player",
      subjectId: "player:1",
      startedAtTick: OLD_FREE_MINIMUM_VICTORY_TICKS,
      currentTick: OLD_FREE_MINIMUM_VICTORY_TICKS + OLD_FREE_CONTROL_HOLD_TICKS
    });

    const result = checkVictory(state, { config: resolveModeConfig("free") });

    expect(result.resolved).toBe(false);
    expect(result.nextState.victoryState?.progressPayload).toMatchObject({
      reason: "final_lockdown_waiting_for_top8",
      controlProgressReason: "below_control_threshold",
      requiredControlledDistricts: 20,
      controlHoldRemainingTicks: 0,
      canResolveControlVictoryNow: false
    });
  });

  it("does not resolve free player victory from 75 percent control after Final Lockdown replaces old endgame", () => {
    const state = createStateWithDistrictControl({
      totalDistricts: 20,
      playerControlledDistricts: 15
    });
    seedDominanceHold(state, {
      subjectType: "player",
      subjectId: "player:1",
      startedAtTick: OLD_FREE_MINIMUM_VICTORY_TICKS,
      currentTick: OLD_FREE_MINIMUM_VICTORY_TICKS + OLD_FREE_CONTROL_HOLD_TICKS
    });

    const result = checkVictory(state, { config: resolveModeConfig("free") });

    expect(result.resolved).toBe(false);
    expect(result.nextState.matchResult).toBeNull();
    expect(result.nextState.victoryState?.progressPayload).toMatchObject({
      reason: "final_lockdown_waiting_for_top8",
      controlProgressReason: "below_control_threshold",
      controlledDistrictCount: 15,
      requiredControlledDistricts: 20,
      controlHoldRemainingTicks: 0,
      canResolveControlVictoryNow: false,
      finalLockdown: {
        enabled: true,
        status: "inactive",
        triggerActivePlayers: 8
      }
    });
  });

  it("does not resolve free alliance victory from 75 percent control before Final Lockdown", () => {
    const state = createStateWithDistrictControl({
      totalDistricts: 20,
      playerControlledDistricts: 15,
      allianceControlledDistricts: 15
    });
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      allianceId: "alliance:1"
    };
    state.alliancesById["alliance:1"] = createAllianceFixture({
      memberIds: ["player:1"]
    });
    state.root.allianceIds.push("alliance:1");
    seedDominanceHold(state, {
      subjectType: "alliance",
      subjectId: "alliance:1",
      startedAtTick: OLD_FREE_MINIMUM_VICTORY_TICKS,
      currentTick: OLD_FREE_MINIMUM_VICTORY_TICKS + OLD_FREE_CONTROL_HOLD_TICKS
    });

    const result = checkVictory(state, { config: resolveModeConfig("free") });

    expect(result.summary).toMatchObject({
      hasWinner: true,
      winnerType: "alliance",
      winnerId: "alliance:1",
      controlPercent: 75,
      reason: "final_lockdown_waiting_for_top8"
    });
    expect(result.resolved).toBe(false);
    expect(result.nextState.matchResult).toBeNull();
    expect(result.nextState.victoryState?.progressPayload).toMatchObject({
      reason: "final_lockdown_waiting_for_top8",
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

  it("keeps even full map control as audit progress while Final Lockdown waits", () => {
    const state = createStateWithDistrictControl({
      totalDistricts: 20,
      playerControlledDistricts: 20
    });
    seedDominanceHold(state, {
      subjectType: "player",
      subjectId: "player:1",
      startedAtTick: OLD_FREE_MINIMUM_VICTORY_TICKS,
      currentTick: OLD_FREE_MINIMUM_VICTORY_TICKS + OLD_FREE_CONTROL_HOLD_TICKS
    });

    const result = checkVictory(state, { config: resolveModeConfig("free") });

    expect(result.resolved).toBe(false);
    expect(result.nextState.matchResult).toBeNull();
    expect(result.nextState.victoryState?.progressPayload).toMatchObject({
      reason: "final_lockdown_waiting_for_top8",
      controlProgressReason: "control_victory_ready",
      controlledDistrictCount: 20,
      requiredControlledDistricts: 20,
      canResolveControlVictoryNow: true,
      finalLockdown: {
        enabled: true,
        status: "inactive",
        triggerActivePlayers: 8
      }
    });
  });

  it("does not create a false score winner when hard timeout expires with duration fallback disabled", () => {
    const state = createStateWithDistrictControl({
      totalDistricts: 20,
      playerControlledDistricts: 10
    });
    state.root.tick = FREE_HARD_TIMEOUT_TICKS;

    const result = checkVictory(state, { config: resolveModeConfig("free") });

    expect(result.resolved).toBe(true);
    expect(result.summary).toMatchObject({
      hasWinner: false,
      winnerType: "none",
      winnerId: null,
      reason: "timeout_no_winner"
    });
    expect(result.nextState.matchResult).toMatchObject({
      winnerPlayerId: null,
      winnerAllianceId: null,
      reason: "timeout_no_winner"
    });
  });

  it("sets free mode day and night to 2h each at tickRateMs 5000", () => {
    const config = resolveModeConfig("free");

    expect(config.tickRateMs).toBe(5000);
    expect(config.balance.dayLengthTicks).toBe(1440);
    expect(config.balance.nightLengthTicks).toBe(1440);
    expect(config.balance.dayNight?.phases.day.durationTicks).toBe(1440);
    expect(config.balance.dayNight?.phases.night.durationTicks).toBe(1440);
  });

  it("sets war mode day and night to 2h each at tickRateMs 15000", () => {
    const config = resolveModeConfig("war");

    expect(config.tickRateMs).toBe(15000);
    expect(config.balance.dayLengthTicks).toBe(480);
    expect(config.balance.nightLengthTicks).toBe(480);
    expect(config.balance.dayNight?.phases.day.durationTicks).toBe(480);
    expect(config.balance.dayNight?.phases.night.durationTicks).toBe(480);
    expect(config.balance.maxPlayersPerServer).toBe(150);
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
