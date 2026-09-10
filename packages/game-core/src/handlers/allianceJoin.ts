import type { Alliance } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import { CORE_EVENT_TYPES, createEvent } from "../events";
import type { GameCoreContext } from "../engine/context";
import { canJoinOrCreateAlliance } from "../rules/alliances/allianceLifecycle";
import {
  createInitialAllianceMembership,
  nowIsoFromContext,
  rejected,
  type AllianceMembershipResult
} from "./allianceMembershipUtils";

export const addPlayerToAlliance = (
  state: CoreGameState,
  playerId: string,
  allianceId: string,
  context: GameCoreContext,
  sourceId: string,
  authorization: { inviteId: string; approvingPlayerId: string }
): AllianceMembershipResult => {
  const player = state.playersById[playerId];
  const alliance = state.alliancesById[allianceId];
  if (!player || player.status !== "active") return rejected(state, "PLAYER_NOT_FOUND", "Aktivní hráč nebyl nalezen.");
  if (!alliance || alliance.status !== "active") return rejected(state, "ALLIANCE_NOT_FOUND", "Aliance nebyla nalezena.");
  const invite = state.allianceInvitesById?.[authorization.inviteId];
  const leader = state.playersById[alliance.ownerPlayerId];
  const leaderMembership = alliance.membershipByPlayerId?.[alliance.ownerPlayerId];
  const authorized = invite?.status === "pending" && leader?.status === "active"
    && leaderMembership?.role === "leader" && leaderMembership.status !== "removed" && alliance.memberIds.includes(leader.id)
    && (invite.kind === "alliance_contact"
      ? invite.allianceId === alliance.id && invite.targetAllianceId === alliance.id
        && invite.invitedByPlayerId === playerId && invite.targetPlayerId === leader.id && authorization.approvingPlayerId === leader.id
      : invite.allianceId === alliance.id && invite.invitedByPlayerId === leader.id
        && invite.targetPlayerId === playerId && authorization.approvingPlayerId === playerId);
  if (!authorized) return rejected(state, "ALLIANCE_INVITE_NOT_ALLOWED", "Pozvánka už nemá platný souhlas současného vůdce aliance.");
  const nowIso = nowIsoFromContext(context);
  const eligibility = canJoinOrCreateAlliance(state, player.id, "join", nowIso);
  if (eligibility !== true) return rejected(state, eligibility, "Teď se nemůžeš přidat do aliance.");
  if (alliance.memberIds.length >= context.config.balance.maxAllianceSize) return rejected(state, "ALLIANCE_FULL", "Aliance je plná.");

  const membership = createInitialAllianceMembership(alliance.id, player.id, "member", nowIso, context);
  const nextAlliance: Alliance = {
    ...alliance,
    memberIds: [...alliance.memberIds.filter((id) => id !== player.id), player.id],
    membershipByPlayerId: { ...(alliance.membershipByPlayerId ?? {}), [player.id]: membership },
    version: alliance.version + 1
  };

  return {
    nextState: {
      ...state,
      alliancesById: { ...state.alliancesById, [alliance.id]: nextAlliance },
      playersById: {
        ...state.playersById,
        [player.id]: { ...player, allianceId: alliance.id, version: player.version + 1 }
      },
      root: { ...state.root, version: state.root.version + 1 }
    },
    events: [createEvent(CORE_EVENT_TYPES.allianceJoined, { allianceId: alliance.id, playerId, sourceId })],
    errors: []
  };
};
