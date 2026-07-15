import { describe, expect, it } from "vitest";
import type { GameplaySliceView } from "@empire/shared-types";
import { createServerApp } from "../../apps/server/src/app";
import { createFixedClock } from "../../apps/server/src/runtime/scheduling/clock";
import { createDistrictBuildingSliceSeed } from "../../tools/seed/src";
import {
  createAttackDistrictCommandFixture,
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
            "gangMembers": 0,
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
          "stateVersion": 2,
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
  });

  it("projects reports and city feed after spy and attack events", async () => {
    const server = createServerApp({
      clock: createFixedClock("2026-05-21T00:00:00.000Z")
    });
    const instanceId = "instance:read-model:conflict";
    const runtime = server.instanceManager.createInstance(instanceId, "free");

    runtime.state = createCombatStateFixture(instanceId);
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
    const load = await server.gameplaySliceTransport.load(session.loadRequest);
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
          weapons: { "baseball-bat": 1 }
        }
      })
    });
    const attackView = expectReadModel(attack);

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
          "result": "partial",
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
    expect(summarizeSlice(attackView).cityFeed).toMatchInlineSnapshot(`
      {
        "currentPlayer": 2,
        "selectedDistrict": 0,
      }
    `);
    expect(attackView.districts.find(
      (district) => district.districtId === "district:2"
    )).toMatchObject({
      ownerPlayerId: "player:1",
      isOwnedByPlayer: true
    });
  });
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
      population: roundNumber(view.player.economy.population),
      gangMembers: roundNumber(view.player.economy.gangMembers)
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
