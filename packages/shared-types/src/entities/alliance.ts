import type { AllianceId, PlayerId, ServerInstanceId } from "../ids/entity-id";

/**
 * Responsibility: Stable alliance contract for one server instance.
 * Belongs here: membership references, ownership, and lifecycle status.
 * Does not belong here: chat runtime, invitation queues, or ranking caches.
 */
export interface Alliance {
  id: AllianceId;
  serverInstanceId: ServerInstanceId;
  name: string;
  tag: string;
  emblemColor?: string;
  ownerPlayerId: PlayerId;
  memberIds: PlayerId[];
  membershipByPlayerId?: Record<PlayerId, AllianceMembership>;
  kickVotesById?: Record<string, AllianceKickVote>;
  nextKickVoteAllowedAtByPlayerId?: Record<PlayerId, string>;
  status: AllianceStatus;
  createdAt: string;
  version: number;
}

export type AllianceStatus = "forming" | "active" | "disbanded";

export type AllianceMembershipStatus =
  | "active"
  | "due_soon"
  | "overdue"
  | "vote_eligible"
  | "vote_pending"
  | "exit_pending"
  | "removed";

export type AllianceMembershipRole = "leader" | "member";

export type AllianceRemovalReason =
  | "voluntary_leave"
  | "inactive_kick"
  | "leader_kick_if_supported"
  | "alliance_disbanded"
  | "administrative_removal";

export interface AllianceMembership {
  allianceId: AllianceId;
  playerId: PlayerId;
  role: AllianceMembershipRole;
  joinedAt: string;
  status: AllianceMembershipStatus;
  lastReadyAt: string;
  readyDueAt: string;
  graceEndsAt: string;
  activeVoteId?: string;
  nextKickVoteAllowedAt?: string;
  exitRequestedAt?: string;
  removedAt?: string;
  removedReason?: AllianceRemovalReason;
  version: number;
}

export interface AllianceKickVote {
  id: string;
  allianceId: AllianceId;
  targetPlayerId: PlayerId;
  initiatedByPlayerId: PlayerId;
  reason: "readiness_timeout";
  createdAt: string;
  expiresAt: string;
  eligibleVoterIds: PlayerId[];
  requiredYesVotes: number;
  votes: Record<PlayerId, "yes" | "no">;
  status:
    | "pending"
    | "passed"
    | "rejected"
    | "expired"
    | "cancelled_by_ready"
    | "cancelled"
    | "invalidated";
  version: number;
}

export interface AllianceExitPenalty {
  id: string;
  playerId: PlayerId;
  formerAllianceId: AllianceId;
  reason: AllianceRemovalReason;
  startedAt: string;
  penaltyEndsAt: string;
  allianceJoinLockedUntil: string;
  allianceCreateLockedUntil: string;
  formerAllyTruceUntil: string;
  influenceGenerationMultiplier: number;
  actionCooldownMultiplier: number;
  attackMultiplier?: number;
  defenseMultiplier?: number;
  productionMultiplier?: number;
  incomeMultiplier?: number;
  affectedActionIds: string[];
  blocksAllianceDefenseSupport: boolean;
  sourceEventId: string;
  version: number;
}

export interface FormerAllianceTruce {
  id: string;
  playerAId: PlayerId;
  playerBId: PlayerId;
  formerAllianceId: AllianceId;
  createdAt: string;
  expiresAt: string;
  reason: AllianceRemovalReason;
  sourceEventId: string;
  version: number;
}

export interface AllianceDefenseContribution {
  id: string;
  allianceId: AllianceId;
  ownerPlayerId: PlayerId;
  hostPlayerId: PlayerId;
  districtId: string;
  itemId: string;
  originalAmount: number;
  remainingAmount: number;
  lostAmount: number;
  returnedAmount: number;
  status: "active" | "partially_lost" | "depleted" | "returned" | "consumed";
  combatSnapshotId?: string;
  createdAt: string;
  returnedAt?: string;
  sourceEventId?: string;
  version: number;
}

export interface AllianceAuditEvent {
  id: string;
  allianceId: AllianceId;
  actorPlayerId?: PlayerId;
  targetPlayerId?: PlayerId;
  type:
    | "ready_confirmed"
    | "readiness_expired"
    | "vote_started"
    | "vote_cast"
    | "vote_changed"
    | "vote_cancelled_by_ready"
    | "vote_passed"
    | "vote_rejected"
    | "voluntary_leave"
    | "inactive_kick"
    | "leader_transfer"
    | "alliance_disbanded"
    | "defense_cleanup"
    | "penalty_applied"
    | "truce_created";
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface AllianceInvite {
  id: string;
  allianceId: AllianceId;
  invitedByPlayerId: PlayerId;
  targetPlayerId: PlayerId;
  targetAllianceId?: AllianceId | null;
  kind?: "member" | "alliance_contact";
  status: "pending" | "accepted" | "rejected" | "cancelled" | "expired";
  createdAt: string;
  respondedAt?: string | null;
  version: number;
}

export interface AllianceDefenseCombatImpact {
  contributionId: string;
  lostAmount: number;
  remainingAmount: number;
}

export interface AllianceDefenseCombatSnapshot {
  id: string;
  districtId: string;
  losses: Record<string, number>;
  ownerLosses: Record<string, number>;
  contributionImpacts: AllianceDefenseCombatImpact[];
  createdAtTick: number;
  version: number;
}

export interface AllianceChatMessage {
  id: string;
  allianceId: AllianceId;
  authorPlayerId: PlayerId;
  body: string;
  createdAt: string;
  version: number;
}
