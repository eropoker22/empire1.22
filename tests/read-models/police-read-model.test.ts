import { describe, expect, it } from "vitest";
import {
  createPlayerView,
  createPoliceReadModel,
  triggerRaid
} from "../../packages/game-core/src";
import { resolveModeConfig } from "@empire/game-config";
import { createCoreStateFixture, createFixedBuildingFixture } from "../fixtures/game-state-fixtures";

const createPoliceContext = (policePressureMultiplier = 1, raidIntensityMultiplier = 1) => ({
  config: {
    balance: {
      policePressureMultiplier,
      raidIntensityMultiplier
    }
  }
}) as any;

const createFullPoliceContext = (policePressureMultiplier = 1, raidIntensityMultiplier = 1) => {
  const config = resolveModeConfig("free");
  return {
    config: {
      ...config,
      balance: {
        ...config.balance,
        policePressureMultiplier,
        raidIntensityMultiplier
      }
    }
  } as any;
};

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
      playerHeat: 65,
      ownedDistrictHeat: 20,
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
      raidPressureExplanation: "Raid pressure je celkový tlak policie: player heat plus vážený district heat z vlastněných districtů. District heat může přitáhnout raid i bez vysokého wanted levelu.",
      raidPending: false,
      raidRisk: "ready"
    });
    expect(model.heatBreakdown).toEqual([
      {
        key: "wantedLevel",
        label: "Wanted level",
        value: "3 / 5",
        description: "Osobní policejní stopa hráče. Počítá se z player heat, ne z district heat."
      },
      {
        key: "playerHeat",
        label: "Player heat",
        value: "65",
        description: "Heat přímo na hráči z hlučných akcí, útoků a špinavých operací."
      },
      {
        key: "districtHeat",
        label: "District heat",
        value: "20",
        description: "Součet heat ve vlastněných districtech. Může táhnout raid pressure nahoru i při nízkém wanted levelu."
      },
      {
        key: "raidPressure",
        label: "Raid pressure",
        value: "117",
        description: "Celkový tlak policie, který rozhoduje o warningu a raidu."
      }
    ]);
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

  it("recommends different action for high player heat than for high district heat", () => {
    const playerHeatState = createCoreStateFixture();
    playerHeatState.policeStatesById["police:1"] = {
      id: "police:1",
      ownerPlayerId: "player:1",
      heat: 110,
      wantedLevel: 5,
      lastDecayTick: 0,
      activeFlags: [],
      version: 1
    };
    playerHeatState.districtsById["district:1"] = {
      ...playerHeatState.districtsById["district:1"],
      heat: 5
    };

    const districtHeatState = createCoreStateFixture();
    districtHeatState.policeStatesById["police:1"] = {
      id: "police:1",
      ownerPlayerId: "player:1",
      heat: 20,
      wantedLevel: 1,
      lastDecayTick: 0,
      activeFlags: [],
      version: 1
    };
    districtHeatState.districtsById["district:1"] = {
      ...districtHeatState.districtsById["district:1"],
      heat: 120
    };

    const playerModel = createPoliceReadModel(playerHeatState, "player:1", createPoliceContext());
    const districtModel = createPoliceReadModel(districtHeatState, "player:1", createPoliceContext());

    expect(playerModel.recommendedAction).toContain("osobní policejní stopa");
    expect(districtModel.recommendedAction).toContain("wanted level je nízký");
    expect(districtModel.recommendedAction).toContain("Policie sleduje hlavně tvoje podniky");
  });

  it("adds mitigation guidance for City Hall and Courthouse without changing police state", () => {
    const cityHallState = createCoreStateFixture();
    cityHallState.policeStatesById["police:1"] = {
      id: "police:1",
      ownerPlayerId: "player:1",
      heat: 80,
      wantedLevel: 4,
      lastDecayTick: 0,
      activeFlags: [],
      version: 1
    };
    const cityHall = createFixedBuildingFixture("city_hall", {
      metadata: {
        cityHall: {
          officialCoverByDistrictId: {
            "district:1": {
              districtId: "district:1",
              expiresAtTick: 100,
              heatGainReductionPct: 35,
              policeControlChanceReductionPct: 80,
              rumorChanceReductionPct: 15
            }
          }
        }
      }
    });
    cityHallState.buildingsById[cityHall.id] = cityHall;
    cityHallState.districtsById["district:1"] = {
      ...cityHallState.districtsById["district:1"],
      heat: 80,
      buildingIds: [cityHall.id]
    };

    const courthouseState = createCoreStateFixture();
    courthouseState.policeStatesById["police:1"] = {
      id: "police:1",
      ownerPlayerId: "player:1",
      heat: 140,
      wantedLevel: 5,
      lastDecayTick: 0,
      activeFlags: [],
      version: 1
    };
    courthouseState.resourceStatesById["resource:1"] = {
      ...courthouseState.resourceStatesById["resource:1"],
      balances: {
        "dirty-cash": 500
      }
    };
    const courthouse = createFixedBuildingFixture("court");
    courthouseState.buildingsById[courthouse.id] = courthouse;
    courthouseState.districtsById["district:1"] = {
      ...courthouseState.districtsById["district:1"],
      buildingIds: [courthouse.id]
    };

    const cityHallModel = createPoliceReadModel(cityHallState, "player:1", createFullPoliceContext());
    const triggered = triggerRaid(courthouseState, createFullPoliceContext());
    const courthouseModel = createPoliceReadModel(triggered.nextState, "player:1", createFullPoliceContext());

    expect(cityHallModel.recommendedAction).toContain("Magistrát tlumí šanci zásahu");
    expect(courthouseModel.recommendedAction).toContain("Soud nezabrání zásahu");
    expect(courthouseModel.mitigations?.some((mitigation) => mitigation.source === "courthouse")).toBe(true);
    expect(courthouseState.policeStatesById["police:1"].pendingRaids).toBeUndefined();
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
