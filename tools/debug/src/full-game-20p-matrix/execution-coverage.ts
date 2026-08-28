import type { FullGameExecutionMetrics } from "./executor";
import type {
  ActionCoverageEntry,
  FullGameArchetype,
  RejectionCategory
} from "./types";

export const coverageFor = (
  metrics: FullGameExecutionMetrics,
  action: string
): ActionCoverageEntry => metrics.actionCoverage[action] ??= {
  executed: 0,
  success: 0,
  expectedGameplayReject: 0,
  expectedConcurrencyReject: 0,
  botDecisionError: 0,
  realGameBug: 0,
  harnessError: 0,
  unclassifiedUnexpectedReject: 0,
  expectedReject: 0,
  unexpectedFailure: 0,
  seeds: []
};

export const recordRejectedCoverage = (
  coverage: ActionCoverageEntry,
  category: RejectionCategory
): void => {
  if (category === "EXPECTED_GAMEPLAY_REJECTION") coverage.expectedGameplayReject += 1;
  else if (category === "EXPECTED_CONCURRENCY_REJECTION") coverage.expectedConcurrencyReject += 1;
  else if (category === "BOT_DECISION_ERROR") coverage.botDecisionError += 1;
  else if (category === "REAL_GAME_BUG") coverage.realGameBug += 1;
  else if (category === "HARNESS_ERROR") coverage.harnessError += 1;
  else coverage.unclassifiedUnexpectedReject += 1;
  coverage.expectedReject = coverage.expectedGameplayReject + coverage.expectedConcurrencyReject;
  coverage.unexpectedFailure = coverage.botDecisionError + coverage.realGameBug
    + coverage.harnessError + coverage.unclassifiedUnexpectedReject;
};

export const addCoverageSeed = (coverage: ActionCoverageEntry, seed: string): void => {
  if (!coverage.seeds.includes(seed)) coverage.seeds.push(seed);
};

export const targetFromPayload = (payload: Record<string, unknown>): string | null => {
  for (const key of ["targetDistrictId", "districtId", "targetPlayerId", "listingId", "bountyId", "allianceId", "buildingId"]) {
    const value = payload[key];
    if (typeof value === "string") return value;
  }
  return null;
};

export const recordTrace = (
  metrics: FullGameExecutionMetrics,
  tick: number,
  playerId: string,
  archetype: FullGameArchetype,
  action: string,
  target: string | null,
  accepted: boolean,
  reason: string | null,
  stateVersion: number
): void => {
  metrics.traces.push({ tick, playerId, archetype, action, target, accepted, reason, stateVersion });
  if (metrics.traces.length > 500) metrics.traces.shift();
};
