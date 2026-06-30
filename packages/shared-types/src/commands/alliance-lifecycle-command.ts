import type { AllianceId, PlayerId } from "../ids/entity-id";
import type { ActionCommand } from "./action-command";

export interface CreateAlliancePayload {
  name: string;
  tag?: string;
}

export type CreateAllianceCommand = ActionCommand<"create-alliance", CreateAlliancePayload>;

export interface JoinAlliancePayload {
  allianceId: AllianceId;
}

export type JoinAllianceCommand = ActionCommand<"join-alliance", JoinAlliancePayload>;

export interface InviteAllianceMemberPayload {
  allianceId: AllianceId;
  targetPlayerId: PlayerId;
}

export type InviteAllianceMemberCommand = ActionCommand<"invite-alliance-member", InviteAllianceMemberPayload>;

export interface RespondAllianceInvitePayload {
  inviteId: string;
  response: "accept" | "reject";
}

export type RespondAllianceInviteCommand = ActionCommand<"respond-alliance-invite", RespondAllianceInvitePayload>;

export interface SendAllianceChatMessagePayload {
  allianceId: AllianceId;
  body: string;
}

export type SendAllianceChatMessageCommand = ActionCommand<"send-alliance-chat-message", SendAllianceChatMessagePayload>;

export interface ConfirmAllianceReadyPayload {
  allianceId: AllianceId;
  expectedMembershipVersion?: number;
}

export type ConfirmAllianceReadyCommand = ActionCommand<"confirm-alliance-ready", ConfirmAllianceReadyPayload>;

export interface StartAllianceKickVotePayload {
  allianceId: AllianceId;
  targetPlayerId: PlayerId;
  expectedTargetMembershipVersion?: number;
}

export type StartAllianceKickVoteCommand = ActionCommand<"start-alliance-kick-vote", StartAllianceKickVotePayload>;

export interface CastAllianceKickVotePayload {
  voteId: string;
  choice: "yes" | "no";
  expectedVoteVersion?: number;
}

export type CastAllianceKickVoteCommand = ActionCommand<"cast-alliance-kick-vote", CastAllianceKickVotePayload>;

export interface LeaveAlliancePayload {
  allianceId: AllianceId;
  expectedMembershipVersion?: number;
  chosenSuccessorPlayerId?: PlayerId;
}

export type LeaveAllianceCommand = ActionCommand<"leave-alliance", LeaveAlliancePayload>;

export interface DisbandAlliancePayload {
  allianceId: AllianceId;
}

export type DisbandAllianceCommand = ActionCommand<"disband-alliance", DisbandAlliancePayload>;

export type AllianceLifecycleCommand =
  | CreateAllianceCommand
  | JoinAllianceCommand
  | InviteAllianceMemberCommand
  | RespondAllianceInviteCommand
  | SendAllianceChatMessageCommand
  | ConfirmAllianceReadyCommand
  | StartAllianceKickVoteCommand
  | CastAllianceKickVoteCommand
  | LeaveAllianceCommand
  | DisbandAllianceCommand;
