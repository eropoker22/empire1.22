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
  /** Private authoritative accepted contract, independent of rotating offers. */
  offerSnapshot?: PlayerCityEventOffer;
  titleSnapshot?: string;
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
  /** Retained claims from legacy orphaned runs; only evidence-backed settlement is allowed. */
  unresolvedRuns?: Array<{ run: ActivePlayerCityEventRun; reason: "missing-accepted-contract"; recordedAtTick: number }>;
  attemptedOfferIds: string[];
  pendingRewards: PendingPlayerCityEventReward[];
  lastProcessedScheduleWindowByAgent: Partial<Record<PlayerCityEventAgentId, string>>;
}
