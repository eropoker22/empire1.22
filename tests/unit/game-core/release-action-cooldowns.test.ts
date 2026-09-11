import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand, runTick } from "@empire/game-core";
import { createCombatStateFixture } from "../../fixtures/game-state-fixtures";
import { createAttackDistrictCommandFixture, createHeistDistrictCommandFixture, createRobDistrictCommandFixture, createSpyDistrictCommandFixture } from "../../fixtures/command-fixtures";
const config = resolveModeConfig("free");
const epoch = Date.parse("2026-09-10T12:00:00Z");
const context = (ms = epoch) => ({ config, clock: { now: () => new Date(ms), nowIso: () => new Date(ms).toISOString() } });
const factories = { spy: createSpyDistrictCommandFixture, attack: createAttackDistrictCommandFixture, rob: createRobDistrictCommandFixture, heist: createHeistDistrictCommandFixture };
const kinds = ["spy", "attack", "rob", "heist"] as const;
function fixture(kind: typeof kinds[number]) {
  const state = createCombatStateFixture();
  state.serverInstance.startedAt = new Date(epoch).toISOString();
  state.serverInstance.worldSeed = "release-cooldown";
  state.playersById["player:1"].population = 200;
  state.playersById["player:1"].factionId = "motorkarsky-gang";
  state.districtsById["district:1"].influence = 100;
  state.resourceStatesById["resource:1"].balances.cash = 100000;
  if (kind === "rob") { state.districtsById["district:2"].ownerPlayerId = null; state.districtsById["district:2"].status = "neutral"; }
  if (kind === "spy") { state.notificationsById = {}; state.root.notificationIds = []; }
  const base = factories[kind]({ issuedAt: context().clock.nowIso() });
  const created = applyCommand(state, { ...base, type: "create-alliance", payload: { name: "Release", tag: "REL" } }, context());
  expect(created.errors).toEqual([]);
  const left = applyCommand(created.nextState, { ...base, id: "leave", type: "leave-alliance", payload: { allianceId: created.nextState.playersById["player:1"].allianceId! } }, context());
  expect(left.errors).toEqual([]);
  return { state: left.nextState, base };
}
function resolve(state: ReturnType<typeof createCombatStateFixture>, ctx: ReturnType<typeof context>) {
  const op = Object.values(state.pendingDistrictActionOperationsById!)[0];
  const before = JSON.parse(JSON.stringify(state));
  before.root.tick = op.resolveAtTick - 1; before.serverInstance.currentTick = before.root.tick;
  return { op, state: runTick(before, ctx).nextState };
}
describe("all affected operation recovery cooldowns", () => {
  it.each(kinds)("applies one penalty to %s recovery with an existing faction modifier, never to travel", kind => {
    const { state, base } = fixture(kind);
    const normal = structuredClone(state); normal.allianceExitPenaltiesById = {};
    const a = applyCommand(normal, base, context()); const b = applyCommand(state, base, context());
    expect(a.errors).toEqual([]); expect(b.errors).toEqual([]);
    const doneA = resolve(a.nextState, context()); const doneB = resolve(b.nextState, context());
    expect(doneB.op.resolveAtTick).toBe(doneA.op.resolveAtTick);
    const cdA = doneA.state.cooldownStatesById[doneA.state.playersById["player:1"].cooldownStateId].cooldowns;
    const cdB = doneB.state.cooldownStatesById[doneB.state.playersById["player:1"].cooldownStateId].cooldowns;
    for (const key of doneB.op.cooldownKeys) {
      const baseRecovery = Math.max(0, (cdA[key] ?? doneA.op.resolveAtTick) - doneA.op.resolveAtTick);
      const spyExtra = kind === "spy" ? Math.ceil((doneA.op.resolveAtTick - doneA.op.issuedAtTick) * .15) : 0;
      expect(cdB[key]).toBe(doneB.op.resolveAtTick + Math.max(Math.ceil(baseRecovery * 1.15), spyExtra));
    }
    if (kind === "spy") {
      const slot = doneB.state.playerSpyOperationStatesByPlayerId!["player:1"].slots.find(s => s.slotId === doneB.op.spySlotId)!;
      expect(slot.availableAtTick).toBe(cdB[`spy:${doneB.op.targetDistrictId}`]);
    }
  });
  it.each(kinds)("does not apply the expired six-hour effect to a new %s operation", kind => {
    const { state, base } = fixture(kind);
    const ctx = context(epoch + 6 * 3600000);
    const started = applyCommand(state, { ...base, issuedAt: ctx.clock.nowIso() }, ctx);
    expect(started.errors).toEqual([]);
    expect(Object.values(started.nextState.pendingDistrictActionOperationsById!)[0].allianceCooldownMultiplier).toBe(1);
  });
  it("respects the saved list of affected actions", () => {
    const { state, base } = fixture("heist");
    Object.values(state.allianceExitPenaltiesById!)[0].affectedActionIds = ["spy"];
    const started = applyCommand(state, base, context());
    expect(started.errors).toEqual([]);
    expect(Object.values(started.nextState.pendingDistrictActionOperationsById!)[0].allianceCooldownMultiplier).toBe(1);
  });
});
