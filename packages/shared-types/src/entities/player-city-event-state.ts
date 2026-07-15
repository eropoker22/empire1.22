export type PlayerCityEventAgentId = "victor" | "leon" | "nyra";
export type PlayerCityEventOfferStatus = "available" | "attempted" | "running" | "succeeded" | "failed" | "expired";

export interface PlayerCityEventRiskSnapshot {
  successHeat: number;
  failureHeat: number;
  failureDirtyCashLoss: number;
  startCost?: Partial<Record<"cash" | "dirty-cash", number>>;
}
export interface PlayerCityEventOffer {
  offerId: string;
  definitionId: string;
  agentId: PlayerCityEventAgentId;
  scheduleWindowId: string;
  generatedAtTick: number;
  expiresAtTick: number;
  attemptedAtTick: number | null;
  successRateSnapshot: number;
  durationTicksSnapshot: number;
  rewardSnapshot: Record<string, number>;
  riskSnapshot: PlayerCityEventRiskSnapshot;
  status: PlayerCityEventOfferStatus;
}

export interface ActivePlayerCityEventRun {
  runId: string;
  offerId: string;
  playerId: string;
  startedAtTick: number;
  completesAtTick: number;
  deterministicOutcomeSeed: string;
  status: "running";
}

export interface PendingPlayerCityEventReward {
  pendingRewardId: string;
  sourceOfferId: string;
  resourceKey: string;
  amount: number;
  districtId?: string | null;
  reason: "storage-capacity" | "missing-owned-district";
  createdAtTick: number;
}

export interface PlayerCityEventState {
  version: number;
  offersByAgent: Record<PlayerCityEventAgentId, PlayerCityEventOffer[]>;
  activeRun: ActivePlayerCityEventRun | null;
  attemptedOfferIds: string[];
  pendingRewards: PendingPlayerCityEventReward[];
  lastProcessedScheduleWindowByAgent: Partial<Record<PlayerCityEventAgentId, string>>;
}
