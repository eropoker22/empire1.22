import { describe, expect, it } from "vitest";
import {
  appendCityFeedEvents,
  appendCityFeedEventsFromCoreEvents,
  createMarketCityFeedEvent,
  createRobberyCityFeedEvent,
  createCityFeedProjection,
  createTrapCityFeedEvent,
  runTick,
  type CoreEvent
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand } from "../../../packages/game-core/src/engine";
import { createAttackDistrictCommandFixture, createSpyDistrictCommandFixture } from "../../fixtures/command-fixtures";
import { createCombatStateFixture, createCoreStateFixture } from "../../fixtures/game-state-fixtures";

const context = { config: resolveModeConfig("free") };

const addPoliceState = (state: ReturnType<typeof createCoreStateFixture>, heat: number) => {
  state.policeStatesById["police:1"] = {
    id: "police:1",
    ownerPlayerId: "player:1",
    heat,
    wantedLevel: Math.floor(heat / 20),
    lastDecayTick: 0,
    activeFlags: [],
    version: 1
  };
};

describe("city feed event integration", () => {
  it("creates idempotent attack and spy city feed events from command results", () => {
    const attack = applyCommand(createCombatStateFixture(), createAttackDistrictCommandFixture(), context);
    expect(attack.errors).toEqual([]);
    expect(Object.values(attack.nextState.cityFeedEventsById)).toEqual([
      expect.objectContaining({
        sourceType: "attack",
        category: "combat",
        districtId: "district:2",
        truthiness: "confirmed"
      })
    ]);

    const repeated = appendCityFeedEvents(
      attack.nextState,
      Object.values(attack.nextState.cityFeedEventsById)
    );
    expect(Object.keys(repeated.cityFeedEventsById)).toHaveLength(1);

    const spy = applyCommand(createCombatStateFixture(), createSpyDistrictCommandFixture(), context);
    const spyEvent = Object.values(spy.nextState.cityFeedEventsById)[0];
    expect(spyEvent).toMatchObject({
      sourceType: "spy",
      category: "rumor",
      truthiness: "unconfirmed",
      payload: { publicSummary: "spy_activity" }
    });
    expect(JSON.stringify(spyEvent.payload)).not.toContain("detectedDefense");
  });

  it("creates capture, trap, police warning and raid feed events from core events", () => {
    const state = createCoreStateFixture();
    const events: CoreEvent[] = [
      {
        type: "district-captured",
        occurredAt: new Date(0).toISOString(),
        payload: {
          attackerPlayerId: "player:1",
          previousOwnerPlayerId: "player:2",
          districtId: "district:1"
        }
      },
      {
        type: "trap-triggered",
        occurredAt: new Date(0).toISOString(),
        payload: {
          attackerPlayerId: "player:2",
          districtId: "district:1"
        }
      },
      {
        type: "police-warning-issued",
        occurredAt: new Date(0).toISOString(),
        payload: {
          playerId: "player:1",
          aggregatePressure: 80
        }
      },
      {
        type: "police-raid-resolved",
        occurredAt: new Date(0).toISOString(),
        payload: {
          playerId: "player:1",
          raidId: "raid:1",
          severity: "high",
          targetDistrictId: "district:1",
          seizedDirtyCash: 120
        }
      }
    ];
    const nextState = appendCityFeedEventsFromCoreEvents(state, events);

    expect(new Set(Object.values(nextState.cityFeedEventsById).map((event) => event.sourceType))).toEqual(new Set([
      "district_capture",
      "trap",
      "police_warning",
      "police_raid"
    ]));
    expect(Object.values(nextState.cityFeedEventsById).every((event) => event.message.length > 0)).toBe(true);
  });

  it("projects visibility, selected district feed, police feed and max feed trimming", () => {
    const state = createCoreStateFixture();
    const nextState = appendCityFeedEvents(state, [
      {
        id: "city-feed:all",
        sourceType: "attack",
        category: "combat",
        severity: "medium",
        truthiness: "confirmed",
        visibility: "all",
        districtId: "district:1",
        createdAtTick: 1,
        message: "Global event"
      },
      {
        id: "city-feed:player",
        sourceType: "spy",
        category: "rumor",
        severity: "low",
        truthiness: "unconfirmed",
        visibility: "player",
        playerId: "player:1",
        createdAtTick: 2,
        message: "Player event"
      },
      {
        id: "city-feed:admin",
        sourceType: "system",
        category: "system",
        severity: "low",
        truthiness: "confirmed",
        visibility: "admin",
        createdAtTick: 3,
        message: "Admin event"
      },
      {
        id: "city-feed:police",
        sourceType: "police_raid",
        category: "police",
        severity: "high",
        truthiness: "confirmed",
        visibility: "all",
        districtId: "district:1",
        createdAtTick: 4,
        message: "Police event"
      }
    ]);
    const projection = createCityFeedProjection(nextState, {
      playerId: "player:1",
      selectedDistrictId: "district:1",
      limit: 3
    });

    expect(projection.currentPlayerFeed.map((event) => event.id)).toEqual([
      "city-feed:police",
      "city-feed:player",
      "city-feed:all"
    ]);
    expect(projection.globalCityFeed.map((event) => event.id)).toEqual(["city-feed:police", "city-feed:all"]);
    expect(projection.selectedDistrictFeed).toHaveLength(2);
    expect(projection.policeFeed[0]).toMatchObject({ sourceType: "police_raid" });
  });

  it("creates market, robbery and trap manual feed events with source idempotency keys", () => {
    const events = [
      createMarketCityFeedEvent({
        sourceEventId: "market:black:1",
        playerId: "player:1",
        createdAtTick: 1,
        severity: "medium"
      }),
      createRobberyCityFeedEvent({
        sourceEventId: "robbery:district:1",
        playerId: "player:1",
        targetPlayerId: "player:2",
        districtId: "district:1",
        createdAtTick: 2
      }),
      createTrapCityFeedEvent({
        sourceEventId: "trap:district:1",
        playerId: "player:2",
        districtId: "district:1",
        createdAtTick: 3
      })
    ];

    expect(events.map((event) => event.sourceType)).toEqual(["market", "robbery", "trap"]);
    expect(events.every((event) => event.id.startsWith("city-feed:"))).toBe(true);
    expect(events.every((event) => event.message.length > 0)).toBe(true);
  });

  it("adds police raid feed during tick without duplicate unresolved spam", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 130);
    const first = runTick(state, context);
    const second = runTick(first.nextState, context);
    const feedEvents = Object.values(second.nextState.cityFeedEventsById);

    expect(feedEvents.some((event) => event.sourceType === "police_raid")).toBe(true);
    expect(feedEvents.filter((event) => event.sourceType === "police_raid")).toHaveLength(1);
  });
});
