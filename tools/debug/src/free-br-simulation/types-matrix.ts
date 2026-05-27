import type { FreeBrScenarioName } from "./types-core";
import type { FreeBrSimulationSummary } from "./types-report";

export interface FreeBrMatrixReport {
  scenarioNames: FreeBrScenarioName[];
  runs: number;
  summaries: FreeBrSimulationSummary[];
  byFaction: Record<string, FreeBrMatrixEntityStats>;
  byStrategy: Record<string, FreeBrMatrixEntityStats>;
  averageMatchDuration: number;
  averageAttacksPerMatch: number;
  averageAlliancesPerMatch: number;
  averageQuietHourDeferrals: number;
  averageDowntownSnowballRate: number;
  earlyDowntownOwnerTop8Chance: number;
  victoryBeforeTimeoutChance: number;
  timeoutWithoutWinnerChance: number;
  dangerZoneComebackRate: number;
  averagePoliceRaidsPerMatch: number;
  mostDominantFaction: string | null;
  weakestFaction: string | null;
  mostReliableStrategy: string | null;
  mostRiskyStrategy: string | null;
}

export interface FreeBrMatrixEntityStats {
  runs: number;
  wins: number;
  winRate: number;
  top8: number;
  top8Rate: number;
  averagePlacement: number;
}
