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
  finalLockdownWinRate: number;
  averageFinalLockdownDurationWallClock: number;
  averageFinalLockdownPausedHours: number;
  top3RateByFaction: Record<string, number>;
  top3RateByStrategy: Record<string, number>;
  averageFinalScoreByFaction: Record<string, number>;
  downtownBonusImpact: number;
  heatPenaltyImpact: number;
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
