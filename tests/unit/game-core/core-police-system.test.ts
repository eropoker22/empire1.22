import { describe, expect, it } from "vitest";
import {
  acknowledgePendingRaid,
  calculatePlayerPolicePressure,
  createPoliceReadModel,
  createRaidPreviewConsequences,
  expirePendingRaids,
  resolveCityHallPoliceMitigation,
  resolveCourtRaidMitigationPct,
  resolvePendingRaid,
  runTick,
  triggerRaid
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import {
  createCoreStateFixture,
  createDistrictFixture,
  createFixedBuildingFixture,
  createPlayerFixture,
  createResourceStateFixture
} from "../../fixtures/game-state-fixtures";

const createContext = (policeOverride = {}) => {
  const config = resolveModeConfig("free");
  return {
    config: {
      ...config,
      balance: {
        ...config.balance,
        dayNight: {
          ...config.balance.dayNight!,
          enabled: false
        },
        policePressureMultiplier: 1,
        police: {
          ...config.balance.police!,
          ...policeOverride
        }
      }
    }
  };
};
const FREE_POLICE_CONFIG = resolveModeConfig("free").balance.police!;
const readEventPlayerId = (payload: unknown): string | null => {
  if (payload === null || typeof payload !== "object" || !("playerId" in payload)) {
    return null;
  }
  return typeof payload.playerId === "string" ? payload.playerId : null;
};
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

const moveToRaidBoundary = (
  state: ReturnType<typeof createCoreStateFixture>,
  tick = 360
) => {
  state.root.tick = tick;
  state.serverInstance.currentTick = tick;
  return state;
};

const addQuietRaidFallback = (
  state: ReturnType<typeof createCoreStateFixture>,
  index = 99
) => {
  addRaidReadyPlayer(state, index, 0);
  state.districtsById[`district:${index}`] = {
    ...state.districtsById[`district:${index}`],
    heat: 0
  };
};

const addRaidReadyPlayer = (
  state: ReturnType<typeof createCoreStateFixture>,
  index: number,
  heat = 220
) => {
  const playerId = `player:${index}`;
  const districtId = `district:${index}`;
  const existingPlayer = state.playersById[playerId];
  const player = existingPlayer
    ? {
        ...existingPlayer,
        policeStateId: `police:${index}`,
        resourceStateId: `resource:${index}`,
        homeDistrictId: districtId
      }
    : createPlayerFixture({
        id: playerId,
        accountId: `account:${index}`,
        name: `Raid Target ${index}`,
        homeDistrictId: districtId,
        resourceStateId: `resource:${index}`,
        cooldownStateId: `cooldown:${index}`,
        effectStateId: `effect:${index}`,
        policeStateId: `police:${index}`
      });

  state.playersById[playerId] = player;
  if (!state.root.playerIds.includes(playerId)) state.root.playerIds.push(playerId);
  state.resourceStatesById[player.resourceStateId] = createResourceStateFixture({
    id: player.resourceStateId,
    ownerType: "player",
    ownerId: playerId,
    balances: {
      cash: 1000,
      "dirty-cash": 1200
    }
  });
  state.policeStatesById[player.policeStateId] = {
    id: player.policeStateId,
    ownerPlayerId: playerId,
    heat,
    wantedLevel: Math.floor(heat / 20),
    lastDecayTick: 0,
    activeFlags: [],
    version: 1
  };
  state.districtsById[districtId] = createDistrictFixture({
    id: districtId,
    ownerPlayerId: playerId,
    heat: 90,
    templateId: `template:${index}`,
    name: `Raid District ${index}`
  });
  if (!state.root.districtIds.includes(districtId)) state.root.districtIds.push(districtId);
};

const addCityHallOfficialCover = (
  state: ReturnType<typeof createCoreStateFixture>,
  policeControlChanceReductionPct = 80,
  districtIds = ["district:1"]
) => {
  const cityHall = createFixedBuildingFixture("city_hall", {
    id: "building:district-1:city-hall:1",
    metadata: {
      cityHall: {
        officialCoverByDistrictId: Object.fromEntries(districtIds.map((districtId) => [
          districtId,
          {
            districtId,
            expiresAtTick: 10_000,
            heatGainReductionPct: 35,
            policeControlChanceReductionPct,
            rumorChanceReductionPct: 15
          }
        ]))
      }
    }
  });
  state.buildingsById[cityHall.id] = cityHall;
  state.districtsById["district:1"] = {
    ...state.districtsById["district:1"],
    buildingIds: [...state.districtsById["district:1"].buildingIds, cityHall.id]
  };
};

const addCourts = (state: ReturnType<typeof createCoreStateFixture>, count: number) => {
  for (let index = 1; index <= count; index += 1) {
    const court = createFixedBuildingFixture("court", {
      id: `building:district-legal:court:${index}`,
      districtId: "district:legal"
    });
    state.buildingsById[court.id] = court;
  }
};

const createRaidPreviewState = (courtCount = 0) => {
  const state = createCoreStateFixture();
  addPoliceState(state, 150);
  state.districtsById["district:1"] = {
    ...state.districtsById["district:1"],
    heat: 70
  };
  state.resourceStatesById["resource:1"] = {
    ...state.resourceStatesById["resource:1"],
    balances: {
      cash: 1000,
      "dirty-cash": 1000,
      chemicals: 50
    }
  };
  addCourts(state, courtCount);
  return state;
};

describe("core police system completion", () => {
  it("combines player heat and district heat into aggregate pressure", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 20);
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 110
    };

    const pressure = calculatePlayerPolicePressure(state, "player:1", createContext());

    expect(pressure).toMatchObject({
      playerHeatPressure: 20,
      districtHeatPressure: 110,
      aggregatePressure: 119,
      hottestDistrictId: "district:1",
      hottestDistrictHeat: 110,
      riskTier: "high"
    });
  });

  it("keeps district pressure at zero when the player owns no districts", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 130);
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      ownerPlayerId: null,
      heat: 200
    };

    const pressure = calculatePlayerPolicePressure(state, "player:1", createContext());

    expect(pressure).toMatchObject({
      playerHeatPressure: 130,
      districtHeatPressure: 0,
      aggregatePressure: 130,
      hottestDistrictId: null,
      hottestDistrictHeat: 0,
      riskTier: "high"
    });
  });

  it("creates one district-targeted pending raid without duplicating it every tick", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 80);
    moveToRaidBoundary(state);
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 75
    };

    const first = triggerRaid(state, createContext());
    const second = triggerRaid(first.nextState, createContext());
    const raids = first.nextState.policeStatesById["police:1"].pendingRaids ?? [];

    expect(first.events[0]?.type).toBe("police-raid-triggered");
    expect(raids).toHaveLength(1);
    expect(raids[0]).toMatchObject({
      targetDistrictId: "district:1",
      status: "pending",
      sourcePressure: 147,
      createdAtTick: 360,
      expiresAtTick: 360 + createContext().config.balance.police.raidDurationTicks
    });
    expect(second.events).toEqual([]);
    expect(second.nextState.policeStatesById["police:1"].pendingRaids).toHaveLength(1);
  });

  it("keeps Free BR police raids open for the canonical configured duration", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 150);
    moveToRaidBoundary(state);
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 70
    };

    const context = createContext();
    const result = triggerRaid(state, context);
    const raid = result.nextState.policeStatesById["police:1"].pendingRaids?.[0];

    const duration = context.config.balance.police.raidDurationTicks;
    expect(duration * context.config.tickRateMs).toBe(60 * 60 * 1000);
    expect(context.config.balance.police.pendingRaidTtlTicks).toBe(duration);
    expect(raid?.expiresAtTick).toBe(raid!.createdAtTick + duration);
  });

  it("runs police raids at 12:00 and 00:00, not the old 06:00 or 22:00 boundaries", () => {
    for (const tick of [1, 960]) {
      const outsideBoundary = createCoreStateFixture();
      addPoliceState(outsideBoundary, 150);
      moveToRaidBoundary(outsideBoundary, tick);
      outsideBoundary.districtsById["district:1"] = {
        ...outsideBoundary.districtsById["district:1"],
        heat: 70
      };
      expect(triggerRaid(outsideBoundary, createContext()).events).toEqual([]);
    }

    for (const tick of [360, 1080]) {
      const atBoundary = createCoreStateFixture();
      addPoliceState(atBoundary, 150);
      moveToRaidBoundary(atBoundary, tick);
      atBoundary.districtsById["district:1"] = {
        ...atBoundary.districtsById["district:1"],
        heat: 70
      };
      expect(triggerRaid(atBoundary, createContext()).events.some(
        (event) => event.type === "police-raid-triggered"
      )).toBe(true);
    }
  });

  it("starts the first midday police raid check at exactly 12:00 game time", () => {
    const atNoon = createCoreStateFixture();
    addPoliceState(atNoon, 150);
    atNoon.root.tick = 360;
    atNoon.districtsById["district:1"] = {
      ...atNoon.districtsById["district:1"],
      heat: 70
    };

    const result = triggerRaid(atNoon, createContext());

    expect(result.events.some((event) => event.type === "police-raid-triggered")).toBe(true);
    expect(result.nextState.policeStatesById["police:1"].pendingRaids?.[0]?.createdAtTick).toBe(360);

    const oldTwelveThirtyBoundary = createCoreStateFixture();
    addPoliceState(oldTwelveThirtyBoundary, 150);
    oldTwelveThirtyBoundary.root.tick = 390;
    oldTwelveThirtyBoundary.districtsById["district:1"] = {
      ...oldTwelveThirtyBoundary.districtsById["district:1"],
      heat: 70
    };

    expect(triggerRaid(oldTwelveThirtyBoundary, createContext()).events).toEqual([]);
  });

  it("starts one visible medium raid at the first 12:00 boundary even when the city is still quiet", () => {
    const atFirstNoon = createCoreStateFixture();
    addPoliceState(atFirstNoon, 0);
    atFirstNoon.root.tick = 360;

    const result = triggerRaid(atFirstNoon, createContext());
    const raid = result.nextState.policeStatesById["police:1"].pendingRaids?.[0];

    expect(result.events.filter((event) => event.type === "police-raid-triggered")).toHaveLength(1);
    expect(raid).toMatchObject({
      playerId: "player:1",
      severity: "medium",
      createdAtTick: 360,
      reason: expect.stringContaining("scheduled-midday")
    });
  });

  it("forces another quiet-city raid at every later scheduled boundary", () => {
    const nextDayNoon = createCoreStateFixture();
    addPoliceState(nextDayNoon, 0);
    nextDayNoon.root.tick = 1800;
    nextDayNoon.policeStatesById["police:1"] = {
      ...nextDayNoon.policeStatesById["police:1"],
      lastRaidCreatedAtTick: 360
    };

    const result = triggerRaid(nextDayNoon, createContext());

    expect(result.events.filter((event) => event.type === "police-raid-triggered")).toHaveLength(1);
    expect(result.nextState.policeStatesById["police:1"].pendingRaids?.[0]).toMatchObject({
      severity: "medium",
      createdAtTick: 1800,
      reason: expect.stringContaining("scheduled-midday")
    });
  });

  it("starts one raid at both scheduled boundaries with only two quiet active players", () => {
    const state = createCoreStateFixture();
    state.playersById = {};
    state.districtsById = {};
    state.resourceStatesById = {};
    state.policeStatesById = {};
    state.root.playerIds = [];
    state.root.districtIds = [];
    addRaidReadyPlayer(state, 1, 0);
    addRaidReadyPlayer(state, 2, 0);
    state.districtsById["district:1"] = { ...state.districtsById["district:1"], heat: 0 };
    state.districtsById["district:2"] = { ...state.districtsById["district:2"], heat: 0 };
    moveToRaidBoundary(state, 359);

    const midday = runTick(state, createContext());
    expect(midday.events.filter((event) => event.type === "police-raid-triggered")).toHaveLength(1);

    const beforeMidnight = {
      ...midday.nextState,
      root: { ...midday.nextState.root, tick: 1079 },
      serverInstance: { ...midday.nextState.serverInstance, currentTick: 1079 }
    };
    const midnight = runTick(beforeMidnight, createContext());
    const triggeredPlayerIds = [...midday.events, ...midnight.events]
      .filter((event) => event.type === "police-raid-triggered")
      .map((event) => readEventPlayerId(event.payload));

    expect(midnight.events.filter((event) => event.type === "police-raid-triggered")).toHaveLength(1);
    expect(triggeredPlayerIds).toEqual(["player:1", "player:2"]);
  });

  it("caps simultaneous police raids to the canonical day limit", () => {
    const state = createCoreStateFixture();
    moveToRaidBoundary(state, 360);
    state.playersById = {};
    state.districtsById = {};
    state.resourceStatesById = {};
    state.policeStatesById = {};
    state.root.playerIds = [];
    state.root.districtIds = [];
    addRaidReadyPlayer(state, 1);
    addRaidReadyPlayer(state, 2);
    addRaidReadyPlayer(state, 3);

    const result = triggerRaid(state, createContext());
    const raidEvents = result.events.filter((event) => event.type === "police-raid-triggered");
    const openRaids = Object.values(result.nextState.policeStatesById).flatMap((policeState) =>
      (policeState.pendingRaids ?? []).filter((raid) => raid.status === "pending" || raid.status === "acknowledged")
    );

    const limit = createContext().config.balance.police.maxConcurrentRaidsByPhase.day;
    expect(raidEvents).toHaveLength(limit);
    expect(openRaids).toHaveLength(limit);
    expect(result.decisions.filter((decision) => decision.type === "concurrent_raid_limit_active")).toHaveLength(3 - limit);
  });

  it("caps simultaneous police raids to one during night", () => {
    const state = createCoreStateFixture();
    moveToRaidBoundary(state, 1080);
    state.playersById = {};
    state.districtsById = {};
    state.resourceStatesById = {};
    state.policeStatesById = {};
    state.root.playerIds = [];
    state.root.districtIds = [];
    addRaidReadyPlayer(state, 1);
    addRaidReadyPlayer(state, 2);

    const result = triggerRaid(state, createContext());
    const raidEvents = result.events.filter((event) => event.type === "police-raid-triggered");
    const openRaids = Object.values(result.nextState.policeStatesById).flatMap((policeState) =>
      (policeState.pendingRaids ?? []).filter((raid) => raid.status === "pending" || raid.status === "acknowledged")
    );

    expect(raidEvents).toHaveLength(1);
    expect(openRaids).toHaveLength(1);
    expect(result.decisions.filter((decision) => decision.type === "concurrent_raid_limit_active")).toHaveLength(1);
  });

  it("applies raid consequences deterministically and never seizes protected resources", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 150);
    moveToRaidBoundary(state);
    const building = createFixedBuildingFixture("pharmacy");
    state.buildingsById[building.id] = building;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 70,
      buildingIds: [building.id]
    };
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: {
        cash: 1000,
        "dirty-cash": 1000,
        chemicals: 50
      }
    };
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      population: 20
    };

    const triggered = triggerRaid(state, createContext());
    const raid = triggered.nextState.policeStatesById["police:1"].pendingRaids?.[0];
    const resolved = resolvePendingRaid(triggered.nextState, "player:1", raid!.raidId, createContext());
    const balances = resolved.nextState.resourceStatesById["resource:1"].balances;

    expect(resolved.result).toMatchObject({
      severity: "extreme",
      seizedDirtyCash: 220,
      seizedResources: {
        chemicals: 5
      },
      lockedDistrictId: "district:1",
      disruptedBuildingIds: [building.id],
      buildingDisruptionUntilTick: 360 + FREE_POLICE_CONFIG.buildingDisruptionTicksBySeverity.extreme,
      heatReducedBy: 55
    });
    expect(balances).toMatchObject({
      cash: 1000,
      "dirty-cash": 780,
      chemicals: 45
    });
    expect(resolved.nextState.playersById["player:1"].population).toBe(20);
    expect(balances).not.toHaveProperty("gang-members");
    expect(resolved.nextState.playersById["player:1"].salvagePool).toBeUndefined();
    expect(resolved.nextState.districtsById["district:1"]).toMatchObject({
      status: "locked",
      lockdownUntilTick: 360 + FREE_POLICE_CONFIG.lockdownTicksBySeverity.extreme
    });
    expect(resolved.nextState.buildingsById[building.id]).toMatchObject({
      status: "disabled",
      disruptedUntilTick: 360 + FREE_POLICE_CONFIG.buildingDisruptionTicksBySeverity.extreme
    });

    const secondResolve = resolvePendingRaid(resolved.nextState, "player:1", raid!.raidId, createContext());
    expect(secondResolve.events).toEqual([]);
    expect(secondResolve.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(780);
  });

  it("does not mitigate raid consequences without Court ownership", () => {
    const state = createRaidPreviewState(0);
    const preview = createRaidPreviewConsequences(state, "player:1", "extreme", "district:1", createContext());

    expect(resolveCourtRaidMitigationPct(state, "player:1", createContext().config.balance.courthouse)).toBe(0);
    expect(preview).toMatchObject({
      seizedDirtyCash: 220,
      seizedResources: {
        chemicals: 5
      },
      courtMitigationPct: 0,
      courtBuildingsOwned: 0,
      courthouseMitigation: null
    });
  });

  it("does not over-seize a single bulk item when the configured percentage rounds below one", () => {
    const state = createRaidPreviewState(0);
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: {
        cash: 1000,
        "dirty-cash": 1000,
        chemicals: 1
      }
    };

    const preview = createRaidPreviewConsequences(state, "player:1", "high", "district:1", createContext());

    expect(preview.seizedResources).toEqual({});
  });

  it("applies category-aware seizure caps and protects low strategic inventory", () => {
    const state = createRaidPreviewState(0);
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: {
        cash: 1000,
        "dirty-cash": 1000,
        chemicals: 100,
        "tech-core": 20,
        "ghost-serum": 2,
        "combat-module": 3,
        bazooka: 3
      }
    };

    const high = createRaidPreviewConsequences(state, "player:1", "high", "district:1", createContext());
    const extreme = createRaidPreviewConsequences(state, "player:1", "extreme", "district:1", createContext());

    expect(high.seizedResources).toMatchObject({ chemicals: 5, "tech-core": 1 });
    expect(high.seizedResources["combat-module"]).toBeUndefined();
    expect(extreme.seizedResources).toMatchObject({ chemicals: 10, "tech-core": 2, "combat-module": 1, bazooka: 1 });
    expect(extreme.seizedResources["ghost-serum"]).toBeUndefined();
    expect(Object.values(extreme.seizedResources).reduce((total, amount) => total + amount, 0)).toBeLessThanOrEqual(20);
  });

  it("mitigates raid consequences by 50 percent with one Court", () => {
    const state = createRaidPreviewState(1);
    const preview = createRaidPreviewConsequences(state, "player:1", "extreme", "district:1", createContext());

    expect(resolveCourtRaidMitigationPct(state, "player:1", createContext().config.balance.courthouse)).toBe(50);
    expect(preview).toMatchObject({
      seizedDirtyCash: 110,
      seizedResources: {
        chemicals: 2
      },
      courtMitigationPct: 50,
      courtBuildingsOwned: 1,
      courthouseMitigation: {
        ownedCount: 1,
        reductionPct: 50
      }
    });
    expect(preview.heatReducedBy).toBe(55);
  });

  it("mitigates raid consequences by 75 percent with two Courts", () => {
    const state = createRaidPreviewState(2);
    const preview = createRaidPreviewConsequences(state, "player:1", "extreme", "district:1", createContext());

    expect(resolveCourtRaidMitigationPct(state, "player:1", createContext().config.balance.courthouse)).toBe(75);
    expect(preview).toMatchObject({
      seizedDirtyCash: 55,
      seizedResources: {
        chemicals: 1
      },
      lockdownUntilTick: Math.ceil(FREE_POLICE_CONFIG.lockdownTicksBySeverity.extreme * 0.25),
      buildingDisruptionUntilTick: Math.ceil(
        FREE_POLICE_CONFIG.buildingDisruptionTicksBySeverity.extreme * 0.25
      ),
      courtMitigationPct: 75,
      courtBuildingsOwned: 2,
      courthouseMitigation: {
        ownedCount: 2,
        reductionPct: 75
      }
    });
    expect(preview.heatReducedBy).toBe(55);
  });

  it("caps Court raid mitigation at 75 percent with three Courts", () => {
    const state = createRaidPreviewState(3);
    const preview = createRaidPreviewConsequences(state, "player:1", "extreme", "district:1", createContext());

    expect(resolveCourtRaidMitigationPct(state, "player:1", createContext().config.balance.courthouse)).toBe(75);
    expect(preview).toMatchObject({
      seizedDirtyCash: 55,
      seizedResources: {
        chemicals: 1
      },
      courtMitigationPct: 75,
      courtBuildingsOwned: 3
    });
  });

  it("does not change police pressure or risk tier when the player owns Courts", () => {
    const state = createRaidPreviewState(0);
    const pressureBefore = calculatePlayerPolicePressure(state, "player:1", createContext());
    addCourts(state, 2);
    const pressureAfter = calculatePlayerPolicePressure(state, "player:1", createContext());

    expect(pressureAfter).toEqual(pressureBefore);
  });

  it("mitigates police raid consequences when the player owns courthouses", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 150);
    moveToRaidBoundary(state);
    const targetBuilding = createFixedBuildingFixture("pharmacy");
    const firstCourt = createFixedBuildingFixture("court", {
      id: "building:district-legal:court:1",
      districtId: "district:legal"
    });
    const secondCourt = createFixedBuildingFixture("court", {
      id: "building:district-legal:court:2",
      districtId: "district:legal"
    });
    state.buildingsById[targetBuilding.id] = targetBuilding;
    state.buildingsById[firstCourt.id] = firstCourt;
    state.buildingsById[secondCourt.id] = secondCourt;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 70,
      buildingIds: [targetBuilding.id]
    };
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: {
        cash: 1000,
        "dirty-cash": 1000,
        chemicals: 50
      }
    };

    const triggered = triggerRaid(state, createContext());
    const raid = triggered.nextState.policeStatesById["police:1"].pendingRaids?.[0];
    const resolved = resolvePendingRaid(triggered.nextState, "player:1", raid!.raidId, createContext());
    const balances = resolved.nextState.resourceStatesById["resource:1"].balances;

    expect(raid?.previewConsequences.courthouseMitigation).toMatchObject({
      source: "courthouse",
      ownedCount: 2,
      reductionPct: 75,
      originalConsequences: {
        seizedDirtyCash: 220,
        seizedResources: {
          chemicals: 5
        },
        lockdownTicks: FREE_POLICE_CONFIG.lockdownTicksBySeverity.extreme,
        buildingDisruptionTicks: FREE_POLICE_CONFIG.buildingDisruptionTicksBySeverity.extreme
      }
    });
    expect(raid?.previewConsequences).toMatchObject({
      courtMitigationPct: 75,
      courtBuildingsOwned: 2
    });
    expect(resolved.result).toMatchObject({
      seizedDirtyCash: 55,
      seizedResources: {
        chemicals: 1
      },
      lockedDistrictId: "district:1",
      disruptedBuildingIds: [targetBuilding.id],
      buildingDisruptionUntilTick: 360 + Math.ceil(
        FREE_POLICE_CONFIG.buildingDisruptionTicksBySeverity.extreme * 0.25
      ),
      heatReducedBy: 55,
      courtMitigationPct: 75,
      courtBuildingsOwned: 2,
      courthouseMitigation: {
        reductionPct: 75
      },
      message: "Následky razie byly zmírněny díky Soudu."
    });
    expect(balances).toMatchObject({
      cash: 1000,
      "dirty-cash": 945,
      chemicals: 49
    });
    expect(resolved.nextState.districtsById["district:1"].lockdownUntilTick).toBe(
      360 + Math.ceil(FREE_POLICE_CONFIG.lockdownTicksBySeverity.extreme * 0.25)
    );
    expect(resolved.events[0]?.payload).toMatchObject({
      courtMitigationPct: 75,
      courtBuildingsOwned: 2,
      courthouseMitigation: {
        reductionPct: 75
      }
    });
  });

  it("supports pending to acknowledged to resolved lifecycle", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 130);
    moveToRaidBoundary(state);
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: {
        "dirty-cash": 100
      }
    };

    const triggered = triggerRaid(state, createContext());
    const raid = triggered.nextState.policeStatesById["police:1"].pendingRaids?.[0];
    const acknowledged = acknowledgePendingRaid(triggered.nextState, "player:1", raid!.raidId);
    const resolved = resolvePendingRaid(acknowledged.nextState, "player:1", raid!.raidId, createContext());

    expect(acknowledged.nextState.policeStatesById["police:1"].pendingRaids?.[0].status).toBe("acknowledged");
    expect(resolved.nextState.policeStatesById["police:1"].pendingRaids?.[0].status).toBe("resolved");
    expect(resolved.result?.seizedDirtyCash).toBe(12);
  });

  it("does not lower heat when an unacknowledged raid auto-resolves while the player is away", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 150);
    moveToRaidBoundary(state);
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: {
        "dirty-cash": 100
      }
    };
    const context = createContext({
      raidDurationTicks: 1,
      pendingRaidTtlTicks: 1
    });
    const triggered = triggerRaid(state, context);
    const raid = triggered.nextState.policeStatesById["police:1"].pendingRaids?.[0];
    const expiredInput = {
      ...triggered.nextState,
      root: { ...triggered.nextState.root, tick: 361 },
      serverInstance: { ...triggered.nextState.serverInstance, currentTick: 361 }
    };

    const resolved = expirePendingRaids(expiredInput, context);

    expect(raid?.status).toBe("pending");
    expect(raid?.previewConsequences.heatReducedBy).toBe(30);
    expect(resolved.nextState.policeStatesById["police:1"].pendingRaids?.[0].status).toBe("resolved");
    expect(resolved.nextState.policeStatesById["police:1"].heat).toBe(150);
    expect(resolved.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBeLessThan(100);
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: "police-raid-resolved",
      payload: expect.objectContaining({ heatReducedBy: 0 })
    }));
  });

  it("keeps the normal heat reduction for a raid acknowledged while playing", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 150);
    moveToRaidBoundary(state);
    const context = createContext({
      raidDurationTicks: 1,
      pendingRaidTtlTicks: 1
    });
    const triggered = triggerRaid(state, context);
    const raid = triggered.nextState.policeStatesById["police:1"].pendingRaids?.[0];
    const acknowledged = acknowledgePendingRaid(triggered.nextState, "player:1", raid!.raidId);
    const expiredInput = {
      ...acknowledged.nextState,
      root: { ...acknowledged.nextState.root, tick: 361 },
      serverInstance: { ...acknowledged.nextState.serverInstance, currentTick: 361 }
    };

    const resolved = expirePendingRaids(expiredInput, context);

    expect(resolved.nextState.policeStatesById["police:1"].pendingRaids?.[0].status).toBe("resolved");
    expect(resolved.nextState.policeStatesById["police:1"].heat).toBe(120);
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: "police-raid-resolved",
      payload: expect.objectContaining({ heatReducedBy: 30 })
    }));
  });

  it("can expire pending raids without consequences when configured", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 130);
    moveToRaidBoundary(state);
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: {
        "dirty-cash": 100
      }
    };
    const context = createContext({
      autoResolveExpiredPendingRaids: false,
      raidDurationTicks: 1,
      pendingRaidTtlTicks: 1
    });
    const triggered = triggerRaid(state, context);
    const expiredInput = {
      ...triggered.nextState,
      root: {
        ...triggered.nextState.root,
        tick: 361
      }
    };

    const expired = expirePendingRaids(expiredInput, context);

    expect(expired.nextState.policeStatesById["police:1"].pendingRaids?.[0].status).toBe("expired");
    expect(expired.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(100);
  });

  it("projects pending raid and last police event safely", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 130);
    moveToRaidBoundary(state);
    const triggered = triggerRaid(state, createContext());
    const model = createPoliceReadModel(triggered.nextState, "player:1", createContext());

    expect(model).toMatchObject({
      riskTier: "high",
      pendingRaid: {
        status: "pending",
        severity: "high"
      },
      lastPoliceEvent: {
        type: "police-raid-pending"
      }
    });
  });

  it("uses City Hall official cover to reduce high raid trigger chance", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 80);
    moveToRaidBoundary(state);
    addQuietRaidFallback(state);
    addCityHallOfficialCover(state);
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 70
    };

    const result = triggerRaid(state, createContext());

    expect(result.decisions.find((decision) => decision.playerId === "player:1")).toMatchObject({
      type: "political_cover_delayed",
      aggregatePressure: 143
    });
    expect(result.nextState.policeStatesById["police:1"].pendingRaids).toBeUndefined();
    expect(result.events.filter((event) => event.type === "police-raid-triggered")).toHaveLength(1);
    expect(
      readEventPlayerId(
        result.events.find((event) => event.type === "police-raid-triggered")?.payload
      )
    ).toBe("player:99");
  });

  it("does not make high raid pressure immune under City Hall cover", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 80);
    moveToRaidBoundary(state, 1080);
    addQuietRaidFallback(state);
    addCityHallOfficialCover(state);
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 70
    };

    const result = triggerRaid(state, createContext());

    expect(result.events[0]).toMatchObject({
      type: "police-raid-triggered",
      payload: {
        severity: "high",
        cityHallMitigation: {
          source: "city_hall_official_cover",
          rawReductionPct: 80,
          effectiveReductionPct: 45,
          triggerChancePct: 55
        }
      }
    });
    expect(result.nextState.policeStatesById["police:1"].pendingRaids?.[0]).toMatchObject({
      status: "pending",
      severity: "high"
    });
  });

  it("applies City Hall official cover to a raid targeting any owned district", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 60);
    moveToRaidBoundary(state, 1080);
    addQuietRaidFallback(state);
    state.districtsById["district:2"] = createDistrictFixture({
      id: "district:2",
      ownerPlayerId: "player:1",
      name: "Second District",
      heat: 90
    });
    state.root.districtIds.push("district:2");
    addCityHallOfficialCover(state, 80, ["district:1", "district:2"]);

    const result = triggerRaid(state, createContext());

    expect(result.events[0]).toMatchObject({
      type: "police-raid-triggered",
      payload: {
        targetDistrictId: "district:2",
        cityHallMitigation: {
          districtId: "district:2",
          coveredDistrictIds: ["district:1", "district:2"],
          effectiveReductionPct: 45,
          triggerChancePct: 55
        }
      }
    });
  });

  it("does not apply City Hall official cover to a district the player does not own", () => {
    const state = createCoreStateFixture();
    state.districtsById["district:2"] = createDistrictFixture({
      id: "district:2",
      ownerPlayerId: "player:2",
      name: "Foreign District",
      heat: 90
    });
    addCityHallOfficialCover(state, 80, ["district:2"]);

    const mitigation = resolveCityHallPoliceMitigation({
      state,
      context: createContext(),
      playerId: "player:1",
      targetDistrictId: "district:2",
      severity: "high"
    });

    expect(mitigation).toBeNull();
  });

  it("still allows extreme raids under reduced City Hall cover", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 140);
    moveToRaidBoundary(state);
    addQuietRaidFallback(state);
    addCityHallOfficialCover(state);
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 70
    };

    const result = triggerRaid(state, createContext());

    expect(result.events[0]).toMatchObject({
      type: "police-raid-triggered",
      payload: {
        severity: "extreme",
        cityHallMitigation: {
          rawReductionPct: 80,
          effectiveReductionPct: 40,
          triggerChancePct: 60
        }
      }
    });
    expect(result.nextState.policeStatesById["police:1"].pendingRaids?.[0].severity).toBe("extreme");
  });

  it("does not erase heat when City Hall cover delays a raid", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 80);
    moveToRaidBoundary(state);
    addQuietRaidFallback(state);
    addCityHallOfficialCover(state);
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 70
    };

    const result = triggerRaid(state, createContext());

    expect(result.decisions.find((decision) => decision.playerId === "player:1")?.type).toBe("political_cover_delayed");
    expect(result.nextState.policeStatesById["police:1"].heat).toBe(80);
    expect(result.nextState.districtsById["district:1"].heat).toBe(70);
  });

  it("keeps existing pending raids under City Hall cover", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 80);
    moveToRaidBoundary(state);
    addCityHallOfficialCover(state);
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 70
    };
    state.policeStatesById["police:1"].pendingRaids = [{
      raidId: "police:raid:existing",
      playerId: "player:1",
      targetDistrictId: "district:1",
      severity: "high",
      reason: "existing",
      createdAtTick: 0,
      expiresAtTick: 30,
      status: "pending",
      sourcePressure: 143,
      previewConsequences: {
        seizedDirtyCash: 0,
        seizedResources: {},
        lockedDistrictId: null,
        lockdownUntilTick: null,
        disruptedBuildingIds: [],
        heatReducedBy: 0
      }
    }];

    const result = triggerRaid(state, createContext());

    expect(result.events).toEqual([]);
    expect(result.decisions[0]).toMatchObject({
      type: "existing_pending_raid_kept",
      raidId: "police:raid:existing"
    });
    expect(result.nextState.policeStatesById["police:1"].pendingRaids).toHaveLength(1);
  });

  it("does not suppress confirmed police warning events under City Hall cover", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 20);
    moveToRaidBoundary(state);
    addQuietRaidFallback(state);
    addCityHallOfficialCover(state);
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 30
    };

    const result = triggerRaid(state, createContext());

    expect(result.events[0]).toMatchObject({
      type: "police-warning-issued",
      payload: {
        severity: "medium"
      }
    });
    expect(result.nextState.policeStatesById["police:1"].policeEvents?.[0]).toMatchObject({
      type: "police-warning"
    });
  });

  it("shows City Hall police mitigation in the police read model", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 80);
    addCityHallOfficialCover(state);
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 70
    };

    const model = createPoliceReadModel(state, "player:1", createContext());

    expect(model.mitigations).toEqual([
      {
        source: "city_hall_official_cover",
        label: "Politické krytí aktivní: snižuje šanci zásahu na tvé obsazené districty. Nečistí heat a nezastaví extrémní zásah. Snižuje šanci vytvoření zásahu.",
        districtId: "district:1",
        coveredDistrictIds: ["district:1"],
        effectiveReductionPct: 45,
        triggerChancePct: 55
      }
    ]);
  });

  it("does not apply City Hall cover when high raid pressure has no target district", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 130);
    moveToRaidBoundary(state);
    addQuietRaidFallback(state);
    addCityHallOfficialCover(state);
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 0
    };

    const result = triggerRaid(state, createContext());
    const model = createPoliceReadModel(state, "player:1", createContext());

    expect(result.events[0]).toMatchObject({
      type: "police-raid-triggered",
      payload: {
        targetDistrictId: null,
        cityHallMitigation: null
      }
    });
    expect(model.mitigations?.[0]).toMatchObject({
      source: "city_hall_official_cover",
      districtId: null,
      effectiveReductionPct: 0
    });
    expect(model.mitigations?.[0]?.label).toContain("Raidy čistě z heat hráče bez cílového districtu zatím nekryje");
  });

  it("keeps player and district heat unchanged across authoritative ticks", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 85);
    state.root.tick = 10_000;
    state.serverInstance.currentTick = 10_000;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 90,
      lastHeatDecayTick: 0
    };

    const result = runTick(state, createContext());

    expect(result.nextState.policeStatesById["police:1"].heat).toBe(85);
    expect(result.nextState.districtsById["district:1"].heat).toBe(90);
  });

  it("runs police raids from the authoritative tick", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 150);
    moveToRaidBoundary(state, 359);
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 70
    };

    const result = runTick(state, createContext());

    expect(result.events.some((event) => event.type === "police-raid-triggered")).toBe(true);
    expect(result.nextState.policeStatesById["police:1"].pendingRaids?.[0]).toMatchObject({
      status: "pending",
      severity: "extreme"
    });
  });
});
