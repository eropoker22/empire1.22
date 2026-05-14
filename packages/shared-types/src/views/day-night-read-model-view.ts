export type DayNightPhaseId = "day" | "night";

/**
 * Responsibility: UI-facing projection of the active city light cycle.
 * Belongs here: labels, tick windows, player-readable effect summary.
 * Does not belong here: gameplay modifier math.
 */
export interface DayNightReadModel {
  phaseId: DayNightPhaseId;
  label: string;
  startedAtTick: number;
  endsAtTick: number;
  remainingTicks: number;
  progressPct: number;
  effectSummary: string[];
  uiThemeHint: DayNightPhaseId;
}

