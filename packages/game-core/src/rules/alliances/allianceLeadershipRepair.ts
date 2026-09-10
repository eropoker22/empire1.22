import type { CoreGameState } from "../../entities";
import { invalidateDepartureVotes } from "./allianceDepartureVotes";

/** Repair snapshots written before forced departures transferred leadership. */
export function repairAllianceLeadership(state: CoreGameState, allianceId: string, nowIso: string): CoreGameState {
  const alliance = state.alliancesById[allianceId];
  if (!alliance || alliance.status === "disbanded") return state;
  const members = alliance.memberIds.filter(id => state.playersById[id]?.status === "active"
    && alliance.membershipByPlayerId?.[id]?.status !== "removed");
  if (members.includes(alliance.ownerPlayerId)) return state;
  const memberships = { ...alliance.membershipByPlayerId };
  const ordered = [...members].sort((a,b) => {
    const left = memberships[a], right = memberships[b];
    return Date.parse(left?.joinedAt ?? alliance.createdAt) - Date.parse(right?.joinedAt ?? alliance.createdAt)
      || Date.parse(right?.lastReadyAt ?? alliance.createdAt) - Date.parse(left?.lastReadyAt ?? alliance.createdAt)
      || a.localeCompare(b);
  });
  const owner = ordered[0];
  for (const id of members) if (memberships[id]) memberships[id] = { ...memberships[id], role: id === owner ? "leader" : "member", version: memberships[id].version + 1 };
  const votes = invalidateDepartureVotes(alliance, alliance.ownerPlayerId, memberships);
  const notificationId = `alliance-leader-repair:${alliance.id}:${alliance.version}`;
  return { ...state,
    alliancesById: { ...state.alliancesById, [allianceId]: { ...alliance, ownerPlayerId: owner ?? alliance.ownerPlayerId,
      membershipByPlayerId: memberships, kickVotesById: votes, status: owner ? "active" : "disbanded", version: alliance.version + 1 } },
    allianceInvitesById: Object.fromEntries(Object.entries(state.allianceInvitesById ?? {}).map(([id,invite]) => [id,
      invite.status === "pending" && invite.allianceId === allianceId
        ? { ...invite, status: "rejected" as const, respondedAt: nowIso, version: invite.version + 1 } : invite])),
    notificationsById: { ...state.notificationsById, [notificationId]: { id: notificationId, recipientType: "alliance", recipientId: allianceId,
      category: "alliance", title: owner ? `Nový vůdce aliance: ${state.playersById[owner].name}` : "Aliance byla rozpuštěna",
      bodyKey: "alliance.leader_transfer", createdAt: nowIso, readAt: null, payload: { newLeaderPlayerId: owner ?? null } } },
    root: { ...state.root, version: state.root.version + 1, notificationIds: [...state.root.notificationIds, notificationId] }
  };
}
