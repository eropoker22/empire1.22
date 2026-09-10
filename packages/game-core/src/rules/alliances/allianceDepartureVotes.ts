import type { Alliance } from "@empire/shared-types";

export function invalidateDepartureVotes(alliance: Alliance, playerId: string, nextMembershipByPlayerId: NonNullable<Alliance["membershipByPlayerId"]>) {
  const invalidatedVotes = Object.fromEntries(Object.entries(alliance.kickVotesById ?? {}).map(([id, vote]) => [
    id,
    vote.status === "pending" && (vote.targetPlayerId === playerId || vote.eligibleVoterIds.includes(playerId))
      ? { ...vote, status: "invalidated" as const, version: vote.version + 1 }
      : vote
  ]));
  for (const [id, member] of Object.entries(nextMembershipByPlayerId)) {
    if (member.activeVoteId && invalidatedVotes[member.activeVoteId]?.status !== "pending") {
      nextMembershipByPlayerId[id] = { ...member, activeVoteId: undefined, version: member.version + 1 };
    }
  }
  return invalidatedVotes;
}
