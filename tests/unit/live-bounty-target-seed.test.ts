import { describe, expect, it } from "vitest";
import { createBountyReadModel, createDistrictSummaryViews, createInitialState } from "@empire/game-core";
import { PRODUCTION_GAME_LIFECYCLE_PHASES } from "@empire/shared-types";
import { createServerApp } from "../../apps/server/src/app";
import { ensureGameplaySliceSessionResult } from "../../apps/server/src/bootstrap";
import { ensureGameplaySliceMembershipInState } from "../../apps/server/src/bootstrap/gameplay-slice-session-membership";
import { addPlayerToGameplaySliceState } from "../../apps/server/src/bootstrap/gameplay-slice-session-seed";

describe("live bounty target seed", () => {
  it("adds an authoritative target player for bounty in live phase", () => {
    const state = createInitialState("instance:live-bounty", "free");
    state.root.phase = PRODUCTION_GAME_LIFECYCLE_PHASES.live;

    addPlayerToGameplaySliceState(state, {
      serverInstanceId: "instance:live-bounty",
      playerId: "player:current",
      factionId: "mafian",
      mode: "free"
    });

    const view = createBountyReadModel(state, "player:current");
    const target = view.eligibleTargets.find((entry) => entry.playerId === "player:live-bounty-target");

    expect(target).toMatchObject({
      name: "LowKeyLad",
      canTarget: true,
      activeDistrictCount: 1
    });
    expect(view.eligibleTargets.filter((entry) => entry.canTarget).map((entry) => entry.name)).toEqual(
      expect.arrayContaining(["LowKeyLad", "NeonViktor", "SableQueen"])
    );
    expect(target?.districts).toHaveLength(1);
    expect(state.districtsById[target!.districts[0]!.districtId]?.ownerPlayerId).toBe("player:live-bounty-target");
    expect(state.root.playerIds).not.toContain("player:live-bounty-target");
  });

  it("adds the live bounty target after implicit instance start", async () => {
    const server = createServerApp();
    const request = {
      serverInstanceId: "instance:live-bounty-implicit",
      playerId: "player:current",
      districtId: null,
      factionId: "mafian"
    };

    const result = await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const runtime = server.instanceManager.getInstanceById(request.serverInstanceId);

    expect(result.accepted).toBe(true);
    expect(runtime?.state.root.phase).toBe(PRODUCTION_GAME_LIFECYCLE_PHASES.live);

    const view = createBountyReadModel(runtime!.state, request.playerId);
    const target = view.eligibleTargets.find((entry) => entry.playerId === "player:live-bounty-target");

    expect(target).toMatchObject({
      name: "LowKeyLad",
      canTarget: true,
      activeDistrictCount: 1
    });
    expect(runtime!.state.root.playerIds).toEqual([request.playerId]);
  });

  it("repairs an existing live session on refresh", () => {
    const state = createInitialState("instance:live-bounty-refresh", "free");
    addPlayerToGameplaySliceState(state, {
      serverInstanceId: "instance:live-bounty-refresh",
      playerId: "player:current",
      factionId: "mafian",
      mode: "free"
    });
    state.root.phase = PRODUCTION_GAME_LIFECYCLE_PHASES.live;

    const result = ensureGameplaySliceMembershipInState(state, {
      serverInstanceId: "instance:live-bounty-refresh",
      playerId: "player:current",
      factionId: "mafian",
      mode: "free"
    });
    const view = createBountyReadModel(result.state, "player:current");
    const target = view.eligibleTargets.find((entry) => entry.playerId === "player:live-bounty-target");

    expect(result.accepted).toBe(true);
    expect(result.joinedPlayer).toBe(false);
    expect(target?.name).toBe("LowKeyLad");
    expect(target?.canTarget).toBe(true);
  });

  it("projects dev demo bounty targets onto the map district summary", async () => {
    const server = createServerApp();
    const request = {
      serverInstanceId: "instance:live-bounty-map-demo",
      playerId: "player:current",
      districtId: null,
      factionId: "mafian"
    };

    await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const runtime = server.instanceManager.getInstanceById(request.serverInstanceId);
    const view = createBountyReadModel(runtime!.state, request.playerId);
    const mapDistricts = createDistrictSummaryViews(runtime!.state, request.playerId);

    const demoTargetIds = view.eligibleTargets
      .filter((entry) => ["LowKeyLad", "NeonViktor", "SableQueen"].includes(entry.name))
      .map((entry) => entry.playerId);

    expect(demoTargetIds).toHaveLength(3);
    for (const playerId of demoTargetIds) {
      expect(mapDistricts.some((district) => district.ownerPlayerId === playerId && district.ownerColor)).toBe(true);
      expect(runtime!.state.root.playerIds).not.toContain(playerId);
    }
  });
});
