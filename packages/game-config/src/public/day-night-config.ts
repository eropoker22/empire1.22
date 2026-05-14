import type { DayNightBalanceConfig, DayNightModifiersConfig, DayNightPhaseId } from "@empire/game-core/contracts/game-mode-config";

export const dayModifiers: DayNightModifiersConfig = Object.freeze({
  legalIncomeMultiplier: 1.15,
  dirtyIncomeMultiplier: 0.9,
  productionSpeedMultiplier: 1,
  legalProductionSpeedMultiplier: 1.1,
  illegalProductionSpeedMultiplier: 0.9,
  heatGainMultiplier: 1.1,
  policePressureMultiplier: 1.15,
  heistSuccessChanceModifierPct: -10,
  heistDetectionChanceModifierPct: 15,
  rumorGenerationMultiplier: 0.8,
  rumorTruthChanceModifierPct: 10,
  marketVolatilityMultiplier: 0.85,
  attackTravelOrPreparationMultiplier: 1.05
});

export const nightModifiers: DayNightModifiersConfig = Object.freeze({
  legalIncomeMultiplier: 0.9,
  dirtyIncomeMultiplier: 1.25,
  productionSpeedMultiplier: 1.05,
  legalProductionSpeedMultiplier: 0.95,
  illegalProductionSpeedMultiplier: 1.2,
  heatGainMultiplier: 0.95,
  policePressureMultiplier: 0.9,
  raidSeverityMultiplier: 1.1,
  heistSuccessChanceModifierPct: 15,
  heistDetectionChanceModifierPct: -10,
  rumorGenerationMultiplier: 1.35,
  rumorTruthChanceModifierPct: -10,
  marketVolatilityMultiplier: 1.25,
  attackTravelOrPreparationMultiplier: 0.95
});

export const createDayNightConfig = (input: {
  dayDurationTicks: number;
  nightDurationTicks: number;
  defaultPhase?: DayNightPhaseId;
}): DayNightBalanceConfig => ({
  enabled: true,
  defaultPhase: input.defaultPhase ?? "day",
  phases: {
    day: {
      id: "day",
      label: "DEN",
      durationTicks: Math.max(1, Math.floor(input.dayDurationTicks)),
      modifiers: dayModifiers,
      cityFeedMessages: [
        "Město přechází do denního režimu. Kamery, úřady a legální byznys sílí."
      ],
      uiThemeHint: "day",
      effectSummary: [
        "Legální byznys +15 %",
        "Policie víc vidí",
        "Drbů je méně, ale jsou přesnější"
      ]
    },
    night: {
      id: "night",
      label: "NOC",
      durationTicks: Math.max(1, Math.floor(input.nightDurationTicks)),
      modifiers: nightModifiers,
      cityFeedMessages: [
        "Noc padla na ulice. Černý trh ožívá a gangy se dávají do pohybu."
      ],
      uiThemeHint: "night",
      effectSummary: [
        "Dirty cash +25 %",
        "Heisty jsou snazší",
        "Drby jsou častější, ale méně jisté"
      ]
    }
  }
});
