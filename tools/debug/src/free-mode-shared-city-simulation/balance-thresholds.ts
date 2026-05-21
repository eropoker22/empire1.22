export interface FreeModeBalanceThresholdConfig {
  firstMeaningfulActionMaxMinute: number;
  firstProductionCollectionMaxMinute: number;
  firstCraftStartedMaxMinute: number;
  attackReadinessMinMinute: number;
  attackReadinessMaxMinute: number;
  earlyHeatWindowMinute: number;
  maxHeatBeforeEarlyWindow: number;
  minActionAcceptanceRate: number;
  maxDeadTurnRate: number;
}

export const FREE_MODE_BALANCE_THRESHOLDS: FreeModeBalanceThresholdConfig = {
  firstMeaningfulActionMaxMinute: 5,
  firstProductionCollectionMaxMinute: 10,
  firstCraftStartedMaxMinute: 30,
  attackReadinessMinMinute: 2,
  attackReadinessMaxMinute: 30,
  earlyHeatWindowMinute: 10,
  maxHeatBeforeEarlyWindow: 80,
  minActionAcceptanceRate: 0.6,
  maxDeadTurnRate: 0.75
};

export const FREE_MODE_BALANCE_GATE_SCENARIOS = [
  "baseline-20p-short",
  "small-8p",
  "mixed-profiles-20p"
] as const;
