import type { Bounty } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import { CORE_EVENT_TYPES, createEvent } from "../events";
import { changeCleanCash, createBountyEventPayload, getPlayerResourceState } from "./bountyCommandUtils";

/** Terminal transition and escrow settlement are one state mutation. Never reopen historical bounties. */
export const settleUnclaimedBounty = (
  state: CoreGameState,
  bountyId: string,
  reason: NonNullable<Bounty["settlementReason"]>,
  at = state.serverInstance.startedAt
) => {
  const bounty = state.bountiesById?.[bountyId];
  if (!bounty || bounty.status !== "active") return { nextState: state, events: [] };
  const creator = state.playersById[bounty.createdByPlayerId];
  const sameAttempt = !bounty.creatorMembershipId || bounty.creatorMembershipId === creator?.metadata?.membershipId;
  const resource = creator && creator.status !== "left" && sameAttempt && reason !== "creator_left"
    ? getPlayerResourceState(state, creator) : null;
  const refundedCleanCash = resource ? bounty.rewardCleanCash : 0;
  const settled: Bounty = { ...bounty, status: reason === "expired" ? "expired" : "cancelled",
    cancelledAtTick: reason === "expired" ? bounty.cancelledAtTick : state.root.tick,
    settlementReason: reason, refundedCleanCash, version: bounty.version + 1 };
  const id = `notification:bounty-settlement:${bounty.id}`;
  const title = reason === "target_left"
    ? (refundedCleanCash > 0 ? "Zrušeno: cíl opustil server; odměna vrácena" : "Zrušeno: cíl opustil server; vklad uzavřeného pokusu se nevrací")
    : reason === "creator_left" ? "Bounty zrušeno odchodem zadavatele"
      : refundedCleanCash > 0 ? "Vklad bounty vrácen" : "Bounty uzavřeno bez vrácení vkladu";
  const notify = creator?.status !== "left" && sameAttempt && Boolean(creator);
  const nextState: CoreGameState = {
    ...state,
    bountiesById: { ...state.bountiesById, [bountyId]: settled },
    resourceStatesById: resource ? { ...state.resourceStatesById,
      [resource.id]: changeCleanCash(resource, refundedCleanCash) } : state.resourceStatesById,
    notificationsById: notify ? { ...state.notificationsById, [id]: {
      id, recipientType: "player", recipientId: bounty.createdByPlayerId, category: "bounty.settlement",
      title, bodyKey: "bounty.settlement", createdAt: at, readAt: null,
      payload: { bountyId, reason, refundedCleanCash }
    } } : state.notificationsById,
    root: { ...state.root, version: state.root.version + 1,
      notificationIds: notify ? [...state.root.notificationIds.filter((entry) => entry !== id), id] : state.root.notificationIds }
  };
  return { nextState, events: [createEvent(reason === "expired" ? CORE_EVENT_TYPES.bountyExpired : CORE_EVENT_TYPES.bountyCancelled,
    createBountyEventPayload(settled))] };
};
