import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { checkGameStateInvariants, createBountyReadModel, createDistrictSummaryViews, createInitialState } from "@empire/game-core";
import { PRODUCTION_GAME_LIFECYCLE_PHASES } from "@empire/shared-types";
import { createServerApp } from "../../apps/server/src/app";
import { ensureGameplaySliceSessionResult } from "../../apps/server/src/bootstrap";
import { ensureGameplaySliceMembershipInState } from "../../apps/server/src/bootstrap/gameplay-slice-session-membership";
import { addPlayerToGameplaySliceState } from "../../apps/server/src/bootstrap/gameplay-slice-session-seed";

describe("live bounty target seed", () => {
  beforeEach(() => {
    vi.stubEnv("EMPIRE_ENABLE_BOUNTY_DEMO_TARGETS", "1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates the required cooldown state with every authoritative player membership", () => {
    vi.stubEnv("EMPIRE_ENABLE_BOUNTY_DEMO_TARGETS", "");
    const state = createInitialState("instance:membership-cooldowns", "free");

    const nextState = addPlayerToGameplaySliceState(state, {
      serverInstanceId: "instance:membership-cooldowns",
      playerId: "player:current",
      factionId: "mafian",
      mode: "free"
    });

    const player = nextState.playersById["player:current"]!;
    expect(nextState.cooldownStatesById[player.cooldownStateId]).toMatchObject({
      ownerId: player.id,
      ownerType: "player",
      cooldowns: {}
    });
    expect(checkGameStateInvariants(nextState).violations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "PLAYER_COOLDOWN_STATE_MISSING", entityId: player.id })])
    );
  });

  it("keeps demo bounty targets disabled without explicit opt-in", () => {
    vi.stubEnv("EMPIRE_ENABLE_BOUNTY_DEMO_TARGETS", "");
    const state = createInitialState("instance:live-no-demo-bounty", "free");
    state.root.phase = PRODUCTION_GAME_LIFECYCLE_PHASES.live;

    addPlayerToGameplaySliceState(state, {
      serverInstanceId: "instance:live-no-demo-bounty",
      playerId: "player:current",
      factionId: "mafian",
      mode: "free"
    });

    expect(Object.values(state.playersById).some((player) => player.metadata?.systemBountyTarget === true)).toBe(false);
  });

  it("removes legacy demo targets and releases their districts when opt-in is disabled", () => {
    const state = createInitialState("instance:live-remove-demo-bounty", "free");
    state.root.phase = PRODUCTION_GAME_LIFECYCLE_PHASES.live;
    addPlayerToGameplaySliceState(state, {
      serverInstanceId: "instance:live-remove-demo-bounty",
      playerId: "player:current",
      factionId: "mafian",
      mode: "free"
    });
    expect(Object.values(state.playersById).some((player) => player.metadata?.systemBountyTarget === true)).toBe(true);

    vi.stubEnv("EMPIRE_ENABLE_BOUNTY_DEMO_TARGETS", "");
    const result = ensureGameplaySliceMembershipInState(state, {
      serverInstanceId: "instance:live-remove-demo-bounty",
      playerId: "player:current",
      factionId: "mafian",
      mode: "free"
    });

    expect(result.accepted).toBe(true);
    expect(result.stateChanged).toBe(true);
    expect(Object.values(result.state.playersById).some((player) => player.metadata?.systemBountyTarget === true)).toBe(false);
    expect(Object.values(result.state.districtsById).some((district) =>
      district.ownerPlayerId?.includes("bounty-target")
      || district.ownerPlayerId?.includes("demo-bounty")
    )).toBe(false);
  });

  it("adds an authoritative target player for bounty in live phase", () => {
    const state = createInitialState("instance:live-bounty", "free");
    state.root.phase = PRODUCTION_GAME_LIFECYCLE_PHASES.live;

    addPlayerToGameplaySliceState(state, {
      serverInstanceId: "instance:live-bounty",
      playerId: "player:current",
      factionId: "mafian",
      mode: "free"
    });
    state.playersById["player:live-bounty-target"]!.metadata = {
      ...state.playersById["player:live-bounty-target"]!.metadata,
      avatarId: "mafian:1"
    };

    const view = createBountyReadModel(state, "player:current");
    const target = view.eligibleTargets.find((entry) => entry.playerId === "player:live-bounty-target");

    expect(target).toMatchObject({
      name: "LowKeyLad",
      avatarId: "mafian:1",
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
