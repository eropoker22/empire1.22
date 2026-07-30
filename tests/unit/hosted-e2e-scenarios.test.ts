import { describe, expect, it } from "vitest";
import {
  empireStreetsCityMapDistrictsById,
  resolveModeConfig
} from "@empire/game-config";
import type { InstanceSnapshotDto } from "../../apps/server/src/runtime/persistence";
import {
  createSharedCityDistrict,
  seedSharedCityDistrictBuildings
} from "../../apps/server/src/bootstrap/gameplay-slice-shared-city-entities";
import { createCoreStateFixture } from "../fixtures/game-state-fixtures";
import { applyHostedE2eScenario } from "../../tools/seed/hosted-e2e-scenarios";
import hostedBuildingActionMatrix from "../../tools/seed/hosted-building-action-matrix.json";

const createSnapshot = (): InstanceSnapshotDto => {
  const state = createCoreStateFixture();
  return {
    snapshotId: "snapshot:instance:1:0:1",
    instanceId: "instance:1",
    createdAt: new Date(0).toISOString(),
    tick: state.root.tick,
    mode: "free",
    metadata: {
      instanceId: "instance:1",
      mode: "free",
      configKey: "mode:free",
      status: "lobby",
      createdAt: new Date(0).toISOString(),
      startedAt: null,
      stoppedAt: null,
      crashCount: 0,
      lastCrashAt: null,
      version: 1
    },
    version: {
      schemaVersion: 1,
      coreVersion: "1",
      configVersion: "free"
    },
    integrity: {
      entityCounts: {
        players: 1,
        alliances: 0,
        districts: 1,
        buildings: 0
      },
      rootVersion: state.root.version
    },
    runtime: {
      processedCommandIds: [],
      commandRateLimitWindow: {
        tick: 0,
        commandCountsByPlayerId: {}
      }
    },
    lobby: {
      displayName: "Fixture",
      region: "eu-central",
      capacity: 20,
      joinPolicy: "open"
    },
    state
  };
};

describe("hosted E2E scenario seeding", () => {
  it("moves the City Events scenario to the canonical 18:00 boundary", () => {
    const source = createSnapshot();
    source.state.playerCityEventStatesByPlayerId = {
      "player:1": {
        version: 1,
        offersByAgent: { victor: [], leon: [], nyra: [] },
        activeRun: null,
        attemptedOfferIds: [],
        pendingRewards: [],
        lastProcessedScheduleWindowByAgent: {}
      }
    };
    const seeded = applyHostedE2eScenario(
      source,
      "city-events",
      "2026-07-29T22:00:00.000Z"
    );
    const at1800 = resolveModeConfig("free").balance.dayNight!.phases.day.durationTicks;

    expect(seeded.tick).toBe(at1800);
    expect(seeded.state.root.tick).toBe(at1800);
    expect(seeded.state.serverInstance.currentTick).toBe(at1800);
    expect(seeded.state.playerCityEventStatesByPlayerId).toEqual({});
    expect(seeded.integrity.rootVersion).toBe(source.integrity.rootVersion + 1);
    expect(source.state.root.tick).toBe(0);
  });

  it("keeps the realistic new-player scenario state intact except for snapshot versioning", () => {
    const source = createSnapshot();
    const seeded = applyHostedE2eScenario(
      source,
      "realistic-new-player",
      "2026-07-29T22:00:00.000Z"
    );

    expect(seeded.state.root.tick).toBe(source.state.root.tick);
    expect(seeded.state.root.version).toBe(source.state.root.version + 1);
    expect(seeded.state.playersById).toEqual(source.state.playersById);
  });

  it.each([
    ["building-actions-day", "day"],
    ["building-actions-night", "night"]
  ] as const)("prepares the guarded %s fixture from canonical map entities", (scenario, phase) => {
    const source = createBuildingActionSnapshot();
    const original = structuredClone(source);
    const seeded = applyHostedE2eScenario(
      source,
      scenario,
      "2026-07-29T22:00:00.000Z"
    );
    const player = Object.values(seeded.state.playersById)[0];
    const expectedTick = phase === "night"
      ? resolveModeConfig("free").balance.dayNight!.phases.day.durationTicks + 5
      : 5;

    expect(source).toEqual(original);
    expect(seeded.state.root.tick).toBe(expectedTick);
    expect(seeded.state.serverInstance.currentTick).toBe(expectedTick);
    expect(seeded.state.resourceStatesById[player.resourceStateId].balances).toMatchObject({
      cash: 1_000_000,
      "dirty-cash": 1_000_000,
      "neon-dust": 100
    });
    expect(player.recoveryPool?.[0]).toMatchObject({
      itemType: "population",
      lostAtTick: expectedTick
    });
    expect(player.salvagePool?.[0]).toMatchObject({
      itemId: "metal-parts",
      lostAtTick: expectedTick
    });

    for (const entry of hostedBuildingActionMatrix.filter((candidate) => candidate.phase === phase)) {
      const district = seeded.state.districtsById[entry.districtId];
      const building = district.buildingIds
        .map((buildingId) => seeded.state.buildingsById[buildingId])
        .find((candidate) => candidate.buildingTypeId === entry.buildingTypeId);
      expect(district.ownerPlayerId, entry.actionId).toBe(player.id);
      expect(district.status, entry.actionId).toBe("claimed");
      expect(building, entry.actionId).toMatchObject({
        buildingTypeId: entry.buildingTypeId,
        ownerPlayerId: player.id,
        status: "active",
        actionCooldowns: {}
      });
      if (entry.actionId === "collect_convenience_store_population") {
        const populationCapacity = resolveModeConfig("free").balance.convenienceStore!.basePopulationCapacity;
        expect(building?.metadata?.convenienceStore).toMatchObject({
          storedPopulation: populationCapacity,
          populationCapacity,
          populationWasFull: true
        });
      }
    }
  });
});

const createBuildingActionSnapshot = (): InstanceSnapshotDto => {
  const snapshot = createSnapshot();
  const districtIds = Array.from(new Set(
    hostedBuildingActionMatrix.map((entry) => entry.districtId)
  ));
  for (const districtId of districtIds) {
    const manifestDistrict = empireStreetsCityMapDistrictsById.get(districtId);
    if (!manifestDistrict) throw new Error(`Missing canonical district ${districtId}.`);
    const district = createSharedCityDistrict({
      instanceId: snapshot.instanceId,
      districtId,
      name: manifestDistrict.name,
      ownerPlayerId: null,
      slotCount: 4,
      zone: manifestDistrict.zone,
      buildingSetKey: manifestDistrict.buildingSetKey,
      adjacentDistrictIds: manifestDistrict.neighborIds
    });
    snapshot.state.districtsById[district.id] = district;
    seedSharedCityDistrictBuildings(snapshot.state, snapshot.instanceId, district, {});
  }
  snapshot.state.root.districtIds = Object.keys(snapshot.state.districtsById);
  snapshot.integrity.entityCounts.districts = Object.keys(snapshot.state.districtsById).length;
  snapshot.integrity.entityCounts.buildings = Object.keys(snapshot.state.buildingsById).length;
  return snapshot;
};
