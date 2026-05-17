import { describe, expect, it } from "vitest";
import { applyCommand, createDistrictOccupyTargetViews, type CoreGameState } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import {
  createCombatStateFixture,
  createFixedBuildingFixture
} from "../../fixtures/game-state-fixtures";
import { createOccupyDistrictCommandFixture } from "../../fixtures/command-fixtures";

const context = { config: resolveModeConfig("free") };

describe("occupy district command", () => {
  it("rejects neutral occupation without successful spy intel", () => {
    const state = createNeutralOccupyState();
    const result = applyCommand(state, createOccupyDistrictCommandFixture(), context);

    expect(result.errors).toMatchObject([
      {
        code: "occupy_requires_successful_spy"
      }
    ]);
    expect(result.nextState.districtsById["district:2"].ownerPlayerId).toBeNull();
  });

  it("unlocks an occupy target in the read model after successful spy intel", () => {
    const state = createNeutralOccupyState();
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2");

    expect(createDistrictOccupyTargetViews(state, "player:1", "district:1")).toEqual([
      expect.objectContaining({
        districtId: "district:2",
        enabled: true,
        cost: { influence: 5 },
        heatGain: 2,
        cooldownRemainingTicks: 0
      })
    ]);
  });

  it("shows disabled reason and preview data before successful spy intel", () => {
    const state = createNeutralOccupyState();

    expect(createDistrictOccupyTargetViews(state, "player:1", "district:1")).toEqual([
      expect.objectContaining({
        districtId: "district:2",
        enabled: false,
        disabledCode: "occupy_requires_successful_spy",
        disabledReason: "Successful spy intel is required before occupying this district.",
        cost: { influence: 5 },
        heatGain: 2
      })
    ]);
  });

  it("claims a neutral adjacent district, pays influence, adds heat and sets cooldown after successful spy intel", () => {
    const state = createNeutralOccupyState();
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2");

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
    expect(result.nextState.cooldownStatesById["cooldown:1"]?.cooldowns["occupy:district:2"]).toBe(2);
    expect(result.nextState.policeStatesById["police:1"]?.heat).toBe(2);
    expect(result.nextState.notificationsById["notification:command:occupy:1:occupy-report"]).toMatchObject({
      category: "report.occupy",
      payload: expect.objectContaining({
        actionType: "occupy-district",
        sourceDistrictId: "district:1",
        targetDistrictId: "district:2",
        heatGained: 2,
        influenceCost: 5,
        cooldownTicks: 2
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
          cooldownTicks: 2
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
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2");
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
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2");
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
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2");
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
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2");
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
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2");

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
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2");
    const claimed = applyCommand(state, createOccupyDistrictCommandFixture(), context).nextState;

    const repeated = applyCommand(
      claimed,
      createOccupyDistrictCommandFixture({ id: "command:occupy:repeat" }),
      context
    );

    expect(repeated.errors).toMatchObject([
      {
        code: "occupy_own_district"
      }
    ]);
  });

  it("rejects enemy-owned districts and leaves them for attack flow", () => {
    const state = createCombatStateFixture();
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2");

    const result = applyCommand(state, createOccupyDistrictCommandFixture(), context);

    expect(result.errors).toMatchObject([
      {
        code: "occupy_enemy_owned_district"
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

const seedSuccessfulSpyIntel = (
  state: CoreGameState,
  playerId: string,
  sourceDistrictId: string,
  targetDistrictId: string
): void => {
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
      sourceDistrictId,
      targetDistrictId,
      result: "success",
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
