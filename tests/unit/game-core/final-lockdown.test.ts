import { describe, expect, it } from "vitest";
import {
  PRODUCTION_GAME_LIFECYCLE_PHASES,
  type FinalLockdownState,
  type Player
} from "@empire/shared-types";
import {
  createFinalEmpireRanking,
  createPlayerFinalEmpireScore,
  createPlayerView,
  runFinalLockdownLifecycle,
  runTick,
  type CoreGameState
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import {
  createCoreStateFixture,
  createDistrictFixture,
  createFixedBuildingFixture,
  createPlayerFixture,
  createResourceStateFixture
} from "../../fixtures/game-state-fixtures";

const FREE_CONFIG = resolveModeConfig("free");
const CONTEXT = { config: FREE_CONFIG };

describe("Free BR Final Lockdown", () => {
  it("starts Final Lockdown when Top 8 is reached and stops scheduled eliminations", () => {
    const state = createTop8State();

    const result = runTick(state, CONTEXT);

    expect(result.nextState.root.phase).toBe(PRODUCTION_GAME_LIFECYCLE_PHASES.finalLockdown);
    expect(result.nextState.finalLockdownState).toMatchObject({
      status: "active",
      startedAtTick: 1,
      activeElapsedTicks: 0,
      activeDurationTicks: FREE_CONFIG.balance.finalLockdown!.activeDurationTicks,
      remainingActiveTicks: FREE_CONFIG.balance.finalLockdown!.activeDurationTicks
    });
    expect(result.nextState.eliminationState?.nextEliminationTick).toBeNull();
  });

  it("uses the frozen hosted trigger for a two-player server", () => {
    const state = createTop8State();
    for (let index = 3; index <= 8; index += 1) {
      state.playersById[`player:${index}`] = {
        ...state.playersById[`player:${index}`],
        status: "defeated"
      };
    }
    state.root.tick = FREE_CONFIG.balance.elimination!.firstEliminationTick;
    state.serverPacingState = createFrozenPacingState(state, {
      effectiveFinalLockdownTrigger: 1
    });

    const atTwoPlayers = runFinalLockdownLifecycle(state, CONTEXT);
    expect(atTwoPlayers.nextState.finalLockdownState).toBeNull();

    const atOnePlayer = {
      ...atTwoPlayers.nextState,
      playersById: {
        ...atTwoPlayers.nextState.playersById,
        "player:2": {
          ...atTwoPlayers.nextState.playersById["player:2"],
          status: "defeated" as const
        }
      }
    };
    const started = runFinalLockdownLifecycle(atOnePlayer, CONTEXT);

    expect(started.nextState.finalLockdownState).toMatchObject({
      status: "active",
      startedAtTick: FREE_CONFIG.balance.elimination!.firstEliminationTick
    });
  });

  it("waits only for hosted registration freeze, not the elimination grace deadline", () => {
    const state = createTop8State();
    const effectiveFirstEliminationTick = FREE_CONFIG.balance.elimination!.firstEliminationTick + 100;
    state.root.tick = effectiveFirstEliminationTick - 1;
    state.serverPacingState = createFrozenPacingState(state, {
      registrationClosedAt: null,
      effectiveFirstEliminationTick
    });

    const whileRegistrationOpen = runFinalLockdownLifecycle(state, CONTEXT);
    expect(whileRegistrationOpen.nextState.finalLockdownState).toBeNull();

    const afterRegistrationClosed = {
      ...whileRegistrationOpen.nextState,
      serverPacingState: {
        ...whileRegistrationOpen.nextState.serverPacingState!,
        registrationClosedAt: "2026-01-01T10:00:00.000Z"
      }
    };
    const afterFreeze = runFinalLockdownLifecycle(afterRegistrationClosed, CONTEXT);
    expect(afterFreeze.nextState.finalLockdownState).toMatchObject({
      status: "active",
      startedAtTick: effectiveFirstEliminationTick - 1
    });
  });

  it("advances the Final Lockdown timer outside quiet hours", () => {
    const state = createTop8State({ startedAt: "2026-01-01T11:00:00.000Z" });
    state.finalLockdownState = createActiveFinalLockdownState(state, 0);
    state.root.phase = PRODUCTION_GAME_LIFECYCLE_PHASES.finalLockdown;

    const result = runTick(state, CONTEXT);

    expect(result.nextState.finalLockdownState).toMatchObject({
      status: "active",
      activeElapsedTicks: 1,
      pausedByQuietHours: false
    });
  });

  it("pauses the Final Lockdown timer during Europe/Bratislava quiet hours", () => {
    const state = createTop8State({ startedAt: "2026-01-01T01:00:00.000Z" });
    state.finalLockdownState = createActiveFinalLockdownState(state, 0);
    state.root.phase = PRODUCTION_GAME_LIFECYCLE_PHASES.finalLockdown;

    const result = runTick(state, CONTEXT);

    expect(result.nextState.finalLockdownState).toMatchObject({
      status: "paused",
      activeElapsedTicks: 0,
      pausedByQuietHours: true
    });
  });

  it("resumes the Final Lockdown timer after quiet hours", () => {
    const state = createTop8State({ startedAt: "2026-01-01T05:00:00.000Z" });
    state.finalLockdownState = {
      ...createActiveFinalLockdownState(state, 0),
      status: "paused",
      pausedByQuietHours: true
    };
    state.root.phase = PRODUCTION_GAME_LIFECYCLE_PHASES.finalLockdown;

    const result = runTick(state, CONTEXT);

    expect(result.nextState.finalLockdownState).toMatchObject({
      status: "active",
      activeElapsedTicks: 1,
      pausedByQuietHours: false
    });
  });

  it("resolves Final Lockdown after 12 active hours and writes matchResult ranking", () => {
    const state = createTop8State({ startedAt: "2026-01-01T11:00:00.000Z" });
    const duration = FREE_CONFIG.balance.finalLockdown!.activeDurationTicks;
    state.finalLockdownState = createActiveFinalLockdownState(state, duration - 1);
    state.root.phase = PRODUCTION_GAME_LIFECYCLE_PHASES.finalLockdown;

    const result = runTick(state, CONTEXT);

    expect(result.nextState.finalLockdownState?.status).toBe("resolved");
    expect(result.nextState.matchResult).toMatchObject({
      winnerPlayerId: "player:1",
      winnerAllianceId: null,
      reason: "final_lockdown_score"
    });
    expect(result.nextState.matchResult?.ranking.slice(0, 3).map((entry) => entry.rank)).toEqual([1, 2, 3]);
    expect(result.nextState.victoryState?.progressPayload).toMatchObject({
      reason: "final_lockdown_score"
    });
  });

  it("records the authoritative completion time instead of the Unix epoch", () => {
    const state = createTop8State({ startedAt: "2026-01-01T11:00:00.000Z" });
    const duration = FREE_CONFIG.balance.finalLockdown!.activeDurationTicks;
    state.finalLockdownState = createActiveFinalLockdownState(state, duration - 1);
    state.root.phase = PRODUCTION_GAME_LIFECYCLE_PHASES.finalLockdown;
    const endedAt = "2026-01-02T08:15:00.000Z";

    const result = runTick(state, {
      config: FREE_CONFIG,
      clock: { now: () => new Date(endedAt), nowIso: () => endedAt }
    });

    expect(result.nextState.matchResult?.endedAt).toBe(endedAt);
    expect(result.nextState.matchResult?.endedAt).not.toBe(new Date(0).toISOString());
  });

  it("ranks a smaller downtown empire above a wider weak sprawl when final score is higher", () => {
    const state = createTop8State();
    const playerOneScore = createPlayerFinalEmpireScore(state, "player:1", CONTEXT);
    const playerTwoScore = createPlayerFinalEmpireScore(state, "player:2", CONTEXT);
    const ranking = createFinalEmpireRanking(state, CONTEXT);

    expect(playerOneScore.controlledDistricts).toBeLessThan(playerTwoScore.controlledDistricts);
    expect(playerOneScore.downtownDistricts).toBeGreaterThan(playerTwoScore.downtownDistricts);
    expect(playerOneScore.score).toBeGreaterThan(playerTwoScore.score);
    expect(ranking[0]?.playerId).toBe("player:1");
  });

  it("keeps district control in the Final Lockdown score model", () => {
    const state = createTop8State();
    const widerEmpireScore = createPlayerFinalEmpireScore(state, "player:2", CONTEXT);
    const smallerEmpireScore = createPlayerFinalEmpireScore(state, "player:3", CONTEXT);

    expect(widerEmpireScore.controlledDistricts).toBeGreaterThan(smallerEmpireScore.controlledDistricts);
    expect(widerEmpireScore.scoreBreakdown.controlledDistricts).toBeGreaterThan(
      smallerEmpireScore.scoreBreakdown.controlledDistricts
    );
    expect(widerEmpireScore.score).toBeGreaterThan(smallerEmpireScore.score);
  });

  it("exposes Final Lockdown leaderboard in the player view", () => {
    const state = runTick(createTop8State(), CONTEXT).nextState;
    const view = createPlayerView(state, "player:1", CONTEXT);

    expect(view.finalLockdown).toMatchObject({
      enabled: true,
      status: "active",
      active: true,
      currentPlayerRank: 1
    });
    expect(view.finalLockdown?.leaderboardTop3).toHaveLength(3);
    expect(view.finalLockdown?.leaderboardTop3[0]).toMatchObject({
      playerId: "player:1",
      rank: 1,
      isCurrentPlayer: true
    });
  });
});

const createTop8State = (options: { startedAt?: string } = {}): CoreGameState => {
  const state = createCoreStateFixture();
  state.serverInstance.startedAt = options.startedAt ?? "2026-01-01T11:00:00.000Z";
  state.serverInstance.status = "running";
  state.root.phase = PRODUCTION_GAME_LIFECYCLE_PHASES.live;
  state.playersById = {};
  state.districtsById = {};
  state.buildingsById = {};
  state.resourceStatesById = {};
  state.policeStatesById = {};
  state.root.playerIds = [];
  state.root.districtIds = [];

  for (let index = 1; index <= 8; index += 1) {
    addPlayerWithEmpire(state, index);
  }

  addExtraDistrict(state, 1, "district:1:downtown", "downtown", "central_bank", 180);
  addExtraDistrict(state, 2, "district:2:normal:1", "residential", "warehouse", 5);
  addExtraDistrict(state, 2, "district:2:normal:2", "industrial", "warehouse", 5);

  return state;
};

const createFrozenPacingState = (
  state: CoreGameState,
  overrides: Partial<NonNullable<CoreGameState["serverPacingState"]>> = {}
): NonNullable<CoreGameState["serverPacingState"]> => ({
  id: `${state.serverInstance.id}:pacing`,
  serverInstanceId: state.serverInstance.id,
  registrationOpensAt: "2026-01-01T09:00:00.000Z",
  registrationClosesAt: "2026-01-01T10:00:00.000Z",
  registrationClosedAt: "2026-01-01T10:00:00.000Z",
  registrationBaselinePlayers: 2,
  eliminationEnabled: true,
  effectiveFinalLockdownTrigger: 8,
  effectiveFirstEliminationTick: FREE_CONFIG.balance.elimination!.firstEliminationTick,
  version: 1,
  ...overrides
});

const addPlayerWithEmpire = (state: CoreGameState, index: number): void => {
  const playerId = `player:${index}`;
  const player = createPlayerFixture({
    id: playerId,
    accountId: `account:${index}`,
    name: `Player ${index}`,
    homeDistrictId: `district:${index}`,
    factionId: index % 2 === 0 ? "kartel" : "mafian",
    resourceStateId: `resource:${index}`,
    cooldownStateId: `cooldown:${index}`,
    effectStateId: `effect:${index}`,
    policeStateId: `police:${index}`,
    population: index === 1 ? 2_500 : 250,
    lastActionAt: "2026-01-01T10:00:00.000Z"
  }) as Player;
  state.playersById[playerId] = player;
  state.root.playerIds.push(playerId);
  state.resourceStatesById[player.resourceStateId] = createResourceStateFixture({
    id: player.resourceStateId,
    ownerType: "player",
    ownerId: playerId,
    balances: {
      cash: index === 1 ? 120_000 : index === 2 ? 5_000 : 2_000,
      "dirty-cash": index === 1 ? 30_000 : 500,
      "metal-parts": index === 1 ? 250 : 10,
      "tech-core": index === 1 ? 90 : 2,
      population: index === 1 ? 2_500 : 250
    }
  });
  state.policeStatesById[player.policeStateId] = {
    id: player.policeStateId,
    ownerPlayerId: playerId,
    heat: index === 1 ? 100 : 20,
    wantedLevel: 0,
    lastDecayTick: 0,
    activeFlags: [],
    version: 1
  };
  addExtraDistrict(state, index, `district:${index}`, "residential", "warehouse", 20);
};

const addExtraDistrict = (
  state: CoreGameState,
  playerIndex: number,
  districtId: string,
  zone: string,
  buildingTypeId: string,
  influence: number
): void => {
  const playerId = `player:${playerIndex}`;
  const building = createFixedBuildingFixture(buildingTypeId, {
    id: `building:${districtId}:${buildingTypeId}`,
    districtId,
    ownerPlayerId: playerId
  });
  state.buildingsById[building.id] = building;
  state.districtsById[districtId] = createDistrictFixture({
    id: districtId,
    ownerPlayerId: playerId,
    zone,
    influence,
    buildingIds: [building.id],
    name: districtId
  });
  state.root.districtIds.push(districtId);
};

const createActiveFinalLockdownState = (
  state: CoreGameState,
  activeElapsedTicks: number
): FinalLockdownState => {
  const duration = FREE_CONFIG.balance.finalLockdown!.activeDurationTicks;
  return {
    id: `final-lockdown:${state.serverInstance.id}`,
    serverInstanceId: state.serverInstance.id,
    status: "active",
    startedAtTick: 0,
    activeElapsedTicks,
    activeDurationTicks: duration,
    remainingActiveTicks: Math.max(0, duration - activeElapsedTicks),
    lastUpdatedTick: state.root.tick,
    pausedByQuietHours: false,
    resolvedAtTick: null,
    finalTopPlayerIds: [],
    version: 1
  };
};
