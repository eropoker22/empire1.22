import type { Alliance } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";

/** Historical roles never grant present membership, command or read access. */
export const isCurrentAllianceMember = (state: CoreGameState, alliance: Alliance | undefined | null, playerId: string): boolean => {
  const player = state.playersById[playerId];
  const member = alliance?.membershipByPlayerId?.[playerId];
  return Boolean(alliance?.status === "active" && player?.status === "active"
    && player.allianceId === alliance.id && alliance.memberIds.includes(playerId)
    && member?.playerId === playerId && member.allianceId === alliance.id
    && member.status !== "removed" && member.status !== "exit_pending");
};
export const isCurrentAllianceLeader = (state: CoreGameState, alliance: Alliance | undefined | null, playerId: string): boolean =>
  isCurrentAllianceMember(state, alliance, playerId) && alliance?.ownerPlayerId === playerId
    && alliance.membershipByPlayerId?.[playerId]?.role === "leader";
