import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand, completeDuePlayerCityEvents, createPlayerCityEventsView, synchronizePlayerCityEvents } from "@empire/game-core";
import type { CityEventCommand, PlayerCityEventAgentId } from "@empire/shared-types";
import { createCoreStateFixture } from "../../fixtures/game-state-fixtures";
const config = resolveModeConfig("free");
const context = { config, clock: { now: () => new Date("2026-09-10T12:00:00Z"), nowIso: () => "2026-09-10T12:00:00.000Z" } };
const command = (offerId: string): CityEventCommand => ({ id: `start:${offerId}`, clientRequestId: null, type: "start-city-event", mode: "free", playerId: "player:1", serverInstanceId: "instance:1", issuedAt: context.clock.nowIso(), payload: { offerId } });
function starting(agent: PlayerCityEventAgentId, success = 100) {
  let state = createCoreStateFixture();
  state.root.tick = config.balance.dayNight!.phases.day.durationTicks;
  state.districtsById["district:1"].influence = 400;
  state.resourceStatesById["resource:1"].balances = { cash: 100000, "dirty-cash": 100000, chemicals: 59 };
  state = synchronizePlayerCityEvents(state, "player:1", context);
  const offer = state.playerCityEventStatesByPlayerId!["player:1"].offersByAgent[agent][0];
  offer.successRateSnapshot = success;
  offer.rewardSnapshot = { chemicals: 4, cash: 1234 };
  offer.riskSnapshot = { successHeat: 1, failureHeat: 3, failureDirtyCashLoss: 200, startCost: { cash: 75 } };
  state.root.tick = offer.expiresAtTick - 1;
  state.serverInstance.currentTick = state.root.tick;
  const result = applyCommand(state, command(offer.offerId), context);
  expect(result.errors).toEqual([]);
  return { state: result.nextState, offer };
}
describe("accepted city events survive schedule replacement", () => {
  it.each(["victor", "leon", "nyra"] as const)("settles %s once after rotation and JSON restore, keeping overflow claimable", (agent) => {
    const { state, offer } = starting(agent);
    const run = state.playerCityEventStatesByPlayerId!["player:1"].activeRun!;
    state.root.tick = offer.expiresAtTick;
    const rotated = synchronizePlayerCityEvents(JSON.parse(JSON.stringify(state)), "player:1", context);
    expect(createPlayerCityEventsView(rotated, "player:1", context)!.activeRun?.offerId).toBe(offer.offerId);
    const view = JSON.stringify(createPlayerCityEventsView(rotated, "player:1", context));
    expect(view).not.toContain("deterministicOutcomeSeed");
    rotated.root.tick = run.completesAtTick;
    const result = completeDuePlayerCityEvents(rotated, context);
    expect(result.events.map(e => e.type)).toEqual(["city-event-succeeded"]);
    expect(result.nextState.resourceStatesById["resource:1"].balances).toMatchObject({ cash: 101159, chemicals: 60 });
    expect(result.nextState.playerCityEventStatesByPlayerId!["player:1"]).toMatchObject({ activeRun: null, pendingRewards: [expect.objectContaining({ amount: 3 })] });
    expect(completeDuePlayerCityEvents(JSON.parse(JSON.stringify(result.nextState)), context).events).toEqual([]);
  });
  it("uses accepted failure cost even when new offers or configuration differ", () => {
    const { state, offer } = starting("victor", 0);
    const run = state.playerCityEventStatesByPlayerId!["player:1"].activeRun!;
    // Mutating the rotating catalog cannot mutate the accepted contract.
    state.playerCityEventStatesByPlayerId!["player:1"].offersByAgent.victor[0].riskSnapshot.failureDirtyCashLoss = 9999;
    state.root.tick = run.completesAtTick;
    const done = completeDuePlayerCityEvents(state, context);
    expect(done.events.map(e => e.type)).toEqual(["city-event-failed"]);
    expect(done.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(99800);
    expect(done.nextState.playerCityEventStatesByPlayerId!["player:1"].activeRun).toBeNull();
    const next = done.nextState.playerCityEventStatesByPlayerId!["player:1"].offersByAgent.victor.find(o => o.status === "available")!;
    expect(next.offerId).not.toBe(offer.offerId);
    expect(applyCommand(done.nextState, command(next.offerId), context).errors).toEqual([]);
  });
  it("upgrades an older in-flight snapshot before its offer is replaced", () => {
    const { state, offer } = starting("victor");
    const run = state.playerCityEventStatesByPlayerId!["player:1"].activeRun!;
    delete run.offerSnapshot;
    state.root.tick = offer.expiresAtTick;
    const rotated = synchronizePlayerCityEvents(JSON.parse(JSON.stringify(state)), "player:1", context);
    expect(rotated.playerCityEventStatesByPlayerId!["player:1"].activeRun?.offerSnapshot?.offerId).toBe(offer.offerId);
    rotated.root.tick = run.completesAtTick;
    expect(completeDuePlayerCityEvents(rotated, context).events.map(e => e.type)).toEqual(["city-event-succeeded"]);
  });
  it("retains an already orphaned paid claim explicitly without generating a new payout", () => {
    const { state } = starting("victor");
    const city = state.playerCityEventStatesByPlayerId!["player:1"];
    const run = city.activeRun!;
    delete run.offerSnapshot;
    city.offersByAgent = { victor: [], leon: [], nyra: [] };
    state.root.tick = run.completesAtTick;
    const before = { ...state.resourceStatesById["resource:1"].balances };
    const done = completeDuePlayerCityEvents(JSON.parse(JSON.stringify(state)), context);
    expect(done.nextState.resourceStatesById["resource:1"].balances).toEqual(before);
    expect(done.nextState.playerCityEventStatesByPlayerId!["player:1"]).toMatchObject({ activeRun: null,
      unresolvedRuns: [{ run: expect.objectContaining({ runId: run.runId }), reason: "missing-accepted-contract" }] });
    expect(Object.values(done.nextState.notificationsById).some(n => n.bodyKey === "city.event.recovery_required")).toBe(true);
    const again = completeDuePlayerCityEvents(done.nextState, context);
    expect(again.nextState.playerCityEventStatesByPlayerId!["player:1"].unresolvedRuns).toHaveLength(1);
  });

});
