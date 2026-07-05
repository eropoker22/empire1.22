import type { PlayerAllianceLifecycleView } from "@empire/shared-types";
import type { GameCoreContext } from "../engine/context";
import type { CoreGameState } from "../entities";
import {
  deriveAllianceMembershipStatus,
  getAllianceLifecycleConfig
} from "../rules/alliances/allianceLifecycle";

export const createPlayerAllianceLifecycleView = (
  state: CoreGameState,
  playerId: string,
  context?: GameCoreContext
): PlayerAllianceLifecycleView | null => {
  const player = state.playersById[playerId];
  const nowIso = context?.clock?.nowIso?.() ?? new Date().toISOString();
  const config = context ? getAllianceLifecycleConfig(context) : undefined;
  const alliance = player?.allianceId ? state.alliancesById[player.allianceId] : null;
  const membership = alliance?.membershipByPlayerId?.[playerId] ?? null;
  const activeVote = membership?.activeVoteId ? alliance?.kickVotesById?.[membership.activeVoteId] ?? null : null;
  const derivedMembership = membership
    ? {
        ...membership,
        status: deriveAllianceMembershipStatus(membership, nowIso, config, activeVote)
      }
    : null;
  const eligibleVotes = Object.values(alliance?.kickVotesById ?? {})
    .filter((vote) => vote.status === "pending" && vote.eligibleVoterIds.includes(playerId));
  const exitPenalty = Object.values(state.allianceExitPenaltiesById ?? {})
    .filter((penalty) => penalty.playerId === playerId)
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))[0] ?? null;
  const formerAllyTruces = Object.values(state.formerAllianceTrucesById ?? {})
    .filter((truce) => truce.playerAId === playerId || truce.playerBId === playerId)
    .filter((truce) => Date.parse(truce.expiresAt) > Date.parse(nowIso));

  if (!alliance && !exitPenalty && formerAllyTruces.length === 0) {
    return null;
  }

  return {
    allianceId: alliance?.id ?? null,
    allianceName: alliance?.name ?? null,
    membership: derivedMembership,
    activeVote: activeVote ?? null,
    eligibleVotes,
    exitPenalty,
    formerAllyTruces,
    canConfirmReady: Boolean(derivedMembership && ["active", "due_soon", "overdue", "vote_eligible", "vote_pending"].includes(derivedMembership.status)),
    readyReasonCode: derivedMembership?.status ?? null
  };
};
