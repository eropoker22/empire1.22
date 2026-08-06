import { describe, expect, it } from "vitest";
import { applyCommand, runTick } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { createPlaceTrapCommandFixture } from "../../fixtures/command-fixtures";
import { createCombatStateFixture } from "../../fixtures/game-state-fixtures";

describe("finished match command guard", () => {
  it("rejects every gameplay mutation after authoritative finalization", () => {
    const state = createCombatStateFixture("instance:finished-command-guard");
    const before = structuredClone(state);
    const endedAt = "2026-08-06T17:00:00.000Z";
    state.root.phase = "resolved";
    state.root.matchResultId = "match:finished-command-guard";
    state.serverInstance.status = "ended";
    state.serverInstance.endedAt = endedAt;
    state.matchResult = {
      id: "match:finished-command-guard",
      serverInstanceId: state.serverInstance.id,
      endedAt,
      winnerPlayerId: "player:1",
      winnerAllianceId: null,
      ranking: [{ subjectType: "player", subjectId: "player:1", rank: 1, score: 100 }],
      reason: "final_lockdown_score"
    };
    const finalized = structuredClone(state);

    const result = applyCommand(state, createPlaceTrapCommandFixture({
      id: "command:finished-command-guard",
      playerId: "player:1",
      serverInstanceId: state.serverInstance.id,
      payload: { districtId: "district:1" }
    }), { config: resolveModeConfig("free") });

    expect(result.errors).toEqual([expect.objectContaining({ code: "GAME_FINISHED" })]);
    expect(result.events).toEqual([]);
    expect(result.nextState).toEqual(finalized);
    expect(result.nextState).not.toEqual(before);

    const tick = runTick(state, { config: resolveModeConfig("free") });
    expect(tick.nextState).toBe(state);
    expect(tick.events).toEqual([]);
  });
});
