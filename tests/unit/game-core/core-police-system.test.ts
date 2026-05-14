import { describe, expect, it } from "vitest";
import {
  acknowledgePendingRaid,
  calculatePlayerPolicePressure,
  createPoliceReadModel,
  expirePendingRaids,
  resolvePendingRaid,
  triggerRaid
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { createCoreStateFixture, createFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

const createContext = (policeOverride = {}) => {
  const config = resolveModeConfig("free");
  return {
    config: {
      ...config,
      balance: {
        ...config.balance,
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
      sourcePressure: 147
    });
    expect(second.events).toEqual([]);
    expect(second.nextState.policeStatesById["police:1"].pendingRaids).toHaveLength(1);
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
    expect(resolved.result).toMatchObject({
      seizedDirtyCash: 55,
      seizedResources: {
        chemicals: 1
      },
      lockedDistrictId: "district:1",
      disruptedBuildingIds: [targetBuilding.id],
      buildingDisruptionUntilTick: 5,
      heatReducedBy: 55,
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
});
