import { describe, expect, it } from "vitest";
import { createLeaderboardReadModel, createPlayerFinalEmpireScore } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import {
  createAllianceFixture,
  createCoreStateFixture,
  createDistrictFixture,
  createPlayerFixture,
  createResourceStateFixture
} from "../../fixtures/game-state-fixtures";

const NOW = "2026-07-15T12:00:00.000Z";
const context = {
  config: resolveModeConfig("free"),
  clock: { now: () => new Date(NOW), nowIso: () => NOW }
};

describe("leaderboard read model", () => {
  it("uses the canonical final empire score and deterministic rank", () => {
    const state = createCoreStateFixture();
    state.playersById["player:2"] = createPlayerFixture({
      id: "player:2",
      accountId: "account:2",
      name: "Second",
      homeDistrictId: "district:2",
      resourceStateId: "resource:2",
      allianceId: "alliance:1"
    });
    state.districtsById["district:2"] = createDistrictFixture({
      id: "district:2",
      ownerPlayerId: "player:2",
      influence: 500
    });
    state.resourceStatesById["resource:2"] = createResourceStateFixture({
      id: "resource:2",
      ownerType: "player",
      ownerId: "player:2",
      balances: { cash: 50_000, population: 100 }
    });
    state.alliancesById["alliance:1"] = createAllianceFixture({
      ownerPlayerId: "player:2",
      memberIds: ["player:2"],
      tag: "SRV"
    });
    state.root.playerIds.push("player:2");
    state.root.districtIds.push("district:2");

    const view = createLeaderboardReadModel(state, "player:1", context);
    const canonical = createPlayerFinalEmpireScore(state, "player:2", context);

    expect(view.scoreMode).toBe("final_empire_score");
    expect(view.entries[0]).toMatchObject({
      playerId: "player:2",
      rank: 1,
      allianceTag: "SRV",
      score: canonical.score
    });
    expect(view.entries[0]).not.toHaveProperty("cleanCash");
    expect(view.entries[0]).not.toHaveProperty("heat");
  });

  it("keeps the current player projection outside the requested page and exposes defeat", () => {
    const state = createCoreStateFixture();
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      status: "defeated"
    };
    state.playersById["player:2"] = createPlayerFixture({
      id: "player:2",
      accountId: "account:2",
      name: "Leader",
      homeDistrictId: "district:2",
      resourceStateId: "resource:2"
    });
    state.districtsById["district:2"] = createDistrictFixture({ id: "district:2", ownerPlayerId: "player:2", influence: 1000 });
    state.resourceStatesById["resource:2"] = createResourceStateFixture({
      id: "resource:2",
      ownerType: "player",
      ownerId: "player:2",
      balances: { cash: 100_000 }
    });
    state.root.playerIds.push("player:2");
    state.root.districtIds.push("district:2");

    const view = createLeaderboardReadModel(state, "player:1", context, { limit: 1 });

    expect(view.entries).toHaveLength(1);
    expect(view.entries[0].playerId).toBe("player:2");
    expect(view.currentPlayer).toMatchObject({ playerId: "player:1", status: "defeated", isCurrentPlayer: true });
    expect(view.generatedAt).toBe(NOW);
  });
});
