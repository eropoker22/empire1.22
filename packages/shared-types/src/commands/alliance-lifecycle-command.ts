import type { AllianceId, PlayerId } from "../ids/entity-id";
import type { ActionCommand } from "./action-command";

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
  | ConfirmAllianceReadyCommand
  | StartAllianceKickVoteCommand
  | CastAllianceKickVoteCommand
  | LeaveAllianceCommand
  | DisbandAllianceCommand;
