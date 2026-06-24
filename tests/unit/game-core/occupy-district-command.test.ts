import { describe, expect, it } from "vitest";
import { applyCommand, createDistrictOccupyTargetViews, type CoreGameState } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import {
  createCombatStateFixture,
  createFixedBuildingFixture,
  seedSuccessfulSpyIntel
} from "../../fixtures/game-state-fixtures";
import { createOccupyDistrictCommandFixture } from "../../fixtures/command-fixtures";

const context = { config: resolveModeConfig("free") };

describe("occupy district command", () => {
  it("rejects neutral adjacent occupation without successful empty-district spy intel", () => {
    const state = createNeutralOccupyState();
    const result = applyCommand(state, createOccupyDistrictCommandFixture(), context);

    expect(result.errors).toMatchObject([{ code: "OCCUPY_SPY_REQUIRED" }]);
    expect(result.nextState.districtsById["district:2"].ownerPlayerId).toBeNull();
  });

  it("shows an occupy target in the read model for empty neighboring districts", () => {
    const state = createNeutralOccupyState();

    expect(createDistrictOccupyTargetViews(state, "player:1", "district:1")).toEqual([
      expect.objectContaining({
        districtId: "district:2",
        enabled: false,
        disabledCode: "OCCUPY_SPY_REQUIRED",
        cost: { influence: 5 },
        heatGain: 2,
        cooldownRemainingTicks: 0
      })
    ]);
  });

  it("rejects occupation through an allied district origin", () => {
    const state = createNeutralOccupyState();
    state.playersById["player:3"] = {
      ...state.playersById["player:2"],
      id: "player:3",
      accountId: "account:3",
      name: "Ally",
      allianceId: "alliance:1"
    };
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      allianceId: "alliance:1"
    };
    state.alliancesById["alliance:1"] = {
      id: "alliance:1",
      serverInstanceId: "instance:1",
      name: "Alliance",
      tag: "AL",
      ownerPlayerId: "player:1",
      memberIds: ["player:1", "player:3"],
      status: "active",
      createdAt: new Date(0).toISOString(),
      version: 1
    };
    state.districtsById["district:3"] = {
      ...state.districtsById["district:1"],
      id: "district:3",
      name: "Ally Origin",
      ownerPlayerId: "player:3",
      adjacentDistrictIds: ["district:2"]
    };
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      adjacentDistrictIds: ["district:1", "district:3"]
    };

    const result = applyCommand(
      state,
      createOccupyDistrictCommandFixture({
        payload: {
          districtId: "district:2",
          sourceDistrictId: "district:3"
        }
      }),
      context
    );

    expect(result.errors).toMatchObject([{ code: "NO_VALID_ORIGIN" }]);
    expect(result.nextState.districtsById["district:2"].ownerPlayerId).toBeNull();
  });

  it("claims a neutral adjacent district after successful empty-district spy intel", () => {
    const state = createNeutralOccupyState();
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2", null);
    const result = applyCommand(state, createOccupyDistrictCommandFixture(), context);

    expect(result.errors).toEqual([]);
    expect(result.nextState.districtsById["district:1"].influence).toBe(5);
    expect(result.nextState.districtsById["district:2"]).toMatchObject({
      ownerPlayerId: "player:1",
      status: "claimed",
      heat: 2
    });
    expect(result.nextState.buildingsById["building:district-2:warehouse:1"]).toMatchObject({
      ownerPlayerId: "player:1",
      status: "active"
    });
    expect(result.nextState.cooldownStatesById["cooldown:1"]?.cooldowns["occupy:district:2"]).toBe(144);
    expect(result.nextState.policeStatesById["police:1"]?.heat).toBe(2);
    expect(result.nextState.notificationsById["notification:command:occupy:1:occupy-report"]).toMatchObject({
      category: "report.occupy",
      payload: expect.objectContaining({
        actionType: "occupy-district",
        sourceDistrictId: "district:1",
        targetDistrictId: "district:2",
        heatGained: 2,
        influenceCost: 5,
        cooldownTicks: 144
      })
    });
    expect(result.events).toEqual([
      expect.objectContaining({
        type: "district-captured",
        payload: expect.objectContaining({
          attackerPlayerId: "player:1",
          districtId: "district:2",
          previousOwnerPlayerId: null,
          actionType: "occupy-district",
          heatGained: 2,
          influenceCost: 5,
          cooldownTicks: 144
        })
      }),
      expect.objectContaining({
        type: "notification-created",
        payload: expect.objectContaining({
          notificationId: "notification:command:occupy:1:occupy-report",
          category: "report.occupy"
        })
      })
    ]);
    expect(Object.values(result.nextState.cityFeedEventsById)).toEqual([
      expect.objectContaining({
        sourceType: "district_capture",
        districtId: "district:2"
      })
    ]);
  });

  it("uses configured occupy cost, heat and cooldown values", () => {
    const state = createNeutralOccupyState();
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2", null);
    const config = createOccupyConfig({
      influenceCost: 7,
      heatGain: 3,
      cooldownTicks: 4
    });

    const result = applyCommand(state, createOccupyDistrictCommandFixture(), { config });

    expect(result.errors).toEqual([]);
    expect(result.nextState.districtsById["district:1"].influence).toBe(3);
    expect(result.nextState.districtsById["district:2"].heat).toBe(3);
    expect(result.nextState.policeStatesById["police:1"]?.heat).toBe(3);
    expect(result.nextState.cooldownStatesById["cooldown:1"]?.cooldowns["occupy:district:2"]).toBe(4);
  });

  it("reduces occupy cooldown for Motorkářský gang faction", () => {
    const state = createNeutralOccupyState();
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      factionId: "motorkarsky-gang"
    };
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2", null);
    const config = createOccupyConfig({
      influenceCost: 5,
      heatGain: 2,
      cooldownTicks: 10
    });

    const result = applyCommand(state, createOccupyDistrictCommandFixture(), { config });

    expect(result.errors).toEqual([]);
    expect(result.nextState.cooldownStatesById["cooldown:1"]?.cooldowns["occupy:district:2"]).toBe(9);
    expect(result.events[0]?.payload).toMatchObject({
      cooldownTicks: 9
    });
  });

  it("increases occupy heat for Soukromá armáda faction", () => {
    const state = createNeutralOccupyState();
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      factionId: "soukroma-armada"
    };
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2", null);
    const config = createOccupyConfig({
      influenceCost: 5,
      heatGain: 2,
      cooldownTicks: 10
    });

    const result = applyCommand(state, createOccupyDistrictCommandFixture(), { config });

    expect(result.errors).toEqual([]);
    expect(result.nextState.districtsById["district:2"].heat).toBe(3);
    expect(result.nextState.policeStatesById["police:1"]?.heat).toBe(3);
    expect(result.events[0]?.payload).toMatchObject({
      heatGained: 3
    });
  });

  it("rejects occupation during an active occupy cooldown", () => {
    const state = createNeutralOccupyState();
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2", null);
    state.cooldownStatesById["cooldown:1"] = {
      id: "cooldown:1",
      ownerType: "player",
      ownerId: "player:1",
      cooldowns: {
        "occupy:district:2": 2
      },
      version: 1
    };

    const result = applyCommand(state, createOccupyDistrictCommandFixture(), context);

    expect(result.errors).toMatchObject([
      {
        code: "occupy_on_cooldown"
      }
    ]);
    expect(result.nextState.districtsById["district:2"].ownerPlayerId).toBeNull();
  });

  it("rejects occupation when the source district lacks influence", () => {
    const state = createNeutralOccupyState();
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      influence: 4
    };
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2", null);
    const result = applyCommand(state, createOccupyDistrictCommandFixture(), context);

    expect(result.errors).toMatchObject([
      {
        code: "occupy_not_enough_influence"
      }
    ]);
    expect(result.nextState.districtsById["district:2"].ownerPlayerId).toBeNull();
  });

  it("rejects repeated occupation of an already owned district", () => {
    const state = createNeutralOccupyState();
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2", null);
    const claimed = applyCommand(state, createOccupyDistrictCommandFixture(), context).nextState;

    const repeated = applyCommand(
      claimed,
      createOccupyDistrictCommandFixture({ id: "command:occupy:repeat" }),
      context
    );

    expect(repeated.errors).toMatchObject([
      {
        code: "TARGET_IS_SELF"
      }
    ]);
  });

  it("rejects enemy-owned districts and leaves them for attack flow", () => {
    const state = createCombatStateFixture();

    const result = applyCommand(state, createOccupyDistrictCommandFixture(), context);

    expect(result.errors).toMatchObject([
      {
        code: "TARGET_NOT_EMPTY"
      }
    ]);
    expect(result.nextState.districtsById["district:2"].ownerPlayerId).toBe("player:2");
  });

  it("returns a clear error for invalid targets", () => {
    const state = createNeutralOccupyState();
    const result = applyCommand(
      state,
      createOccupyDistrictCommandFixture({
        payload: {
          districtId: "district:missing",
          sourceDistrictId: "district:1"
        }
      }),
      context
    );

    expect(result.errors).toMatchObject([
      {
        code: "occupy_target_not_found"
      }
    ]);
    expect(result.nextState).toBe(state);
  });
});

const createNeutralOccupyState = (): CoreGameState => {
  const state = createCombatStateFixture();
  const building = createFixedBuildingFixture("warehouse", {
    id: "building:district-2:warehouse:1",
    districtId: "district:2",
    ownerPlayerId: "player:neutral"
  });

  state.districtsById["district:2"] = {
    ...state.districtsById["district:2"],
    ownerPlayerId: null,
    controllerAllianceId: null,
    status: "neutral",
    buildingIds: [building.id],
    defenseLoadout: {}
  };
  state.districtsById["district:1"] = {
    ...state.districtsById["district:1"],
    influence: 10
  };
  state.buildingsById[building.id] = building;

  return state;
};

const createOccupyConfig = (input: {
  influenceCost: number;
  heatGain: number;
  cooldownTicks: number;
}) => {
  const config = resolveModeConfig("free");
  return {
    ...config,
    balance: {
      ...config.balance,
      conflict: {
        ...config.balance.conflict!,
        occupyInfluenceCost: input.influenceCost,
        occupyHeatGain: input.heatGain,
        occupyCooldownTicks: input.cooldownTicks
      }
    }
  };
};
