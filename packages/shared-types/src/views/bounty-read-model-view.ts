import type { BountyObjectiveType, BountyStatus } from "../entities/bounty";

export interface BountyReadModel {
  minRewardCleanCash: number;
  durationOptionsHours: number[];
  currentPlayerCleanCash: number;
  eligibleTargets: BountyEligibleTargetView[];
  activeBounties: BountyBoardEntryView[];
  recentBountyEvents: BountyEventView[];
}

export interface BountyEligibleTargetView {
  playerId: string;
  name: string;
  factionLabel: string | null;
  allianceId: string | null;
  isAlly: boolean;
  isSelf: boolean;
  activeDistrictCount: number;
  districts: BountyTargetDistrictView[];
  canTarget: boolean;
  disabledReason: string | null;
}

export interface BountyTargetDistrictView {
  districtId: string;
  name: string;
  zone: string;
  status: string;
}

export interface BountyBoardEntryView {
  bountyId: string;
  targetPlayerId: string;
  targetPlayerName: string;
  targetDistrictId: string | null;
  targetDistrictName: string | null;
  objectiveType: BountyObjectiveType;
  objectiveLabel: string;
  rewardCleanCash: number;
  createdByLabel: string;
  expiresAtTick: number;
  remainingTicks: number;
  remainingMs: number;
  status: BountyStatus;
  isOwn: boolean;
  canCancel: boolean;
  cancelDisabledReason: string | null;
}

export interface BountyEventView {
  eventId: string;
  bountyId: string;
  type: "created" | "claimed" | "expired" | "cancelled";
  label: string;
  createdAtTick: number;
}
