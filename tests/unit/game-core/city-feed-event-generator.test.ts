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
import { resolveModeConfig, validateRumorTemplates } from "@empire/game-config";
import { applyCommand } from "../../../packages/game-core/src/engine";
import { createAttackDistrictCommandFixture } from "../../fixtures/command-fixtures";
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
  it("creates idempotent attack feed events and keeps successful spy intel private", () => {
    const attack = applyCommand(createCombatStateFixture(), createAttackDistrictCommandFixture(), context);
    expect(attack.errors).toEqual([]);
    expect(Object.values(attack.nextState.cityFeedEventsById)).toEqual([
      expect.objectContaining({
        sourceType: "attack",
        category: "combat",
        districtId: "district:2",
        truthiness: "confirmed",
        confidence: "confirmed",
        templateId: expect.stringMatching(/^rumor\.attack_activity\.confirmed\./)
      })
    ]);

    const repeated = appendCityFeedEvents(
      attack.nextState,
      Object.values(attack.nextState.cityFeedEventsById)
    );
    expect(Object.keys(repeated.cityFeedEventsById)).toHaveLength(1);

    const successfulSpyState = appendCityFeedEventsFromCoreEvents(createCoreStateFixture(), [{
      type: "district-spied",
      occurredAt: new Date(0).toISOString(),
      payload: {
        attackerPlayerId: "player:1",
        targetDistrictId: "district:2",
        result: "success",
        detectedDefense: { cameras: 4 },
        trapDetected: true
      }
    }], 50, context);
    expect(Object.values(successfulSpyState.cityFeedEventsById)).toHaveLength(0);

    const failedSpyState = appendCityFeedEventsFromCoreEvents(createCoreStateFixture(), [{
      type: "district-spied",
      occurredAt: new Date(0).toISOString(),
      payload: {
        attackerPlayerId: "player:1",
        targetDistrictId: "district:2",
        result: "critical_failed",
        detectedDefense: { cameras: 4 },
        trapDetected: true
      }
    }], 50, context);
    const spyEvent = Object.values(failedSpyState.cityFeedEventsById)[0];
    expect(spyEvent).toMatchObject({
      sourceType: "spy",
      category: "rumor",
      rumorCategory: "espionage",
      truthiness: "unconfirmed",
      confidence: "suspicion"
    });
    expect(JSON.stringify(spyEvent)).not.toContain("detectedDefense");
    expect(JSON.stringify(spyEvent).toLowerCase()).not.toContain("trap");
  });

  it("creates capture, police warning and raid feed events from core events without trap feed", () => {
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
      "city-feed:all",
      "city-feed:player"
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

    expect(events.map((event) => event.sourceType)).toEqual(["market", "robbery", "system"]);
    expect(events.every((event) => event.id.startsWith("city-feed:"))).toBe(true);
    expect(events.every((event) => event.message.length === 0)).toBe(true);
    expect(events.map((event) => event.messageKey)).toEqual(["rumor.black_market", "rumor.robbery", "rumor.atmosphere"]);
    expect(JSON.stringify(events).toLowerCase()).not.toContain("trap");
    expect(JSON.stringify(events).toLowerCase()).not.toContain("past");
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
    const policeRumors = Object.values(nextState.cityFeedEventsById).filter((event) => event.category === "rumor");

    expect(policeRumors).toHaveLength(1);
    expect(policeRumors[0]).toMatchObject({
      category: "rumor",
      truthiness: "unconfirmed",
      intelType: "suspicion",
      confidence: "suspicion",
      rumorCategory: "police_heat"
    });
    expect(projection.policeFeed).toHaveLength(1);
    expect(projection.policeFeed[0]).toMatchObject({
      category: "police",
      truthiness: "confirmed",
      intelType: "confirmed_event"
    });
    expect(projection.policeFeed.some((event) => event.category === "rumor")).toBe(false);
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
    const rumor = Object.values(nextState.cityFeedEventsById).find((event) => event.category === "rumor");

    expect(rumor).toMatchObject({
      category: "rumor",
      districtId: "district:1",
      truthiness: "unconfirmed",
      intelType: "suspicion",
      confidence: "suspicion",
      payload: {
        rumorCategory: "police_heat",
        confidence: "suspicion"
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
    const event = Object.values(nextState.cityFeedEventsById).find((feedEvent) => feedEvent.confidence === "false_possible");

    expect(event).toMatchObject({
      category: "rumor",
      sourceType: "police_warning",
      truthiness: "false_possible",
      intelType: "false_lead",
      payload: {
        rumorCategory: "police_heat",
        confidence: "false_possible"
      }
    });
  });

  it("suppresses trap suspicion rumors and never mutates trap discovery state", () => {
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
    expect(resolved.event).toBeNull();
    expect(resolved.suppressed).toBe(true);

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

  it("validates runtime rumor content registry and keeps forbidden placeholders out", () => {
    expect(validateRumorTemplates()).toEqual([]);
  });

  it("serializes rumor payloads without exact private values", () => {
    const state = createCoreStateFixture();
    const nextState = applyRumorEventToState(state, {
      sourceEventId: "security:leak:1",
      sourceType: "building_action",
      category: "rumor",
      severity: "high",
      visibility: "all",
      districtId: "district:1",
      message: "Bezpečný signál",
      confidence: "credible",
      rumorCategory: "weapons_materials",
      payload: {
        exactPopulation: 1200,
        attackPower: 999,
        defensePower: 888,
        weaponInventory: { smg: 12 },
        targetCommand: { districtId: "district:2" },
        hiddenSpyResult: { detectedDefense: { cameras: 4 } },
        exactPrivateHeat: 77,
        dirtyCash: 5000,
        cleanCash: 3000,
        sourceBuildingType: "restaurant"
      }
    }, context);
    const serialized = JSON.stringify(Object.values(nextState.cityFeedEventsById));

    for (const forbidden of [
      "exactPopulation",
      "attackPower",
      "defensePower",
      "weaponInventory",
      "targetCommand",
      "hiddenSpyResult",
      "exactPrivateHeat",
      "dirtyCash",
      "cleanCash",
      "cameras"
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("keeps template choice deterministic and retry-safe", () => {
    const state = createCoreStateFixture();
    const input = {
      sourceEventId: "deterministic:event:1",
      sourceType: "building_action" as const,
      category: "rumor" as const,
      severity: "medium" as const,
      visibility: "all" as const,
      districtId: "district:1",
      message: "Bezpečný signál",
      confidence: "credible" as const,
      rumorCategory: "economy" as const
    };
    const first = applyRumorEventToState(state, input, context);
    const second = applyRumorEventToState(first, input, context);
    const event = Object.values(first.cityFeedEventsById)[0];
    const repeated = Object.values(second.cityFeedEventsById)[0];

    expect(Object.values(second.cityFeedEventsById)).toHaveLength(1);
    expect(repeated.templateId).toBe(event.templateId);
    expect(repeated.message).toBe(event.message);
  });

  it("filters audience and expires stale feed items in the read model", () => {
    const state = createCoreStateFixture();
    const withEvents = appendCityFeedEvents(state, [
      {
        id: "city-feed:player:1",
        sourceEventId: "player:1",
        sourceType: "system",
        category: "rumor",
        severity: "low",
        truthiness: "unconfirmed",
        visibility: "player",
        playerId: "player:1",
        createdAtTick: 1,
        expiresAtTick: 100,
        priority: 30,
        message: "Private"
      },
      {
        id: "city-feed:player:2",
        sourceEventId: "player:2",
        sourceType: "system",
        category: "rumor",
        severity: "low",
        truthiness: "unconfirmed",
        visibility: "player",
        playerId: "player:2",
        createdAtTick: 2,
        expiresAtTick: 100,
        priority: 30,
        message: "Other"
      },
      {
        id: "city-feed:expired",
        sourceEventId: "expired",
        sourceType: "system",
        category: "rumor",
        severity: "low",
        truthiness: "unconfirmed",
        visibility: "all",
        createdAtTick: 1,
        expiresAtTick: 1,
        priority: 100,
        message: "Expired"
      }
    ]);
    const projection = createCityFeedProjection({ ...withEvents, root: { ...withEvents.root, tick: 20 } }, { playerId: "player:1" });

    expect(projection.currentPlayerFeed.map((event) => event.id)).toEqual(["city-feed:player:1"]);
    expect(JSON.stringify(projection)).not.toContain("Other");
    expect(JSON.stringify(projection)).not.toContain("Expired");
    expect(projection.currentPlayerFeed[0]?.freshness).toBe("fresh");
  });

  it("suppresses rapid duplicate category spam", () => {
    const state = createCoreStateFixture();
    const first = applyRumorEventToState(state, {
      sourceEventId: "spam:1",
      sourceType: "building_action",
      category: "rumor",
      visibility: "all",
      districtId: "district:1",
      createdAtTick: 10,
      confidence: "rumor",
      rumorCategory: "market",
      message: "Market signal"
    }, context);
    const second = applyRumorEventToState({ ...first, root: { ...first.root, tick: 11 } }, {
      sourceEventId: "spam:2",
      sourceType: "building_action",
      category: "rumor",
      visibility: "all",
      districtId: "district:1",
      createdAtTick: 11,
      confidence: "rumor",
      rumorCategory: "market",
      message: "Market signal"
    }, context);

    expect(Object.values(second.cityFeedEventsById)).toHaveLength(1);
  });
});
