import type { Bounty, Player, ResourceState } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";
import type { CoreEvent } from "../events";

export const getPlayerResourceState = (state: CoreGameState, player: Player): ResourceState | null =>
  state.resourceStatesById[player.resourceStateId] ?? null;

export const changeCleanCash = (resourceState: ResourceState, delta: number): ResourceState => ({
  ...resourceState,
  balances: {
    ...resourceState.balances,
    cash: Math.max(0, Math.floor(Number(resourceState.balances.cash || 0) + delta))
  },
  version: resourceState.version + 1
});

export const createBountyEventPayload = (bounty: Bounty) => ({
  bountyId: bounty.id,
  createdByPlayerId: bounty.createdByPlayerId,
  targetPlayerId: bounty.targetPlayerId,
  targetDistrictId: bounty.targetDistrictId,
  objectiveType: bounty.objectiveType,
  rewardCleanCash: bounty.rewardCleanCash,
  status: bounty.status,
  expiresAtTick: bounty.expiresAtTick,
  claimedByPlayerId: bounty.claimedByPlayerId,
  claimedAtTick: bounty.claimedAtTick,
  cancelledAtTick: bounty.cancelledAtTick
});

export const rejected = (
  state: CoreGameState,
  code: string,
  message: string
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => ({
  nextState: state,
  events: [],
  errors: [{ code, message }]
});
