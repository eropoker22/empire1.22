import { describe, expect, it } from "vitest";
import {
  applyCommand,
  createEliminationReadModel,
  createInitialState,
  createPlayerEliminationScore,
  createPlayerFinalEmpireScore,
  createPlayerView,
  runTick,
  runScheduledElimination
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import type { CoreGameState } from "@empire/game-core";
import {
  createAttackDistrictCommandFixture,
  createOccupyDistrictCommandFixture
} from "../../fixtures/command-fixtures";
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

  it("does not initialize or run elimination while hosted registration is open", () => {
    const state = createEliminationState();
    state.root.tick = FIRST_ELIMINATION_TICK + 500;
    state.serverPacingState = createHostedPacingState(state, {
      registrationClosedAt: null,
      effectiveFirstEliminationTick: FIRST_ELIMINATION_TICK + 1_000
    });

    const result = runScheduledElimination(state, context);
    const model = createEliminationReadModel(result.nextState, "player:3", context);

    expect(result.result).toBeNull();
    expect(result.nextState.eliminationState).toBeNull();
    expect(model.eliminationsStopped).toBe(false);
    expect(model.nextEliminationTick).toBeNull();
  });

  it("keeps elimination disabled for a hosted control template after close and restart", () => {
    const state = createEliminationState();
    state.root.tick = FIRST_ELIMINATION_TICK + 10_000;
    state.serverPacingState = createHostedPacingState(state, {
      eliminationEnabled: false,
      effectiveFirstEliminationTick: FIRST_ELIMINATION_TICK
    });

    const first = runScheduledElimination(state, context);
    const restored = JSON.parse(JSON.stringify(first.nextState)) as CoreGameState;
    const second = runScheduledElimination(restored, context);
    const model = createEliminationReadModel(second.nextState, "player:3", context);

    expect(first.result).toBeNull();
    expect(second.result).toBeNull();
    expect(second.nextState.eliminationState).toBeNull();
    expect(model.enabled).toBe(false);
  });

  it("clamps the first hosted elimination to the frozen effective deadline", () => {
    const effectiveFirstEliminationTick = FIRST_ELIMINATION_TICK + 100;
    const state = createEliminationState();
    state.serverPacingState = createHostedPacingState(state, { effectiveFirstEliminationTick });
    state.root.tick = FIRST_ELIMINATION_TICK;

    const beforeDeadline = runScheduledElimination(state, context);
    expect(beforeDeadline.result).toBeNull();
    expect(beforeDeadline.nextState.eliminationState?.nextEliminationTick).toBe(effectiveFirstEliminationTick);

    const atDeadline = runScheduledElimination({
      ...beforeDeadline.nextState,
      root: { ...beforeDeadline.nextState.root, tick: effectiveFirstEliminationTick }
    }, context);
    expect(atDeadline.result?.eliminatedPlayerId).toBe("player:3");
  });

  it("uses the frozen cutoff so a two-player hosted server can reach its final one", () => {
    const state = createEliminationState({ players: 2 });
    state.root.tick = FIRST_ELIMINATION_TICK;
    state.serverPacingState = createHostedPacingState(state, {
      registrationBaselinePlayers: 2,
      effectiveFinalLockdownTrigger: 1
    });

    const result = runScheduledElimination(state, context);

    expect(result.result?.activePlayersRemaining).toBe(1);
    expect(Object.values(result.nextState.playersById).filter((player) => player.status === "active")).toHaveLength(1);
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
      finalPlacement: 9,
      rankFromBottomAtElimination: 1,
      scoreAtElimination: expect.any(Number),
      scoreBreakdownAtElimination: expect.any(Object)
    });
    expect(createPlayerFinalEmpireScore(result.nextState, "player:3", context).score)
      .toBe(result.nextState.playersById["player:3"]!.metadata?.scoreAtElimination);
    expect(result.events.find((event) => event.type === "player-eliminated")?.payload).toMatchObject({
      playerId: "player:3",
      gangName: "Player 3",
      title: "Očista proběhla: Player 3",
      body: "Policie rozdrtila gang Player 3. Jeho území se vrací pod kontrolu města.",
      remainingPlayers: 8,
      serverCapacity: config.balance.maxPlayersPerServer
    });
    expect(Object.values(result.nextState.notificationsById)
      .find((notification) => notification.category === "elimination.defeated")?.payload).toMatchObject({
        body: "Po pravidelném vyhodnocení jsi byl nejslabší aktivní hráč. Tvůj gang ztratil kontrolu nad ulicemi."
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

  it("awards the activity bonus only inside the configured recent window", () => {
    const state = createEliminationState();
    state.playersById["player:3"] = {
      ...state.playersById["player:3"],
      lastActionAt: "2026-01-01T12:00:15.000Z"
    };
    const recentContext = {
      config: {
        ...config,
        tickRateMs: 1_000,
        balance: {
          ...config.balance,
          elimination: {
            ...config.balance.elimination!,
            scoreWeights: {
              ...config.balance.elimination!.scoreWeights,
              recentActivityBonus: 250,
              recentActivityWindowTicks: 10
            }
          }
        }
      },
      clock: {
        now: () => new Date("2026-01-01T12:00:20.000Z"),
        nowIso: () => "2026-01-01T12:00:20.000Z"
      }
    };

    expect(createPlayerEliminationScore(state, "player:3", recentContext).recentActivityBonus).toBe(250);
    state.playersById["player:3"] = {
      ...state.playersById["player:3"],
      lastActionAt: "2026-01-01T11:59:59.000Z"
    };
    expect(createPlayerEliminationScore(state, "player:3", recentContext).recentActivityBonus).toBe(0);
  });

  it("uses the typed resource score registry while preserving a default value of one", () => {
    const state = createEliminationState();
    state.resourceStatesById["resource:3"] = {
      ...state.resourceStatesById["resource:3"],
      balances: {
        ...state.resourceStatesById["resource:3"].balances,
        chemicals: 10,
        biomass: 5
      }
    };
    const weightedContext = {
      config: {
        ...config,
        balance: {
          ...config.balance,
          elimination: {
            ...config.balance.elimination!,
            scoreWeights: {
              ...config.balance.elimination!.scoreWeights,
              resourceScoreValues: { chemicals: 3 }
            }
          }
        }
      }
    };

    expect(createPlayerEliminationScore(state, "player:3", weightedContext).totalResourceValue).toBe(35);
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
      message: "Očista proběhla. Gang Player 3 byl odstraněn z města.",
      payload: expect.objectContaining({
        gangName: "Player 3",
        title: "Očista proběhla: Player 3",
        body: "Policie rozdrtila gang Player 3. Jeho území se vrací pod kontrolu města.",
        remainingPlayers: 8
      })
    });
    expect(feedEvent?.message).toContain("Player 3");
    expect(JSON.stringify(feedEvent)).not.toMatch(/sračky|vystřílela/u);
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
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      influence: 10
    };
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: {
        ...state.resourceStatesById["resource:1"]?.balances,
        population: 1_000
      }
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
    seedSuccessfulOccupySpyIntel(state, "player:1", "district:2");

    const result = applyCommand(state, createOccupyDistrictCommandFixture(), {
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

    expect(result.errors).toContainEqual(expect.objectContaining({ code: "PLAYER_DEFEATED" }));
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
        "dirty-cash": options.equalWeakPlayers ? 0 : index === 2 ? 500 : 0,
        population: index === 1 ? 1_000 : 0
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

const createHostedPacingState = (
  state: CoreGameState,
  overrides: Partial<NonNullable<CoreGameState["serverPacingState"]>> = {}
): NonNullable<CoreGameState["serverPacingState"]> => ({
  id: `${state.serverInstance.id}:pacing`,
  serverInstanceId: state.serverInstance.id,
  registrationOpensAt: "2026-01-01T09:00:00.000Z",
  registrationClosesAt: "2026-01-01T10:00:00.000Z",
  registrationClosedAt: "2026-01-01T10:00:00.000Z",
  registrationBaselinePlayers: state.root.playerIds.length,
  eliminationEnabled: true,
  effectiveFinalLockdownTrigger: 8,
  effectiveFirstEliminationTick: FIRST_ELIMINATION_TICK,
  version: 1,
  ...overrides
});

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

const seedSuccessfulOccupySpyIntel = (
  state: CoreGameState,
  playerId: string,
  targetDistrictId: string
): void => {
  const targetDistrict = state.districtsById[targetDistrictId];
  const notificationId = `notification:spy-success:${playerId}:${targetDistrictId}`;
  state.notificationsById[notificationId] = {
    id: notificationId,
    recipientType: "player",
    recipientId: playerId,
    category: "report.spy",
    title: `Spy report: ${targetDistrictId}`,
    bodyKey: "report.spy",
    payload: {
      reportId: `report:spy-success:${playerId}:${targetDistrictId}`,
      reportType: "spy",
      actionType: "spy-district",
      playerId,
      attackerPlayerId: playerId,
      sourceDistrictId: "district:1",
      targetDistrictId,
      targetOwnerPlayerId: null,
      targetStateAtSpy: "empty",
      targetSecurityRevision: targetDistrict?.securityRevision ?? targetDistrict?.version ?? 1,
      result: "success",
      purpose: "occupy_empty_district",
      authorizationScope: "occupy_empty_district",
      issuedAtTick: state.root.tick,
      authorizationExpiresAtTick: state.root.tick + 120,
      detectedDefense: {},
      trapDetected: false,
      tick: state.root.tick,
      createdAt: new Date(0).toISOString(),
      eventId: null
    },
    createdAt: new Date(0).toISOString(),
    readAt: null
  };
  state.root.notificationIds.push(notificationId);
};
