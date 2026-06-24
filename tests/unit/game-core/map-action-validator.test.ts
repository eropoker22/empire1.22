import { describe, expect, it } from "vitest";
import {
  calculatePlayerFrontier,
  createDistrictCapabilitiesView,
  createPlayerFrontierSummaryView,
  detectAlliedEncirclementAfterOccupy,
  validateDistrictAdjacencyGraph,
  validateMapAction
} from "@empire/game-core";
import {
  createAllianceFixture,
  createCombatStateFixture,
  createDistrictFixture,
  createPlayerFixture
} from "../../fixtures/game-state-fixtures";

describe("map action validator", () => {
  it("allows attack only from an owned adjacent origin into an enemy district with spy authorization", () => {
    const state = createCombatStateFixture();

    expect(validateMapAction(
      state,
      {
        actorPlayerId: "player:1",
        targetDistrictId: "district:2",
        originDistrictId: "district:1",
        action: "attack"
      },
      { hasAttackAuthorization: () => true }
    )).toMatchObject({
      allowed: true,
      relation: "enemy",
      isAdjacentToOwnedDistrict: true,
      originDistrictId: "district:1"
    });
  });

  it("does not allow allied districts as attack targets or expansion origins", () => {
    const state = createCombatStateFixture();
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      allianceId: "alliance:1"
    };
    state.playersById["player:2"] = {
      ...state.playersById["player:2"],
      allianceId: "alliance:1"
    };
    state.alliancesById["alliance:1"] = createAllianceFixture({
      memberIds: ["player:1", "player:2"]
    });

    expect(validateMapAction(
      state,
      {
        actorPlayerId: "player:1",
        targetDistrictId: "district:2",
        originDistrictId: "district:1",
        action: "attack"
      },
      { hasAttackAuthorization: () => true }
    )).toMatchObject({
      allowed: false,
      reasonCode: "TARGET_IS_ALLY",
      relation: "ally"
    });

    state.playersById["player:3"] = createPlayerFixture({
      id: "player:3",
      accountId: "account:3",
      name: "Third",
      homeDistrictId: "district:3",
      allianceId: "alliance:1"
    });
    state.alliancesById["alliance:1"] = {
      ...state.alliancesById["alliance:1"],
      memberIds: ["player:1", "player:2", "player:3"]
    };
    state.districtsById["district:3"] = createDistrictFixture({
      id: "district:3",
      ownerPlayerId: "player:3",
      adjacentDistrictIds: ["district:4"]
    });
    state.districtsById["district:4"] = createDistrictFixture({
      id: "district:4",
      ownerPlayerId: null,
      status: "neutral",
      adjacentDistrictIds: ["district:3"]
    });

    expect(validateMapAction(state, {
      actorPlayerId: "player:1",
      targetDistrictId: "district:4",
      originDistrictId: "district:3",
      action: "occupy"
    })).toMatchObject({
      allowed: false,
      reasonCode: "NO_VALID_ORIGIN",
      relation: "empty",
      isAdjacentToOwnedDistrict: false
    });
  });

  it("allows spy against empty neighboring districts and rejects self/allied targets", () => {
    const state = createCombatStateFixture();
    state.districtsById["district:3"] = createDistrictFixture({
      id: "district:3",
      ownerPlayerId: null,
      status: "neutral",
      adjacentDistrictIds: ["district:1"]
    });
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      adjacentDistrictIds: ["district:2", "district:3"]
    };

    expect(validateMapAction(state, {
      actorPlayerId: "player:1",
      targetDistrictId: "district:3",
      originDistrictId: "district:1",
      action: "spy"
    })).toMatchObject({
      allowed: true,
      relation: "empty"
    });

    expect(validateMapAction(state, {
      actorPlayerId: "player:1",
      targetDistrictId: "district:1",
      originDistrictId: "district:1",
      action: "spy"
    })).toMatchObject({
      allowed: false,
      reasonCode: "SPY_TARGET_IS_SELF",
      relation: "self"
    });
  });

  it("validates rob and heist through the same owned-adjacent border rules", () => {
    const state = createCombatStateFixture();
    state.districtsById["district:3"] = createDistrictFixture({
      id: "district:3",
      ownerPlayerId: null,
      status: "neutral",
      adjacentDistrictIds: ["district:1"]
    });
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      adjacentDistrictIds: ["district:2", "district:3"]
    };

    expect(validateMapAction(state, {
      actorPlayerId: "player:1",
      targetDistrictId: "district:3",
      originDistrictId: "district:1",
      action: "rob"
    })).toMatchObject({ allowed: true, relation: "empty" });

    expect(validateMapAction(state, {
      actorPlayerId: "player:1",
      targetDistrictId: "district:2",
      originDistrictId: "district:1",
      action: "rob"
    })).toMatchObject({ allowed: false, reasonCode: "TARGET_NOT_EMPTY" });

    expect(validateMapAction(state, {
      actorPlayerId: "player:1",
      targetDistrictId: "district:2",
      originDistrictId: "district:1",
      action: "heist"
    })).toMatchObject({ allowed: true, relation: "enemy" });

    expect(validateMapAction(state, {
      actorPlayerId: "player:1",
      targetDistrictId: "district:3",
      originDistrictId: "district:1",
      action: "heist"
    })).toMatchObject({ allowed: false, reasonCode: "TARGET_NOT_ENEMY" });
  });

  it("validates adjacency graph symmetry and duplicate neighbors", () => {
    const state = createCombatStateFixture();
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      adjacentDistrictIds: ["district:2", "district:2", "district:missing", "district:1"]
    };
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      adjacentDistrictIds: []
    };

    expect(validateDistrictAdjacencyGraph(state)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "DUPLICATE_NEIGHBOR", districtId: "district:1", neighborId: "district:2" }),
      expect.objectContaining({ code: "ASYMMETRIC_NEIGHBOR", districtId: "district:1", neighborId: "district:2" }),
      expect.objectContaining({ code: "MISSING_NEIGHBOR", districtId: "district:1", neighborId: "district:missing" }),
      expect.objectContaining({ code: "SELF_NEIGHBOR", districtId: "district:1", neighborId: "district:1" })
    ]));
  });

  it("calculates frontier state across empty, allied, and enemy borders", () => {
    const state = createCombatStateFixture();
    state.districtsById["district:3"] = createDistrictFixture({
      id: "district:3",
      ownerPlayerId: null,
      status: "neutral",
      adjacentDistrictIds: ["district:1"]
    });
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      adjacentDistrictIds: ["district:2", "district:3"]
    };

    expect(calculatePlayerFrontier(state, "player:1")).toMatchObject({
      state: "open",
      emptyDistrictIds: ["district:3"],
      enemyDistrictIds: ["district:2"]
    });

    expect(createPlayerFrontierSummaryView(state, "player:1")).toMatchObject({
      state: "open",
      emptyNeighborDistrictIds: ["district:3"],
      canSpyEmptyFrontier: true,
      canRobEmptyFrontier: true,
      canOccupyWithValidSpy: false
    });

    expect(createDistrictCapabilitiesView(state, "player:1", "district:3")).toMatchObject({
      canSpy: true,
      canRob: true,
      canOccupy: false,
      reasons: expect.objectContaining({
        occupy: "OCCUPY_SPY_REQUIRED"
      })
    });
  });

  it("detects when occupying an empty district would close an ally's last empty frontier", () => {
    const state = createCombatStateFixture();
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      allianceId: "alliance:1"
    };
    state.playersById["player:2"] = {
      ...state.playersById["player:2"],
      allianceId: "alliance:1"
    };
    state.alliancesById["alliance:1"] = createAllianceFixture({
      memberIds: ["player:1", "player:2"]
    });
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      adjacentDistrictIds: ["district:1", "district:3"]
    };
    state.districtsById["district:3"] = createDistrictFixture({
      id: "district:3",
      ownerPlayerId: null,
      status: "neutral",
      adjacentDistrictIds: ["district:1", "district:2"]
    });
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      adjacentDistrictIds: ["district:2", "district:3"]
    };

    expect(calculatePlayerFrontier(state, "player:2").state).toBe("open");
    expect(detectAlliedEncirclementAfterOccupy(state, "player:1", "district:3")).toEqual({
      requiresConsent: true,
      affectedPlayerIds: ["player:2"]
    });
  });
});
