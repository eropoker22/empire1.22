import type { AllianceKickVote } from "../entities/alliance";

export interface AllianceBoardReadModel {
  maxAllianceSize: number;
  currentPlayerId: string;
  activeAlliance: AllianceBoardAllianceView | null;
  publicAlliances: AllianceBoardAllianceView[];
  incomingInvites: AllianceBoardInviteView[];
  eligibleInviteTargets: AllianceBoardPlayerView[];
  allianceBadgesByPlayerId: Record<string, AllianceBoardMapBadgeView>;
  canCreateAlliance: boolean;
  createDisabledReason: string | null;
}

export interface AllianceBoardAllianceView {
  allianceId: string;
  name: string;
  tag: string;
  emblemColor: string | null;
  ownerPlayerId: string;
  ownerName: string;
  memberCount: number;
  maxMembers: number;
  currentPlayerRole: "leader" | "member" | null;
  canJoin: boolean;
  joinDisabledReason: string | null;
  canInvite: boolean;
  canLeave: boolean;
  canDisband: boolean;
  canConfirmReady: boolean;
  readyReasonCode: string | null;
  activeVote: AllianceKickVote | null;
  eligibleVotes: AllianceKickVote[];
  members: AllianceBoardMemberView[];
  pendingInvites: AllianceBoardInviteView[];
  receivedInvites: AllianceBoardInviteView[];
  chatMessages: AllianceBoardChatMessageView[];
  defenseContributions: AllianceBoardDefenseContributionView[];
}

export interface AllianceBoardMemberView {
  playerId: string;
  name: string;
  role: "leader" | "member";
  status: string;
  readyDueAt: string | null;
  graceEndsAt: string | null;
  activeDistrictCount: number;
  canStartKickVote: boolean;
  avatarSrc: string | null;
  presence: "online" | "away" | "offline";
  lastSeenAt: string | null;
}

export interface AllianceBoardInviteView {
  inviteId: string;
  allianceId: string;
  allianceName: string;
  invitedByPlayerId: string;
  invitedByName: string;
  targetPlayerId: string;
  targetName: string;
  targetAllianceId: string | null;
  kind: "member" | "alliance_contact";
  status: string;
  createdAt: string;
}

export interface AllianceBoardPlayerView {
  playerId: string;
  name: string;
  activeDistrictCount: number;
  canInvite: boolean;
  disabledReason: string | null;
}

export interface AllianceBoardChatMessageView {
  messageId: string;
  allianceId: string;
  authorPlayerId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface AllianceBoardDefenseContributionView {
  contributionId: string;
  allianceId: string;
  districtId: string;
  districtName: string;
  ownerPlayerId: string;
  ownerName: string;
  hostPlayerId: string;
  hostName: string;
  itemId: string;
  amount: number;
  status: string;
}

export interface AllianceBoardMapBadgeView {
  allianceId: string;
  name: string;
  tag: string;
  emblemColor: string | null;
}
