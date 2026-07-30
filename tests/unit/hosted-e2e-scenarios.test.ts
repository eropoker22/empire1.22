import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import type { InstanceSnapshotDto } from "../../apps/server/src/runtime/persistence";
import { createCoreStateFixture } from "../fixtures/game-state-fixtures";
import { applyHostedE2eScenario } from "../../tools/seed/hosted-e2e-scenarios";

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
});
