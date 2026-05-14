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
  createFixedBuildingFixture
} from "../../fixtures/game-state-fixtures";

const config = resolveModeConfig("free");
const context = { config };
const FIRST_ELIMINATION_TICK = 5_760;

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
      finalPlacement: 6
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
    const state = createEliminationState({ players: 7 });
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
    const state = createEliminationState({ players: 5 });
    state.root.tick = FIRST_ELIMINATION_TICK;

    const result = runScheduledElimination(state, context);

    expect(result.result).toBeNull();
    expect(state.root.playerIds.map((id) => result.nextState.playersById[id].status)).toEqual([
      "active",
      "active",
      "active",
      "active",
      "active"
    ]);
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
      minActivePlayers: 5
    });
  });
});

const createEliminationState = (options: {
  players?: number;
  equalWeakPlayers?: boolean;
  weakPlayerOwnsDistrict?: boolean;
} = {}): CoreGameState => {
  const state = createInitialState("instance:1", "free");
  const players = options.players ?? 6;
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
