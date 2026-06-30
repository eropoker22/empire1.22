import type { DistrictId, PlayerId } from "../ids/entity-id";
import type { ActionCommand } from "./action-command";
import type { BountyObjectiveType } from "../entities/bounty";

export interface CreateBountyPayload {
  targetPlayerId: PlayerId;
  objectiveType: BountyObjectiveType;
  targetDistrictId?: DistrictId | null;
  rewardCleanCash: number;
  durationHours: number;
  isAnonymous?: boolean;
}

export interface CancelBountyPayload {
  bountyId: string;
}

export type CreateBountyCommand = ActionCommand<"create-bounty", CreateBountyPayload>;
export type CancelBountyCommand = ActionCommand<"cancel-bounty", CancelBountyPayload>;
export type BountyCommand = CreateBountyCommand | CancelBountyCommand;
