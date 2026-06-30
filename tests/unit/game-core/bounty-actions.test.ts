import { describe, expect, it } from "vitest";
import {
  applyCommand,
  createBountyReadModel,
  expireBounties,
  resolveBountyClaims,
  type CoreGameState
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import type { CancelBountyCommand, CreateBountyCommand } from "@empire/shared-types";
import { createCombatStateFixture } from "../../fixtures/game-state-fixtures";

const config = resolveModeConfig("free");
const context = { config };

describe("server-authoritative bounty actions", () => {
  it("creates bounty by locking clean cash escrow on the server", () => {
    const state = createBountyState();
    const result = applyCommand(state, createBountyCommand(), context);

    expect(result.errors).toEqual([]);
    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(5_000);
    expect(result.nextState.bountiesById?.["bounty:command:bounty:create:1"]).toMatchObject({
      createdByPlayerId: "player:1",
      targetPlayerId: "player:2",
      targetDistrictId: null,
      objectiveType: "attack-player",
      rewardCleanCash: 5_000,
      status: "active",
      claimedByPlayerId: null
    });
    expect(result.events).toContainEqual(expect.objectContaining({ type: "bounty-created" }));
  });

  it("rejects bounty below minimum without mutating cash", () => {
    const state = createBountyState();
    const result = applyCommand(
      state,
      createBountyCommand({
        payload: {
          targetPlayerId: "player:2",
          objectiveType: "attack-player",
          targetDistrictId: null,
          rewardCleanCash: 4_999,
          durationHours: 1,
          isAnonymous: true
        }
      }),
      context
    );

    expect(result.errors).toMatchObject([{ code: "bounty_reward_too_low" }]);
    expect(result.nextState).toBe(state);
    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(10_000);
  });

  it("rejects self-target bounty", () => {
    const state = createBountyState();
    const result = applyCommand(
      state,
      createBountyCommand({
        payload: {
          targetPlayerId: "player:1",
          objectiveType: "attack-player",
          targetDistrictId: null,
          rewardCleanCash: 5_000,
          durationHours: 1,
          isAnonymous: true
        }
      }),
      context
    );

    expect(result.errors).toMatchObject([{ code: "bounty_target_self" }]);
    expect(result.nextState).toBe(state);
  });

  it("requires target district ownership for district bounty", () => {
    const state = createBountyState();
    const result = applyCommand(
      state,
      createBountyCommand({
        payload: {
          targetPlayerId: "player:2",
          objectiveType: "attack-district",
          targetDistrictId: "district:1",
          rewardCleanCash: 5_000,
          durationHours: 1,
          isAnonymous: true
        }
      }),
      context
    );

    expect(result.errors).toMatchObject([{ code: "bounty_target_district_invalid" }]);
    expect(result.nextState).toBe(state);
  });

  it("cancels own active bounty and returns escrow", () => {
    const created = applyCommand(createBountyState(), createBountyCommand(), context).nextState;
    const result = applyCommand(created, createCancelBountyCommand(), context);

    expect(result.errors).toEqual([]);
    expect(result.nextState.bountiesById?.["bounty:command:bounty:create:1"].status).toBe("cancelled");
    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(10_000);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "bounty-cancelled" }));
  });

  it("expires bounty and returns escrow lazily", () => {
    const created = applyCommand(createBountyState(), createBountyCommand(), context).nextState;
    const expired = expireBounties({
      ...created,
      root: {
        ...created.root,
        tick: created.root.tick + Math.ceil(60 * 60 * 1000 / config.tickRateMs) + 1
      }
    });

    expect(expired.nextState.bountiesById?.["bounty:command:bounty:create:1"].status).toBe("expired");
    expect(expired.nextState.resourceStatesById["resource:1"].balances.cash).toBe(10_000);
    expect(expired.events).toContainEqual(expect.objectContaining({ type: "bounty-expired" }));
  });

  it("claims attack-player bounty after successful server action and prevents double payout", () => {
    const created = applyCommand(createBountyState(), createBountyCommand(), context).nextState;
    const claimed = resolveBountyClaims(created, {
      actorPlayerId: "player:3",
      targetPlayerId: "player:2",
      targetDistrictId: "district:2",
      actionType: "attack-district",
      successfulAttack: true,
      capturesDistrict: false,
      destroysDistrict: false,
      commandId: "command:attack:claim"
    });
    const secondClaim = resolveBountyClaims(claimed.nextState, {
      actorPlayerId: "player:3",
      targetPlayerId: "player:2",
      targetDistrictId: "district:2",
      actionType: "attack-district",
      successfulAttack: true,
      capturesDistrict: false,
      destroysDistrict: false,
      commandId: "command:attack:claim:again"
    });

    expect(claimed.nextState.bountiesById?.["bounty:command:bounty:create:1"]).toMatchObject({
      status: "claimed",
      claimedByPlayerId: "player:3"
    });
    expect(claimed.nextState.resourceStatesById["resource:3"].balances.cash).toBe(6_000);
    expect(claimed.events).toContainEqual(expect.objectContaining({ type: "bounty-claimed" }));
    expect(secondClaim.nextState.resourceStatesById["resource:3"].balances.cash).toBe(6_000);
    expect(secondClaim.events).toEqual([]);
  });

  it("does not claim bounty for failed or wrong-target attacks", () => {
    const created = applyCommand(createBountyState(), createBountyCommand(), context).nextState;
    const wrongTarget = resolveBountyClaims(created, {
      actorPlayerId: "player:3",
      targetPlayerId: "player:1",
      targetDistrictId: "district:1",
      actionType: "attack-district",
      successfulAttack: true,
      capturesDistrict: false,
      destroysDistrict: false,
      commandId: "command:attack:wrong"
    });
    const failed = resolveBountyClaims(created, {
      actorPlayerId: "player:3",
      targetPlayerId: "player:2",
      targetDistrictId: "district:2",
      actionType: "attack-district",
      successfulAttack: false,
      capturesDistrict: false,
      destroysDistrict: false,
      commandId: "command:attack:failed"
    });

    expect(wrongTarget.events).toEqual([]);
    expect(failed.events).toEqual([]);
    expect(wrongTarget.nextState.bountiesById?.["bounty:command:bounty:create:1"].status).toBe("active");
    expect(failed.nextState.bountiesById?.["bounty:command:bounty:create:1"].status).toBe("active");
  });

  it("projects eligible targets and active bounty table from authoritative state", () => {
    const created = applyCommand(createBountyState(), createBountyCommand(), context).nextState;
    const view = createBountyReadModel(created, "player:1", {
      nowTick: created.root.tick,
      tickRateMs: config.tickRateMs
    });

    expect(view.minRewardCleanCash).toBe(5_000);
    expect(view.currentPlayerCleanCash).toBe(5_000);
    expect(view.eligibleTargets).toContainEqual(expect.objectContaining({
      playerId: "player:2",
      canTarget: true,
      activeDistrictCount: 1
    }));
    expect(view.activeBounties).toContainEqual(expect.objectContaining({
      bountyId: "bounty:command:bounty:create:1",
      targetPlayerName: "Defender",
      objectiveLabel: "Útok na hráče",
      canCancel: true
    }));
  });
});

const createBountyCommand = (overrides: Partial<CreateBountyCommand> = {}): CreateBountyCommand => ({
  id: "command:bounty:create:1",
  type: "create-bounty",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  payload: {
    targetPlayerId: "player:2",
    objectiveType: "attack-player",
    targetDistrictId: null,
    rewardCleanCash: 5_000,
    durationHours: 1,
    isAnonymous: true
  },
  clientRequestId: null,
  ...overrides
});

const createCancelBountyCommand = (overrides: Partial<CancelBountyCommand> = {}): CancelBountyCommand => ({
  id: "command:bounty:cancel:1",
  type: "cancel-bounty",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  payload: {
    bountyId: "bounty:command:bounty:create:1"
  },
  clientRequestId: null,
  ...overrides
});

const createBountyState = (): CoreGameState => {
  const state = createCombatStateFixture();
  state.playersById["player:3"] = {
    ...state.playersById["player:1"],
    id: "player:3",
    accountId: "account:3",
    name: "Hunter",
    homeDistrictId: "district:3",
    resourceStateId: "resource:3",
    cooldownStateId: "cooldown:3",
    effectStateId: "effect:3",
    policeStateId: "police:3"
  };
  state.resourceStatesById["resource:1"] = {
    ...state.resourceStatesById["resource:1"],
    balances: { cash: 10_000 }
  };
  state.resourceStatesById["resource:3"] = {
    ...state.resourceStatesById["resource:1"],
    id: "resource:3",
    ownerId: "player:3",
    balances: { cash: 1_000 }
  };
  state.root.playerIds.push("player:3");
  state.bountiesById = {};
  return state;
};
