import { describe, expect, it } from "vitest";
import {
  calculatePlayerFrontier,
  createInitialState,
  createDistrictCapabilitiesView,
  createPlayerFrontierSummaryView,
  detectAlliedEncirclementAfterOccupy,
  validateDistrictAdjacencyGraph,
  validateMapAction
} from "@empire/game-core";
import { empireStreetsCityMapManifest } from "@empire/game-config";
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

  it("validates border actions against concrete canonical manifest district IDs", () => {
    const state = createManifestMapState();
    const origin = empireStreetsCityMapManifest.districts.find((district) => district.neighborIds.length >= 2)!;
    const adjacentTargetId = origin.neighborIds[0]!;
    const nonAdjacentTarget = empireStreetsCityMapManifest.districts.find((district) =>
      district.id !== origin.id && !origin.neighborIds.includes(district.id)
    )!;

    state.playersById["player:1"] = createPlayerFixture({ id: "player:1", homeDistrictId: origin.id });
    state.playersById["player:2"] = createPlayerFixture({ id: "player:2", homeDistrictId: adjacentTargetId });
    state.districtsById[origin.id] = {
      ...state.districtsById[origin.id],
      ownerPlayerId: "player:1",
      status: "claimed"
    };
    state.districtsById[adjacentTargetId] = {
      ...state.districtsById[adjacentTargetId],
      ownerPlayerId: "player:2",
      status: "claimed"
    };
    state.districtsById[nonAdjacentTarget.id] = {
      ...state.districtsById[nonAdjacentTarget.id],
      ownerPlayerId: "player:2",
      status: "claimed"
    };

    expect(validateMapAction(
      state,
      {
        actorPlayerId: "player:1",
        targetDistrictId: adjacentTargetId,
        originDistrictId: origin.id,
        action: "attack"
      },
      { hasAttackAuthorization: () => true }
    )).toMatchObject({
      allowed: true,
      originDistrictId: origin.id,
      isAdjacentToOwnedDistrict: true
    });

    expect(validateMapAction(
      state,
      {
        actorPlayerId: "player:1",
        targetDistrictId: nonAdjacentTarget.id,
        originDistrictId: origin.id,
        action: "attack"
      },
      { hasAttackAuthorization: () => true }
    )).toMatchObject({
      allowed: false,
      reasonCode: "TARGET_NOT_ADJACENT",
      isAdjacentToOwnedDistrict: false
    });
  });

  it("allows exactly one allied corridor hop only as encirclement recovery", () => {
    const state = createCombatStateFixture();
    state.playersById["player:1"] = { ...state.playersById["player:1"], allianceId: "alliance:1" };
    state.playersById["player:2"] = { ...state.playersById["player:2"], allianceId: "alliance:1" };
    state.alliancesById["alliance:1"] = createAllianceFixture({ memberIds: ["player:1", "player:2"] });
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      adjacentDistrictIds: ["district:2"]
    };
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      ownerPlayerId: "player:2",
      adjacentDistrictIds: ["district:1", "district:3"],
      version: 7
    };
    state.districtsById["district:3"] = createDistrictFixture({
      id: "district:3",
      ownerPlayerId: null,
      status: "neutral",
      adjacentDistrictIds: ["district:2"]
    });

    expect(validateMapAction(state, {
      actorPlayerId: "player:1",
      targetDistrictId: "district:3",
      originDistrictId: "district:1",
      routeDistrictId: "district:2",
      expectedRouteVersion: 7,
      action: "spy"
    })).toMatchObject({
      allowed: true,
      usedAllianceCorridor: true,
      routeDistrictId: "district:2",
      routeOwnerPlayerId: "player:2"
    });

    expect(validateMapAction(state, {
      actorPlayerId: "player:1",
      targetDistrictId: "district:3",
      originDistrictId: "district:1",
      routeDistrictId: "district:2",
      expectedRouteVersion: 6,
      action: "spy"
    })).toMatchObject({ allowed: false, reasonCode: "ROUTE_VERSION_CONFLICT" });

    state.alliancesById["alliance:1"] = { ...state.alliancesById["alliance:1"], status: "disbanded" };
    expect(validateMapAction(state, {
      actorPlayerId: "player:1",
      targetDistrictId: "district:3",
      originDistrictId: "district:1",
      routeDistrictId: "district:2",
      action: "spy"
    })).toMatchObject({ allowed: false, reasonCode: "ROUTE_NOT_ALLY" });
  });

  it("rejects a corridor when the target is already directly adjacent", () => {
    const state = createCombatStateFixture();
    state.playersById["player:1"] = { ...state.playersById["player:1"], allianceId: "alliance:1" };
    state.playersById["player:3"] = createPlayerFixture({
      id: "player:3", accountId: "account:3", allianceId: "alliance:1", homeDistrictId: "district:3"
    });
    state.alliancesById["alliance:1"] = createAllianceFixture({ memberIds: ["player:1", "player:3"] });
    state.districtsById["district:3"] = createDistrictFixture({
      id: "district:3", ownerPlayerId: "player:3", adjacentDistrictIds: ["district:1", "district:2"]
    });
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"], adjacentDistrictIds: ["district:2", "district:3"]
    };
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"], adjacentDistrictIds: ["district:1", "district:3"]
    };

    expect(validateMapAction(state, {
      actorPlayerId: "player:1",
      targetDistrictId: "district:2",
      originDistrictId: "district:1",
      routeDistrictId: "district:3",
      action: "heist"
    })).toMatchObject({ allowed: false, reasonCode: "CORRIDOR_NOT_REQUIRED" });
  });

  it("calculates frontier states on the canonical manifest graph", () => {
    const { state, ownedDistrictId, allyNeighborId, enemyNeighborId, emptyNeighborId } = createManifestFrontierScenario();

    expect(calculatePlayerFrontier(state, "player:1")).toMatchObject({
      state: "open",
      emptyDistrictIds: [emptyNeighborId],
      allyDistrictIds: [allyNeighborId],
      enemyDistrictIds: [enemyNeighborId]
    });

    state.districtsById[emptyNeighborId] = {
      ...state.districtsById[emptyNeighborId],
      ownerPlayerId: "player:3",
      status: "claimed"
    };
    expect(calculatePlayerFrontier(state, "player:1").state).toBe("mixed_encircled");

    state.districtsById[enemyNeighborId] = {
      ...state.districtsById[enemyNeighborId],
      ownerPlayerId: "player:3",
      status: "claimed"
    };
    expect(calculatePlayerFrontier(state, "player:1").state).toBe("allied_encircled");

    state.playersById["player:3"] = { ...state.playersById["player:3"], allianceId: null };
    state.districtsById[allyNeighborId] = {
      ...state.districtsById[allyNeighborId],
      ownerPlayerId: "player:2",
      status: "claimed"
    };
    state.districtsById[enemyNeighborId] = {
      ...state.districtsById[enemyNeighborId],
      ownerPlayerId: "player:2",
      status: "claimed"
    };
    state.districtsById[emptyNeighborId] = {
      ...state.districtsById[emptyNeighborId],
      ownerPlayerId: "player:2",
      status: "claimed"
    };
    expect(calculatePlayerFrontier(state, "player:1").state).toBe("hostile_encircled");

    const alliedExpansionCandidateId = state.districtsById[allyNeighborId].adjacentDistrictIds.find((districtId) =>
      districtId !== ownedDistrictId && !state.districtsById[ownedDistrictId].adjacentDistrictIds.includes(districtId)
    );
    expect(alliedExpansionCandidateId).toBeTruthy();
    expect(calculatePlayerFrontier(state, "player:1").emptyDistrictIds).not.toContain(alliedExpansionCandidateId);
  });
});

const createManifestMapState = () => {
  const state = createInitialState("instance:manifest-map", "free");
  state.root.districtIds = empireStreetsCityMapManifest.districts.map((district) => district.id);
  state.districtsById = Object.fromEntries(empireStreetsCityMapManifest.districts.map((district) => [
    district.id,
    createDistrictFixture({
      id: district.id,
      name: district.name,
      zone: district.zone,
      ownerPlayerId: null,
      status: "neutral",
      adjacentDistrictIds: district.neighborIds
    })
  ]));
  return state;
};

const createManifestFrontierScenario = () => {
  const state = createManifestMapState();
  const ownedDistrict = empireStreetsCityMapManifest.districts.find((district) => district.neighborIds.length >= 3)!;
  const [allyNeighborId, enemyNeighborId, emptyNeighborId] = ownedDistrict.neighborIds;

  state.playersById["player:1"] = createPlayerFixture({
    id: "player:1",
    allianceId: "alliance:1",
    homeDistrictId: ownedDistrict.id
  });
  state.playersById["player:2"] = createPlayerFixture({
    id: "player:2",
    allianceId: null,
    homeDistrictId: enemyNeighborId
  });
  state.playersById["player:3"] = createPlayerFixture({
    id: "player:3",
    allianceId: "alliance:1",
    homeDistrictId: allyNeighborId
  });
  state.alliancesById["alliance:1"] = createAllianceFixture({
    memberIds: ["player:1", "player:3"]
  });
  state.districtsById[ownedDistrict.id] = {
    ...state.districtsById[ownedDistrict.id],
    ownerPlayerId: "player:1",
    status: "claimed"
  };
  state.districtsById[allyNeighborId!] = {
    ...state.districtsById[allyNeighborId!],
    ownerPlayerId: "player:3",
    status: "claimed"
  };
  state.districtsById[enemyNeighborId!] = {
    ...state.districtsById[enemyNeighborId!],
    ownerPlayerId: "player:2",
    status: "claimed"
  };
  state.root.playerIds = ["player:1", "player:2", "player:3"];

  return {
    state,
    ownedDistrictId: ownedDistrict.id,
    allyNeighborId: allyNeighborId!,
    enemyNeighborId: enemyNeighborId!,
    emptyNeighborId: emptyNeighborId!
  };
};
