import type { AllianceBoardReadModel } from "@empire/shared-types";
import type { GameCoreContext } from "../engine/context";
import type { CoreGameState } from "../entities";
import {
  canJoinOrCreateAlliance,
  deriveAllianceMembershipStatus,
  getAllianceLifecycleConfig
} from "../rules/alliances/allianceLifecycle";

export const createAllianceBoardReadModel = (
  state: CoreGameState,
  playerId: string,
  context: GameCoreContext
): AllianceBoardReadModel => {
  const nowIso = context.clock?.nowIso?.() ?? new Date().toISOString();
  const config = getAllianceLifecycleConfig(context);
  const player = state.playersById[playerId];
  const activeAlliance = player?.allianceId ? state.alliancesById[player.allianceId] ?? null : null;
  const createEligibility = canJoinOrCreateAlliance(state, playerId, "create", nowIso);
  const activeView = activeAlliance ? createAllianceView(state, activeAlliance.id, playerId, context, nowIso) : null;

  return {
    maxAllianceSize: context.config.balance.maxAllianceSize,
    currentPlayerId: playerId,
    activeAlliance: activeView,
    publicAlliances: Object.values(state.alliancesById)
      .filter((alliance) => alliance.status === "active" && alliance.id !== activeAlliance?.id)
      .map((alliance) => createAllianceView(state, alliance.id, playerId, context, nowIso))
      .filter((view): view is NonNullable<typeof view> => Boolean(view)),
    incomingInvites: Object.values(state.allianceInvitesById ?? {})
      .filter((invite) => invite.targetPlayerId === playerId && invite.status === "pending")
      .map((invite) => createInviteView(state, invite.id))
      .filter((view): view is NonNullable<typeof view> => Boolean(view)),
    eligibleInviteTargets: Object.values(state.playersById)
      .filter((candidate) => candidate.id !== playerId && candidate.status === "active")
      .map((candidate) => ({
        playerId: candidate.id,
        name: candidate.name,
        activeDistrictCount: countActiveDistricts(state, candidate.id),
        canInvite: Boolean(activeAlliance && !candidate.allianceId && activeAlliance.memberIds.length < context.config.balance.maxAllianceSize),
        disabledReason: candidate.allianceId
          ? "Hráč už je v alianci."
          : activeAlliance && activeAlliance.memberIds.length >= context.config.balance.maxAllianceSize
            ? "Aliance je plná."
            : null
      })),
    canCreateAlliance: createEligibility === true,
    createDisabledReason: createEligibility === true ? null : createEligibility
  };

  function createAllianceView(
    inputState: CoreGameState,
    allianceId: string,
    currentPlayerId: string,
    inputContext: GameCoreContext,
    currentNowIso: string
  ): AllianceBoardReadModel["activeAlliance"] {
    const alliance = inputState.alliancesById[allianceId];
    if (!alliance || alliance.status !== "active") return null;
    const currentMembership = alliance.membershipByPlayerId?.[currentPlayerId] ?? null;
    const isLeader = currentMembership?.role === "leader";
    const joinEligibility = canJoinOrCreateAlliance(inputState, currentPlayerId, "join", currentNowIso);
    const canJoin = !currentMembership && joinEligibility === true && alliance.memberIds.length < inputContext.config.balance.maxAllianceSize;
    const activeVote = currentMembership?.activeVoteId ? alliance.kickVotesById?.[currentMembership.activeVoteId] ?? null : null;
    const eligibleVotes = Object.values(alliance.kickVotesById ?? {})
      .filter((vote) => vote.status === "pending" && vote.eligibleVoterIds.includes(currentPlayerId));

    return {
      allianceId: alliance.id,
      name: alliance.name,
      tag: alliance.tag,
      ownerPlayerId: alliance.ownerPlayerId,
      ownerName: inputState.playersById[alliance.ownerPlayerId]?.name ?? "Leader",
      memberCount: alliance.memberIds.length,
      maxMembers: inputContext.config.balance.maxAllianceSize,
      currentPlayerRole: currentMembership?.role ?? null,
      canJoin,
      joinDisabledReason: canJoin
        ? null
        : currentMembership
          ? "Už jsi členem."
          : joinEligibility !== true
            ? joinEligibility
            : alliance.memberIds.length >= inputContext.config.balance.maxAllianceSize
              ? "Aliance je plná."
              : "Vstup není dostupný.",
      canInvite: Boolean(isLeader && alliance.memberIds.length < inputContext.config.balance.maxAllianceSize),
      canLeave: Boolean(currentMembership),
      canDisband: Boolean(isLeader),
      canConfirmReady: Boolean(currentMembership && ["due_soon", "overdue", "vote_eligible", "vote_pending"].includes(
        deriveAllianceMembershipStatus(currentMembership, currentNowIso, config, activeVote)
      )),
      readyReasonCode: currentMembership ? deriveAllianceMembershipStatus(
        currentMembership,
        currentNowIso,
        config,
        activeVote
      ) : null,
      activeVote,
      eligibleVotes,
      members: alliance.memberIds.map((memberId) => {
        const membership = alliance.membershipByPlayerId?.[memberId];
        const member = inputState.playersById[memberId];
        const status = membership
          ? deriveAllianceMembershipStatus(membership, currentNowIso, config, membership.activeVoteId ? alliance.kickVotesById?.[membership.activeVoteId] : null)
          : "active";
        return {
          playerId: memberId,
          name: member?.name ?? memberId,
          role: membership?.role ?? (alliance.ownerPlayerId === memberId ? "leader" : "member"),
          status,
          readyDueAt: membership?.readyDueAt ?? null,
          graceEndsAt: membership?.graceEndsAt ?? null,
          activeDistrictCount: countActiveDistricts(inputState, memberId),
          canStartKickVote: Boolean(isLeader && memberId !== currentPlayerId && status === "vote_eligible")
        };
      }),
      pendingInvites: Object.values(inputState.allianceInvitesById ?? {})
        .filter((invite) => invite.allianceId === alliance.id && invite.status === "pending")
        .map((invite) => createInviteView(inputState, invite.id))
        .filter((view): view is NonNullable<typeof view> => Boolean(view)),
      chatMessages: Object.values(inputState.allianceChatMessagesById ?? {})
        .filter((message) => message.allianceId === alliance.id)
        .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
        .slice(-50)
        .map((message) => ({
          messageId: message.id,
          allianceId: message.allianceId,
          authorPlayerId: message.authorPlayerId,
          authorName: inputState.playersById[message.authorPlayerId]?.name ?? "Hráč",
          body: message.body,
          createdAt: message.createdAt
        })),
      defenseContributions: Object.values(inputState.allianceDefenseContributionsById ?? {})
        .filter((contribution) => contribution.allianceId === alliance.id)
        .map((contribution) => ({
          contributionId: contribution.id,
          allianceId: contribution.allianceId,
          districtId: contribution.districtId,
          districtName: inputState.districtsById[contribution.districtId]?.name ?? contribution.districtId,
          ownerPlayerId: contribution.ownerPlayerId,
          ownerName: inputState.playersById[contribution.ownerPlayerId]?.name ?? contribution.ownerPlayerId,
          hostPlayerId: contribution.hostPlayerId,
          hostName: inputState.playersById[contribution.hostPlayerId]?.name ?? contribution.hostPlayerId,
          itemId: contribution.itemId,
          amount: contribution.amount,
          status: contribution.status
        }))
    };
  }
};

const createInviteView = (
  state: CoreGameState,
  inviteId: string
): AllianceBoardReadModel["incomingInvites"][number] | null => {
  const invite = state.allianceInvitesById?.[inviteId];
  const alliance = invite ? state.alliancesById[invite.allianceId] : null;
  if (!invite || !alliance) return null;
  return {
    inviteId: invite.id,
    allianceId: invite.allianceId,
    allianceName: alliance.name,
    invitedByPlayerId: invite.invitedByPlayerId,
    invitedByName: state.playersById[invite.invitedByPlayerId]?.name ?? "Leader",
    targetPlayerId: invite.targetPlayerId,
    targetName: state.playersById[invite.targetPlayerId]?.name ?? "Hráč",
    status: invite.status,
    createdAt: invite.createdAt
  };
};

const countActiveDistricts = (state: CoreGameState, playerId: string): number =>
  Object.values(state.districtsById).filter((district) =>
    district.ownerPlayerId === playerId && district.status !== "destroyed" && district.status !== "locked"
  ).length;
