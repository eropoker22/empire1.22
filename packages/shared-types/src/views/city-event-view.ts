import type { PlayerCityEventAgentId } from "../entities/player-city-event-state";

export interface CityClockView {
  minuteOfDay: number;
  hour: number;
  minute: number;
  dayIndex: number;
  label: string;
}
export interface CityEventOfferView {
  offerId: string;
  definitionId: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard" | "rare";
  successRate: number;
  durationMinutes: number;
  durationTicks: number;
  rewards: Record<string, number>;
  successHeat: number;
  failureHeat: number;
  failureDirtyCashLoss: number;
  expiresAtTick: number;
  status: string;
  attempted: boolean;
  canStart: boolean;
  disabledReason: string | null;
}

export interface CityEventAgentView {
  agentId: PlayerCityEventAgentId;
  name: string;
  type: string;
  requiredInfluence: number;
  currentInfluence: number;
  unlocked: boolean;
  availableNow: boolean;
  nextOpenAtTick: number | null;
  nextRefreshAtTick: number;
  scheduleLabel: string;
  offers: CityEventOfferView[];
}

export interface CityEventActiveRunView {
  runId: string;
  offerId: string;
  title: string;
  agentName: string;
  startedAtTick: number;
  completesAtTick: number;
  remainingTicks: number;
  possibleReward: Record<string, number>;
  risk: {
    successHeat: number;
    failureHeat: number;
    failureDirtyCashLoss: number;
  };
}

export interface PlayerCityEventsView {
  cityClock: CityClockView;
  activeRun: CityEventActiveRunView | null;
  pendingRewards: Array<{
    pendingRewardId: string;
    resourceKey: string;
    amount: number;
    reason: "storage-capacity" | "missing-owned-district";
    canClaim: boolean;
  }>;
  agents: CityEventAgentView[];
}
