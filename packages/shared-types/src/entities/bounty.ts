import type { DistrictId, PlayerId } from "../ids/entity-id";

export type BountyObjectiveType = "attack-player" | "attack-district" | "destroy-player-district";
export type BountyStatus = "active" | "claimed" | "expired" | "cancelled";

export interface Bounty {
  id: string;
  createdByPlayerId: PlayerId;
  targetPlayerId: PlayerId;
  targetDistrictId: DistrictId | null;
  objectiveType: BountyObjectiveType;
  rewardCleanCash: number;
  status: BountyStatus;
  createdAtTick: number;
  expiresAtTick: number;
  claimedByPlayerId: PlayerId | null;
  claimedAtTick: number | null;
  cancelledAtTick: number | null;
  isAnonymous: boolean;
  version: number;
}

export const BOUNTY_MIN_REWARD_CLEAN_CASH = 5000;
export const BOUNTY_DURATION_OPTIONS_HOURS = [1, 6, 12, 24] as const;
