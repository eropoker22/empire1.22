export interface AllianceBoardReadModel {
  maxAllianceSize: number;
  currentPlayerId: string;
  activeAlliance: AllianceBoardAllianceView | null;
  publicAlliances: AllianceBoardAllianceView[];
  incomingInvites: AllianceBoardInviteView[];
  eligibleInviteTargets: AllianceBoardPlayerView[];
  canCreateAlliance: boolean;
  createDisabledReason: string | null;
}

export interface AllianceBoardAllianceView {
  allianceId: string;
  name: string;
  tag: string;
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
  members: AllianceBoardMemberView[];
  pendingInvites: AllianceBoardInviteView[];
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
}

export interface AllianceBoardInviteView {
  inviteId: string;
  allianceId: string;
  allianceName: string;
  invitedByPlayerId: string;
  invitedByName: string;
  targetPlayerId: string;
  targetName: string;
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
