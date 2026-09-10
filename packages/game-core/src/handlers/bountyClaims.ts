import type { Bounty } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreEvent } from "../events";
import { CORE_EVENT_TYPES, createEvent } from "../events";
import { changeCleanCash, createBountyEventPayload, getPlayerResourceState } from "./bountyCommandUtils";
import { settleUnclaimedBounty } from "./bountySettlement";

export interface BountyClaimInput {
  actorPlayerId: string;
  targetPlayerId: string | null;
  targetDistrictId: string;
  actionType: "attack-district" | "occupy-district" | "destroy-district";
  successfulAttack: boolean;
  capturesDistrict: boolean;
  destroysDistrict: boolean;
  commandId: string;
}

export const expireBounties = (
  state: CoreGameState,
  _context?: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[] } => {
  let nextState = state;
  const events: CoreEvent[] = [];
  for (const bounty of Object.values(state.bountiesById || {})) {
    if (bounty.status !== "active" || bounty.expiresAtTick > state.root.tick) continue;
    const result = settleUnclaimedBounty(nextState, bounty.id, "expired", _context?.clock?.nowIso?.());
    nextState = result.nextState;
    events.push(...result.events);
  }
  return { nextState, events };
};

export const resolveBountyClaims = (
  state: CoreGameState,
  input: BountyClaimInput
): { nextState: CoreGameState; events: CoreEvent[]; claimedBounties: Bounty[] } => {
  const expiry = expireBounties(state);
  let nextState = expiry.nextState;
  const events: CoreEvent[] = [...expiry.events];
  const claimedBounties: Bounty[] = [];

  for (const bounty of Object.values(nextState.bountiesById || {})) {
    if (!matchesBountyClaim(bounty, input)) continue;
    if (bounty.targetMembershipId && bounty.targetMembershipId !== nextState.playersById[bounty.targetPlayerId]?.metadata?.membershipId) continue;
    if (nextState.playersById[bounty.targetPlayerId]?.status === "left") continue;
    const actor = nextState.playersById[input.actorPlayerId];
    const resourceState = actor ? getPlayerResourceState(nextState, actor) : null;
    if (!resourceState) continue;

    const claimed: Bounty = {
      ...bounty,
      status: "claimed",
      claimedByPlayerId: input.actorPlayerId,
      claimedAtTick: nextState.root.tick,
      version: bounty.version + 1
    };
    nextState = {
      ...nextState,
      bountiesById: { ...(nextState.bountiesById || {}), [claimed.id]: claimed },
      resourceStatesById: {
        ...nextState.resourceStatesById,
        [resourceState.id]: changeCleanCash(resourceState, bounty.rewardCleanCash)
      },
      root: { ...nextState.root, version: nextState.root.version + 1 }
    };
    claimedBounties.push(claimed);
    events.push(createEvent(CORE_EVENT_TYPES.bountyClaimed, {
      ...createBountyEventPayload(claimed),
      actorPlayerId: input.actorPlayerId,
      actionType: input.actionType,
      sourceCommandId: input.commandId
    }));
  }

  return { nextState, events, claimedBounties };
};

const matchesBountyClaim = (bounty: Bounty, input: BountyClaimInput): boolean => {
  if (bounty.status !== "active") return false;
  if (bounty.createdByPlayerId === input.actorPlayerId) return false;
  if (bounty.targetPlayerId !== input.targetPlayerId) return false;
  if (bounty.objectiveType === "attack-player") return input.successfulAttack;
  if (bounty.objectiveType === "attack-district") return input.capturesDistrict && bounty.targetDistrictId === input.targetDistrictId;
  if (bounty.objectiveType === "destroy-player-district") {
    return input.destroysDistrict && (!bounty.targetDistrictId || bounty.targetDistrictId === input.targetDistrictId);
  }
  return false;
};
