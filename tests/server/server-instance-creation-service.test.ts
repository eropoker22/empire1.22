import { describe, expect, it } from "vitest";
import { PRODUCTION_GAME_LIFECYCLE_PHASES } from "@empire/shared-types";
import { createServerApp } from "../../apps/server/src/app";
import { ensureGameplaySliceSessionResult } from "../../apps/server/src/bootstrap";

describe("server instance creation lifecycle", () => {
  it("creates a free-mode server with config, capacity, lobby status, and shared city map", () => {
    const server = createServerApp();
    const runtime = server.serverInstanceCreationService.createGameServerInstance({
      mode: "free",
      region: "eu-central",
      displayName: "Free Streets EU",
      capacity: 3
    });

    expect(runtime.record.id).toMatch(/^instance:free:eu-central:/u);
    expect(runtime.record.mode).toBe("free");
    expect(runtime.record.status).toBe("lobby");
    expect(runtime.lobby).toEqual({
      displayName: "Free Streets EU",
      region: "eu-central",
      maxPlayers: 3,
      joinPolicy: "open"
    });
    expect(runtime.config.mode).toBe("free");
    expect(runtime.state.root.districtIds).toHaveLength(161);
    expect(countDistrictZones(runtime.state.districtsById)).toMatchObject({
      downtown: 8,
      commercial: 40,
      industrial: 35,
      residential: 48,
      park: 30
    });
    expect(runtime.state.root.playerIds).toHaveLength(0);
  });

  it("creates a free-mode server with caller-selected non-downtown map composition", () => {
    const server = createServerApp();
    const result = server.serverInstanceCreationService.createGameServerInstanceResult({
      mode: "free",
      region: "eu-central",
      mapComposition: {
        downtown: 8,
        commercial: 40,
        industrial: 35,
        residential: 48,
        park: 30
      }
    });

    expect(result.accepted).toBe(true);
    expect(result.runtime?.state.root.districtIds).toHaveLength(161);
    expect(countDistrictZones(result.runtime!.state.districtsById)).toMatchObject({
      downtown: 8,
      commercial: 40,
      industrial: 35,
      residential: 48,
      park: 30
    });
  });

  it("rejects invalid map composition before creating a runtime", () => {
    const server = createServerApp();
    const result = server.serverInstanceCreationService.createGameServerInstanceResult({
      mode: "free",
      region: "eu-central",
      mapComposition: {
        downtown: 8,
        commercial: 50,
        industrial: 50,
        residential: 50,
        park: 20
      }
    });

    expect(result).toEqual({
      accepted: false,
      runtime: null,
      errors: [
        expect.objectContaining({
          code: "server.invalid_map_composition",
          message: "Server map composition must contain exactly 161 districts.",
          details: expect.objectContaining({
            expectedDowntown: 8,
            expectedNonDowntownTotal: 153,
            expectedTotal: 161,
            actualNonDowntownTotal: 170,
            actualTotal: 178
          })
        })
      ]
    });
    expect(server.instanceManager.listInstances()).toHaveLength(0);
  });

  it("rejects explicit duplicate server ids without replacing the runtime", () => {
    const server = createServerApp();
    const first = server.serverInstanceCreationService.createGameServerInstanceResult({
      serverInstanceId: "instance:free:duplicate",
      mode: "free",
      region: "eu-central",
      displayName: "Original"
    });
    const duplicate = server.serverInstanceCreationService.createGameServerInstanceResult({
      serverInstanceId: "instance:free:duplicate",
      mode: "free",
      region: "eu-central",
      displayName: "Replacement"
    });

    expect(first.accepted).toBe(true);
    expect(duplicate).toEqual({
      accepted: false,
      runtime: null,
      errors: [
        {
          code: "server.instance_already_exists",
          message: "Server instance already exists.",
          details: {
            serverInstanceId: "instance:free:duplicate"
          }
        }
      ]
    });
    expect(server.instanceManager.getInstanceById("instance:free:duplicate")?.lobby.displayName).toBe("Original");
  });

  it("rejects unknown load when implicit creation is disabled and preserves dev fallback when enabled", async () => {
    const server = createServerApp();

    const rejected = await ensureGameplaySliceSessionResult(server.instanceManager, {
      serverInstanceId: "instance:free-no-implicit",
      playerId: "player:no-implicit",
      districtId: "district:no-implicit"
    }, {
      allowImplicitInstanceCreation: false
    });

    expect(rejected).toMatchObject({
      accepted: false,
      createdInstance: false,
      joinedPlayer: false,
      errors: [
        {
          code: "server.instance_not_found"
        }
      ]
    });
    expect(server.instanceManager.getInstanceById("instance:free-no-implicit")).toBeUndefined();

    const accepted = await ensureGameplaySliceSessionResult(server.instanceManager, {
      serverInstanceId: "instance:free-implicit",
      playerId: "player:implicit",
      districtId: "district:implicit"
    }, {
      allowImplicitInstanceCreation: true
    });

    expect(accepted).toMatchObject({
      accepted: true,
      createdInstance: true,
      joinedPlayer: true,
      errors: []
    });
    expect(server.instanceManager.getInstanceById("instance:free-implicit")).toBeDefined();
  });

  it("joins players into a pre-created joinable instance and keeps repeated load idempotent", async () => {
    const server = createServerApp();
    const runtime = server.serverInstanceCreationService.createGameServerInstance({
      mode: "free",
      region: "local",
      capacity: 2
    });
    const request = {
      serverInstanceId: runtime.record.id,
      playerId: "player:precreated",
      districtId: "district:precreated"
    };

    const first = await ensureGameplaySliceSessionResult(server.instanceManager, request, {
      allowImplicitInstanceCreation: false
    });
    const second = await ensureGameplaySliceSessionResult(server.instanceManager, request, {
      allowImplicitInstanceCreation: false
    });

    expect(first).toMatchObject({
      accepted: true,
      createdInstance: false,
      joinedPlayer: true,
      errors: []
    });
    expect(second).toMatchObject({
      accepted: true,
      createdInstance: false,
      joinedPlayer: false,
      errors: []
    });
    expect(runtime.state.root.playerIds).toEqual([request.playerId]);
  });

  it("rejects joins for stopped, resolved, and full instances", async () => {
    const server = createServerApp();
    const stopped = server.serverInstanceCreationService.createGameServerInstance({
      mode: "free",
      region: "local",
      displayName: "Stopped"
    });
    server.instanceManager.stopInstance(stopped.record.id);

    const stoppedJoin = await ensureGameplaySliceSessionResult(server.instanceManager, {
      serverInstanceId: stopped.record.id,
      playerId: "player:stopped",
      districtId: "district:stopped"
    }, {
      allowImplicitInstanceCreation: false
    });

    expect(stoppedJoin.errors[0]?.code).toBe("server.instance_not_joinable");

    const resolved = server.serverInstanceCreationService.createGameServerInstance({
      mode: "free",
      region: "local",
      displayName: "Resolved"
    });
    resolved.state.root.phase = PRODUCTION_GAME_LIFECYCLE_PHASES.resolved;

    const resolvedJoin = await ensureGameplaySliceSessionResult(server.instanceManager, {
      serverInstanceId: resolved.record.id,
      playerId: "player:resolved",
      districtId: "district:resolved"
    }, {
      allowImplicitInstanceCreation: false
    });

    expect(resolvedJoin.errors[0]?.code).toBe("server.instance_resolved");

    const full = server.serverInstanceCreationService.createGameServerInstance({
      mode: "free",
      region: "local",
      displayName: "Tiny",
      capacity: 1
    });
    await ensureGameplaySliceSessionResult(server.instanceManager, {
      serverInstanceId: full.record.id,
      playerId: "player:full:1",
      districtId: "district:full:1"
    }, {
      allowImplicitInstanceCreation: false
    });
    const fullJoin = await ensureGameplaySliceSessionResult(server.instanceManager, {
      serverInstanceId: full.record.id,
      playerId: "player:full:2",
      districtId: "district:full:2"
    }, {
      allowImplicitInstanceCreation: false
    });

    expect(fullJoin.errors[0]?.code).toBe("server.player_cap_reached");
    expect(full.record.status).toBe("full");
  });

  it("returns lobby-safe server summaries with player count and joinability", async () => {
    const server = createServerApp();
    const runtime = server.serverInstanceCreationService.createGameServerInstance({
      mode: "free",
      region: "us-east",
      displayName: "US East Free",
      capacity: 1
    });

    const summaries = server.instanceManager.listServerSummaries();

    expect(summaries[0]).not.toHaveProperty("worldSeed");
    expect(summaries).toEqual([
      expect.objectContaining({
        serverInstanceId: runtime.record.id,
        displayName: "US East Free",
        mode: "free",
        region: "us-east",
        status: "lobby",
        playerCount: 0,
        maxPlayers: 1,
        joinable: true,
        map: {
          totalDistricts: 161,
          downtownDistricts: 8,
          commercialDistricts: 40,
          industrialDistricts: 35,
          residentialDistricts: 48,
          parkDistricts: 30
        },
        phase: runtime.state.root.phase
      })
    ]);

    await ensureGameplaySliceSessionResult(server.instanceManager, {
      serverInstanceId: runtime.record.id,
      playerId: "player:summary",
      districtId: "district:summary"
    }, {
      allowImplicitInstanceCreation: false
    });

    const adminSummaries = server.adminMonitoring.listServerSummaries();

    expect(adminSummaries[0]).not.toHaveProperty("worldSeed");
    expect(adminSummaries).toEqual([
      expect.objectContaining({
        serverInstanceId: runtime.record.id,
        status: "full",
        playerCount: 1,
        maxPlayers: 1,
        joinable: false
      })
    ]);
  });
});

const countDistrictZones = (
  districtsById: Record<string, { zone?: string | null }>
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const district of Object.values(districtsById)) {
    const zone = district.zone ?? "unknown";
    counts[zone] = (counts[zone] ?? 0) + 1;
  }
  return counts;
};
