import type { CoreGameState } from "@empire/game-core";
import type { FactionPacingMetrics } from "./factionMetrics";

export type PacingVariantName =
  | "baseline"
  | "elimination-8h-stop8"
  | "elimination-8h-stop8-lower-catastrophe"
  | "elimination-8h-stop8-lower-catastrophe-faster-attacks";

export interface PacingEliminationVariantConfig {
  enabled: true;
  firstEliminationTick: number;
  eliminationIntervalTicks: number;
  minActivePlayers: number;
  dangerZoneSize: number;
  quietHours: {
    enabled: true;
    timeZone: "Europe/Bratislava";
    startHour: 0;
    endHour: 6;
    behavior: "defer_to_window_end";
  };
  defeatedDistrictPolicy: "neutralize";
}

export interface FreeModePacingVariant {
  variantName: PacingVariantName;
  catastropheChance?: number;
  attackCooldownTicks?: number;
  minAttackDurationTicks?: number;
  elimination?: PacingEliminationVariantConfig;
}

export interface FreeModePacingOptions {
  seed?: string;
  botCount?: number;
  districtCount?: number;
  checkpointHours?: number[];
  maxHours?: number;
  tickStride?: number;
  variantName?: PacingVariantName;
  variant?: FreeModePacingVariant;
  quiet?: boolean;
}

export interface PacingMilestone {
  tick: number;
  hour: number;
  subjectType: "player" | "alliance";
  subjectId: string;
  percent: number;
}

export interface PacingMetrics {
  totalAttacks: number;
  successfulAttacks: number;
  failedAttacks: number;
  districtCaptures: number;
  first25: PacingMilestone | null;
  first50: PacingMilestone | null;
  first75: PacingMilestone | null;
  eliminationTimeline: EliminationTimelineEntry[];
}

export interface PacingSnapshot {
  variantName: PacingVariantName;
  simulatedHours: number;
  currentTick: number;
  activePlayersRemaining: number;
  eliminatedPlayers: string[];
  activeDistricts: number;
  destroyedDistricts: number;
  neutralDistricts: number;
  topPlayerId: string | null;
  topPlayerControlledDistricts: number;
  topPlayerControlPercent: number;
  topAllianceId: string | null;
  topAllianceControlledDistricts: number;
  topAllianceControlPercent: number;
  averageDistrictHeat: number;
  averagePlayerCash: number;
  averagePlayerDirtyCash: number;
  factionMetrics: FactionPacingMetrics;
  totalAttacks: number;
  successfulAttacks: number;
  failedAttacks: number;
  districtCaptures: number;
  first25PercentHour: number | null;
  first50PercentHour: number | null;
  first75PercentHour: number | null;
  victoryReached: boolean;
  victoryTick: number | null;
  victoryHour: number | null;
  winnerType: "player" | "alliance" | "none" | null;
  winnerId: string | null;
}

export interface EliminationTimelineEntry {
  eliminationNumber: number;
  tick: number;
  hour: number;
  eliminatedPlayerId: string;
  finalPlacement: number;
  eliminatedPlayerScore: number;
  eliminatedPlayerControlledDistricts: number;
  activePlayersRemaining: number;
  topAllianceControlPercentAfterElimination: number;
}

export interface PacingSimulationResult {
  variantName: PacingVariantName;
  config: {
    tickRateMs: number;
    ticksPerHour: number;
    tickStride: number;
    dayLengthTicks: number;
    nightLengthTicks: number;
    minimumVictoryTicks: number;
    controlHoldTicks: number;
    hardTimeoutTicks: number;
    victoryThreshold: number;
    allowDurationVictoryFallback: boolean;
  };
  finalState: CoreGameState;
  snapshots: PacingSnapshot[];
  eliminationTimeline: EliminationTimelineEntry[];
  milestones: {
    first25: PacingMilestone | null;
    first50: PacingMilestone | null;
    first75: PacingMilestone | null;
  };
  verdict: string;
}

export interface PacingVariantSuiteResult {
  results: PacingSimulationResult[];
  factionWinRate: Record<string, number>;
}

export const createInitialPacingMetrics = (): PacingMetrics => ({
  totalAttacks: 0,
  successfulAttacks: 0,
  failedAttacks: 0,
  districtCaptures: 0,
  first25: null,
  first50: null,
  first75: null,
  eliminationTimeline: []
});
