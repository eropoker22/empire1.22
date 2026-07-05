import type {
  Alliance,
  AllianceAuditEvent,
  AllianceExitPenalty,
  AllianceKickVote,
  AllianceMembership,
  AllianceMembershipStatus,
  AllianceRemovalReason,
  CastAllianceKickVoteCommand,
  ConfirmAllianceReadyCommand,
  DisbandAllianceCommand,
  FormerAllianceTruce,
  LeaveAllianceCommand,
  Notification,
  Player,
  StartAllianceKickVoteCommand
} from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { CoreError } from "../../errors";
import type { GameCoreContext } from "../../engine/context";
import type { CoreEvent } from "../../events";
import type { AllianceLifecycleBalanceConfig } from "../../contracts/game-mode-config";
import { cleanupAllianceDefense } from "./allianceDefenseCleanup";

export const ALLIANCE_READY_TOO_EARLY = "READY_TOO_EARLY";
export const ALLIANCE_CREATE_REQUIRED_INFLUENCE = 150;

export interface AllianceLifecycleResult {
  nextState: CoreGameState;
  events: CoreEvent[];
  errors: CoreError[];
}

const DEFAULT_LIFECYCLE_CONFIG: AllianceLifecycleBalanceConfig = {
  readiness: {
    readyIntervalSeconds: 8 * 60 * 60,
    readyButtonAvailableBeforeDueSeconds: 0,
    gracePeriodSeconds: 0,
    voteDurationSeconds: 2 * 60 * 60,
    voteRetryCooldownSeconds: 2 * 60 * 60
  },
  voluntaryLeavePenalty: {
    allianceJoinLockoutSeconds: 12 * 60 * 60,
    allianceCreateLockoutSeconds: 12 * 60 * 60,
    influenceDebuffSeconds: 8 * 60 * 60,
    actionCooldownDebuffSeconds: 6 * 60 * 60,
    formerAllyTruceSeconds: 60 * 60,
    influenceGenerationMultiplier: 0.8,
    actionCooldownMultiplier: 1.15,
    blocksAllianceDefenseSupport: true
  },
  inactiveKickPenalty: {
    allianceJoinLockoutSeconds: 6 * 60 * 60,
    allianceCreateLockoutSeconds: 6 * 60 * 60,
    influenceDebuffSeconds: 0,
    actionCooldownDebuffSeconds: 0,
    statDebuffSeconds: 8 * 60 * 60,
    formerAllyTruceSeconds: 60 * 60,
    influenceGenerationMultiplier: 1,
    actionCooldownMultiplier: 1,
    attackMultiplier: 0.5,
    defenseMultiplier: 0.5,
    productionMultiplier: 0.5,
    incomeMultiplier: 0.5,
    blocksAllianceDefenseSupport: true
  },
  disbandPenalty: {
    allianceJoinLockoutSeconds: 30 * 60,
    allianceCreateLockoutSeconds: 30 * 60,
    influenceDebuffSeconds: 0,
    actionCooldownDebuffSeconds: 0,
    formerAllyTruceSeconds: 60 * 60,
    influenceGenerationMultiplier: 1,
    actionCooldownMultiplier: 1,
    blocksAllianceDefenseSupport: false
  },
  administrativeRemovalPenalty: {
    allianceJoinLockoutSeconds: 0,
    allianceCreateLockoutSeconds: 0,
    influenceDebuffSeconds: 0,
    actionCooldownDebuffSeconds: 0,
    formerAllyTruceSeconds: 0,
    influenceGenerationMultiplier: 1,
    actionCooldownMultiplier: 1,
    blocksAllianceDefenseSupport: false
  },
  affectedCooldownActionIds: ["spy", "heist", "attack", "rob"],
  exitPendingTimeoutSeconds: 15 * 60
};

export const getAllianceLifecycleConfig = (context: GameCoreContext): AllianceLifecycleBalanceConfig =>
  context.config.balance.allianceLifecycle ?? DEFAULT_LIFECYCLE_CONFIG;

export const deriveAllianceMembershipStatus = (
  membership: AllianceMembership,
  nowIso: string,
  config: AllianceLifecycleBalanceConfig = DEFAULT_LIFECYCLE_CONFIG,
  activeVote?: AllianceKickVote | null
): AllianceMembershipStatus => {
  if (membership.status === "removed" || membership.removedAt) return "removed";
  if (membership.status === "exit_pending" || membership.exitRequestedAt) return "exit_pending";
  if (activeVote?.status === "pending") return "vote_pending";

  const now = Date.parse(nowIso);
  const dueAt = Date.parse(membership.readyDueAt);
  const graceEndsAt = Date.parse(membership.graceEndsAt);
  if (!Number.isFinite(now) || !Number.isFinite(dueAt) || !Number.isFinite(graceEndsAt)) {
    return "vote_eligible";
  }

  if (now >= graceEndsAt) return "vote_eligible";
  if (now >= dueAt) return "overdue";
  if (now >= dueAt - config.readiness.readyButtonAvailableBeforeDueSeconds * 1000) return "due_soon";
  return "active";
};

export const calculateRequiredYesVotes = (eligibleVoterCount: number): number => {
  if (eligibleVoterCount <= 1) return 1;
  return 2;
};

export const canJoinOrCreateAlliance = (
  state: CoreGameState,
  playerId: string,
  action: "join" | "create",
  nowIso: string
): true | "ALLIANCE_JOIN_LOCKED" | "ALLIANCE_CREATE_LOCKED" | "ALLIANCE_EXIT_PENDING" | "PLAYER_ALREADY_IN_ALLIANCE" | "ALLIANCE_CREATE_INSUFFICIENT_INFLUENCE" => {
  const player = state.playersById[playerId];
  if (!player) return "PLAYER_ALREADY_IN_ALLIANCE";
  if (player.allianceId) return "PLAYER_ALREADY_IN_ALLIANCE";

  const exiting = Object.values(state.alliancesById).some((alliance) => {
    const membership = alliance.membershipByPlayerId?.[playerId];
    return membership?.status === "exit_pending";
  });
  if (exiting) return "ALLIANCE_EXIT_PENDING";

  const now = Date.parse(nowIso);
  const penalty = Object.values(state.allianceExitPenaltiesById ?? {})
    .filter((entry) => entry.playerId === playerId)
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))[0];
  if (!Number.isFinite(now)) return true;

  if (penalty && action === "join" && Date.parse(penalty.allianceJoinLockedUntil) > now) return "ALLIANCE_JOIN_LOCKED";
  if (penalty && action === "create" && Date.parse(penalty.allianceCreateLockedUntil) > now) return "ALLIANCE_CREATE_LOCKED";
  if (action === "create" && calculatePlayerAllianceCreateInfluence(state, playerId) < ALLIANCE_CREATE_REQUIRED_INFLUENCE) {
    return "ALLIANCE_CREATE_INSUFFICIENT_INFLUENCE";
  }
  return true;
};

const calculatePlayerAllianceCreateInfluence = (state: CoreGameState, playerId: string): number =>
  Object.values(state.districtsById)
    .filter((district) =>
      district.ownerPlayerId === playerId
      && district.status !== "destroyed"
      && district.status !== "locked"
    )
    .reduce((total, district) => total + Math.max(0, Number(district.influence || 0)), 0);

export const confirmAllianceReady = (
  state: CoreGameState,
  command: ConfirmAllianceReadyCommand,
  context: GameCoreContext
): AllianceLifecycleResult => {
  const nowIso = nowIsoFromContext(context);
  const config = getAllianceLifecycleConfig(context);
  const prepared = prepareAlliance(state, command.payload.allianceId, nowIso, config);
  if (prepared.errors.length) return { nextState: state, events: [], errors: prepared.errors };

  const alliance = prepared.alliance;
  const membership = alliance.membershipByPlayerId?.[command.playerId];
  const activeVote = membership?.activeVoteId ? alliance.kickVotesById?.[membership.activeVoteId] : null;
  if (!membership || membership.status === "removed") return failure(state, "MEMBERSHIP_NOT_FOUND", "Alliance membership was not found.");
  if (membership.status === "exit_pending") return failure(state, "READY_NOT_ALLOWED", "Exiting members cannot confirm READY.");
  if (
    typeof command.payload.expectedMembershipVersion === "number"
    && membership.version !== command.payload.expectedMembershipVersion
  ) {
    return failure(state, "MEMBERSHIP_VERSION_CONFLICT", "Alliance membership version changed.");
  }

  const nextMembership = createReadyMembership(membership, nowIso, config);
  const nextVotes = { ...(alliance.kickVotesById ?? {}) };
  const notifications: Notification[] = [];
  const auditEvents: AllianceAuditEvent[] = [
    createAudit(`${command.id}:ready`, alliance.id, "ready_confirmed", nowIso, command.playerId, command.playerId)
  ];

  if (activeVote?.status === "pending") {
    nextVotes[activeVote.id] = {
      ...activeVote,
      status: "cancelled_by_ready",
      version: activeVote.version + 1
    };
    notifications.push(createAllianceNotification({
      id: `alliance-vote-cancelled-by-ready:${activeVote.id}`,
      allianceId: alliance.id,
      title: "HLASOVÁNÍ ZRUŠENO",
      bodyKey: "alliance.vote_cancelled_by_ready",
      createdAt: nowIso,
      payload: { playerId: command.playerId, voteId: activeVote.id }
    }));
    auditEvents.push(createAudit(`${command.id}:vote-cancelled`, alliance.id, "vote_cancelled_by_ready", nowIso, command.playerId, command.playerId));
  }

  const nextAlliance = withMembership(alliance, nextMembership, nextVotes);
  return success(
    mergeAlliance(prepared.nextState, nextAlliance),
    notifications,
    auditEvents
  );
};

export const startInactiveMemberKickVote = (
  state: CoreGameState,
  command: StartAllianceKickVoteCommand,
  context: GameCoreContext
): AllianceLifecycleResult => {
  const nowIso = nowIsoFromContext(context);
  const config = getAllianceLifecycleConfig(context);
  const prepared = prepareAlliance(state, command.payload.allianceId, nowIso, config);
  if (prepared.errors.length) return { nextState: state, events: [], errors: prepared.errors };

  const alliance = prepared.alliance;
  const initiator = alliance.membershipByPlayerId?.[command.playerId];
  const target = alliance.membershipByPlayerId?.[command.payload.targetPlayerId];
  if (!initiator || initiator.status === "removed") return failure(state, "MEMBERSHIP_NOT_FOUND", "Initiator is not an alliance member.");
  if (!target || target.status === "removed") return failure(state, "MEMBERSHIP_NOT_FOUND", "Target is not an alliance member.");
  if (command.playerId === command.payload.targetPlayerId) return failure(state, "TARGET_CANNOT_VOTE", "Target cannot start a vote against self.");
  if (
    typeof command.payload.expectedTargetMembershipVersion === "number"
    && target.version !== command.payload.expectedTargetMembershipVersion
  ) {
    return failure(state, "MEMBERSHIP_VERSION_CONFLICT", "Target membership version changed.");
  }
  if (alliance.memberIds.filter((id) => alliance.membershipByPlayerId?.[id]?.status !== "removed").length < 2) {
    return failure(state, "READY_NOT_ALLOWED", "Alliance needs at least two members to vote.");
  }
  if (Date.parse(target.nextKickVoteAllowedAt ?? "") > Date.parse(nowIso)) {
    return failure(state, "VOTE_RETRY_COOLDOWN", "Kick vote retry cooldown is active.");
  }

  const targetVote = target.activeVoteId ? alliance.kickVotesById?.[target.activeVoteId] : null;
  if (targetVote?.status === "pending") return failure(state, "VOTE_ALREADY_ACTIVE", "A vote is already active.");

  const targetStatus = deriveAllianceMembershipStatus(target, nowIso, config, null);
  if (targetStatus !== "vote_eligible") {
    return failure(state, "TARGET_NOT_VOTE_ELIGIBLE", "Target is not eligible for inactive kick voting.");
  }

  const eligibleVoterIds = alliance.memberIds.filter((id) => {
    if (id === target.playerId) return false;
    const membership = alliance.membershipByPlayerId?.[id];
    return membership && deriveAllianceMembershipStatus(membership, nowIso, config, null) !== "removed";
  });
  const vote: AllianceKickVote = {
    id: `alliance-vote:${command.id}`,
    allianceId: alliance.id,
    targetPlayerId: target.playerId,
    initiatedByPlayerId: command.playerId,
    reason: "readiness_timeout",
    createdAt: nowIso,
    expiresAt: addSecondsIso(nowIso, config.readiness.voteDurationSeconds),
    eligibleVoterIds,
    requiredYesVotes: calculateRequiredYesVotes(eligibleVoterIds.length),
    votes: {},
    status: "pending",
    version: 1
  };
  const nextAlliance = withMembership(
    alliance,
    {
      ...target,
      status: "vote_pending",
      activeVoteId: vote.id,
      version: target.version + 1
    },
    {
      ...(alliance.kickVotesById ?? {}),
      [vote.id]: vote
    }
  );

  return success(
    mergeAlliance(prepared.nextState, nextAlliance),
    [createPlayerNotification({
      id: `alliance-vote-started:${vote.id}:${target.playerId}`,
      playerId: target.playerId,
      title: "ZAČALO HLASOVÁNÍ O TVÉM ČLENSTVÍ",
      bodyKey: "alliance.vote_started",
      createdAt: nowIso,
      payload: { allianceId: alliance.id, voteId: vote.id }
    })],
    [createAudit(`${command.id}:vote-started`, alliance.id, "vote_started", nowIso, command.playerId, target.playerId)]
  );
};

export const castAllianceKickVote = (
  state: CoreGameState,
  command: CastAllianceKickVoteCommand,
  context: GameCoreContext
): AllianceLifecycleResult => {
  const nowIso = nowIsoFromContext(context);
  const config = getAllianceLifecycleConfig(context);
  const voteEntry = findVote(state, command.payload.voteId);
  if (!voteEntry) return failure(state, "VOTE_NOT_FOUND", "Vote was not found.");
  const prepared = prepareAlliance(state, voteEntry.alliance.id, nowIso, config);
  if (prepared.errors.length) return { nextState: state, events: [], errors: prepared.errors };

  const vote = prepared.alliance.kickVotesById?.[command.payload.voteId];
  if (!vote) return failure(state, "VOTE_NOT_FOUND", "Vote was not found.");
  if (vote.status !== "pending") return failure(state, "VOTE_NOT_PENDING", "Vote is not pending.");
  if (Date.parse(vote.expiresAt) <= Date.parse(nowIso)) return finalizeVote(prepared.nextState, vote.id, context);
  if (vote.targetPlayerId === command.playerId) return failure(state, "TARGET_CANNOT_VOTE", "Target cannot vote.");
  if (!vote.eligibleVoterIds.includes(command.playerId)) return failure(state, "VOTER_NOT_ELIGIBLE", "Voter is not eligible.");
  if (
    typeof command.payload.expectedVoteVersion === "number"
    && vote.version !== command.payload.expectedVoteVersion
  ) {
    return failure(state, "VOTE_INVALIDATED", "Vote version changed.");
  }

  const voterMembership = prepared.alliance.membershipByPlayerId?.[command.playerId];
  if (!voterMembership || voterMembership.status === "removed") {
    return failure(state, "VOTER_NOT_ELIGIBLE", "Voter is not an active member.");
  }

  const previousChoice = vote.votes[command.playerId];
  const nextVote = evaluateVoteResult({
    ...vote,
    votes: {
      ...vote.votes,
      [command.playerId]: command.payload.choice
    },
    version: vote.version + (previousChoice === command.payload.choice ? 0 : 1)
  });
  const nextAlliance = {
    ...prepared.alliance,
    kickVotesById: {
      ...(prepared.alliance.kickVotesById ?? {}),
      [nextVote.id]: nextVote
    },
    version: prepared.alliance.version + 1
  };

  const nextState = mergeAlliance(prepared.nextState, nextAlliance);
  if (nextVote.status === "passed") {
    return finalizeVote(nextState, nextVote.id, context);
  }
  if (nextVote.status === "rejected") {
    return success(mergeAlliance(prepared.nextState, updateVote(prepared.alliance, nextVote, "rejected", config, nowIso)), [], [
      createAudit(`${command.id}:vote-rejected`, nextAlliance.id, "vote_rejected", nowIso, command.playerId, nextVote.targetPlayerId)
    ]);
  }

  const notifications: Notification[] = [];
  const auditType = previousChoice && previousChoice !== command.payload.choice ? "vote_changed" : "vote_cast";
  return success(nextState, notifications, [
    createAudit(`${command.id}:${auditType}`, nextAlliance.id, auditType, nowIso, command.playerId, nextVote.targetPlayerId, {
      choice: command.payload.choice
    })
  ]);
};

export const finalizeVote = (
  state: CoreGameState,
  voteId: string,
  context: GameCoreContext
): AllianceLifecycleResult => {
  const nowIso = nowIsoFromContext(context);
  const config = getAllianceLifecycleConfig(context);
  const voteEntry = findVote(state, voteId);
  if (!voteEntry) return failure(state, "VOTE_NOT_FOUND", "Vote was not found.");
  const prepared = prepareAlliance(state, voteEntry.alliance.id, nowIso, config);
  if (prepared.errors.length) return { nextState: state, events: [], errors: prepared.errors };

  const alliance = prepared.alliance;
  const vote = alliance.kickVotesById?.[voteId];
  const target = vote ? alliance.membershipByPlayerId?.[vote.targetPlayerId] : null;
  if (!vote || !target) return failure(state, "VOTE_NOT_FOUND", "Vote target was not found.");
  if (vote.status !== "pending" && vote.status !== "passed") return { nextState: prepared.nextState, events: [], errors: [] };

  const revalidatedVoters = vote.eligibleVoterIds.every((id) => {
    const membership = alliance.membershipByPlayerId?.[id];
    return membership && membership.status !== "removed" && membership.status !== "exit_pending";
  });
  const targetStatus = deriveAllianceMembershipStatus(target, nowIso, config, vote);
  if (!revalidatedVoters || targetStatus === "active" || targetStatus === "due_soon" || target.status === "removed") {
    const invalidated = updateVote(alliance, vote, "invalidated", config, nowIso);
    return success(mergeAlliance(prepared.nextState, invalidated), [], [
      createAudit(`${vote.id}:invalidated`, alliance.id, "vote_rejected", nowIso, undefined, target.playerId, {
        status: "invalidated"
      })
    ]);
  }

  const evaluated = evaluateVoteResult(vote);
  if (evaluated.status !== "passed" && Date.parse(evaluated.expiresAt) > Date.parse(nowIso)) {
    return { nextState: prepared.nextState, events: [], errors: [] };
  }
  const finalStatus = evaluated.status === "passed" || yesVoteCount(evaluated) >= evaluated.requiredYesVotes ? "passed" : "expired";
  if (finalStatus !== "passed") {
    const rejected = updateVote(alliance, evaluated, finalStatus, config, nowIso);
    return success(mergeAlliance(prepared.nextState, rejected), [], [
      createAudit(`${vote.id}:rejected`, alliance.id, "vote_rejected", nowIso, undefined, target.playerId, {
        status: finalStatus
      })
    ]);
  }

  const passedAlliance = updateVote(alliance, evaluated, "passed", config, nowIso);
  const removal = removeMemberFromAlliance(
    mergeAlliance(prepared.nextState, passedAlliance),
    passedAlliance.id,
    target.playerId,
    "inactive_kick",
    `${vote.id}:inactive-kick`,
    nowIso,
    context,
    undefined
  );
  return {
    nextState: removal.nextState,
    events: [],
    errors: [],
  };
};

export const leaveAlliance = (
  state: CoreGameState,
  command: LeaveAllianceCommand,
  context: GameCoreContext
): AllianceLifecycleResult => {
  const nowIso = nowIsoFromContext(context);
  const config = getAllianceLifecycleConfig(context);
  const prepared = prepareAlliance(state, command.payload.allianceId, nowIso, config);
  if (prepared.errors.length) return { nextState: state, events: [], errors: prepared.errors };

  const membership = prepared.alliance.membershipByPlayerId?.[command.playerId];
  if (!membership || membership.status === "removed") return failure(state, "MEMBERSHIP_NOT_FOUND", "Membership was not found.");
  if (membership.status === "exit_pending") return failure(state, "PLAYER_ALREADY_EXITING", "Player is already leaving alliance.");
  if (
    typeof command.payload.expectedMembershipVersion === "number"
    && membership.version !== command.payload.expectedMembershipVersion
  ) {
    return failure(state, "MEMBERSHIP_VERSION_CONFLICT", "Membership version changed.");
  }

  const remainingIds = prepared.alliance.memberIds.filter((id) => id !== command.playerId);
  const successor = chooseLeaderSuccessor(prepared.alliance, command.payload.chosenSuccessorPlayerId, nowIso, config, command.playerId);
  if (membership.role === "leader" && remainingIds.length > 0 && !successor) {
    return failure(state, "LEADER_SUCCESSOR_REQUIRED", "Leader must select a valid successor.");
  }

  const removal = removeMemberFromAlliance(
    prepared.nextState,
    prepared.alliance.id,
    command.playerId,
    "voluntary_leave",
    `${command.id}:leave`,
    nowIso,
    context,
    successor?.playerId
  );
  return { nextState: removal.nextState, events: [], errors: [] };
};

export const disbandAlliance = (
  state: CoreGameState,
  command: DisbandAllianceCommand,
  context: GameCoreContext
): AllianceLifecycleResult => {
  const nowIso = nowIsoFromContext(context);
  const config = getAllianceLifecycleConfig(context);
  const prepared = prepareAlliance(state, command.payload.allianceId, nowIso, config);
  if (prepared.errors.length) return { nextState: state, events: [], errors: prepared.errors };
  const membership = prepared.alliance.membershipByPlayerId?.[command.playerId];
  if (!membership || membership.role !== "leader") {
    return failure(state, "READY_NOT_ALLOWED", "Only alliance leader can disband alliance.");
  }

  let nextState = prepared.nextState;
  for (const playerId of [...prepared.alliance.memberIds]) {
    nextState = removeMemberFromAlliance(
      nextState,
      prepared.alliance.id,
      playerId,
      "alliance_disbanded",
      `${command.id}:disband:${playerId}`,
      nowIso,
      context,
      undefined
    ).nextState;
  }
  const alliance = nextState.alliancesById[prepared.alliance.id];
  if (alliance) {
    nextState = mergeAlliance(nextState, {
      ...alliance,
      status: "disbanded",
      memberIds: [],
      version: alliance.version + 1
    });
  }
  return { nextState, events: [], errors: [] };
};

export const runAllianceLifecycleScheduled = (
  state: CoreGameState,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[] } => {
  const nowIso = nowIsoFromContext(context);
  const config = getAllianceLifecycleConfig(context);
  let nextState = state;
  const notifications: Notification[] = [];
  const audits: AllianceAuditEvent[] = [];

  for (const allianceId of Object.keys(nextState.alliancesById)) {
    const prepared = prepareAlliance(nextState, allianceId, nowIso, config);
    if (prepared.errors.length) continue;
    nextState = prepared.nextState;
    const alliance = prepared.alliance;

    for (const membership of Object.values(alliance.membershipByPlayerId ?? {})) {
      if (membership.status === "removed") continue;
      const status = deriveAllianceMembershipStatus(membership, nowIso, config, membership.activeVoteId ? alliance.kickVotesById?.[membership.activeVoteId] : null);
      const cycleId = membership.readyDueAt;
      if (status === "due_soon") {
        notifications.push(createPlayerNotification({
          id: `alliance-ready-warning:${alliance.id}:${membership.playerId}:${cycleId}`,
          playerId: membership.playerId,
          title: "ALIANCE TĚ POTŘEBUJE",
          bodyKey: "alliance.ready_warning",
          createdAt: nowIso,
          payload: { allianceId: alliance.id, readyDueAt: membership.readyDueAt }
        }));
      }
      if (status === "overdue") {
        notifications.push(createPlayerNotification({
          id: `alliance-ready-overdue:${alliance.id}:${membership.playerId}:${cycleId}`,
          playerId: membership.playerId,
          title: "POTVRZENÍ AKTIVITY VYPRŠELO",
          bodyKey: "alliance.ready_overdue",
          createdAt: nowIso,
          payload: { allianceId: alliance.id, graceEndsAt: membership.graceEndsAt }
        }));
      }
      if (status === "vote_eligible") {
        notifications.push(createPlayerNotification({
          id: `alliance-ready-timeout:${alliance.id}:${membership.playerId}:${cycleId}`,
          playerId: membership.playerId,
          title: "AKTIVITA V ALIANCI VYPRŠELA",
          bodyKey: "alliance.ready_timeout_removed",
          createdAt: nowIso,
          payload: { allianceId: alliance.id, readyDueAt: membership.readyDueAt }
        }));
        audits.push(createAudit(`readiness-expired:${alliance.id}:${membership.playerId}:${cycleId}`, alliance.id, "readiness_expired", nowIso, undefined, membership.playerId));
        nextState = removeMemberFromAlliance(
          nextState,
          alliance.id,
          membership.playerId,
          "inactive_kick",
          `readiness-timeout:${alliance.id}:${membership.playerId}:${cycleId}`,
          nowIso,
          context,
          undefined
        ).nextState;
      }
    }

    for (const vote of Object.values(alliance.kickVotesById ?? {})) {
      if (vote.status === "pending" && Date.parse(vote.expiresAt) <= Date.parse(nowIso)) {
        nextState = finalizeVote(nextState, vote.id, context).nextState;
      }
    }
  }

  return {
    nextState: addNotificationsAndAudit(nextState, notifications, audits),
    events: []
  };
};

export const hasFormerAllyTruce = (
  state: CoreGameState,
  playerAId: string,
  playerBId: string,
  nowIso: string
): boolean => {
  const now = Date.parse(nowIso);
  return Object.values(state.formerAllianceTrucesById ?? {}).some((truce) =>
    Date.parse(truce.expiresAt) > now
    && ((truce.playerAId === playerAId && truce.playerBId === playerBId)
      || (truce.playerAId === playerBId && truce.playerBId === playerAId))
  );
};

const prepareAlliance = (
  state: CoreGameState,
  allianceId: string,
  nowIso: string,
  config: AllianceLifecycleBalanceConfig
): { nextState: CoreGameState; alliance: Alliance; errors: CoreError[] } => {
  const alliance = state.alliancesById[allianceId];
  if (!alliance || alliance.status === "disbanded") {
    return { nextState: state, alliance: alliance as Alliance, errors: [{ code: "MEMBERSHIP_NOT_FOUND", message: "Alliance was not found." }] };
  }
  const membershipByPlayerId = { ...(alliance.membershipByPlayerId ?? {}) };
  let changed = false;
  for (const playerId of alliance.memberIds) {
    if (membershipByPlayerId[playerId]) continue;
    membershipByPlayerId[playerId] = createInitialMembership(alliance, playerId, nowIso, config);
    changed = true;
  }
  const nextAlliance = changed ? { ...alliance, membershipByPlayerId, version: alliance.version + 1 } : { ...alliance, membershipByPlayerId };
  return { nextState: changed ? mergeAlliance(state, nextAlliance) : state, alliance: nextAlliance, errors: [] };
};

const createInitialMembership = (
  alliance: Alliance,
  playerId: string,
  nowIso: string,
  config: AllianceLifecycleBalanceConfig
): AllianceMembership => ({
  allianceId: alliance.id,
  playerId,
  role: alliance.ownerPlayerId === playerId ? "leader" : "member",
  joinedAt: alliance.createdAt || nowIso,
  status: "active",
  lastReadyAt: nowIso,
  readyDueAt: addSecondsIso(nowIso, config.readiness.readyIntervalSeconds),
  graceEndsAt: addSecondsIso(nowIso, config.readiness.readyIntervalSeconds + config.readiness.gracePeriodSeconds),
  version: 1
});

const createReadyMembership = (
  membership: AllianceMembership,
  nowIso: string,
  config: AllianceLifecycleBalanceConfig
): AllianceMembership => ({
  ...membership,
  status: "active",
  lastReadyAt: nowIso,
  readyDueAt: addSecondsIso(nowIso, config.readiness.readyIntervalSeconds),
  graceEndsAt: addSecondsIso(nowIso, config.readiness.readyIntervalSeconds + config.readiness.gracePeriodSeconds),
  activeVoteId: undefined,
  version: membership.version + 1
});

const removeMemberFromAlliance = (
  state: CoreGameState,
  allianceId: string,
  playerId: string,
  reason: AllianceRemovalReason,
  sourceEventId: string,
  nowIso: string,
  context: GameCoreContext,
  successorPlayerId: string | undefined
): { nextState: CoreGameState } => {
  const prepared = prepareAlliance(state, allianceId, nowIso, getAllianceLifecycleConfig(context));
  if (prepared.errors.length) return { nextState: state };
  const alliance = prepared.alliance;
  const membership = alliance.membershipByPlayerId?.[playerId];
  if (!membership || membership.status === "removed") return { nextState: prepared.nextState };

  const remainingIds = alliance.memberIds.filter((id) => id !== playerId);
  const nextOwnerPlayerId = remainingIds.length === 0
    ? alliance.ownerPlayerId
    : successorPlayerId ?? chooseLeaderSuccessor(alliance, undefined, nowIso, getAllianceLifecycleConfig(context), playerId)?.playerId ?? remainingIds[0];
  const nextMembershipByPlayerId = { ...(alliance.membershipByPlayerId ?? {}) };
  nextMembershipByPlayerId[playerId] = {
    ...membership,
    status: "removed",
    activeVoteId: undefined,
    removedAt: nowIso,
    removedReason: reason,
    version: membership.version + 1
  };
  for (const id of remainingIds) {
    const member = nextMembershipByPlayerId[id];
    if (member) {
      nextMembershipByPlayerId[id] = {
        ...member,
        role: id === nextOwnerPlayerId ? "leader" : "member",
        version: member.version + (member.role === (id === nextOwnerPlayerId ? "leader" : "member") ? 0 : 1)
      };
    }
  }

  const invalidatedVotes = Object.fromEntries(Object.entries(alliance.kickVotesById ?? {}).map(([id, vote]) => [
    id,
    vote.status === "pending" && (vote.targetPlayerId === playerId || vote.eligibleVoterIds.includes(playerId))
      ? { ...vote, status: "invalidated" as const, version: vote.version + 1 }
      : vote
  ]));
  const nextAlliance: Alliance = {
    ...alliance,
    ownerPlayerId: nextOwnerPlayerId,
    memberIds: remainingIds,
    membershipByPlayerId: nextMembershipByPlayerId,
    kickVotesById: invalidatedVotes,
    status: remainingIds.length === 0 ? "disbanded" : alliance.status,
    version: alliance.version + 1
  };
  const previousAllies = alliance.memberIds.filter((id) => id !== playerId);
  const nextPlayersById = {
    ...prepared.nextState.playersById,
    [playerId]: {
      ...prepared.nextState.playersById[playerId],
      allianceId: null,
      version: (prepared.nextState.playersById[playerId]?.version ?? 0) + 1
    } as Player
  };
  const stateWithAlliance = {
    ...mergeAlliance(prepared.nextState, nextAlliance),
    playersById: nextPlayersById
  };
  const cleaned = cleanupAllianceExitEffects(stateWithAlliance, {
    allianceId,
    playerId,
    previousAllies,
    reason,
    sourceEventId,
    nowIso,
    context
  });
  const auditType = reason === "inactive_kick"
    ? "inactive_kick"
    : reason === "alliance_disbanded"
      ? "alliance_disbanded"
      : "voluntary_leave";
  return {
    nextState: addNotificationsAndAudit(cleaned, [], [
      createAudit(`${sourceEventId}:removed`, allianceId, auditType, nowIso, playerId, playerId),
      ...(successorPlayerId ? [createAudit(`${sourceEventId}:leader-transfer`, allianceId, "leader_transfer", nowIso, playerId, successorPlayerId)] : [])
    ])
  };
};

const cleanupAllianceExitEffects = (
  state: CoreGameState,
  input: {
    allianceId: string;
    playerId: string;
    previousAllies: string[];
    reason: AllianceRemovalReason;
    sourceEventId: string;
    nowIso: string;
    context: GameCoreContext;
  }
): CoreGameState => {
  const config = getAllianceLifecycleConfig(input.context);
  const penaltyConfig = input.reason === "inactive_kick"
    ? config.inactiveKickPenalty
    : input.reason === "alliance_disbanded"
      ? config.disbandPenalty
      : input.reason === "administrative_removal"
        ? config.administrativeRemovalPenalty
        : config.voluntaryLeavePenalty;
  const penalty: AllianceExitPenalty = {
    id: `alliance-penalty:${input.sourceEventId}`,
    playerId: input.playerId,
    formerAllianceId: input.allianceId,
    reason: input.reason,
    startedAt: input.nowIso,
    penaltyEndsAt: addSecondsIso(input.nowIso, Math.max(
      penaltyConfig.influenceDebuffSeconds,
      penaltyConfig.actionCooldownDebuffSeconds,
      penaltyConfig.statDebuffSeconds ?? 0
    )),
    allianceJoinLockedUntil: addSecondsIso(input.nowIso, penaltyConfig.allianceJoinLockoutSeconds),
    allianceCreateLockedUntil: addSecondsIso(input.nowIso, penaltyConfig.allianceCreateLockoutSeconds),
    formerAllyTruceUntil: addSecondsIso(input.nowIso, penaltyConfig.formerAllyTruceSeconds),
    influenceGenerationMultiplier: penaltyConfig.influenceGenerationMultiplier,
    actionCooldownMultiplier: penaltyConfig.actionCooldownMultiplier,
    attackMultiplier: resolvePenaltyMultiplier(penaltyConfig.attackMultiplier),
    defenseMultiplier: resolvePenaltyMultiplier(penaltyConfig.defenseMultiplier),
    productionMultiplier: resolvePenaltyMultiplier(penaltyConfig.productionMultiplier),
    incomeMultiplier: resolvePenaltyMultiplier(penaltyConfig.incomeMultiplier),
    affectedActionIds: config.affectedCooldownActionIds,
    blocksAllianceDefenseSupport: penaltyConfig.blocksAllianceDefenseSupport,
    sourceEventId: input.sourceEventId,
    version: 1
  };
  let nextState: CoreGameState = {
    ...state,
    allianceExitPenaltiesById: {
      ...(state.allianceExitPenaltiesById ?? {}),
      [penalty.id]: penalty
    }
  };

  const truceEntries: FormerAllianceTruce[] = input.previousAllies.map((allyId) => {
    const [playerAId, playerBId] = [input.playerId, allyId].sort();
    return {
      id: `former-ally-truce:${input.sourceEventId}:${playerAId}:${playerBId}`,
      playerAId,
      playerBId,
      formerAllianceId: input.allianceId,
      createdAt: input.nowIso,
      expiresAt: penalty.formerAllyTruceUntil,
      reason: input.reason,
      sourceEventId: input.sourceEventId,
      version: 1
    };
  });
  nextState = {
    ...nextState,
    formerAllianceTrucesById: truceEntries.reduce(
      (collection, truce) => ({ ...collection, [truce.id]: truce }),
      nextState.formerAllianceTrucesById ?? {}
    )
  };

  return cleanupAllianceDefense(invalidateFormerAllySpyAuth(nextState, input.playerId, input.previousAllies), input);
};

const invalidateFormerAllySpyAuth = (
  state: CoreGameState,
  playerId: string,
  formerAllyIds: string[]
): CoreGameState => {
  const allySet = new Set(formerAllyIds);
  const notificationsById = Object.fromEntries(Object.entries(state.notificationsById).map(([id, notification]) => {
    if (notification.category !== "report.spy") return [id, notification];
    const payload = notification.payload ?? {};
    const actor = String(payload.playerId ?? notification.recipientId);
    const owner = String(payload.targetOwnerPlayerId ?? "");
    const shouldInvalidate = (actor === playerId && allySet.has(owner)) || (allySet.has(actor) && owner === playerId);
    return [
      id,
      shouldInvalidate
        ? {
            ...notification,
            payload: {
              ...payload,
              allianceAuthorizationInvalidated: true,
              attackAuthorizationExpiresAtTick: state.root.tick
            }
          }
        : notification
    ];
  }));
  return { ...state, notificationsById };
};

const chooseLeaderSuccessor = (
  alliance: Alliance,
  chosenSuccessorPlayerId: string | undefined,
  nowIso: string,
  config: AllianceLifecycleBalanceConfig,
  leavingPlayerId: string
): AllianceMembership | null => {
  const candidates = alliance.memberIds
    .filter((id) => id !== leavingPlayerId)
    .map((id) => alliance.membershipByPlayerId?.[id])
    .filter((membership): membership is AllianceMembership => Boolean(membership && membership.status !== "removed"))
    .filter((membership) => ["active", "due_soon", "overdue", "vote_eligible"].includes(deriveAllianceMembershipStatus(membership, nowIso, config, null)));
  if (chosenSuccessorPlayerId) {
    return candidates.find((membership) => membership.playerId === chosenSuccessorPlayerId) ?? null;
  }
  return candidates.sort((left, right) =>
    Date.parse(left.joinedAt) - Date.parse(right.joinedAt)
    || Date.parse(right.lastReadyAt) - Date.parse(left.lastReadyAt)
    || left.playerId.localeCompare(right.playerId)
  )[0] ?? null;
};

const withMembership = (
  alliance: Alliance,
  membership: AllianceMembership,
  kickVotesById: Record<string, AllianceKickVote> = alliance.kickVotesById ?? {}
): Alliance => ({
  ...alliance,
  membershipByPlayerId: {
    ...(alliance.membershipByPlayerId ?? {}),
    [membership.playerId]: membership
  },
  kickVotesById,
  version: alliance.version + 1
});

const updateVote = (
  alliance: Alliance,
  vote: AllianceKickVote,
  status: AllianceKickVote["status"],
  config: AllianceLifecycleBalanceConfig,
  nowIso: string
): Alliance => {
  const targetMembership = alliance.membershipByPlayerId?.[vote.targetPlayerId];
  return withMembership(
    alliance,
    targetMembership
      ? {
          ...targetMembership,
          status: status === "passed" ? targetMembership.status : deriveAllianceMembershipStatus(targetMembership, nowIso, config, null),
          activeVoteId: undefined,
          nextKickVoteAllowedAt: status === "passed" ? targetMembership.nextKickVoteAllowedAt : addSecondsIso(nowIso, config.readiness.voteRetryCooldownSeconds),
          version: targetMembership.version + 1
        }
      : createInitialMembership(alliance, vote.targetPlayerId, nowIso, config),
    {
      ...(alliance.kickVotesById ?? {}),
      [vote.id]: {
        ...vote,
        status,
        version: vote.version + 1
      }
    }
  );
};

const evaluateVoteResult = (vote: AllianceKickVote): AllianceKickVote => {
  const yes = yesVoteCount(vote);
  if (yes >= vote.requiredYesVotes) return { ...vote, status: "passed" };
  const remaining = vote.eligibleVoterIds.length - Object.keys(vote.votes).length;
  if (yes + remaining < vote.requiredYesVotes) return { ...vote, status: "rejected" };
  return vote;
};

const yesVoteCount = (vote: AllianceKickVote): number =>
  Object.values(vote.votes).filter((choice) => choice === "yes").length;

const findVote = (
  state: CoreGameState,
  voteId: string
): { alliance: Alliance; vote: AllianceKickVote } | null => {
  for (const alliance of Object.values(state.alliancesById)) {
    const vote = alliance.kickVotesById?.[voteId];
    if (vote) return { alliance, vote };
  }
  return null;
};

const mergeAlliance = (state: CoreGameState, alliance: Alliance): CoreGameState => ({
  ...state,
  alliancesById: {
    ...state.alliancesById,
    [alliance.id]: alliance
  }
});

const success = (
  state: CoreGameState,
  notifications: Notification[],
  auditEvents: AllianceAuditEvent[]
): AllianceLifecycleResult => ({
  nextState: addNotificationsAndAudit(state, notifications, auditEvents),
  events: [],
  errors: []
});

const failure = (
  state: CoreGameState,
  code: string,
  message: string
): AllianceLifecycleResult => ({
  nextState: state,
  events: [],
  errors: [{ code, message }]
});

const addNotificationsAndAudit = (
  state: CoreGameState,
  notifications: Notification[],
  auditEvents: AllianceAuditEvent[]
): CoreGameState => {
  const nextNotificationsById = { ...state.notificationsById };
  const nextNotificationIds = [...state.root.notificationIds];
  for (const notification of notifications) {
    if (nextNotificationsById[notification.id]) continue;
    nextNotificationsById[notification.id] = notification;
    nextNotificationIds.push(notification.id);
  }
  const nextAuditEventsById = { ...(state.allianceAuditEventsById ?? {}) };
  for (const auditEvent of auditEvents) {
    if (nextAuditEventsById[auditEvent.id]) continue;
    nextAuditEventsById[auditEvent.id] = auditEvent;
  }
  return {
    ...state,
    notificationsById: nextNotificationsById,
    allianceAuditEventsById: nextAuditEventsById,
    root: {
      ...state.root,
      notificationIds: nextNotificationIds,
      version: state.root.version + (notifications.length || auditEvents.length ? 1 : 0)
    }
  };
};

const createAllianceNotification = (input: {
  id: string;
  allianceId: string;
  title: string;
  bodyKey: string;
  createdAt: string;
  payload: Record<string, unknown>;
}): Notification => ({
  id: input.id,
  recipientType: "alliance",
  recipientId: input.allianceId,
  category: "alliance.lifecycle",
  title: input.title,
  bodyKey: input.bodyKey,
  payload: input.payload,
  createdAt: input.createdAt,
  readAt: null
});

const createPlayerNotification = (input: {
  id: string;
  playerId: string;
  title: string;
  bodyKey: string;
  createdAt: string;
  payload: Record<string, unknown>;
}): Notification => ({
  id: input.id,
  recipientType: "player",
  recipientId: input.playerId,
  category: "alliance.lifecycle",
  title: input.title,
  bodyKey: input.bodyKey,
  payload: input.payload,
  createdAt: input.createdAt,
  readAt: null
});

const createAudit = (
  id: string,
  allianceId: string,
  type: AllianceAuditEvent["type"],
  createdAt: string,
  actorPlayerId?: string,
  targetPlayerId?: string,
  payload: Record<string, unknown> = {}
): AllianceAuditEvent => ({
  id,
  allianceId,
  actorPlayerId,
  targetPlayerId,
  type,
  createdAt,
  payload
});

const nowIsoFromContext = (context: GameCoreContext): string =>
  context.clock?.nowIso?.() ?? context.clock?.now?.().toISOString() ?? new Date().toISOString();

const addSecondsIso = (isoValue: string, seconds: number): string =>
  new Date(Date.parse(isoValue) + seconds * 1000).toISOString();

const resolvePenaltyMultiplier = (value: number | undefined): number => {
  const multiplier = Number(value);
  return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
};
