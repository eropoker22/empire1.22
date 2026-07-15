export type CityEventAgentId = "victor" | "leon" | "nyra";
export type CityEventDifficulty = "easy" | "medium" | "hard" | "rare";

export const CITY_EVENT_REWARD_KEYS = [
  "cash", "dirty-cash", "influence",
  "chemicals", "biomass", "metal-parts", "neon-dust", "baseball-bat", "barricades",
  "stim-pack", "pulse-shot", "velvet-smoke", "tech-core", "pistol", "grenade", "vest", "cameras", "alarm",
  "combat-module", "ghost-serum", "overdrive-x", "smg", "bazooka", "defense-tower"
] as const;

export type CityEventRewardKey = typeof CITY_EVENT_REWARD_KEYS[number];

export interface CityEventClockTimeConfig {
  hour: number;
  minute: number;
}

export interface CityEventAgentScheduleConfig {
  agentId: CityEventAgentId;
  name: string;
  typeLabel: string;
  requiredInfluence: number;
  offerCount: number;
  refreshTimes: readonly CityEventClockTimeConfig[];
  availability?: Readonly<{
    opensAt: CityEventClockTimeConfig;
    closesAt: CityEventClockTimeConfig;
  }>;
  dossierSlot?: Readonly<{
    standardOfferCount: number;
    rareEligibleHour: number;
  }>;
}

export interface CityEventRiskConfig {
  successHeat: number;
  failureHeat: number;
  failureDirtyCashLoss: number;
  startCost?: Readonly<Partial<Record<"cash" | "dirty-cash", number>>>;
}

export interface CityEventDefinitionConfig {
  id: string;
  agentId: CityEventAgentId;
  title: string;
  description: string;
  difficulty: CityEventDifficulty;
  successRate: number;
  durationMinutes: number;
  reward: Readonly<Partial<Record<CityEventRewardKey, number>>>;
  risk: Readonly<CityEventRiskConfig>;
}

export interface CityEventDifficultyBudgetConfig {
  maxReplacementValue: number;
  successRateMin: number;
  successRateMax: number;
  durationMinutesMin: number;
  durationMinutesMax: number;
}

export interface CityEventBalanceConfig {
  enabled: boolean;
  agents: Readonly<Record<CityEventAgentId, CityEventAgentScheduleConfig>>;
  definitions: readonly CityEventDefinitionConfig[];
  difficultyBudgets: Readonly<Record<CityEventDifficulty, CityEventDifficultyBudgetConfig>>;
  maxActiveRunsPerPlayer: 1;
  maxStrategicOffersPerCityDay: 1;
}
