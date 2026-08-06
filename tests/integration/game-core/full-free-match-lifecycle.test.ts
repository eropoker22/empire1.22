import { describe, expect, it } from "vitest";
import {
  applyCommand,
  checkGameStateInvariants,
  runTick
} from "@empire/game-core";
import { PRODUCTION_GAME_LIFECYCLE_PHASES } from "@empire/shared-types";
import { createPlaceTrapCommandFixture } from "../../fixtures/command-fixtures";
import {
  acceleratedLifecycleConfig,
  createTwentyPlayerLifecycleState
} from "../../fixtures/full-free-lifecycle-fixture";

describe("accelerated canonical Free match lifecycle", () => {
  it("drives 20 players through Očista, Final Lockdown and immutable finalization", () => {
    let state = createTwentyPlayerLifecycleState();
    const lifecycleEvents: string[] = [];
    const invariantChecks: number[] = [];

    for (let step = 0; step < 40 && !state.matchResult; step += 1) {
      const now = new Date(Date.parse(state.serverInstance.startedAt) + state.root.tick * acceleratedLifecycleConfig.tickRateMs);
      const result = runTick(state, {
        config: acceleratedLifecycleConfig,
        clock: {
          now: () => now,
          nowIso: () => now.toISOString()
        }
      });
      state = result.nextState;
      lifecycleEvents.push(...result.events.map((event) => event.type));

      const invariantReport = checkGameStateInvariants(state, {
        maxPlayers: acceleratedLifecycleConfig.balance.maxPlayersPerServer,
        maxAllianceSize: acceleratedLifecycleConfig.balance.maxAllianceSize
      });
      expect(invariantReport.violations, `tick ${state.root.tick}`).toEqual([]);
      invariantChecks.push(invariantReport.checked);
    }

    const activePlayers = Object.values(state.playersById).filter((player) => player.status === "active");
    const defeatedPlayers = Object.values(state.playersById).filter((player) => player.status === "defeated");
    expect(defeatedPlayers).toHaveLength(12);
    expect(new Set(state.eliminationState?.eliminatedPlayerIds)).toHaveLength(12);
    expect(activePlayers).toHaveLength(8);
    expect(lifecycleEvents.filter((type) => type === "player-eliminated")).toHaveLength(12);
    expect(lifecycleEvents.filter((type) => type === "final-lockdown-started")).toHaveLength(1);
    expect(lifecycleEvents.filter((type) => type === "final-lockdown-resolved")).toHaveLength(1);
    expect(state.finalLockdownState).toMatchObject({
      status: "resolved",
      activeDurationTicks: 3,
      remainingActiveTicks: 0
    });
    expect(state.root.phase).toBe(PRODUCTION_GAME_LIFECYCLE_PHASES.resolved);
    expect(state.serverInstance.status).toBe("ended");
    expect(state.matchResult).toMatchObject({
      id: state.root.matchResultId,
      serverInstanceId: state.serverInstance.id,
      reason: "final_lockdown_score"
    });
    expect(state.matchResult?.ranking).toHaveLength(20);
    expect(state.matchResult?.ranking.filter((entry) => entry.rank === 1)).toHaveLength(1);
    expect(state.matchResult?.winnerPlayerId).toBe(state.matchResult?.ranking[0]?.subjectId);
    expect(invariantChecks).toHaveLength(state.root.tick);
    expect(invariantChecks.every((count) => count > 100)).toBe(true);

    const finalized = structuredClone(state);
    const winningPlayerId = state.matchResult!.winnerPlayerId!;
    const winnerDistrictId = Object.values(state.districtsById)
      .find((district) => district.ownerPlayerId === winningPlayerId)!.id;
    const commandResult = applyCommand(state, createPlaceTrapCommandFixture({
      id: "command:full-lifecycle:after-finish",
      playerId: winningPlayerId,
      serverInstanceId: state.serverInstance.id,
      payload: { districtId: winnerDistrictId }
    }), { config: acceleratedLifecycleConfig });
    const postFinishTick = runTick(state, { config: acceleratedLifecycleConfig });

    expect(commandResult.errors[0]?.code).toBe("GAME_FINISHED");
    expect(commandResult.nextState).toEqual(finalized);
    expect(postFinishTick.nextState).toBe(state);
    expect(postFinishTick.events).toEqual([]);
  });
});
