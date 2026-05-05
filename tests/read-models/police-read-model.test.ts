import { describe, expect, it } from "vitest";
import {
  createPlayerView,
  createPoliceReadModel,
  triggerRaid
} from "../../packages/game-core/src";
import { createCoreStateFixture } from "../fixtures/game-state-fixtures";

const createPoliceContext = (policePressureMultiplier = 1, raidIntensityMultiplier = 1) => ({
  config: {
    balance: {
      policePressureMultiplier,
      raidIntensityMultiplier
    }
  }
}) as any;

describe("police read model projection", () => {
  it("aggregates player and owned district heat into a read-only police projection", () => {
    const state = createCoreStateFixture();
    state.policeStatesById["police:1"] = {
      id: "police:1",
      ownerPlayerId: "player:1",
      heat: 65,
      wantedLevel: 1,
      lastDecayTick: 0,
      activeFlags: [],
      version: 1
    };
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      heat: 20
    };

    const model = createPoliceReadModel(state, "player:1", createPoliceContext(1.5, 2));

    expect(model).toMatchObject({
      playerId: "player:1",
      policeStateId: "police:1",
      heat: 65,
      projectedWantedLevel: 3,
      wantedLevel: 3,
      districtHeat: 20,
      totalHeat: 85,
      aggregatePressure: 117,
      playerHeatPressure: 97,
      districtHeatPressure: 20,
      hottestDistrictId: "district:1",
      hottestDistrictHeat: 20,
      raidPressure: 117,
      raidThreshold: 100,
      raidPending: false,
      raidRisk: "ready"
    });
    expect(model.heatSources).toEqual([
      {
        id: "police:1",
        kind: "player",
        label: "Player police heat",
        heat: 65
      },
      {
        id: "district:1",
        kind: "district",
        label: "Starter District",
        heat: 20
      }
    ]);
    expect(state.policeStatesById["police:1"].activeFlags).toEqual([]);
  });

  it("projects missing police state safely without creating state", () => {
    const state = createCoreStateFixture();

    const model = createPoliceReadModel(state, "player:missing", createPoliceContext());

    expect(model).toMatchObject({
      playerId: "player:missing",
      policeStateId: null,
      heat: 0,
      wantedLevel: 0,
      raidRisk: "none"
    });
  });

  it("reflects pending raid result payloads without resolving the raid in the read model", () => {
    const state = createCoreStateFixture();
    state.policeStatesById["police:1"] = {
      id: "police:1",
      ownerPlayerId: "player:1",
      heat: 120,
      wantedLevel: 3,
      lastDecayTick: 0,
      activeFlags: [],
      version: 1
    };
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: {
        cash: 1000,
        "dirty-cash": 500,
        chemicals: 20,
        "gang-members": 30
      }
    };

    const raidResult = triggerRaid(state, createPoliceContext());
    const model = createPoliceReadModel(raidResult.nextState, "player:1", createPoliceContext());

    expect(raidResult.events[0]).toMatchObject({
      type: "police-raid-triggered",
      payload: {
        policeStateId: "police:1",
        heat: 120,
        threshold: 100,
        aggregatePressure: 120,
        severity: "high",
        cashSeized: {
          "dirty-cash": 90
        },
        resourcesSeized: {
          chemicals: 1
        },
        gangMembersLost: 0,
        districtLockdownTicks: 0,
        heatReduced: 25
      }
    });
    expect(model.raidPending).toBe(true);
    expect(model.raidRisk).toBe("pending");
    expect(model.pendingRaid?.previewConsequences.seizedDirtyCash).toBe(90);
    expect(model.wantedLevel).toBe(5);
  });

  it("includes the core police read model in the player projection", () => {
    const state = createCoreStateFixture();
    state.policeStatesById["police:1"] = {
      id: "police:1",
      ownerPlayerId: "player:1",
      heat: 42,
      wantedLevel: 2,
      lastDecayTick: 0,
      activeFlags: [],
      version: 1
    };

    const player = createPlayerView(state, "player:1", createPoliceContext());

    expect(player.police).toMatchObject({
      playerId: "player:1",
      heat: 42,
      wantedLevel: 2,
      aggregatePressure: 42,
      riskTier: "low"
    });
  });
});
