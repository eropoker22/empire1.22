import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import {
  applyCommand,
  completeDuePlayerCityEvents,
  createPlayerCityEventsView,
  synchronizePlayerCityEvents
} from "@empire/game-core";
import type { CityEventCommand } from "@empire/shared-types";
import { createCoreStateFixture } from "../../fixtures/game-state-fixtures";

const config = resolveModeConfig("free");
const context = {
  config,
  clock: {
    now: () => new Date("2026-07-14T18:00:00.000Z"),
    nowIso: () => "2026-07-14T18:00:00.000Z"
  }
};

const at1800 = config.balance.dayNight!.phases.day.durationTicks;

const command = (
  type: CityEventCommand["type"],
  payload: CityEventCommand["payload"],
  id: string
): CityEventCommand => ({
  id,
  type,
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: "2026-07-14T18:00:00.000Z",
  clientRequestId: id,
  payload
} as CityEventCommand);

const scheduledState = () => {
  const state = createCoreStateFixture();
  state.root.tick = at1800;
  state.serverInstance.currentTick = at1800;
  state.districtsById["district:1"].influence = 400;
  return synchronizePlayerCityEvents(state, "player:1", context);
};

describe("authoritative City Event lifecycle", () => {
  it("generates stable schedule-window offers and projects exact risk", () => {
    const first = scheduledState();
    const second = synchronizePlayerCityEvents(first, "player:1", context);
    expect(second).toBe(first);
    const cityState = first.playerCityEventStatesByPlayerId?.["player:1"];
    expect(cityState?.offersByAgent.victor).toHaveLength(3);
    expect(cityState?.offersByAgent.leon).toHaveLength(3);
    expect(cityState?.offersByAgent.nyra).toHaveLength(3);
    expect(cityState?.offersByAgent.victor[0].scheduleWindowId).toContain(":1800");

    const view = createPlayerCityEventsView(first, "player:1", context)!;
    expect(view.cityClock.label).toBe("18:00");
    expect(view.agents.find((agent) => agent.agentId === "victor")).toMatchObject({
      availableNow: true,
      unlocked: true,
      scheduleLabel: "18:00–04:00 · nové nabídky 18:00 / 22:00 / 02:00"
    });
    expect(view.agents.flatMap((agent) => agent.offers)).toHaveLength(9);
  });

  it("allows one attempt, completes by tick, applies Heat and keeps storage overflow pending", () => {
    const state = scheduledState();
    const cityState = state.playerCityEventStatesByPlayerId!["player:1"];
    const offer = cityState.offersByAgent.victor[0];
    cityState.offersByAgent.victor[0] = {
      ...offer,
      successRateSnapshot: 100,
      durationTicksSnapshot: 2,
      rewardSnapshot: { chemicals: 4 },
      riskSnapshot: { successHeat: 1, failureHeat: 3, failureDirtyCashLoss: 0 }
    };
    state.resourceStatesById["resource:1"].balances.chemicals = 59;

    const started = applyCommand(
      state,
      command("start-city-event", { offerId: offer.offerId }, "command:event:start"),
      context
    );
    expect(started.errors).toEqual([]);
    expect(started.nextState.playerCityEventStatesByPlayerId?.["player:1"].activeRun).toMatchObject({
      offerId: offer.offerId,
      completesAtTick: at1800 + 2
    });
    const duplicate = applyCommand(
      started.nextState,
      command("start-city-event", { offerId: offer.offerId }, "command:event:duplicate"),
      context
    );
    expect(duplicate.errors[0]?.code).toBe("city_event_already_active");

    const dueState = {
      ...started.nextState,
      root: { ...started.nextState.root, tick: at1800 + 2 },
      serverInstance: { ...started.nextState.serverInstance, currentTick: at1800 + 2 }
    };
    const completed = completeDuePlayerCityEvents(dueState, context);
    expect(completed.events.map((event) => event.type)).toContain("city-event-succeeded");
    expect(completed.nextState.resourceStatesById["resource:1"].balances.chemicals).toBe(60);
    expect(completed.nextState.policeStatesById["police:1"].heat).toBe(1);
    expect(completed.nextState.playerCityEventStatesByPlayerId?.["player:1"].pendingRewards).toEqual([
      expect.objectContaining({ resourceKey: "chemicals", amount: 3, reason: "storage-capacity" })
    ]);
    expect(completeDuePlayerCityEvents(completed.nextState, context).nextState).toBe(completed.nextState);
  });

  it("claims only the amount that fits and never duplicates a pending reward", () => {
    const state = scheduledState();
    state.resourceStatesById["resource:1"].balances.chemicals = 58;
    state.playerCityEventStatesByPlayerId!["player:1"].pendingRewards = [{
      pendingRewardId: "city-event-reward:pending:1",
      sourceOfferId: "offer:1",
      resourceKey: "chemicals",
      amount: 5,
      reason: "storage-capacity",
      createdAtTick: at1800
    }];
    const claimed = applyCommand(
      state,
      command("claim-city-event-reward", { pendingRewardId: "city-event-reward:pending:1" }, "command:event:claim"),
      context
    );
    expect(claimed.errors).toEqual([]);
    expect(claimed.nextState.resourceStatesById["resource:1"].balances.chemicals).toBe(60);
    expect(claimed.nextState.playerCityEventStatesByPlayerId?.["player:1"].pendingRewards[0].amount).toBe(3);
    const full = applyCommand(
      claimed.nextState,
      command("claim-city-event-reward", { pendingRewardId: "city-event-reward:pending:1" }, "command:event:claim-again"),
      context
    );
    expect(full.errors[0]?.code).toBe("storage_capacity_full");
    expect(full.nextState).toBe(claimed.nextState);
  });
});
