import { describe, expect, it } from "vitest";
import { applyCommand, createDistrictOccupyTargetViews, type CoreGameState } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { PRODUCTION_GAME_LIFECYCLE_PHASES } from "@empire/shared-types";
import {
  createAllianceFixture,
  createCombatStateFixture,
  createDistrictFixture,
  createFixedBuildingFixture,
  seedSuccessfulSpyIntel
} from "../../fixtures/game-state-fixtures";
import { createOccupyDistrictCommandFixture } from "../../fixtures/command-fixtures";

const context = { config: resolveModeConfig("free") };

describe("occupy district command", () => {
  it("requires and consumes a server-issued token before closing an ally frontier", () => {
    const state = createAlliedEncirclementOccupyState();
    const prepared = applyCommand(
      state,
      createOccupyDistrictCommandFixture({ id: "command:occupy:prepare" }),
      context
    );

    expect(prepared.errors).toEqual([]);
    expect(prepared.nextState.districtsById["district:2"].ownerPlayerId).toBeNull();
    const token = Object.values(prepared.nextState.encirclementConfirmationTokensById ?? {})[0]!;
    expect(token).toMatchObject({
      actorPlayerId: "player:1",
      targetDistrictId: "district:2",
      sourceDistrictId: "district:1",
      affectedPlayerIds: ["player:2"],
      targetVersion: state.districtsById["district:2"].version,
      allianceVersion: state.alliancesById["alliance:1"].version,
      consumedAtTick: null
    });

    const confirmed = applyCommand(
      prepared.nextState,
      createOccupyDistrictCommandFixture({
        id: "command:occupy:confirmed",
        payload: {
          districtId: "district:2",
          sourceDistrictId: "district:1",
          encirclementConfirmationToken: token.id
        }
      }),
      context
    );

    expect(confirmed.errors).toEqual([]);
    expect(confirmed.nextState.encirclementConfirmationTokensById?.[token.id]?.consumedAtTick).toBe(state.root.tick);
    expect(confirmed.nextState.districtsById["district:2"].version).toBeGreaterThan(state.districtsById["district:2"].version);
  });

  it("invalidates an encirclement token when alliance or target state changes", () => {
    const state = createAlliedEncirclementOccupyState();
    const prepared = applyCommand(
      state,
      createOccupyDistrictCommandFixture({ id: "command:occupy:prepare-invalid" }),
      context
    ).nextState;
    const token = Object.values(prepared.encirclementConfirmationTokensById ?? {})[0]!;
    prepared.alliancesById["alliance:1"] = {
      ...prepared.alliancesById["alliance:1"],
      version: prepared.alliancesById["alliance:1"].version + 1
    };

    const invalid = applyCommand(
      prepared,
      createOccupyDistrictCommandFixture({
        id: "command:occupy:invalid-confirm",
        payload: {
          districtId: "district:2",
          sourceDistrictId: "district:1",
          encirclementConfirmationToken: token.id
        }
      }),
      context
    );

    expect(invalid.errors).toEqual([]);
    expect(invalid.nextState.districtsById["district:2"].ownerPlayerId).toBeNull();
    const replacement = Object.values(invalid.nextState.encirclementConfirmationTokensById ?? {})
      .find((entry) => entry.id !== token.id);
    expect(replacement?.allianceVersion).toBe(prepared.alliancesById["alliance:1"].version);
  });

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
        cost: { influence: 5, population: 50 },
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
    expect(result.nextState.resourceStatesById["resource:1"].balances.population).toBe(955);
    expect(result.nextState.districtsById["district:2"]).toMatchObject({
      ownerPlayerId: "player:1",
      status: "claimed",
      heat: 2
    });
    expect(result.nextState.buildingsById["building:district-2:warehouse:1"]).toMatchObject({
      ownerPlayerId: "player:1",
      status: "active"
    });
    expect(result.nextState.cooldownStatesById["cooldown:1"]?.cooldowns["occupy:global"]).toBe(144);
    expect(result.nextState.policeStatesById["police:1"]?.heat).toBe(2);
    expect(result.nextState.notificationsById["notification:command:occupy:1:occupy-report"]).toMatchObject({
      category: "report.occupy",
      payload: expect.objectContaining({
        actionType: "occupy-district",
        sourceDistrictId: "district:1",
        targetDistrictId: "district:2",
        heatGained: 2,
        influenceCost: 5,
        populationCost: 50,
        populationLost: 45,
        populationRefunded: 5,
        result: "success",
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
          populationCost: 50,
          populationLost: 45,
          populationRefunded: 5,
          result: "success",
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
        sourceType: "district_occupy",
        districtId: "district:2"
      })
    ]);
  });

  it("locks downtown occupation until final lockdown", () => {
    const state = createNeutralOccupyState();
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      zone: "downtown"
    };
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2", null);

    expect(createDistrictOccupyTargetViews(state, "player:1", "district:1")[0]).toMatchObject({
      districtId: "district:2",
      enabled: false,
      disabledCode: "DOWNTOWN_LOCKED_UNTIL_FINAL_LOCKDOWN",
      disabledReason: "Downtown districty jde obsadit až během final lockdownu."
    });

    const blocked = applyCommand(state, createOccupyDistrictCommandFixture(), context);
    expect(blocked.errors).toMatchObject([{ code: "DOWNTOWN_LOCKED_UNTIL_FINAL_LOCKDOWN" }]);
    expect(blocked.nextState.districtsById["district:2"].ownerPlayerId).toBeNull();

    state.root.phase = PRODUCTION_GAME_LIFECYCLE_PHASES.finalLockdown;
    expect(createDistrictOccupyTargetViews(state, "player:1", "district:1")[0]).toMatchObject({
      districtId: "district:2",
      enabled: true,
      disabledCode: null
    });

    const allowed = applyCommand(state, createOccupyDistrictCommandFixture(), context);
    expect(allowed.errors).toEqual([]);
  });

  it("can fail occupation, keep the district neutral and consume the full population cost", () => {
    const state = createNeutralOccupyState();
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2", null);
    const result = applyCommand(
      state,
      createOccupyDistrictCommandFixture({ id: "command:occupy:fail:1" }),
      context
    );

    expect(result.errors).toEqual([]);
    expect(result.nextState.districtsById["district:1"].influence).toBe(5);
    expect(result.nextState.resourceStatesById["resource:1"].balances.population).toBe(950);
    expect(result.nextState.playersById["player:1"].recoveryPool).toEqual([
      expect.objectContaining({ itemType: "population", amount: 50, source: "occupy" })
    ]);
    expect(result.nextState.districtsById["district:2"]).toMatchObject({
      ownerPlayerId: null,
      status: "neutral",
      heat: 2
    });
    expect(result.nextState.buildingsById["building:district-2:warehouse:1"]).toMatchObject({
      ownerPlayerId: "player:neutral"
    });
    expect(result.nextState.notificationsById["notification:command:occupy:fail:1:occupy-report"]).toMatchObject({
      category: "report.occupy",
      payload: expect.objectContaining({
        result: "failure",
        districtCaptured: false,
        populationCost: 50,
        populationLost: 50,
        populationRefunded: 0
      })
    });
    expect(result.events[0]).toMatchObject({
      type: "district-occupy-resolved",
      payload: expect.objectContaining({
        result: "failure",
        districtCaptured: false,
        populationLost: 50,
        populationRefunded: 0
      })
    });
    expect(Object.values(result.nextState.cityFeedEventsById)).toEqual([
      expect.objectContaining({
        sourceType: "district_occupy",
        districtId: "district:2",
        payload: expect.objectContaining({
          result: "failure"
        })
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
    expect(result.nextState.resourceStatesById["resource:1"].balances.population).toBe(955);
    expect(result.nextState.districtsById["district:2"].heat).toBe(3);
    expect(result.nextState.policeStatesById["police:1"]?.heat).toBe(3);
    expect(result.nextState.cooldownStatesById["cooldown:1"]?.cooldowns["occupy:global"]).toBe(4);
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
    expect(result.nextState.cooldownStatesById["cooldown:1"]?.cooldowns["occupy:global"]).toBe(9);
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

  it("rejects occupation when the player lacks the population cost", () => {
    const state = createNeutralOccupyState();
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: {
        ...state.resourceStatesById["resource:1"].balances,
        population: 49
      }
    };
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2", null);
    const result = applyCommand(state, createOccupyDistrictCommandFixture(), context);

    expect(result.errors).toMatchObject([
      {
        code: "occupy_not_enough_population"
      }
    ]);
    expect(result.nextState.districtsById["district:2"].ownerPlayerId).toBeNull();
  });

  it("blocks a second district occupation while the player's first occupation is active", () => {
    const state = createNeutralOccupyState();
    const secondTarget = createDistrictFixture({
      id: "district:3",
      ownerPlayerId: null,
      status: "neutral",
      adjacentDistrictIds: ["district:1"]
    });
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      adjacentDistrictIds: ["district:2", secondTarget.id]
    };
    state.districtsById[secondTarget.id] = secondTarget;
    state.root.districtIds.push(secondTarget.id);
    seedSuccessfulSpyIntel(state, "player:1", "district:1", secondTarget.id, null);
    state.cooldownStatesById["cooldown:1"] = {
      id: "cooldown:1",
      ownerType: "player",
      ownerId: "player:1",
      cooldowns: { "occupy:global": 2 },
      version: 1
    };

    const result = applyCommand(state, createOccupyDistrictCommandFixture({
      payload: {
        districtId: secondTarget.id,
        sourceDistrictId: "district:1",
        expectedConflictRevision: secondTarget.conflictRevision
      }
    }), context);

    expect(result.errors[0]?.code).toBe("PLAYER_OCCUPY_OPERATION_ACTIVE");
    expect(result.errors[0]?.message).toContain("Už provádíš obsazení.");
    expect(result.nextState).toBe(state);
  });

  it("keeps population cost gradual while influence overextension continues growing", () => {
    const state = createNeutralOccupyState();
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      influence: 5_000
    };
    state.districtsById["district:3"] = {
      ...state.districtsById["district:1"],
      id: "district:3",
      name: "Second Owned District",
      ownerPlayerId: "player:1",
      adjacentDistrictIds: ["district:2"]
    };
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      adjacentDistrictIds: ["district:2"]
    };
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      adjacentDistrictIds: ["district:1", "district:3", "district:4"]
    };
    state.districtsById["district:4"] = {
      ...state.districtsById["district:2"],
      id: "district:4",
      name: "Next Neutral District",
      ownerPlayerId: null,
      controllerAllianceId: null,
      status: "neutral",
      adjacentDistrictIds: ["district:2"],
      buildingIds: []
    };
    state.root.districtIds.push("district:3", "district:4");
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2", null);

    expect(createDistrictOccupyTargetViews(state, "player:1", "district:1")[0].cost).toEqual({
      influence: 550,
      population: 50
    });
    const result = applyCommand(state, createOccupyDistrictCommandFixture(), context);

    expect(result.errors).toEqual([]);
    expect(result.nextState.resourceStatesById["resource:1"].balances.population).toBe(955);
    expect(createDistrictOccupyTargetViews(result.nextState, "player:1", "district:2")[0]?.cost).toEqual({
      influence: 1050,
      population: 51
    });
  });

  it("rejects repeated occupation of an already owned district", () => {
    const state = createNeutralOccupyState();
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2", null);
    const claimed = applyCommand(state, createOccupyDistrictCommandFixture(), context).nextState;

    const repeated = applyCommand(
      claimed,
      createOccupyDistrictCommandFixture({
        id: "command:occupy:repeat",
        payload: { expectedConflictRevision: claimed.districtsById["district:2"].conflictRevision }
      }),
      context
    );

    expect(repeated.errors).toMatchObject([
      {
        code: "TARGET_NO_LONGER_NEUTRAL"
      }
    ]);
  });

  it("rejects enemy-owned districts and leaves them for attack flow", () => {
    const state = createCombatStateFixture();

    const result = applyCommand(state, createOccupyDistrictCommandFixture(), context);

    expect(result.errors).toMatchObject([
      {
        code: "TARGET_NO_LONGER_NEUTRAL"
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
  state.resourceStatesById["resource:1"] = {
    ...state.resourceStatesById["resource:1"],
    balances: {
      ...state.resourceStatesById["resource:1"].balances,
      population: 1000
    }
  };

  return state;
};

const createAlliedEncirclementOccupyState = (): CoreGameState => {
  const state = createNeutralOccupyState();
  state.playersById["player:1"] = { ...state.playersById["player:1"], allianceId: "alliance:1" };
  state.playersById["player:2"] = { ...state.playersById["player:2"], allianceId: "alliance:1" };
  state.alliancesById["alliance:1"] = createAllianceFixture({ memberIds: ["player:1", "player:2"] });
  state.districtsById["district:1"] = {
    ...state.districtsById["district:1"],
    adjacentDistrictIds: ["district:2"]
  };
  state.districtsById["district:2"] = {
    ...state.districtsById["district:2"],
    adjacentDistrictIds: ["district:1", "district:3"]
  };
  state.districtsById["district:3"] = {
    ...state.districtsById["district:1"],
    id: "district:3",
    name: "Allied District",
    ownerPlayerId: "player:2",
    controllerAllianceId: "alliance:1",
    adjacentDistrictIds: ["district:2"],
    buildingIds: []
  };
  state.root.districtIds.push("district:3");
  seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2", null);
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
