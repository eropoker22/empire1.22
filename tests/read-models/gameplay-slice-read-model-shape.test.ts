import { describe, expect, it } from "vitest";
import type { GameplaySliceView } from "@empire/shared-types";
import { createServerApp } from "../../apps/server/src/app";
import { createFixedClock } from "../../apps/server/src/runtime/scheduling/clock";
import { createDistrictBuildingSliceSeed } from "../../tools/seed/src";
import {
  createAttackDistrictCommandFixture,
  createRobDistrictCommandFixture,
  createSpyDistrictCommandFixture
} from "../fixtures/command-fixtures";
import {
  createCombatStateFixture,
  createDistrictFixture
} from "../fixtures/game-state-fixtures";
import {
  createDevGameplaySession,
  loadWithDevGameplaySession
} from "../helpers/gameplay-session-test-helpers";
import { advanceStateToTick } from "../fixtures/timed-operation-fixtures";

describe("gameplay slice read model contract", () => {
  it("projects a fresh joined player without exposing core internals", async () => {
    const server = createServerApp({
      clock: createFixedClock("2026-05-21T00:00:00.000Z")
    });
    const request = {
      serverInstanceId: "instance:free:read-model:fresh",
      playerId: "player:read-model:fresh",
      districtId: "district:server-assigned",
      factionId: "mafian"
    };

    const { response } = await loadWithDevGameplaySession(server, request);
    const view = expectReadModel(response);

    expectNoCoreInternals(view);
    expect(response.metadata).toEqual({
      serverTick: view.server.currentTick,
      stateVersion: view.server.stateVersion
    });
    expect(summarizeSlice(view)).toMatchInlineSnapshot(`
      {
        "cityFeed": {
          "currentPlayer": 0,
          "selectedDistrict": 0,
        },
        "commandHints": {
          "availableAttackTargetCount": 0,
          "availableBuildingActionCount": 0,
          "availableOccupyTargetCount": 0,
          "availableSpyTargetCount": 0,
          "cooldowns": [],
          "disabledReasonCount": 0,
          "selectedDistrictId": null,
        },
        "district": null,
        "map": {
          "districtCount": 161,
          "selectedSummary": null,
        },
        "player": {
          "factionId": "mafian",
          "homeDistrictId": null,
          "playerId": "player:read-model:fresh",
          "resourceBalances": {
            "biomass": 6,
            "cash": 1500,
            "chemicals": 10,
            "dirty-cash": 300,
            "metal-parts": 8,
            "pistol": 2,
            "smg": 1,
            "tech-core": 2,
          },
          "resources": {
            "cleanCash": 1500,
            "dirtyCash": 300,
            "influence": 0,
            "population": 0,
          },
        },
        "reports": [],
        "server": {
          "currentTick": 0,
          "generatedAt": "2026-05-21T00:00:00.000Z",
          "mapManifestHash": "fnv1a32:a3aa0021",
          "mapManifestId": "empire-streets-city",
          "mapManifestVersion": 1,
          "maxPlayersPerServer": 20,
          "mode": "free",
          "selectedDistrictId": null,
          "serverInstanceId": "instance:free:read-model:fresh",
          "stateVersion": 4,
          "status": "running",
        },
      }
    `);
  });

  it("projects selected own, neutral, and enemy districts with public ownership/status fields", async () => {
    const server = createServerApp({
      clock: createFixedClock("2026-05-21T00:00:00.000Z")
    });
    const instanceId = "instance:read-model:districts";
    const runtime = server.instanceManager.createInstance(instanceId, "free");

    runtime.state = createCombatStateFixture(instanceId);
    runtime.state.districtsById["district:1"] = {
      ...runtime.state.districtsById["district:1"]!,
      adjacentDistrictIds: ["district:2", "district:3"]
    };
    runtime.state.districtsById["district:3"] = createDistrictFixture({
      id: "district:3",
      serverInstanceId: instanceId,
      name: "Neutral Yard",
      status: "neutral",
      ownerPlayerId: null,
      adjacentDistrictIds: ["district:1"]
    });
    runtime.state.root.districtIds.push("district:3");
    server.instanceManager.startInstance(instanceId);
    runtime.state.districtsById["district:3"] = {
      ...runtime.state.districtsById["district:3"]!,
      ownerPlayerId: null,
      status: "neutral"
    };

    const session = await createDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId: "player:1"
    });
    const ownResponse = await server.gameplaySliceTransport.load({
      ...session.loadRequest,
      districtId: "district:1"
    });
    runtime.state.districtsById["district:3"] = {
      ...runtime.state.districtsById["district:3"]!,
      ownerPlayerId: null,
      status: "neutral"
    };
    const neutralResponse = await server.gameplaySliceTransport.load({
      ...session.loadRequest,
      districtId: "district:3"
    });
    const enemyResponse = await server.gameplaySliceTransport.load({
      ...session.loadRequest,
      districtId: "district:2"
    });
    const own = expectReadModel(ownResponse);
    const neutral = expectReadModel(neutralResponse);
    const enemy = expectReadModel(enemyResponse);

    expect(own.economyRates?.selectedDistrict?.districtId)
      .toBe("district:1");
    expect(neutral.economyRates?.selectedDistrict).toBeNull();
    expect(enemy.economyRates?.selectedDistrict).toBeNull();
    expect([
      summarizeSlice(own).district,
      summarizeSlice(neutral).district,
      summarizeSlice(enemy).district
    ]).toMatchInlineSnapshot(`
      [
        {
          "actionCounts": [],
          "buildingCount": 0,
          "districtId": "district:1",
          "isOwnedByPlayer": true,
          "ownerPlayerId": "player:1",
          "status": "claimed",
        },
        {
          "actionCounts": [],
          "buildingCount": 0,
          "districtId": "district:3",
          "isOwnedByPlayer": false,
          "ownerPlayerId": null,
          "status": "neutral",
        },
        {
          "actionCounts": [],
          "buildingCount": 0,
          "districtId": "district:2",
          "isOwnedByPlayer": false,
          "ownerPlayerId": "player:2",
          "status": "claimed",
        },
      ]
    `);
  });

  it("projects Factory production without legacy special actions", async () => {
    const server = createServerApp({
      clock: createFixedClock("2026-05-21T00:00:00.000Z")
    });
    const instanceId = "instance:read-model:collect";
    const playerId = "player:read-model:collect";
    const districtId = "district:read-model:collect";
    const runtime = server.instanceManager.createInstance(instanceId, "free");

    runtime.state = createDistrictBuildingSliceSeed({
      instanceId,
      playerId,
      districtId,
      mode: "free",
      homeDistrict: {
        zone: "industrial",
        buildingSetKey: "ind-early-1"
      }
    });
    server.instanceManager.startInstance(instanceId);
    const { response } = await loadWithDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId,
      districtId,
      factionId: "mafian"
    });
    const load = expectReadModel(response);
    const factory = load.district?.buildings.find((building) => building.buildingTypeId === "factory");

    expect(factory?.actions).toEqual([]);
    expect(load.commandHints.availableBuildingActionCount).toBe(0);
    expect(load.player.factoryProduction).toMatchObject({
      buildingId: factory?.buildingId,
      districtId,
      productionLines: expect.any(Array)
    });
    expect(load.economyRates).toMatchObject({
      basis: "next-authoritative-economy-tick",
      tickRateMs: runtime.config.tickRateMs,
      fromTick: load.server.currentTick,
      toTick: load.server.currentTick + 1,
      playerBalancePerTick: {
        population: 0,
        chemicals: 0,
        "metal-parts": 0
      },
      selectedDistrict: {
        districtId,
        cleanCashPerTick: expect.any(Number),
        dirtyCashPerTick: expect.any(Number),
        cleanCashPerHour: expect.any(Number),
        dirtyCashPerHour: expect.any(Number),
        passivePopulationSources: [],
        passivePopulationSourceSummary:
          "Pasivní populace: 0 / h · žádný zdroj v districtu"
      }
    });
  });

  it("keeps a pending robbery effect private and removes it at its resolve tick", async () => {
    const server = createServerApp({
      clock: createFixedClock("2026-05-21T00:00:00.000Z")
    });
    const instanceId = "instance:read-model:robbery-effect";
    const runtime = server.instanceManager.createInstance(instanceId, "free");
    runtime.state = createCombatStateFixture(instanceId);
    const seededIntelId = "notification:spy-success:player:1:district:2";
    delete runtime.state.notificationsById[seededIntelId];
    runtime.state.root.notificationIds = runtime.state.root.notificationIds
      .filter((notificationId) => notificationId !== seededIntelId);
    runtime.state.districtsById["district:2"] = {
      ...runtime.state.districtsById["district:2"]!,
      ownerPlayerId: null,
      controllerAllianceId: null,
      status: "neutral",
      defenseLoadout: {}
    };
    server.instanceManager.startInstance(instanceId);

    const attackerSession = await createDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId: "player:1",
      districtId: "district:1"
    });
    const defenderSession = await createDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId: "player:2",
      districtId: "district:2"
    });
    const started = await server.gameplaySliceTransport.submit({
      sessionToken: attackerSession.sessionToken,
      focusDistrictId: "district:1",
      command: createRobDistrictCommandFixture({
        id: "command:read-model:rob",
        serverInstanceId: instanceId,
        playerId: "player:1",
        payload: {
          targetDistrictId: "district:2",
          sourceDistrictId: "district:1",
          expectedConflictRevision: runtime.state.districtsById["district:2"]!.conflictRevision
        }
      })
    });
    expect(started.accepted, started.errors[0]?.code).toBe(true);
    const operation = Object.values(runtime.state.pendingDistrictActionOperationsById ?? {})
      .find((candidate) => candidate.command.id === "command:read-model:rob");
    expect(operation).toBeDefined();

    const attacker = expectReadModel(started);
    const defender = expectReadModel(await server.gameplaySliceTransport.load(defenderSession.loadRequest));

    expect(attacker.reports).not.toContainEqual(expect.objectContaining({ reportType: "rob" }));
    expect(attacker.mapEffects).toContainEqual(expect.objectContaining({
      effectId: operation!.id,
      type: "robbery",
      source: "server-pending-operation",
      playerId: "player:1",
      districtId: "district:2",
      startedAtTick: operation!.issuedAtTick,
      expiresAtTick: operation!.resolveAtTick
    }));
    expect(defender.mapEffects).not.toContainEqual(expect.objectContaining({
      effectId: operation!.id
    }));

    runtime.state = stageImmediatelyBeforeTick(runtime.state, operation!.resolveAtTick);
    const beforeDue = expectReadModel(await server.gameplaySliceTransport.load(attackerSession.loadRequest));
    expect(beforeDue.mapEffects).toContainEqual(expect.objectContaining({ effectId: operation!.id }));
    expect(beforeDue.reports).not.toContainEqual(expect.objectContaining({ reportType: "rob" }));

    runtime.state = advanceStateToTick(runtime.state, operation!.resolveAtTick, {
      config: runtime.config
    });
    const resolved = expectReadModel(await server.gameplaySliceTransport.load(attackerSession.loadRequest));
    expect(resolved.mapEffects).not.toContainEqual(expect.objectContaining({ effectId: operation!.id }));
    expect(resolved.reports).toContainEqual(expect.objectContaining({
      reportId: "report:command:read-model:rob:rob",
      reportType: "rob"
    }));
  }, 30_000);

  it("projects reports and city feed after spy and attack events", async () => {
    const server = createServerApp({
      clock: createFixedClock("2026-05-21T00:00:00.000Z")
    });
    const instanceId = "instance:read-model:conflict";
    const runtime = server.instanceManager.createInstance(instanceId, "free");

    runtime.state = createCombatStateFixture(instanceId);
    const seededIntelId = "notification:spy-success:player:1:district:2";
    delete runtime.state.notificationsById[seededIntelId];
    runtime.state.root.notificationIds = runtime.state.root.notificationIds
      .filter((notificationId) => notificationId !== seededIntelId);
    runtime.state.districtsById["district:2"] = {
      ...runtime.state.districtsById["district:2"]!,
      defenseLoadout: {}
    };
    server.instanceManager.startInstance(instanceId);

    const session = await createDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId: "player:1",
      districtId: "district:1"
    });
    await server.gameplaySliceTransport.load(session.loadRequest);
    const spy = await server.gameplaySliceTransport.submit({
      sessionToken: session.sessionToken,
      focusDistrictId: "district:1",
      command: createSpyDistrictCommandFixture({
        id: "command:read-model:spy",
        serverInstanceId: instanceId,
        playerId: "player:1",
        payload: {
          districtId: "district:2",
          sourceDistrictId: "district:1"
        }
      })
    });
    expect(spy.accepted, spy.errors[0]?.code).toBe(true);
    const spyStartedView = expectReadModel(spy);
    expect(spyStartedView.reports).not.toContainEqual(expect.objectContaining({
      reportId: "report:command:read-model:spy:spy"
    }));
    const pendingSpy = Object.values(runtime.state.pendingDistrictActionOperationsById ?? {})
      .find((candidate) => candidate.command.id === "command:read-model:spy");
    expect(pendingSpy).toBeDefined();
    expect(spyStartedView.mapEffects).toContainEqual(expect.objectContaining({
      effectId: pendingSpy!.id,
      type: "spy",
      expiresAtTick: pendingSpy!.resolveAtTick
    }));

    runtime.state = stageImmediatelyBeforeTick(runtime.state, pendingSpy!.resolveAtTick);
    const spyBeforeDueView = expectReadModel(await server.gameplaySliceTransport.load(session.loadRequest));
    expect(spyBeforeDueView.mapEffects).toContainEqual(expect.objectContaining({ effectId: pendingSpy!.id }));
    expect(spyBeforeDueView.reports).not.toContainEqual(expect.objectContaining({
      reportId: "report:command:read-model:spy:spy"
    }));
    runtime.state = advanceStateToTick(runtime.state, pendingSpy!.resolveAtTick, {
      config: runtime.config
    });
    const spyResolvedView = expectReadModel(await server.gameplaySliceTransport.load(session.loadRequest));
    expect(spyResolvedView.reports).toContainEqual(expect.objectContaining({
      reportId: "report:command:read-model:spy:spy",
      actionType: "spy-district"
    }));

    const attack = await server.gameplaySliceTransport.submit({
      sessionToken: session.sessionToken,
      focusDistrictId: "district:1",
      command: createAttackDistrictCommandFixture({
        id: "command:read-model:attack",
        serverInstanceId: instanceId,
        playerId: "player:1",
        payload: {
          districtId: "district:2",
          sourceDistrictId: "district:1",
          weapons: { "baseball-bat": 1 },
          expectedConflictRevision: runtime.state.districtsById["district:2"]!.conflictRevision
        }
      })
    });
    expect(attack.accepted, attack.errors[0]?.code).toBe(true);
    const attackStartedView = expectReadModel(attack);
    expect(attackStartedView.reports).not.toContainEqual(expect.objectContaining({
      reportId: "report:command:read-model:attack:battle:player:1"
    }));
    const pendingAttack = Object.values(runtime.state.pendingDistrictActionOperationsById ?? {})
      .find((candidate) => candidate.command.id === "command:read-model:attack");
    expect(pendingAttack).toBeDefined();
    const pendingAttackEffect = attackStartedView.mapEffects.find((effect) =>
      effect.type === "attack" && effect.districtId === "district:2"
    );
    expect(pendingAttackEffect).toMatchObject({
      type: "attack",
      source: "server-public-operation",
      playerId: "player:1",
      startedAtTick: pendingAttack!.issuedAtTick,
      expiresAtTick: pendingAttack!.resolveAtTick
    });

    runtime.state = stageImmediatelyBeforeTick(runtime.state, pendingAttack!.resolveAtTick);
    const attackBeforeDueView = expectReadModel(await server.gameplaySliceTransport.load(session.loadRequest));
    expect(attackBeforeDueView.mapEffects).toContainEqual(expect.objectContaining({
      effectId: pendingAttackEffect!.effectId
    }));
    expect(attackBeforeDueView.reports).not.toContainEqual(expect.objectContaining({
      reportId: "report:command:read-model:attack:battle:player:1"
    }));
    runtime.state = advanceStateToTick(runtime.state, pendingAttack!.resolveAtTick, {
      config: runtime.config
    });
    const attackView = expectReadModel(await server.gameplaySliceTransport.load(session.loadRequest));
    expect(attackView.mapEffects).not.toContainEqual(expect.objectContaining({
      effectId: pendingAttackEffect!.effectId
    }));

    expect(summarizeSlice(attackView).reports).toMatchInlineSnapshot(`
      [
        {
          "actionType": "attack-district",
          "reportType": "battle",
          "result": "success",
          "targetDistrictId": "district:2",
        },
        {
          "actionType": "spy-district",
          "reportType": "spy",
          "result": "success",
          "targetDistrictId": "district:2",
        },
      ]
    `);
    const canonicalAttackFeed = attackView.cityFeed?.currentPlayerFeed.filter((event) =>
      event.districtId === "district:2"
      && event.playerId === "player:1"
      && (event.sourceType === "attack" || event.sourceType === "district_capture")
    ) ?? [];
    expect(canonicalAttackFeed).toHaveLength(2);
    expect(canonicalAttackFeed).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceType: "attack" }),
      expect.objectContaining({ sourceType: "district_capture" })
    ]));
    expect(attackView.districts.find(
      (district) => district.districtId === "district:2"
    )).toMatchObject({
      ownerPlayerId: "player:1",
      isOwnedByPlayer: true
    });
  }, 30_000);
});

const expectReadModel = (response: { readModel: GameplaySliceView | null }): GameplaySliceView => {
  expect(response.readModel).not.toBeNull();
  return response.readModel!;
};

const summarizeSlice = (view: GameplaySliceView) => ({
  server: view.server,
  player: {
    playerId: view.player.playerId,
    factionId: view.player.factionId,
    homeDistrictId: view.player.homeDistrictId,
    resourceBalances: pickPositive(view.player.resourceBalances),
    resources: {
      cleanCash: roundNumber(view.player.economy.cleanCash),
      dirtyCash: roundNumber(view.player.economy.dirtyCash),
      influence: roundNumber(view.player.economy.influence),
      population: roundNumber(view.player.economy.population)
    }
  },
  map: {
    districtCount: view.districts.length,
    selectedSummary: findSelectedDistrictSummary(view)
      ? {
          ownerPlayerId: findSelectedDistrictSummary(view)!.ownerPlayerId,
          isOwnedByPlayer: findSelectedDistrictSummary(view)!.isOwnedByPlayer,
          status: findSelectedDistrictSummary(view)!.status
        }
      : null
  },
  district: view.district
    ? {
        districtId: view.district.districtId,
        status: view.district.status,
        ownerPlayerId: view.district.ownerPlayerId,
        isOwnedByPlayer: view.district.isOwnedByPlayer,
        buildingCount: view.district.buildings.length,
        actionCounts: view.district.buildings.map((building) => ({
          buildingTypeId: building.buildingTypeId,
          enabled: building.actions.filter((action) => action.enabled).length,
          total: building.actions.length
        }))
      }
    : null,
  commandHints: {
    selectedDistrictId: view.commandHints.selectedDistrictId,
    availableBuildingActionCount: view.commandHints.availableBuildingActionCount,
    availableSpyTargetCount: view.commandHints.availableSpyTargetCount,
    availableAttackTargetCount: view.commandHints.availableAttackTargetCount,
    availableOccupyTargetCount: view.commandHints.availableOccupyTargetCount,
    cooldowns: view.commandHints.cooldowns,
    disabledReasonCount: view.commandHints.disabledReasons.length
  },
  reports: view.reports.map((report) => ({
    reportType: report.reportType,
    actionType: report.actionType,
    result: report.result,
    targetDistrictId: "targetDistrictId" in report ? report.targetDistrictId : report.districtId
  })),
  cityFeed: {
    currentPlayer: view.cityFeed?.currentPlayerFeed.length ?? 0,
    selectedDistrict: view.cityFeed?.selectedDistrictFeed.length ?? 0
  }
});

const pickPositive = (balances: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(balances)
    .filter(([, amount]) => amount > 0)
    .map(([key, amount]) => [key, roundNumber(amount)]));

const roundNumber = (value: number): number => Math.round(value * 1000) / 1000;

const findSelectedDistrictSummary = (view: GameplaySliceView) =>
  view.districts.find((district) => district.districtId === view.district?.districtId);

const stageImmediatelyBeforeTick = <State extends { root: { tick: number; version: number } }>(
  state: State,
  targetTick: number
): State => ({
  ...state,
  root: {
    ...state.root,
    tick: Math.max(state.root.tick, targetTick - 1),
    version: state.root.version + 1
  }
});

const expectNoCoreInternals = (view: GameplaySliceView): void => {
  const serialized = JSON.stringify(view);
  for (const internalKey of [
    "playersById",
    "districtsById",
    "buildingsById",
    "resourceStatesById",
    "root",
    "processedCommandIds"
  ]) {
    expect(serialized).not.toContain(internalKey);
  }
};
