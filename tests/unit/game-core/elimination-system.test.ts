import { describe, expect, it } from "vitest";
import {
  applyCommand,
  createEliminationReadModel,
  createInitialState,
  createPlayerView,
  runTick,
  runScheduledElimination
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import type { CoreGameState } from "@empire/game-core";
import { createAttackDistrictCommandFixture } from "../../fixtures/command-fixtures";
import {
  createPlayerFixture,
  createResourceStateFixture,
  createDistrictFixture,
  createFixedBuildingFixture,
  createCombatStateFixture
} from "../../fixtures/game-state-fixtures";

const config = resolveModeConfig("free");
const context = { config };
const FIRST_ELIMINATION_TICK = 5_760;
const ELIMINATION_INTERVAL_TICKS = 2_880;

describe("scheduled elimination system", () => {
  it("does not eliminate anyone before firstEliminationTick", () => {
    const state = createEliminationState();
    state.root.tick = FIRST_ELIMINATION_TICK - 1;

    const result = runScheduledElimination(state, context);

    expect(result.result).toBeNull();
    expect(Object.values(result.nextState.playersById).every((player) => player.status === "active")).toBe(true);
  });

  it("eliminates exactly one weakest active player at the scheduled tick", () => {
    const state = createEliminationState();
    state.root.tick = FIRST_ELIMINATION_TICK;

    const result = runScheduledElimination(state, context);

    expect(result.result?.eliminatedPlayerId).toBe("player:3");
    expect(result.nextState.playersById["player:3"].status).toBe("defeated");
    expect(result.nextState.playersById["player:3"].metadata).toMatchObject({
      eliminatedAtTick: FIRST_ELIMINATION_TICK,
      eliminationReason: "scheduled_weakest_player",
      finalPlacement: 9
    });
    expect(result.events.find((event) => event.type === "player-eliminated")?.payload).toMatchObject({
      playerId: "player:3",
      gangName: "Player 3",
      title: "Policie vystřílela gang Player 3",
      body: "Policie vystřílela gang na sračky a nic tu po něm nezbylo."
    });
  });

  it("runs during the tick lifecycle before victory checks", () => {
    const state = createEliminationState();
    state.root.tick = FIRST_ELIMINATION_TICK - 1;
    state.serverInstance.currentTick = FIRST_ELIMINATION_TICK - 1;

    const result = runTick(state, context);

    expect(result.nextState.root.tick).toBe(FIRST_ELIMINATION_TICK);
    expect(result.nextState.playersById["player:3"].status).toBe("defeated");
    expect(result.events.some((event) => event.type === "player-eliminated")).toBe(true);
  });

  it("ignores defeated players in the next elimination", () => {
    const state = createEliminationState({ players: 10 });
    state.root.tick = FIRST_ELIMINATION_TICK;
    const first = runScheduledElimination(state, context).nextState;
    const nextState = {
      ...first,
      root: { ...first.root, tick: FIRST_ELIMINATION_TICK + config.balance.elimination!.intervalTicks }
    };

    const second = runScheduledElimination(nextState, context);

    expect(second.result?.eliminatedPlayerId).not.toBe("player:3");
    expect(second.nextState.playersById["player:3"].status).toBe("defeated");
  });

  it("does not run when active players are at or below minActivePlayers", () => {
    const state = createEliminationState({ players: 8 });
    state.root.tick = FIRST_ELIMINATION_TICK;

    const result = runScheduledElimination(state, context);

    expect(result.result).toBeNull();
    expect(state.root.playerIds.map((id) => result.nextState.playersById[id].status)).toEqual([
      "active",
      "active",
      "active",
      "active",
      "active",
      "active",
      "active",
      "active"
    ]);
    expect(result.nextState.eliminationState?.nextEliminationTick).toBeNull();
  });

  it("runs at 9 active players and leaves the final 8 active", () => {
    const state = createEliminationState({ players: 9 });
    state.root.tick = FIRST_ELIMINATION_TICK;

    const result = runScheduledElimination(state, context);

    expect(result.result?.activePlayersRemaining).toBe(8);
    expect(Object.values(result.nextState.playersById).filter((player) => player.status === "active")).toHaveLength(8);
  });

  it("defers a scheduled 02:00 Europe/Bratislava elimination to 06:00", () => {
    const state = createEliminationState({ players: 9 });
    state.serverInstance.startedAt = "2026-01-01T17:00:00.000Z";
    state.root.tick = FIRST_ELIMINATION_TICK;

    const result = runScheduledElimination(state, context);

    expect(result.result).toBeNull();
    expect(result.nextState.eliminationState).toMatchObject({
      nextEliminationTick: FIRST_ELIMINATION_TICK + ELIMINATION_INTERVAL_TICKS,
      deferredFromTick: FIRST_ELIMINATION_TICK,
      lastScheduledEliminationTick: FIRST_ELIMINATION_TICK
    });
  });

  it("runs only one deferred elimination at 06:00 and schedules the next +4h", () => {
    const state = createEliminationState({ players: 9 });
    state.serverInstance.startedAt = "2026-01-01T17:00:00.000Z";
    state.root.tick = FIRST_ELIMINATION_TICK;
    const deferred = runScheduledElimination(state, context).nextState;
    const atResume = {
      ...deferred,
      root: { ...deferred.root, tick: FIRST_ELIMINATION_TICK + ELIMINATION_INTERVAL_TICKS },
      serverInstance: { ...deferred.serverInstance, currentTick: FIRST_ELIMINATION_TICK + ELIMINATION_INTERVAL_TICKS }
    };

    const first = runScheduledElimination(atResume, context);
    const second = runScheduledElimination(first.nextState, context);

    expect(first.result?.eliminatedPlayerId).toBe("player:3");
    expect(first.nextState.eliminationState).toMatchObject({
      lastEliminationTick: FIRST_ELIMINATION_TICK + ELIMINATION_INTERVAL_TICKS,
      lastScheduledEliminationTick: FIRST_ELIMINATION_TICK,
      nextEliminationTick: FIRST_ELIMINATION_TICK + (ELIMINATION_INTERVAL_TICKS * 2),
      deferredFromTick: null
    });
    expect(second.result).toBeNull();
    expect(Object.values(second.nextState.playersById).filter((player) => player.status === "defeated")).toHaveLength(1);
  });

  it("eliminates a player without districts before a player with territory", () => {
    const state = createEliminationState();
    state.root.tick = FIRST_ELIMINATION_TICK;

    const result = runScheduledElimination(state, context);

    expect(result.result?.eliminatedPlayerId).toBe("player:3");
    expect(result.result?.score.controlledDistricts).toBe(0);
  });

  it("uses deterministic tie-breakers", () => {
    const state = createEliminationState({ equalWeakPlayers: true });
    state.root.tick = FIRST_ELIMINATION_TICK;

    const result = runScheduledElimination(state, context);

    expect(result.result?.eliminatedPlayerId).toBe("player:2");
  });

  it("neutralizes defeated player districts and disables their buildings", () => {
    const state = createEliminationState({ weakPlayerOwnsDistrict: true });
    state.root.tick = FIRST_ELIMINATION_TICK;

    const result = runScheduledElimination(state, context);

    expect(result.result?.eliminatedPlayerId).toBe("player:3");
    expect(result.nextState.districtsById["district:3"]).toMatchObject({
      ownerPlayerId: null,
      controllerAllianceId: null,
      status: "neutral"
    });
    expect(result.nextState.buildingsById["building:district:3:restaurant:1"].status).toBe("disabled");
  });

  it("publishes the police cleanup message to the city feed", () => {
    const state = createEliminationState();
    state.root.tick = FIRST_ELIMINATION_TICK;

    const result = runScheduledElimination(state, context);
    const feedEvent = Object.values(result.nextState.cityFeedEventsById)
      .find((event) => event.sourceEventId === "elimination:5760:player:3");

    expect(feedEvent).toMatchObject({
      visibility: "all",
      message: "Policie vystřílela gang Player 3. Policie vystřílela gang na sračky a nic tu po něm nezbylo.",
      payload: expect.objectContaining({
        gangName: "Player 3",
        title: "Policie vystřílela gang Player 3",
        body: "Policie vystřílela gang na sračky a nic tu po něm nezbylo."
      })
    });
  });

  it("reactivates disabled buildings when another player captures a neutralized defeated district", () => {
    const state = createCombatStateFixture();
    const buildingId = "building:district:2:restaurant:1";
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      ownerPlayerId: null,
      controllerAllianceId: null,
      status: "neutral",
      defenseLoadout: {},
      buildingIds: [buildingId]
    };
    state.buildingsById[buildingId] = createFixedBuildingFixture("restaurant", {
      id: buildingId,
      districtId: "district:2",
      ownerPlayerId: "player:2",
      status: "disabled",
      metadata: {
        disabledByEliminationAtTick: FIRST_ELIMINATION_TICK,
        defeatedOwnerPlayerId: "player:2"
      }
    });

    const result = applyCommand(state, createAttackDistrictCommandFixture(), {
      config: {
        ...config,
        balance: {
          ...config.balance,
          conflict: {
            ...config.balance.conflict!,
            minAttackDurationTicks: 0,
            catastropheChance: 0
          }
        }
      }
    });

    expect(result.errors).toEqual([]);
    expect(result.nextState.districtsById["district:2"]).toMatchObject({
      ownerPlayerId: "player:1",
      status: "claimed"
    });
    expect(result.nextState.buildingsById[buildingId]).toMatchObject({
      ownerPlayerId: "player:1",
      status: "active"
    });
    expect(result.nextState.buildingsById[buildingId].metadata).not.toHaveProperty("disabledByEliminationAtTick");
    expect(result.nextState.buildingsById[buildingId].metadata).not.toHaveProperty("defeatedOwnerPlayerId");
  });

  it("creates city feed and notification only once for the scheduled tick", () => {
    const state = createEliminationState();
    state.root.tick = FIRST_ELIMINATION_TICK;
    const first = runScheduledElimination(state, context).nextState;
    const second = runScheduledElimination(first, context).nextState;

    expect(Object.values(second.cityFeedEventsById).filter((event) => event.sourceEventId?.startsWith("elimination:"))).toHaveLength(1);
    expect(Object.values(second.notificationsById).filter((notification) => notification.category === "elimination.defeated")).toHaveLength(1);
  });

  it("blocks defeated players from sending gameplay commands", () => {
    const state = createEliminationState();
    state.playersById["player:1"] = { ...state.playersById["player:1"], status: "defeated" };

    const result = applyCommand(state, createAttackDistrictCommandFixture(), context);

    expect(result.errors).toContainEqual(expect.objectContaining({ code: "player_not_active" }));
  });

  it("projects danger zone and next elimination tick", () => {
    const state = createEliminationState();
    state.root.tick = 100;

    const model = createEliminationReadModel(state, "player:3", context);

    expect(model.enabled).toBe(true);
    expect(model.nextEliminationTick).toBe(FIRST_ELIMINATION_TICK);
    expect(model.ticksUntilNextElimination).toBe(FIRST_ELIMINATION_TICK - 100);
    expect(model.dangerZone[0]).toMatchObject({ playerId: "player:3", rankFromBottom: 1 });
    expect(model.currentPlayerStatus).toBe("critical");
  });

  it("projects quiet hours while eliminations are paused", () => {
    const state = createEliminationState({ players: 9 });
    state.serverInstance.startedAt = "2026-01-01T17:00:00.000Z";
    state.root.tick = FIRST_ELIMINATION_TICK;

    const model = createEliminationReadModel(state, "player:3", context);

    expect(model.isQuietHoursNow).toBe(true);
    expect(model.quietHours).toMatchObject({
      enabled: true,
      timeZone: "Europe/Bratislava",
      startHour: 0,
      endHour: 6
    });
    expect(model.quietHoursResumeTick).toBe(FIRST_ELIMINATION_TICK + ELIMINATION_INTERVAL_TICKS);
    expect(model.nextEliminationTick).toBe(FIRST_ELIMINATION_TICK + ELIMINATION_INTERVAL_TICKS);
  });

  it("projects eliminationsStopped at the final 8 players", () => {
    const state = createEliminationState({ players: 8 });
    state.root.tick = FIRST_ELIMINATION_TICK;

    const model = createEliminationReadModel(state, "player:3", context);

    expect(model.eliminationsStopped).toBe(true);
    expect(model.minActivePlayers).toBe(8);
    expect(model.nextEliminationTick).toBeNull();
    expect(model.dangerZone).toHaveLength(0);
  });

  it("includes elimination state in the player view", () => {
    const state = createEliminationState();

    const view = createPlayerView(state, "player:3", context);

    expect(view.elimination).toMatchObject({
      enabled: true,
      nextEliminationTick: FIRST_ELIMINATION_TICK,
      currentPlayerStatus: "critical"
    });
  });

  it("free mode uses an eight hour grace period and four hour interval", () => {
    expect(resolveModeConfig("free").balance.elimination).toMatchObject({
      intervalTicks: 2_880,
      firstEliminationTick: 5_760,
      minActivePlayers: 8,
      dangerZoneSize: 3,
      quietHours: {
        enabled: true,
        timeZone: "Europe/Bratislava",
        startHour: 0,
        endHour: 6,
        behavior: "defer_to_window_end"
      }
    });
  });
});

const createEliminationState = (options: {
  players?: number;
  equalWeakPlayers?: boolean;
  weakPlayerOwnsDistrict?: boolean;
} = {}): CoreGameState => {
  const state = createInitialState("instance:1", "free");
  const players = options.players ?? 9;
  for (let index = 1; index <= players; index += 1) {
    const playerId = `player:${index}`;
    const player = createPlayerFixture({
      id: playerId,
      accountId: `account:${index}`,
      name: `Player ${index}`,
      homeDistrictId: `district:${index}`,
      resourceStateId: `resource:${index}`,
      policeStateId: `police:${index}`,
      lastActionAt: options.equalWeakPlayers ? null : new Date(index * 1000).toISOString()
    });
    state.playersById[playerId] = player;
    state.resourceStatesById[player.resourceStateId] = createResourceStateFixture({
      id: player.resourceStateId,
      ownerType: "player",
      ownerId: playerId,
      balances: {
        cash: options.equalWeakPlayers ? 100 : index === 1 ? 10_000 : 100,
        "dirty-cash": options.equalWeakPlayers ? 0 : index === 2 ? 500 : 0
      }
    });
    state.root.playerIds.push(playerId);
  }

  addDistrict(state, "district:1", "player:1", 80);
  if (!options.equalWeakPlayers) {
    addDistrict(state, "district:2", "player:2", 20);
  }
  if (options.weakPlayerOwnsDistrict) {
    addDistrict(state, "district:3", "player:3", 0, true);
    for (let index = 4; index <= players; index += 1) {
      addDistrict(state, `district:${index}`, `player:${index}`, index * 10);
    }
  } else {
    addDistrict(state, "district:3", null, 0);
  }
  return state;
};

const addDistrict = (
  state: CoreGameState,
  districtId: string,
  ownerPlayerId: string | null,
  influence: number,
  withBuilding = false
): void => {
  const district = createDistrictFixture({
    id: districtId,
    ownerPlayerId,
    influence,
    status: ownerPlayerId ? "claimed" : "neutral",
    buildingIds: withBuilding ? [`building:${districtId}:restaurant:1`] : []
  });
  state.districtsById[districtId] = district;
  state.root.districtIds.push(districtId);
  if (withBuilding && ownerPlayerId) {
    const building = createFixedBuildingFixture("restaurant", {
      id: `building:${districtId}:restaurant:1`,
      districtId,
      ownerPlayerId
    });
    state.buildingsById[building.id] = building;
  }
};
