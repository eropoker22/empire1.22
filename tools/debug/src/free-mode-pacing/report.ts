import {
  createDistrictControlScores,
  type CoreGameState,
  type ResolvedGameModeConfig
} from "@empire/game-core";
import { createFactionPacingMetrics } from "./factionMetrics";
import type {
  PacingMetrics,
  PacingMilestone,
  PacingSnapshot,
  PacingSimulationResult,
  PacingVariantName,
  PacingVariantSuiteResult
} from "./types";

export const captureSnapshot = (
  state: CoreGameState,
  config: ResolvedGameModeConfig,
  metrics: PacingMetrics,
  simulatedHours: number,
  variantName: PacingVariantName
): PacingSnapshot => {
  const activeDistricts = Object.values(state.districtsById).filter((district) => district.status !== "destroyed");
  const destroyedDistricts = Object.keys(state.districtsById).length - activeDistricts.length;
  const neutralDistricts = activeDistricts.filter((district) => !district.ownerPlayerId).length;
  const activePlayerIds = state.root.playerIds.filter((playerId) => state.playersById[playerId]?.status === "active");
  const eliminatedPlayers = state.root.playerIds.filter((playerId) => state.playersById[playerId]?.status === "defeated");
  const scores = createDistrictControlScores(state, activeDistricts);
  const topPlayer = scores.find((score) => score.subjectType === "player") ?? null;
  const topAlliance = scores.find((score) => score.subjectType === "alliance") ?? null;
  const playerBalances = activePlayerIds.map((playerId) =>
    state.resourceStatesById[state.playersById[playerId].resourceStateId]?.balances ?? {}
  );
  const allPlayerBalances = Object.values(state.playersById).map((player) =>
    state.resourceStatesById[player.resourceStateId]?.balances ?? {}
  );
  const victoryReached = Boolean(state.matchResult);
  const resolvedAtTick = typeof state.victoryState?.resolvedAtTick === "number"
    ? state.victoryState.resolvedAtTick
    : state.root.tick;
  const winnerType = state.matchResult?.winnerAllianceId ? "alliance" : state.matchResult?.winnerPlayerId ? "player" : victoryReached ? "none" : null;

  return {
    variantName,
    simulatedHours,
    currentTick: state.root.tick,
    activePlayersRemaining: activePlayerIds.length,
    eliminatedPlayers,
    activeDistricts: activeDistricts.length,
    destroyedDistricts,
    neutralDistricts,
    topPlayerId: topPlayer?.subjectId ?? null,
    topPlayerControlledDistricts: topPlayer?.controlledDistricts ?? 0,
    topPlayerControlPercent: controlPercent(topPlayer?.controlledDistricts ?? 0, activeDistricts.length),
    topAllianceId: topAlliance?.subjectId ?? null,
    topAllianceControlledDistricts: topAlliance?.controlledDistricts ?? 0,
    topAllianceControlPercent: controlPercent(topAlliance?.controlledDistricts ?? 0, activeDistricts.length),
    averageDistrictHeat: round(average(activeDistricts.map((district) => district.heat))),
    averagePlayerCash: round(average((playerBalances.length > 0 ? playerBalances : allPlayerBalances).map((balances) => Number(balances.cash || 0)))),
    averagePlayerDirtyCash: round(average((playerBalances.length > 0 ? playerBalances : allPlayerBalances).map((balances) => Number(balances["dirty-cash"] || 0)))),
    factionMetrics: createFactionPacingMetrics(state, ticksPerHour(config)),
    totalAttacks: metrics.totalAttacks,
    successfulAttacks: metrics.successfulAttacks,
    failedAttacks: metrics.failedAttacks,
    districtCaptures: metrics.districtCaptures,
    first25PercentHour: metrics.first25?.hour ?? null,
    first50PercentHour: metrics.first50?.hour ?? null,
    first75PercentHour: metrics.first75?.hour ?? null,
    victoryReached,
    victoryTick: victoryReached ? resolvedAtTick : null,
    victoryHour: victoryReached ? round(resolvedAtTick / ticksPerHour(config)) : null,
    winnerType,
    winnerId: state.matchResult?.winnerAllianceId ?? state.matchResult?.winnerPlayerId ?? null
  };
};

export const updateMilestones = (
  state: CoreGameState,
  config: ResolvedGameModeConfig,
  metrics: PacingMetrics
): void => {
  const activeDistricts = Object.values(state.districtsById).filter((district) => district.status !== "destroyed");
  const leader = createDistrictControlScores(state, activeDistricts)[0] ?? null;
  if (!leader || activeDistricts.length <= 0) return;

  const percent = controlPercent(leader.controlledDistricts, activeDistricts.length);
  const milestone = (): PacingMilestone => ({
    tick: state.root.tick,
    hour: round(state.root.tick / ticksPerHour(config)),
    subjectType: leader.subjectType,
    subjectId: leader.subjectId,
    percent
  });
  if (!metrics.first25 && percent >= 25) metrics.first25 = milestone();
  if (!metrics.first50 && percent >= 50) metrics.first50 = milestone();
  if (!metrics.first75 && percent >= 75) metrics.first75 = milestone();
};

export const createPacingVerdict = (result: Pick<PacingSimulationResult, "milestones" | "snapshots">): string => {
  const first75 = result.milestones.first75;
  const final = result.snapshots[result.snapshots.length - 1];
  const verdict: string[] = [];
  const simulatedHours = final?.simulatedHours ?? 96;

  if (!first75) {
    verdict.push(`75 % pořád nepřišlo do ${simulatedHours}h: kontrola města je pořád moc roztříštěná.`);
  } else if (first75.hour < 48) {
    verdict.push("75 % přišlo před 48h: moc rychlé.");
  } else if (first75.hour >= 72 && first75.hour <= 96) {
    verdict.push("75 % přišlo mezi 72-96h: ideální pacing dominance.");
  } else {
    verdict.push("75 % přišlo mimo ideální okno 72-96h.");
  }

  if (!first75 && result.snapshots.some((snapshot) => snapshot.simulatedHours >= 72 && snapshot.activePlayersRemaining < 5)) {
    verdict.push("Po 72h zbývá méně než 5 hráčů a dominance není: problém je v neutralizaci/scoringu/expanzi.");
  }

  if (final) {
    const totalDistricts = final.activeDistricts + final.destroyedDistricts;
    const destroyedPercent = totalDistricts > 0 ? (final.destroyedDistricts / totalDistricts) * 100 : 0;
    if (destroyedPercent > 25) {
      verdict.push("Destroyed districty přesahují 25 % mapy: catastropheChance je pořád moc vysoká.");
    }
  }

  const maxAlliancePercent = Math.max(0, ...result.snapshots.map((snapshot) => snapshot.topAllianceControlPercent));
  if (maxAlliancePercent < 50) {
    verdict.push("Aliance nikdy nepřelezla 50 %: aliance scoring nebo expanze aliancí je slabá.");
  }

  if (first75?.subjectType === "alliance" && first75.hour < 48) {
    verdict.push("Aliance vyhrává před 48h: eliminace je moc agresivní nebo aliance příliš silné.");
  }

  return verdict.join(" ");
};

export const printSimulationResult = (result: PacingSimulationResult): void => {
  console.log(`\nEmpire Streets free-mode pacing simulation: ${result.variantName}`);
  console.table(result.snapshots);
  if (result.eliminationTimeline.length > 0) {
    console.log("\nElimination timeline");
    console.table(result.eliminationTimeline);
  }
  console.log("\nMilestones");
  console.table({
    first25: result.milestones.first25 ?? "not reached",
    first50: result.milestones.first50 ?? "not reached",
    first75: result.milestones.first75 ?? "not reached"
  });
  console.log("\nConfig");
  console.table(result.config);
  console.log(`\nVerdict: ${result.verdict}`);
};

export const printVariantSuiteResult = (suite: PacingVariantSuiteResult): void => {
  console.log("\nEmpire Streets free-mode pacing simulation variants");
  console.table(suite.results.map(createSimulationSummary));

  for (const result of suite.results.filter((entry) => entry.eliminationTimeline.length > 0)) {
    console.log(`\nElimination timeline: ${result.variantName}`);
    console.table(result.eliminationTimeline);
  }

  console.log("\nPacing verdicts");
  for (const result of suite.results) {
    console.log(`- ${result.variantName}: ${result.verdict}`);
  }
  console.log("\nFaction win rate");
  console.table(suite.factionWinRate);
};

export const createSimulationSummary = (result: PacingSimulationResult): Record<string, unknown> => {
  const final = result.snapshots[result.snapshots.length - 1];
  return {
    variantName: result.variantName,
    simulatedHours: final?.simulatedHours ?? 0,
    currentTick: final?.currentTick ?? result.finalState.root.tick,
    activePlayersRemaining: final?.activePlayersRemaining ?? 0,
    eliminatedPlayers: final?.eliminatedPlayers.join(", ") ?? "",
    activeDistricts: final?.activeDistricts ?? 0,
    destroyedDistricts: final?.destroyedDistricts ?? 0,
    neutralDistricts: final?.neutralDistricts ?? 0,
    topPlayerId: final?.topPlayerId ?? null,
    topPlayerControlledDistricts: final?.topPlayerControlledDistricts ?? 0,
    topPlayerControlPercent: final?.topPlayerControlPercent ?? 0,
    topAllianceId: final?.topAllianceId ?? null,
    topAllianceControlledDistricts: final?.topAllianceControlledDistricts ?? 0,
    topAllianceControlPercent: final?.topAllianceControlPercent ?? 0,
    topFactionByControl: final?.factionMetrics.topFactionByControl ?? null,
    eliminatedByFaction: final?.factionMetrics.eliminatedByFaction ?? {},
    averageControlByFaction: final?.factionMetrics.averageControlByFaction ?? {},
    averageSurvivalTimeByFaction: final?.factionMetrics.averageSurvivalTimeByFaction ?? {},
    totalAttacks: final?.totalAttacks ?? 0,
    successfulAttacks: final?.successfulAttacks ?? 0,
    failedAttacks: final?.failedAttacks ?? 0,
    districtCaptures: final?.districtCaptures ?? 0,
    first25PercentHour: result.milestones.first25?.hour ?? null,
    first50PercentHour: result.milestones.first50?.hour ?? null,
    first75PercentHour: result.milestones.first75?.hour ?? null,
    victoryReached: final?.victoryReached ?? false,
    victoryTick: final?.victoryTick ?? null,
    victoryHour: final?.victoryHour ?? null,
    winnerType: final?.winnerType ?? null,
    winnerId: final?.winnerId ?? null
  };
};

const ticksPerHour = (config: ResolvedGameModeConfig): number =>
  Math.round((60 * 60 * 1000) / config.tickRateMs);

const controlPercent = (controlled: number, total: number): number =>
  total > 0 ? round((controlled / total) * 100) : 0;

const average = (values: number[]): number =>
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const round = (value: number): number =>
  Math.round(value * 100) / 100;
