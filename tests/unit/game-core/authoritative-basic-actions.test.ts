import { describe, expect, it } from "vitest";
import {
  applyCommand,
  createDistrictPanelView,
  createDistrictSummaryViews,
  createHeistAttackerTargetCooldownKey,
  createHeistGlobalCooldownKey,
  createRobCooldownKey,
  createRobSourceCooldownKey,
  type CoreGameState
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import {
  createAllianceFixture,
  createCombatStateFixture,
  createDistrictFixture,
  createFixedBuildingFixture,
  seedSuccessfulSpyIntel
} from "../../fixtures/game-state-fixtures";
import {
  createHeistDistrictCommandFixture,
  createPlaceDefenseCommandFixture,
  createRemoveDefenseCommandFixture,
  createRobDistrictCommandFixture
} from "../../fixtures/command-fixtures";
import { resolvePendingDistrictAction } from "../../fixtures/timed-operation-fixtures";

const context = { config: resolveModeConfig("free") };
const robCooldownTicks = context.config.balance.conflict?.robCooldownTicks ?? 0;

describe("authoritative basic action commands", () => {
  it("robs an adjacent neutral district without changing ownership", () => {
    const state = createNeutralRobState();
    state.playersById["player:1"] = { ...state.playersById["player:1"], population: 2 };
    const started = applyCommand(state, createRobDistrictCommandFixture(), context);
    const result = resolvePendingDistrictAction(started.nextState, context);

    expect(started.errors).toEqual([]);
    expect(result.nextState.districtsById["district:2"]).toMatchObject({
      ownerPlayerId: null,
      heat: expect.any(Number),
      neutralLootPool: expect.any(Object)
    });
    const robbedEvent = result.events.find((event) => event.type === "district-robbed");
    const robLoot = (robbedEvent?.payload as Record<string, unknown>).loot as Record<string, number>;
    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(1000 + robLoot.cash);
    expect(result.nextState.policeStatesById["police:1"]?.heat).toBeGreaterThan(0);
    expect(result.nextState.cooldownStatesById["cooldown:1"]?.cooldowns).toMatchObject({
      [createRobCooldownKey("district:2")]: result.nextState.root.tick + robCooldownTicks,
      [createRobSourceCooldownKey("district:1")]: result.nextState.root.tick + robCooldownTicks
    });
    expect(robbedEvent).toMatchObject({
      type: "district-robbed",
      payload: expect.objectContaining({
        sourceDistrictId: "district:1",
        targetDistrictId: "district:2",
        cooldownTicks: context.config.balance.conflict!.robCooldownTicks
      })
    });
  });

  it("blocks repeated robbing on the same target and from the same source while cooldown is active", () => {
    const state = createNeutralRobState();
    state.playersById["player:1"] = { ...state.playersById["player:1"], population: 2 };
    const started = applyCommand(state, createRobDistrictCommandFixture({ id: "command:rob:cooldown:1" }), context);
    const first = resolvePendingDistrictAction(started.nextState, context);

    const sameTarget = applyCommand(first.nextState, createRobDistrictCommandFixture({ id: "command:rob:cooldown:2" }), context);
    expect(sameTarget.errors).toContainEqual(expect.objectContaining({
      code: "rob_cooldown_active",
      details: expect.objectContaining({
        cooldownKey: createRobCooldownKey("district:2"),
        remainingTicks: context.config.balance.conflict!.robCooldownTicks
      })
    }));
    expect(sameTarget.nextState).toBe(first.nextState);

    const otherTargetState = {
      ...first.nextState,
      districtsById: {
        ...first.nextState.districtsById,
        "district:1": {
          ...first.nextState.districtsById["district:1"],
          adjacentDistrictIds: ["district:2", "district:3"]
        },
        "district:3": createDistrictFixture({
          id: "district:3",
          serverInstanceId: first.nextState.serverInstance.id,
          ownerPlayerId: null,
          controllerAllianceId: null,
          status: "neutral",
          adjacentDistrictIds: ["district:1"]
        })
      },
      root: {
        ...first.nextState.root,
        districtIds: [...first.nextState.root.districtIds, "district:3"]
      }
    };
    const sameSource = applyCommand(otherTargetState, createRobDistrictCommandFixture({
      id: "command:rob:cooldown:3",
      payload: {
        targetDistrictId: "district:3",
        sourceDistrictId: "district:1"
      }
    }), context);

    expect(sameSource.errors).toContainEqual(expect.objectContaining({
      code: "rob_cooldown_active",
      details: expect.objectContaining({
        cooldownKey: createRobSourceCooldownKey("district:1"),
        remainingTicks: context.config.balance.conflict!.robCooldownTicks
      })
    }));
  });

  it("rejects robbing enemy districts and leaves state unchanged", () => {
    const state = createCombatStateFixture();
    state.playersById["player:1"] = { ...state.playersById["player:1"], population: 2 };
    const result = applyCommand(state, createRobDistrictCommandFixture(), context);

    expect(result.errors).toMatchObject([{ code: "TARGET_NO_LONGER_NEUTRAL" }]);
    expect(result.nextState).toBe(state);
  });

  it("rejects rob when player does not have enough population", () => {
    const state = createNeutralRobState();
    state.playersById["player:1"] = { ...state.playersById["player:1"], population: 0 };
    const result = applyCommand(state, createRobDistrictCommandFixture(), context);

    expect(result.errors).toMatchObject([{ code: "INSUFFICIENT_POPULATION" }]);
    expect(result.nextState).toBe(state);
  });

  it("heists an adjacent enemy district without changing ownership", () => {
    const state = createHeistState();
    const started = applyCommand(state, createHeistDistrictCommandFixture(), context);
    const result = resolvePendingDistrictAction(started.nextState, context);

    expect(started.errors).toEqual([]);
    expect(result.nextState.districtsById["district:2"].ownerPlayerId).toBe("player:2");
    const heistedEvent = result.events.find((event) => event.type === "district-heisted");
    const heistLoot = (heistedEvent?.payload as Record<string, unknown>).loot as Record<string, number>;
    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(1000 + heistLoot.cash);
    expect(result.nextState.resourceStatesById["resource:2"].balances.cash).toBe(1000 - heistLoot.cash);
    expect(result.nextState.cooldownStatesById["cooldown:1"]?.cooldowns).toMatchObject({
      [createHeistGlobalCooldownKey()]: result.nextState.root.tick + context.config.balance.conflict!.heist!.globalCooldownTicks,
      [createHeistAttackerTargetCooldownKey("district:2")]:
        result.nextState.root.tick + context.config.balance.conflict!.heist!.sameTargetCooldownTicks
    });
    expect(heistedEvent).toMatchObject({
      type: "district-heisted",
      payload: expect.objectContaining({
        style: "balanced",
        populationSent: 10,
        cooldownTicks: context.config.balance.conflict!.heistCooldownTicks
      })
    });
  });

  it("blocks repeated heists while the authoritative cooldown is active", () => {
    const state = createHeistState();
    const started = applyCommand(state, createHeistDistrictCommandFixture({ id: "command:heist:cooldown:1" }), context);
    const first = resolvePendingDistrictAction(started.nextState, context);
    const repeated = applyCommand(first.nextState, createHeistDistrictCommandFixture({
      id: "command:heist:cooldown:2",
      payload: {
        expectedConflictRevision: first.nextState.districtsById["district:2"].conflictRevision
      }
    }), context);

    expect(repeated.errors).toContainEqual(expect.objectContaining({
      code: "TARGET_HEIST_PROTECTED"
    }));
    expect(repeated.nextState).toBe(first.nextState);
  });

  it("rejects heist outcome fields at transport and invalid enemy relation in core", () => {
    const state = createNeutralRobState();
    state.playersById["player:1"] = { ...state.playersById["player:1"], population: 100 };
    const result = applyCommand(state, createHeistDistrictCommandFixture(), context);

    expect(result.errors).toMatchObject([{ code: "TARGET_OWNER_CHANGED" }]);
    expect(result.nextState).toBe(state);
  });

  it("places and removes defense on own district using player inventory", () => {
    const state = createHeistState();
    state.resourceStatesById["resource:1"].balances.barricades = 2;

    const placed = applyCommand(state, createPlaceDefenseCommandFixture(), context);
    expect(placed.errors).toEqual([]);
    expect(placed.nextState.districtsById["district:1"].defenseLoadout.barricades).toBe(1);
    expect(placed.nextState.resourceStatesById["resource:1"].balances.barricades).toBe(1);

    const removed = applyCommand(placed.nextState, createRemoveDefenseCommandFixture(), context);
    expect(removed.errors).toEqual([]);
    expect(removed.nextState.districtsById["district:1"].defenseLoadout.barricades).toBe(0);
    expect(removed.nextState.resourceStatesById["resource:1"].balances.barricades).toBe(2);
  });

  it("allows allied defense with owner-aware contribution records", () => {
    const state = createAlliedDefenseState();
    state.districtsById["district:2"].defenseLoadout = {};
    state.resourceStatesById["resource:1"].balances.barricades = 2;

    const placed = applyCommand(state, createPlaceDefenseCommandFixture({
      payload: {
        targetDistrictId: "district:2",
        defenseItemId: "barricades",
        amount: 1
      }
    }), context);
    expect(placed.errors).toEqual([]);
    expect(placed.nextState.districtsById["district:2"].defenseLoadout.barricades).toBe(
      Number(state.districtsById["district:2"].defenseLoadout.barricades || 0) + 1
    );
    expect(Object.values(placed.nextState.allianceDefenseContributionsById ?? {})[0]).toMatchObject({
      allianceId: "alliance:1",
      ownerPlayerId: "player:1",
      hostPlayerId: "player:2",
      districtId: "district:2",
      itemId: "barricades",
      originalAmount: 1,
      remainingAmount: 1,
      lostAmount: 0,
      returnedAmount: 0,
      status: "active"
    });

    const panel = createDistrictPanelView(state, {
      districtId: "district:2",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      ...minimalPanelConfig()
    });
    expect(panel?.placeDefense).toEqual(expect.objectContaining({
      enabled: true,
      disabledCode: null
    }));
    expect(panel?.capabilities?.canPlaceDefense).toBe(true);
  });

  it("projects rob, heist and defense capabilities into the district panel", () => {
    const state = createHeistState();
    state.resourceStatesById["resource:1"].balances.barricades = 1;
    const panel = createDistrictPanelView(state, {
      districtId: "district:1",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      ...minimalPanelConfig()
    });

    expect(panel?.heistTargets).toEqual([
      expect.objectContaining({
        districtId: "district:2",
        enabled: true,
        disabledCode: null,
        cooldownRemainingTicks: 0,
        expectedSourceVersion: state.districtsById["district:1"].version,
        expectedTargetVersion: state.districtsById["district:2"].version,
        victimProtectionRemainingTicks: 0,
        styles: [
          expect.objectContaining({ style: "stealth", minMembers: 5, maxMembers: 35, lossRisk: "low" }),
          expect.objectContaining({ style: "balanced", minMembers: 10, maxMembers: 70, lossRisk: "high" }),
          expect.objectContaining({ style: "all_in", minMembers: 25, maxMembers: 120, lossRisk: "extreme" })
        ]
      })
    ]);
    expect(panel?.robTargets).toEqual([
      expect.objectContaining({
        districtId: "district:2",
        enabled: false,
        disabledCode: "TARGET_NO_LONGER_NEUTRAL",
        cooldownRemainingTicks: 0
      })
    ]);
    expect(panel?.placeDefense).toEqual(expect.objectContaining({
      enabled: true,
      usedCapacityPoints: 0,
      maxCapacityPoints: 20
    }));
    expect(panel?.securityRevision).toBe(state.districtsById["district:1"].securityRevision);
    expect(panel?.attackTargets).toEqual([
      expect.objectContaining({
        districtId: "district:2",
        expectedSourceVersion: state.districtsById["district:1"].version,
        expectedTargetVersion: state.districtsById["district:2"].version,
        targetSecurityRevision: state.districtsById["district:2"].securityRevision,
        selectedLoadout: state.playersById["player:1"].attackLoadout,
        catastrophePreview: expect.objectContaining({ bazookaBonus: 0.015 })
      })
    ]);
    expect(panel?.spyTargets[0]).toEqual(expect.objectContaining({
      targetSecurityRevision: state.districtsById["district:2"].securityRevision,
      authorizationTtlTicks: context.config.balance.conflict!.spyAuthorizationTtlTicks,
      slots: [
        expect.objectContaining({ slotId: "spy-1", available: true }),
        expect.objectContaining({ slotId: "spy-2", available: true })
      ]
    }));
  });

  it("enables player robbery with the affordable stealth style instead of a fixed ten-member preview", () => {
    const state = createHeistState();
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      population: 5
    };
    const panel = createDistrictPanelView(state, {
      districtId: "district:2",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      ...minimalPanelConfig()
    });

    expect(panel?.targetActions?.heistTargets).toEqual([
      expect.objectContaining({
        districtId: "district:2",
        enabled: true,
        disabledCode: null,
        recommendedStyle: "stealth",
        availablePopulation: 5,
        styles: expect.arrayContaining([
          expect.objectContaining({ style: "stealth", enabled: true, defaultPopulationSent: 5 }),
          expect.objectContaining({ style: "balanced", enabled: false, defaultPopulationSent: 10 })
        ])
      })
    ]);

    const result = applyCommand(state, createHeistDistrictCommandFixture({
      id: "command:heist:stealth-five",
      payload: {
        targetDistrictId: "district:2",
        sourceDistrictId: "district:1",
        style: "stealth",
        populationSent: 5
      }
    }), context);
    expect(result.errors).toEqual([]);
  });

  it("keeps attack setup available when a smaller valid loadout fits the population", () => {
    const state = createHeistState();
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      population: 1,
      attackLoadout: {
        "baseball-bat": 1,
        pistol: 1,
        grenade: 1,
        smg: 1,
        bazooka: 1
      }
    };
    const panel = createDistrictPanelView(state, {
      districtId: "district:1",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      ...minimalPanelConfig()
    });

    expect(panel?.attackTargets[0]).toMatchObject({
      districtId: "district:2",
      enabled: true
    });
  });

  it("projects one opened-target action route and reveals foreign buildings only after successful spy intel", () => {
    const state = createHeistState();
    const foreignBuilding = createFixedBuildingFixture("casino", {
      id: "building:district-2:casino:1",
      districtId: "district:2",
      ownerPlayerId: "player:2"
    });
    state.buildingsById[foreignBuilding.id] = foreignBuilding;
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      buildingIds: [foreignBuilding.id]
    };
    state.notificationsById = {};
    const hiddenPanel = createDistrictPanelView(state, {
      districtId: "district:2",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      ...minimalPanelConfig()
    });
    expect(hiddenPanel).toMatchObject({
      intelKnown: false,
      filledSlotCount: 0,
      buildings: []
    });
    expect(hiddenPanel?.targetActions?.spyTargets).toEqual([
      expect.objectContaining({
        sourceDistrictId: "district:1",
        districtId: "district:2"
      })
    ]);
    expect(hiddenPanel?.targetActions?.spyTargets).toHaveLength(1);
    expect(hiddenPanel?.targetActions?.attackTargets).toEqual([
      expect.objectContaining({
        districtId: "district:2",
        enabled: false,
        disabledCode: "SPY_REQUIRED"
      })
    ]);
    expect(hiddenPanel?.targetActions?.heistTargets).toHaveLength(1);
    expect(hiddenPanel?.targetActions?.robTargets).toEqual([]);
    expect(hiddenPanel?.targetActions?.occupyTargets).toEqual([]);
    expect(hiddenPanel?.trap).toBeNull();
    expect(hiddenPanel?.placeDefense).toBeNull();
    expect(hiddenPanel?.removeDefense).toBeNull();
    expect(
      createDistrictSummaryViews(state, "player:1")
        .find((candidate) => candidate.districtId === "district:2")
        ?.filledSlotCount
    ).toBe(0);

    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2", "player:2");
    const revealedPanel = createDistrictPanelView(state, {
      districtId: "district:2",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      ...minimalPanelConfig()
    });
    expect(revealedPanel).toMatchObject({
      intelKnown: true,
      filledSlotCount: 1
    });
    expect(revealedPanel?.buildings.map((building) => building.buildingId)).toEqual([
      foreignBuilding.id
    ]);
    expect(revealedPanel?.buildings[0]).toMatchObject({
      stats: [],
      specialActions: [],
      actionCooldowns: {},
      actions: [],
      pharmacy: null,
      drugLab: null,
      factory: null,
      armory: null
    });
    expect(revealedPanel?.targetActions?.spyTargets).toEqual([]);
    expect(revealedPanel?.targetActions?.attackTargets).toEqual([
      expect.objectContaining({
        districtId: "district:2",
        enabled: true
      })
    ]);
    expect(
      createDistrictSummaryViews(state, "player:1")
        .find((candidate) => candidate.districtId === "district:2")
        ?.filledSlotCount
    ).toBe(1);
  });

  it("keeps neutral rob visible while disabled and swaps spy for occupy after valid intel", () => {
    const state = createNeutralRobState();
    state.notificationsById = {};
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      population: 0
    };

    const hiddenPanel = createDistrictPanelView(state, {
      districtId: "district:2",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      ...minimalPanelConfig()
    });

    expect(hiddenPanel?.targetActions).toMatchObject({
      attackTargets: [],
      heistTargets: [],
      occupyTargets: [],
      robTargets: [
        expect.objectContaining({
          districtId: "district:2",
          enabled: false,
          disabledCode: "INSUFFICIENT_POPULATION"
        })
      ],
      spyTargets: [
        expect.objectContaining({
          districtId: "district:2",
          enabled: true
        })
      ]
    });

    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2", null);
    const revealedPanel = createDistrictPanelView(state, {
      districtId: "district:2",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      ...minimalPanelConfig()
    });

    expect(revealedPanel?.targetActions?.spyTargets).toEqual([]);
    expect(revealedPanel?.targetActions?.robTargets).toHaveLength(1);
    expect(revealedPanel?.targetActions?.occupyTargets).toEqual([
      expect.objectContaining({
        districtId: "district:2"
      })
    ]);
  });

  it("reveals building type after partial spy intel without granting occupy authorization", () => {
    const state = createNeutralRobState();
    const foreignBuilding = createFixedBuildingFixture("casino", {
      id: "building:district-2:casino:partial",
      districtId: "district:2",
      ownerPlayerId: "player:neutral"
    });
    state.buildingsById[foreignBuilding.id] = foreignBuilding;
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      buildingIds: [foreignBuilding.id]
    };
    state.notificationsById = {};
    seedSuccessfulSpyIntel(state, "player:1", "district:1", "district:2", null);
    const notification = Object.values(state.notificationsById)[0]!;
    notification.payload = {
      ...notification.payload,
      result: "partial",
      purpose: null,
      authorizationScope: null,
      authorizationExpiresAtTick: null,
      revealedType: true,
      revealedDefense: false
    };

    const panel = createDistrictPanelView(state, {
      districtId: "district:2",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      ...minimalPanelConfig()
    });

    expect(panel).toMatchObject({
      intelKnown: true,
      filledSlotCount: 1
    });
    expect(panel?.targetActions?.spyTargets).toHaveLength(1);
    expect(panel?.targetActions?.occupyTargets).toEqual([]);
  });

  it("hides remove defense until the player has a removable deployed item", () => {
    const state = createHeistState();
    const emptyPanel = createDistrictPanelView(state, {
      districtId: "district:1",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      ...minimalPanelConfig()
    });

    expect(emptyPanel?.placeDefense).toMatchObject({
      enabled: false,
      disabledCode: "DEFENSE_ITEM_UNAVAILABLE",
      preferredItemId: null
    });
    expect(emptyPanel?.removeDefense).toBeNull();

    state.resourceStatesById["resource:1"].balances.vest = 1;
    const inventoryPanel = createDistrictPanelView(state, {
      districtId: "district:1",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      ...minimalPanelConfig()
    });
    expect(inventoryPanel?.placeDefense).toMatchObject({
      enabled: true,
      preferredItemId: "vest",
      preferredAmount: 1
    });

    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      defenseLoadout: { vest: 1 }
    };
    const deployedPanel = createDistrictPanelView(state, {
      districtId: "district:1",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      ...minimalPanelConfig()
    });
    expect(deployedPanel?.removeDefense).toMatchObject({
      enabled: true,
      preferredItemId: "vest",
      preferredAmount: 1
    });
  });

  it("selects an enabled source route when several owned districts border the same enemy", () => {
    const state = createHeistState();
    state.resourceStatesById["resource:1"].balances = {
      ...state.resourceStatesById["resource:1"].balances,
      "baseball-bat": 1,
      pistol: 1,
      grenade: 1,
      smg: 1,
      bazooka: 1
    };
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      stabilizingUntilTick: state.root.tick + 10
    };
    state.districtsById["district:3"] = createDistrictFixture({
      id: "district:3",
      serverInstanceId: state.serverInstance.id,
      ownerPlayerId: "player:1",
      status: "claimed",
      adjacentDistrictIds: ["district:2"]
    });
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      adjacentDistrictIds: [...state.districtsById["district:2"].adjacentDistrictIds, "district:3"]
    };
    state.root.districtIds.push("district:3");

    const panel = createDistrictPanelView(state, {
      districtId: "district:2",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      ...minimalPanelConfig()
    });

    expect(panel?.targetActions?.attackTargets).toEqual([
      expect.objectContaining({
        sourceDistrictId: "district:3",
        enabled: true
      })
    ]);
  });

  it("disables rob targets when player has no population", () => {
    const state = createNeutralRobState();
    state.playersById["player:1"] = { ...state.playersById["player:1"], population: 0 };
    const panel = createDistrictPanelView(state, {
      districtId: "district:1",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      ...minimalPanelConfig()
    });

    expect(panel?.robTargets).toEqual([
      expect.objectContaining({
        districtId: "district:2",
        enabled: false,
        disabledCode: "INSUFFICIENT_POPULATION",
        cooldownRemainingTicks: 0,
        lootPoolLevel: "rich",
        exhausted: false,
        heatRisk: { minimum: 1, maximum: 6 }
      })
    ]);
  });

  it("projects rob and heist cooldown reasons into the district panel", () => {
    const robState = createNeutralRobState();
    robState.playersById["player:1"] = { ...robState.playersById["player:1"], population: 2 };
    const robStarted = applyCommand(robState, createRobDistrictCommandFixture({ id: "command:rob:projection" }), context);
    const robbed = resolvePendingDistrictAction(robStarted.nextState, context);
    const robPanel = createDistrictPanelView(robbed.nextState, {
      districtId: "district:1",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      ...minimalPanelConfig()
    });

    expect(robPanel?.robTargets).toEqual([
      expect.objectContaining({
        districtId: "district:2",
        enabled: false,
        disabledCode: "rob_cooldown_active",
        cooldownRemainingTicks: context.config.balance.conflict!.robCooldownTicks,
        disabledReason: expect.stringContaining("obnoví")
      })
    ]);

    const heistStarted = applyCommand(createHeistState(), createHeistDistrictCommandFixture({ id: "command:heist:projection" }), context);
    const heisted = resolvePendingDistrictAction(heistStarted.nextState, context);
    const heistPanel = createDistrictPanelView(heisted.nextState, {
      districtId: "district:1",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      ...minimalPanelConfig()
    });

    expect(heistPanel?.heistTargets).toEqual([
      expect.objectContaining({
        districtId: "district:2",
        enabled: false,
        disabledCode: "TARGET_HEIST_PROTECTED",
        cooldownRemainingTicks: context.config.balance.conflict!.heist!.sameTargetCooldownTicks,
        disabledReason: expect.stringContaining("chráněný")
      })
    ]);
  });
});

const createNeutralRobState = (): CoreGameState => {
  const state = createCombatStateFixture();
  state.districtsById["district:2"] = {
    ...state.districtsById["district:2"],
    ownerPlayerId: null,
    controllerAllianceId: null,
    status: "neutral",
    defenseLoadout: {},
    heat: 0
  };
  return state;
};

const createHeistState = (): CoreGameState => {
  const state = createCombatStateFixture();
  state.playersById["player:1"] = { ...state.playersById["player:1"], population: 100 };
  state.playersById["player:2"] = { ...state.playersById["player:2"], population: 100, resourceStateId: "resource:2" };
  state.resourceStatesById["resource:1"] = {
    ...state.resourceStatesById["resource:1"],
    ownerId: "player:1",
    balances: { cash: 1000 }
  };
  state.resourceStatesById["resource:2"] = {
    ...state.resourceStatesById["resource:1"],
    id: "resource:2",
    ownerId: "player:2",
    balances: { cash: 1000, "dirty-cash": 50 }
  };
  state.districtsById["district:1"] = {
    ...state.districtsById["district:1"],
    defenseLoadout: {}
  };
  return state;
};

const createAlliedDefenseState = (): CoreGameState => {
  const state = createHeistState();
  state.playersById["player:1"] = {
    ...state.playersById["player:1"],
    allianceId: "alliance:1"
  };
  state.playersById["player:2"] = {
    ...state.playersById["player:2"],
    allianceId: "alliance:1"
  };
  state.alliancesById["alliance:1"] = createAllianceFixture({
    id: "alliance:1",
    memberIds: ["player:1", "player:2"],
    ownerPlayerId: "player:1",
    status: "active"
  });
  state.root.allianceIds.push("alliance:1");
  return state;
};

const minimalPanelConfig = () => {
  const config = resolveModeConfig("free");
  return {
    buildCatalog: [],
    config,
    productionCatalog: {},
    craftCatalog: {},
    buildingActionCatalog: {},
    productionMultiplier: 1,
    tickRateMs: config.tickRateMs,
    conflictConfig: config.balance.conflict
  };
};
