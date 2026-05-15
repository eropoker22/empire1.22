import { describe, expect, it } from "vitest";
import {
  appendCityFeedEvents,
  appendCityFeedEventsFromCoreEvents,
  createMarketCityFeedEvent,
  createRobberyCityFeedEvent,
  createCityFeedProjection,
  createTrapCityFeedEvent,
  applyRumorEventToState,
  resolveRumorEvent,
  runTick,
  type CoreEvent
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand } from "../../../packages/game-core/src/engine";
import { createAttackDistrictCommandFixture, createSpyDistrictCommandFixture } from "../../fixtures/command-fixtures";
import { createCombatStateFixture, createCoreStateFixture, createFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

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

    expect(feedEvents.some((event) => event.sourceType === "police_raid" && event.category === "police")).toBe(true);
    expect(feedEvents.filter((event) => event.sourceType === "police_raid" && event.category === "police")).toHaveLength(1);
  });

  it("keeps atmospheric police rumors out of policeFeed while confirmed warnings stay there", () => {
    const state = createCoreStateFixture();
    const nextState = appendCityFeedEventsFromCoreEvents(state, [
      {
        type: "police-warning-issued",
        occurredAt: new Date(0).toISOString(),
        payload: {
          playerId: "player:1",
          districtId: "district:1",
          aggregatePressure: 80
        }
      }
    ], 50, context);
    const projection = createCityFeedProjection(nextState, {
      playerId: "player:1",
      selectedDistrictId: "district:1"
    });
    const policeRumors = Object.values(nextState.cityFeedEventsById).filter((event) => event.payload?.atmosphericPoliceRumor);

    expect(policeRumors).toHaveLength(1);
    expect(policeRumors[0]).toMatchObject({
      category: "rumor",
      truthiness: "unconfirmed",
      intelType: "warning"
    });
    expect(projection.policeFeed).toHaveLength(1);
    expect(projection.policeFeed[0]).toMatchObject({
      category: "police",
      truthiness: "confirmed",
      intelType: "confirmed_event"
    });
    expect(projection.policeFeed.some((event) => event.payload?.atmosphericPoliceRumor)).toBe(false);
  });

  it("routes raid pressure rumors through the pipeline and into the selected district feed", () => {
    const state = createCoreStateFixture();
    const nextState = appendCityFeedEventsFromCoreEvents(state, [
      {
        type: "police-raid-triggered",
        occurredAt: new Date(0).toISOString(),
        payload: {
          playerId: "player:1",
          raidId: "raid:pressure:1",
          severity: "high",
          targetDistrictId: "district:1"
        }
      }
    ], 50, context);
    const projection = createCityFeedProjection(nextState, {
      playerId: "player:1",
      selectedDistrictId: "district:1"
    });
    const rumor = Object.values(nextState.cityFeedEventsById).find((event) => event.payload?.atmosphericPoliceRumor);

    expect(rumor).toMatchObject({
      category: "rumor",
      districtId: "district:1",
      truthiness: "unconfirmed",
      intelType: "suspicion",
      payload: {
        atmosphericPoliceRumor: true,
        intelType: "suspicion",
        rumorType: "police_district_heat"
      }
    });
    expect(projection.selectedDistrictFeed.some((event) => event.id === rumor?.id)).toBe(true);
    expect(projection.policeFeed.some((event) => event.id === rumor?.id)).toBe(false);
  });

  it("does not let Lobby Club reduction block confirmed raid events", () => {
    const state = createCoreStateFixture();
    const lobbyClub = createFixedBuildingFixture("lobby_club", {
      id: "building:lobby-club:1",
      metadata: {
        lobbyClub: {
          backroomPressureExpiresAtTick: 999,
          mediaScreenExpiresAtTick: 999
        }
      }
    });
    state.buildingsById[lobbyClub.id] = lobbyClub;
    state.districtsById[lobbyClub.districtId] = {
      ...state.districtsById[lobbyClub.districtId],
      buildingIds: [lobbyClub.id]
    };

    const nextState = appendCityFeedEventsFromCoreEvents(state, [
      {
        type: "police-raid-resolved",
        occurredAt: new Date(0).toISOString(),
        payload: {
          playerId: "player:1",
          raidId: "raid:lobby:1",
          severity: "high",
          targetDistrictId: "district:1",
          seizedDirtyCash: 120
        }
      }
    ], 50, context);
    const projection = createCityFeedProjection(nextState, { playerId: "player:1" });

    expect(projection.policeFeed).toEqual([
      expect.objectContaining({
        sourceType: "police_raid",
        category: "police",
        truthiness: "confirmed",
        intelType: "confirmed_event"
      })
    ]);
  });

  it("marks false police leads from police lifecycle as false_possible rumors", () => {
    const state = createCoreStateFixture();
    const nextState = appendCityFeedEventsFromCoreEvents(state, [
      {
        type: "police-warning-issued",
        occurredAt: new Date(0).toISOString(),
        payload: {
          playerId: "player:1",
          districtId: "district:1",
          aggregatePressure: 75,
          falseLead: true
        }
      }
    ], 50);
    const event = Object.values(nextState.cityFeedEventsById).find((feedEvent) =>
      feedEvent.payload?.rumorType === "police_false_lead"
    );

    expect(event).toMatchObject({
      category: "rumor",
      sourceType: "police_warning",
      truthiness: "false_possible",
      intelType: "false_lead",
      payload: {
        rumorType: "police_false_lead",
        intelType: "false_lead"
      }
    });
  });

  it("keeps trap suspicion rumors unconfirmed and never mutates trap discovery state", () => {
    const state = createCoreStateFixture();
    state.trapsById["trap:district:1"] = {
      id: "trap:district:1",
      serverInstanceId: state.serverInstance.id,
      ownerPlayerId: "player:1",
      districtId: "district:1",
      status: "active",
      placedAtTick: 1,
      triggeredAtTick: null,
      version: 1
    };
    const beforeTraps = JSON.stringify(state.trapsById);
    const input = {
      sourceEventId: "trap-rumor:test",
      sourceType: "trap" as const,
      category: "rumor" as const,
      severity: "high" as const,
      truthiness: "confirmed" as const,
      visibility: "all" as const,
      playerId: "player:2",
      districtId: "district:1",
      message: "Někdo možná připravil past v tomto districtu.",
      payload: {
        rumorType: "trap_suspicion",
        trapId: "trap:district:1",
        trapType: "toxic",
        trapDetected: true
      }
    };

    const resolved = resolveRumorEvent(input, state);
    expect(resolved.event).toMatchObject({
      sourceType: "trap",
      category: "rumor",
      intelType: "suspicion"
    });
    expect(resolved.event?.truthiness).not.toBe("confirmed");
    expect(JSON.stringify(resolved.event?.payload)).not.toContain("trap:district:1");
    expect(JSON.stringify(resolved.event?.payload)).not.toContain("toxic");
    expect(resolved.event?.message.toLowerCase()).not.toContain("v tomto districtu je past");

    const nextState = applyRumorEventToState(state, input);
    expect(JSON.stringify(nextState.trapsById)).toBe(beforeTraps);
    expect(JSON.stringify(nextState).toLowerCase()).not.toContain("trapdiscovered");
    expect(JSON.stringify(nextState).toLowerCase()).not.toContain("discoveredtrap");
  });

  it("creates false_possible rumors and projects them without polluting police feed", () => {
    const state = createCoreStateFixture();
    const nextState = applyRumorEventToState(state, {
      sourceEventId: "restaurant:false-lead:1",
      sourceType: "building_action",
      category: "rumor",
      severity: "low",
      visibility: "all",
      playerId: "player:1",
      districtId: "district:1",
      message: "Hosté si spletli dodávku s policejním sledováním.",
      truthChancePct: 0,
      payload: { buildingTypeId: "restaurant", rumorType: "police_interest" }
    });
    const projection = createCityFeedProjection(nextState, {
      playerId: "player:1",
      selectedDistrictId: "district:1"
    });

    expect(projection.currentPlayerFeed[0]).toMatchObject({
      truthiness: "false_possible",
      intelType: "false_lead"
    });
    expect(projection.globalCityFeed).toHaveLength(1);
    expect(projection.selectedDistrictFeed).toHaveLength(1);
    expect(projection.policeFeed).toHaveLength(0);
  });
});
