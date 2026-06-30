import { describe, expect, it } from "vitest";
import { applyCommand, createBountyReadModel, resolveBountyClaims, type CoreGameState } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import type { CreateBountyCommand } from "@empire/shared-types";
import { createCombatStateFixture } from "../../fixtures/game-state-fixtures";

const config = resolveModeConfig("free");
const context = { config };

describe("bounty server-authoritative core flow", () => {
  it("creates server escrow, exposes bounty read model and claims after matching server action", () => {
    const state = createState();
    const created = applyCommand(state, createCommand(), context);
    const readModel = createBountyReadModel(created.nextState, "player:1", {
      nowTick: created.nextState.root.tick,
      tickRateMs: config.tickRateMs
    });
    const claimed = resolveBountyClaims(created.nextState, {
      actorPlayerId: "player:3",
      targetPlayerId: "player:2",
      targetDistrictId: "district:2",
      actionType: "attack-district",
      successfulAttack: true,
      capturesDistrict: false,
      destroysDistrict: false,
      commandId: "command:attack:bounty-integration"
    });

    expect(created.errors).toEqual([]);
    expect(created.nextState.resourceStatesById["resource:1"].balances.cash).toBe(5_000);
    expect(readModel.activeBounties[0]).toMatchObject({
      objectiveType: "attack-district",
      targetDistrictId: "district:2",
      canCancel: true
    });
    expect(claimed.nextState.bountiesById?.["bounty:command:bounty:integration"].status).toBe("claimed");
    expect(claimed.nextState.resourceStatesById["resource:3"].balances.cash).toBe(6_000);
  });
});

const createCommand = (): CreateBountyCommand => ({
  id: "command:bounty:integration",
  type: "create-bounty",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  payload: {
    targetPlayerId: "player:2",
    objectiveType: "attack-district",
    targetDistrictId: "district:2",
    rewardCleanCash: 5_000,
    durationHours: 1,
    isAnonymous: false
  },
  clientRequestId: null
});

const createState = (): CoreGameState => {
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
