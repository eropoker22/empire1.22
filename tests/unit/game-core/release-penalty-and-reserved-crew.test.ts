import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand, createPlayerEliminationScore, createPlayerFinalEmpireScore, createFinalEmpireRanking, compareEliminationScores, runTick } from "@empire/game-core";
import { resolveActiveAlliancePenaltyStatModifiers } from "../../../packages/game-core/src/rules/alliances/alliancePenaltyModifiers";
import { createCombatStateFixture } from "../../fixtures/game-state-fixtures";
import { createHeistDistrictCommandFixture } from "../../fixtures/command-fixtures";
import { resolvePendingDistrictAction } from "../../fixtures/timed-operation-fixtures";
const now = "2026-09-10T12:00:00.000Z";
const config = resolveModeConfig("free");
const context = { config, clock: { now: () => new Date(now), nowIso: () => now } };
function fixture() {
  const state = createCombatStateFixture();
  state.playersById["player:1"].population = 120;
  state.playersById["player:1"].lastActionAt = now;
  state.districtsById["district:1"].influence = 100;
  state.playersById["player:2"].resourceStateId = "resource:2";
  state.resourceStatesById["resource:1"].balances = { cash: 6000 };
  state.resourceStatesById["resource:2"] = { ...state.resourceStatesById["resource:1"], id: "resource:2", ownerId: "player:2", balances: { cash: 1000, "dirty-cash": 500 } };
  return state;
}
function leave() {
  const state = fixture();
  const base = createHeistDistrictCommandFixture({ issuedAt: now });
  const created = applyCommand(state, { ...base, type: "create-alliance", payload: { name: "Release", tag: "REL" } }, context);
  expect(created.errors).toEqual([]);
  const left = applyCommand(created.nextState, { ...base, id: "leave", type: "leave-alliance", payload: { allianceId: created.nextState.playersById["player:1"].allianceId! } }, context);
  expect(left.errors).toEqual([]);
  return left.nextState;
}
describe("release alliance effect deadlines", () => {
  it.each([6, 8, 12])("expires the exact effect at %i hours, including a restored snapshot", (hours) => {
    const state = JSON.parse(JSON.stringify(leave()));
    for (const offset of [-1, 0, 1]) {
      const at = new Date(Date.parse(now) + hours * 3600000 + offset).toISOString();
      const modifiers = resolveActiveAlliancePenaltyStatModifiers(state, "player:1", at);
      expect(modifiers.influenceGenerationMultiplier).toBe(Date.parse(at) < Date.parse(now) + 8 * 3600000 ? .8 : 1);
      expect(modifiers.actionCooldownMultiplier).toBe(Date.parse(at) < Date.parse(now) + 6 * 3600000 ? 1.15 : 1);
      expect(modifiers.attackMultiplier).toBe(Date.parse(at) < Date.parse(now) + 12 * 3600000 ? .8 : 1);
    }
  });
  it("normalizes the frozen legacy FREE profile without taking timing from today's configuration", () => {
    const state = leave();
    const penalty = Object.values(state.allianceExitPenaltiesById!)[0];
    delete penalty.influenceDebuffEndsAt; delete penalty.actionCooldownDebuffEndsAt; delete penalty.statDebuffEndsAt;
    expect(resolveActiveAlliancePenaltyStatModifiers(state, "player:1", "2026-09-10T21:00:00.000Z")).toMatchObject({ influenceGenerationMultiplier: 1, actionCooldownMultiplier: 1, attackMultiplier: .8 });
  });
  it.each([7, 9])("uses the matching influence rate in the actual economy tick after %i hours", (hours) => {
    const state = leave();
    state.districtsById["district:1"].resourceModifiers.influence = 10;
    const control = structuredClone(state); control.allianceExitPenaltiesById = {};
    const time = new Date(Date.parse(now) + hours * 3600000);
    const ctx = { config, clock: { now: () => time, nowIso: () => time.toISOString() } };
    const result = runTick(JSON.parse(JSON.stringify(state)), ctx).nextState;
    const expected = runTick(control, ctx).nextState;
    const initial = state.districtsById["district:1"].influence;
    expect(result.districtsById["district:1"].influence - initial).toBeCloseTo((expected.districtsById["district:1"].influence - initial) * (hours < 8 ? .8 : 1), 6);
  });
  it("extends heist recovery cooldowns once without extending travel", () => {
    const normal = fixture(); const penalized = leave();
    const command = createHeistDistrictCommandFixture({ issuedAt: now });
    const a = applyCommand(normal, command, context); const b = applyCommand(penalized, command, context);
    expect(a.errors).toEqual([]); expect(b.errors).toEqual([]);
    const oa = Object.values(a.nextState.pendingDistrictActionOperationsById!)[0];
    const ob = Object.values(b.nextState.pendingDistrictActionOperationsById!)[0];
    expect(ob.resolveAtTick).toBe(oa.resolveAtTick);
    const doneA = resolvePendingDistrictAction(a.nextState, context).nextState;
    const doneB = resolvePendingDistrictAction(JSON.parse(JSON.stringify(b.nextState)), context).nextState;
    const cdA = doneA.cooldownStatesById[doneA.playersById["player:1"].cooldownStateId].cooldowns;
    const cdB = doneB.cooldownStatesById[doneB.playersById["player:1"].cooldownStateId].cooldowns;
    for (const key of ["heist:global", "heist:attacker-target:district:2", "offense:global", "conflict:source:district:1"]) {
      expect(cdB[key]).toBe(ob.resolveAtTick + Math.ceil((cdA[key] - oa.resolveAtTick) * 1.15));
    }
  });
});
describe("release live heist crew score", () => {
  it("does not reverse a close purge/final ranking just because ten living people depart", () => {
    const state = fixture();
    state.playersById["player:2"].lastActionAt = now;
    state.resourceStatesById["resource:1"].balances.cash = 1000000;
    const a = createPlayerEliminationScore(state, "player:1", context);
    const b = createPlayerEliminationScore(state, "player:2", context);
    state.resourceStatesById["resource:2"].balances.cash! += (a.score - 10 - b.score) / config.balance.elimination!.scoreWeights.cleanCash;
    expect(createPlayerEliminationScore(state, "player:1", context).score - createPlayerEliminationScore(state, "player:2", context).score).toBeCloseTo(10);
    const started = applyCommand(state, createHeistDistrictCommandFixture({ issuedAt: now }), context);
    expect(started.errors).toEqual([]);
    const restored = JSON.parse(JSON.stringify(started.nextState));
    expect(["player:1", "player:2"].map(id => createPlayerEliminationScore(restored, id, context)).sort(compareEliminationScores)[0].playerId).toBe("player:2");
    expect(createFinalEmpireRanking(restored, context)[0].playerId).toBe("player:1");
  });
  it("does not count or refund another membership attempt's crew", () => {
    const state = fixture(); state.playersById["player:1"].metadata = { membershipId: "old" };
    const started = applyCommand(state, createHeistDistrictCommandFixture({ issuedAt: now }), context);
    expect(started.errors).toEqual([]);
    started.nextState.playersById["player:1"].metadata = { membershipId: "new" };
    expect(createPlayerEliminationScore(started.nextState, "player:1", context).population).toBe(110);
    const done = resolvePendingDistrictAction(started.nextState, context).nextState;
    expect(done.playersById["player:1"].population).toBe(110);
  });
  it("preserves both scores while reserved and after cancellation without double credit", () => {
    const state = fixture();
    const before = createPlayerEliminationScore(state, "player:1", context).score;
    const beforeFinal = createPlayerFinalEmpireScore(state, "player:1", context).score;
    const started = applyCommand(state, createHeistDistrictCommandFixture({ issuedAt: now }), context);
    expect(started.errors).toEqual([]);
    const saved = JSON.parse(JSON.stringify(started.nextState));
    expect(saved.playersById["player:1"].population).toBe(110);
    expect(createPlayerEliminationScore(saved, "player:1", context).score).toBe(before);
    expect(createPlayerFinalEmpireScore(saved, "player:1", context).score).toBe(beforeFinal);
    saved.districtsById["district:2"].ownerPlayerId = null;
    const cancelled = resolvePendingDistrictAction(saved, context).nextState;
    expect(cancelled.playersById["player:1"].population).toBe(120);
    expect(Object.values(cancelled.pendingDistrictActionOperationsById ?? {})).toHaveLength(0);
    expect(createPlayerEliminationScore(cancelled, "player:1", context).population).toBe(120);
  });
});
