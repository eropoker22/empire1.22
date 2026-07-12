import { describe, expect, it } from "vitest";
import {
  acknowledgePendingRaid,
  applyPoliceHeatDecay,
  calculatePlayerPolicePressure,
  createPoliceReadModel,
  createRaidPreviewConsequences,
  expirePendingRaids,
  resolveCityHallPoliceMitigation,
  resolveCourtRaidMitigationPct,
  resolvePendingRaid,
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
            expiresAtTick: 100,
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
      createdAtTick: 0,
      expiresAtTick: 360
    });
    expect(second.events).toEqual([]);
    expect(second.nextState.policeStatesById["police:1"].pendingRaids).toHaveLength(1);
  });

  it("keeps Free BR police raids open for 30 minutes", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 150);
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 70
    };

    const context = createContext();
    const result = triggerRaid(state, context);
    const raid = result.nextState.policeStatesById["police:1"].pendingRaids?.[0];

    expect(context.config.balance.police.raidDurationTicks).toBe(360);
    expect(context.config.balance.police.pendingRaidTtlTicks).toBe(360);
    expect(raid?.expiresAtTick).toBe(raid!.createdAtTick + 360);
  });

  it("caps simultaneous police raids to two during day", () => {
    const state = createCoreStateFixture();
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

    expect(raidEvents).toHaveLength(2);
    expect(openRaids).toHaveLength(2);
    expect(result.decisions.filter((decision) => decision.type === "concurrent_raid_limit_active")).toHaveLength(1);
  });

  it("caps simultaneous police raids to one during night", () => {
    const state = createCoreStateFixture();
    state.root.tick = resolveModeConfig("free").balance.dayLengthTicks;
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
        chemicals: 50,
        "gang-members": 20
      }
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
      buildingDisruptionUntilTick: 18,
      heatReducedBy: 55
    });
    expect(balances).toMatchObject({
      cash: 1000,
      "dirty-cash": 780,
      chemicals: 45,
      "gang-members": 20
    });
    expect(resolved.nextState.districtsById["district:1"]).toMatchObject({
      status: "locked",
      lockdownUntilTick: 24
    });
    expect(resolved.nextState.buildingsById[building.id]).toMatchObject({
      status: "disabled",
      disruptedUntilTick: 18
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

  it("seizes one stored resource from a live raid even when the percentage rounds below one", () => {
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

    expect(preview.seizedResources).toMatchObject({ chemicals: 1 });
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
      lockdownUntilTick: 6,
      buildingDisruptionUntilTick: 5,
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
        lockdownTicks: 24,
        buildingDisruptionTicks: 18
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
      buildingDisruptionUntilTick: 5,
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
    expect(resolved.nextState.districtsById["district:1"].lockdownUntilTick).toBe(6);
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

  it("can expire pending raids without consequences when configured", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 130);
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
        tick: 1
      }
    };

    const expired = expirePendingRaids(expiredInput, context);

    expect(expired.nextState.policeStatesById["police:1"].pendingRaids?.[0].status).toBe("expired");
    expect(expired.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(100);
  });

  it("projects pending raid and last police event safely", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 130);
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
    state.root.tick = 0;
    addPoliceState(state, 80);
    addCityHallOfficialCover(state);
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 70
    };

    const result = triggerRaid(state, createContext());

    expect(result.events).toEqual([]);
    expect(result.decisions[0]).toMatchObject({
      type: "political_cover_delayed",
      aggregatePressure: 143
    });
    expect(result.nextState.policeStatesById["police:1"].pendingRaids).toBeUndefined();
  });

  it("does not make high raid pressure immune under City Hall cover", () => {
    const state = createCoreStateFixture();
    state.root.tick = 1;
    addPoliceState(state, 80);
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
    state.root.tick = 1;
    addPoliceState(state, 60);
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
    state.root.tick = 0;
    addPoliceState(state, 140);
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
    state.root.tick = 0;
    addPoliceState(state, 80);
    addCityHallOfficialCover(state);
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 70
    };

    const result = triggerRaid(state, createContext());

    expect(result.decisions[0]?.type).toBe("political_cover_delayed");
    expect(result.nextState.policeStatesById["police:1"].heat).toBe(80);
    expect(result.nextState.districtsById["district:1"].heat).toBe(70);
  });

  it("keeps existing pending raids under City Hall cover", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 80);
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
    state.root.tick = 1;
    addPoliceState(state, 130);
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
    expect(model.mitigations?.[0]?.label).toContain("Raidy čistě z player heat bez cílového districtu zatím nekryje");
  });

  it("decays player heat on the configured interval", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 85);
    state.root.tick = 30;

    const result = applyPoliceHeatDecay(state, createContext());

    expect(result.policeStatesById["police:1"]).toMatchObject({
      heat: 84,
      wantedLevel: 4,
      lastDecayTick: 30
    });
  });

  it("never decays player heat below zero", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 2);
    state.root.tick = 30;

    const result = applyPoliceHeatDecay(state, createContext());

    expect(result.policeStatesById["police:1"]).toMatchObject({
      heat: 0,
      wantedLevel: 0
    });
  });

  it("recalculates wanted level after player heat decay", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 41);
    state.root.tick = 30;

    const result = applyPoliceHeatDecay(state, createContext());

    expect(result.policeStatesById["police:1"]).toMatchObject({
      heat: 39,
      wantedLevel: 1
    });
  });

  it("skips player heat decay while a raid is pending", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 85);
    state.root.tick = 30;
    state.policeStatesById["police:1"].pendingRaids = [{
      raidId: "raid:pending",
      playerId: "player:1",
      severity: "high",
      reason: "test",
      createdAtTick: 20,
      expiresAtTick: 40,
      status: "pending",
      sourcePressure: 120,
      previewConsequences: {
        seizedDirtyCash: 0,
        seizedResources: {},
        lockedDistrictId: null,
        lockdownUntilTick: null,
        disruptedBuildingIds: [],
        heatReducedBy: 0
      }
    }];

    const result = applyPoliceHeatDecay(state, createContext());

    expect(result.policeStatesById["police:1"]).toMatchObject({
      heat: 85,
      wantedLevel: 4,
      lastDecayTick: 30
    });
    expect(result.policeStatesById["police:1"].pendingRaids?.[0].status).toBe("pending");
  });

  it("decays district heat on the configured interval", () => {
    const state = createCoreStateFixture();
    state.root.tick = 60;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 90,
      lastHeatDecayTick: 0
    };

    const result = applyPoliceHeatDecay(state, createContext({
      heatDecay: {
        ...resolveModeConfig("free").balance.police!.heatDecay!,
        districtHighPassiveHeatPerDayThreshold: 999999
      }
    }));

    expect(result.districtsById["district:1"]).toMatchObject({
      heat: 87,
      lastHeatDecayTick: 60
    });
  });

  it("initializes missing district heat decay tick without retroactive decay", () => {
    const state = createCoreStateFixture();
    state.root.tick = 180;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 90
    };

    const result = applyPoliceHeatDecay(state, createContext({
      heatDecay: {
        ...resolveModeConfig("free").balance.police!.heatDecay!,
        districtHighPassiveHeatPerDayThreshold: 999999
      }
    }));

    expect(result.districtsById["district:1"]).toMatchObject({
      heat: 90,
      lastHeatDecayTick: 180
    });
  });

  it("decays district heat normally after initializing the decay tick", () => {
    const state = createCoreStateFixture();
    state.root.tick = 180;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 90
    };

    const context = createContext({
      heatDecay: {
        ...resolveModeConfig("free").balance.police!.heatDecay!,
        districtHighPassiveHeatPerDayThreshold: 999999
      }
    });
    const initialized = applyPoliceHeatDecay(state, context);
    const nextState = {
      ...initialized,
      root: {
        ...initialized.root,
        tick: 240
      }
    };
    const result = applyPoliceHeatDecay(nextState, context);

    expect(result.districtsById["district:1"]).toMatchObject({
      heat: 87,
      lastHeatDecayTick: 240
    });
  });

  it("keeps existing valid district heat decay ticks compatible", () => {
    const state = createCoreStateFixture();
    state.root.tick = 120;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 90,
      lastHeatDecayTick: 60
    };

    const result = applyPoliceHeatDecay(state, createContext({
      heatDecay: {
        ...resolveModeConfig("free").balance.police!.heatDecay!,
        districtHighPassiveHeatPerDayThreshold: 999999
      }
    }));

    expect(result.districtsById["district:1"]).toMatchObject({
      heat: 87,
      lastHeatDecayTick: 120
    });
  });

  it("never decays district heat below zero", () => {
    const state = createCoreStateFixture();
    state.root.tick = 60;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 2,
      lastHeatDecayTick: 0
    };

    const result = applyPoliceHeatDecay(state, createContext({
      heatDecay: {
        ...resolveModeConfig("free").balance.police!.heatDecay!,
        districtHighPassiveHeatPerDayThreshold: 999999
      }
    }));

    expect(result.districtsById["district:1"]).toMatchObject({
      heat: 0,
      lastHeatDecayTick: 60
    });
  });

  it("still triggers raids after applying decay when pressure remains high", () => {
    const state = createCoreStateFixture();
    addPoliceState(state, 120);
    state.root.tick = 30;

    const decayed = applyPoliceHeatDecay(state, createContext());
    const triggered = triggerRaid(decayed, createContext());

    expect(decayed.policeStatesById["police:1"].heat).toBe(119);
    expect(triggered.events[0]?.type).toBe("police-raid-triggered");
    expect(triggered.nextState.policeStatesById["police:1"].pendingRaids?.[0]).toMatchObject({
      status: "pending",
      severity: "high"
    });
  });
});
