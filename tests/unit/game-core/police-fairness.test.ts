import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { calculatePlayerPolicePressure, createPoliceReadModel, triggerRaid } from "@empire/game-core";
import { createCoreStateFixture, createDistrictFixture } from "../../fixtures/game-state-fixtures";

const context = { config: resolveModeConfig("free") };
const fixture = (heat: number) => {
  const state = createCoreStateFixture();
  state.policeStatesById["police:1"] = { id: "police:1", ownerPlayerId: "player:1", heat, wantedLevel: 5, activeFlags: [], lastDecayTick: 0, version: 1 };
  return state;
};

describe("police fairness during a multi-day war", () => {
  it("does not turn a wide quiet empire into an extreme criminal through passive district heat alone", () => {
    const state = fixture(0);
    for (let index = 1; index <= 10; index++) {
      const district = createDistrictFixture({ id: `district:${index}`, heat: 500, ownerPlayerId: "player:1" });
      state.districtsById[district.id] = district;
    }
    const pressure = calculatePlayerPolicePressure(state, "player:1", context);
    expect(pressure.aggregatePressure).toBe(75);
    expect(pressure.riskTier).toBe("medium");
    state.root.tick = 120;
    const result = triggerRaid(state, context);
    const raid = result.nextState.policeStatesById["police:1"].pendingRaids?.[0];
    expect(raid).toMatchObject({ kind: "inspection", severity: "low", previewConsequences: { seizedDirtyCash: 0, seizedResources: {}, disruptedBuildingIds: [] } });
    expect(createPoliceReadModel(result.nextState, "player:1", context).raidPressureExplanation).toContain("75 bodů");
  });

  it("keeps a high-heat criminal eligible for a proportionate raid despite the territory cap", () => {
    const state = fixture(200);
    state.root.tick = 120;
    state.districtsById["district:1"].heat = 500;
    const pressure = calculatePlayerPolicePressure(state, "player:1", context);
    expect(pressure.riskTier).toBe("extreme");
    const result = triggerRaid(state, context);
    expect(result.nextState.policeStatesById["police:1"].pendingRaids?.[0]).toMatchObject({ kind: "raid", severity: "extreme" });
  });
});
