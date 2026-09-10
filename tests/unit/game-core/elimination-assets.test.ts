import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand, createPlayerEliminationScore, createPlayerFinalEmpireScore } from "@empire/game-core";
import { completeFactoryProduction } from "../../../packages/game-core/src/rules/production/completeFactoryProduction";
import { marketReplacementCost } from "../../../packages/game-core/src/rules/market/market-config";
import { createEliminationReadModel } from "../../../packages/game-core/src/projections/elimination-read-model-projection";
import { createFinalLockdownReadModel } from "../../../packages/game-core/src/projections/final-lockdown-read-model-projection";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";
import { createCraftItemCommandFixture, createCollectProductionCommandFixture, createUpgradeBuildingCommandFixture } from "../../fixtures/command-fixtures";

const context = { config: resolveModeConfig("free") };
const scores = (state: Parameters<typeof createPlayerEliminationScore>[0]) => ({
  purge: createPlayerEliminationScore(state, "player:1", context).score,
  final: createPlayerFinalEmpireScore(state, "player:1", context).score
});

describe("score respects the value of production and committed assets", () => {
  it("shows comparable point contributions, including final heat penalties", () => {
    const { state } = createCoreStateWithFixedBuildingFixture("factory", { playerBalances: { cash: 6000, "combat-module": 2 } });
    state.policeStatesById["police:1"] = { id: "police:1", ownerPlayerId: "player:1", heat: 190, wantedLevel: 5, activeFlags: [], lastDecayTick: 0, version: 1 };
    const purge = createEliminationReadModel(state, "player:1", context);
    const final = createFinalLockdownReadModel(state, "player:1", context);
    expect(purge.currentPlayerScoreContributions?.resources).toBe(1580);
    expect(Object.values(purge.currentPlayerScoreContributions!).reduce((a,b)=>a+b,0)).toBeCloseTo(purge.currentPlayerScore!, 1);
    expect(final.currentPlayerScoreContributions?.heatPenalty).toBeLessThan(0);
    expect(Object.values(final.currentPlayerScoreContributions!).reduce((a,b)=>a+b,0)).toBeCloseTo(final.currentPlayerFinalScore!, 1);
  });

  it("values all 21 production chains consistently with replacement costs", () => {
    expect(context.config.balance.elimination?.scoreWeights.resourceScoreValues).toEqual(marketReplacementCost);
  });

  it.each(["metal-parts", "tech-core", "combat-module"])("preserves score when %s moves through a prepaid queue, local output and collected stock", (recipeId) => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { cash: 6000, "metal-parts": 8, "tech-core": 2 }
    });
    state.playersById["player:1"].lastActionAt = state.serverInstance.startedAt;
    const before = scores(state);
    const started = applyCommand(state, createCraftItemCommandFixture({ payload: {
      districtId: building.districtId, buildingId: building.id, recipeId, quantity: 1
    } }), context);
    expect(started.errors).toEqual([]);
    expect(scores(started.nextState)).toEqual(before);
    const tick = started.nextState.buildingsById[building.id].productionLines![recipeId].activeCompletesAtTick!;
    const completed = completeFactoryProduction({ ...started.nextState, root: { ...started.nextState.root, tick } }, context);
    expect(scores(completed)).toEqual(before);
    const collected = applyCommand(completed, createCollectProductionCommandFixture({ payload: {
      districtId: building.districtId, buildingId: building.id
    } }), context);
    expect(collected.errors).toEqual([]);
    expect(scores(collected.nextState)).toEqual(before);
  });

  it("counts installed defenses and bazar escrow once at cost, independent of asking price", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { cash: 6000, barricades: 5, "combat-module": 2 }
    });
    const before = scores(state);
    state.resourceStatesById["resource:1"].balances.barricades = 0;
    state.resourceStatesById["resource:1"].balances["combat-module"] = 0;
    state.districtsById[building.districtId].defenseLoadout = { barricades: 5 };
    state.market = { playerListings: [{ id: "offer:1", sellerPlayerId: "player:1", resourceId: "combat-module", amount: 2, status: "active", unitPrice: 999999999 }] };
    expect(scores(state)).toEqual(before);
    const listing = (state.market.playerListings as Record<string, unknown>[])[0]!;
    state.market.playerListings = [listing, { ...listing }];
    expect(scores(state)).toEqual(before);
    state.market.playerListings = [];
    expect(scores(state).final).toBeCloseTo(before.final - 1580);
  });

  it("retains half of invested upgrade cash as productive capital and removes it with the building", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { cash: 6000 }
    });
    state.playersById["player:1"].lastActionAt = state.serverInstance.startedAt;
    const before = scores(state);
    const upgraded = applyCommand(state, createUpgradeBuildingCommandFixture({ payload: {
      districtId: building.districtId, buildingId: building.id
    } }), context);
    expect(upgraded.errors).toEqual([]);
    const score = createPlayerEliminationScore(upgraded.nextState, "player:1", context);
    expect(score.buildingCapitalValue).toBe(5000);
    expect(score.buildingCapitalScore).toBe(250);
    expect(score.score).toBeCloseTo(before.purge - 250);
    upgraded.nextState.buildingsById[building.id] = { ...upgraded.nextState.buildingsById[building.id], status: "destroyed" };
    expect(createPlayerEliminationScore(upgraded.nextState, "player:1", context).buildingCapitalValue).toBe(0);
  });
});
