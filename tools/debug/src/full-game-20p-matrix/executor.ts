import { checkGameStateInvariants } from "@empire/game-core";
import type { GameCommand } from "@empire/shared-types";
import type { ServerApp } from "../../../../apps/server/src/app/server-app";
import type { MutableSimulationClock } from "./mutable-clock";
import { classifyRejection } from "./rejection-classification";
import type {
  ActionCoverageEntry,
  CommandTraceEntry,
  DecisionSkipEntry,
  FullGameArchetype,
  RejectionAuditEntry,
  RejectionCategory,
  RejectionExpectation,
  SimulationBot
} from "./types";

export interface FullGameExecutionMetrics {
  commandSequence: number;
  commandsAttempted: number;
  commandsAccepted: number;
  commandsRejected: number;
  rejectionsByReason: Record<string, number>;
  actionCoverage: Record<string, ActionCoverageEntry>;
  rejectionAudit: RejectionAuditEntry[];
  decisionSkips: DecisionSkipEntry[];
  acceptedActionsByPlayer: Record<string, Record<string, number>>;
  eventCounts: Record<string, number>;
  outcomesByPlayer: Record<string, Record<string, number>>;
  traces: CommandTraceEntry[];
  invariantChecks: number;
  invariantViolations: Array<{ tick: number; code: string; entityId: string | null; message: string }>;
  unexpectedErrors: string[];
  cityEventClaimableRewardIds: string[];
  cityEventBlockedRewardIds: string[];
}

export interface CommandExecutor {
  submit(bot: SimulationBot, type: GameCommand["type"], payload: Record<string, unknown>, options?: {
    rejectionExpectation?: RejectionExpectation;
    unexpectedCategory?: Exclude<RejectionCategory, "EXPECTED_GAMEPLAY_REJECTION" | "EXPECTED_CONCURRENCY_REJECTION">;
    unexpectedRationale?: string;
    decisionContext?: Record<string, unknown>;
    commandId?: string;
    focusDistrictId?: string | null;
    expectedStateVersion?: number;
  }): Promise<{ accepted: boolean; reason: string | null; commandId: string }>;
  recordDecisionSkip(bot: SimulationBot, action: GameCommand["type"], reasonCode: string): void;
  recordCityEventRewardObservation(pendingRewardId: string, claimable: boolean): void;
  checkInvariants(): void;
}

export const createExecutionMetrics = (): FullGameExecutionMetrics => ({
  commandSequence: 0,
  commandsAttempted: 0,
  commandsAccepted: 0,
  commandsRejected: 0,
  rejectionsByReason: {},
  actionCoverage: {},
  rejectionAudit: [],
  decisionSkips: [],
  acceptedActionsByPlayer: {},
  eventCounts: {},
  outcomesByPlayer: {},
  traces: [],
  invariantChecks: 0,
  invariantViolations: [],
  unexpectedErrors: [],
  cityEventClaimableRewardIds: [],
  cityEventBlockedRewardIds: []
});

export const createCommandExecutor = (input: {
  server: ServerApp;
  clock: MutableSimulationClock;
  instanceId: string;
  seed: string;
  metrics: FullGameExecutionMetrics;
}): CommandExecutor => {
  const { server, clock, instanceId, seed, metrics } = input;
  return {
    submit: async (bot, type, payload, options = {}) => {
      const runtime = requiredRuntime(server, instanceId);
      metrics.commandSequence += 1;
      const commandId = options.commandId ?? `full-game:${seed}:${metrics.commandSequence}:${type}`;
      const focusDistrictId = options.focusDistrictId
        ?? runtime.state.playersById[bot.playerId]?.homeDistrictId
        ?? runtime.state.root.districtIds[0]!;
      const command = {
        id: commandId,
        type,
        mode: "free",
        playerId: bot.playerId,
        serverInstanceId: instanceId,
        issuedAt: clock.nowIso(),
        clientRequestId: commandId,
        payload
      } as GameCommand;
      const targetDistrictId = typeof payload.targetDistrictId === "string"
        ? payload.targetDistrictId
        : typeof payload.districtId === "string" ? payload.districtId : null;
      const targetOwnerBefore = targetDistrictId ? runtime.state.districtsById[targetDistrictId]?.ownerPlayerId ?? null : null;
      const stateVersionBefore = runtime.state.root.version;
      const expectedStateVersion = options.expectedStateVersion ?? stateVersionBefore;
      metrics.commandsAttempted += 1;
      const coverage = coverageFor(metrics, type);
      coverage.executed += 1;
      addSeed(coverage, seed);
      try {
        const response = await server.gameplaySliceTransport.submit({
          sessionToken: bot.sessionToken,
          focusDistrictId,
          expectedStateVersion: options.expectedStateVersion ?? runtime.state.root.version,
          command
        });
        const reason = response.errors[0]?.code ?? null;
        if (response.accepted) {
          metrics.commandsAccepted += 1;
          coverage.success += 1;
          const playerActions = metrics.acceptedActionsByPlayer[bot.playerId] ??= {};
          playerActions[type] = (playerActions[type] ?? 0) + 1;
          recordAcceptedOutcome(metrics, runtime.state, bot.playerId, commandId, type, targetDistrictId, targetOwnerBefore);
        } else {
          metrics.commandsRejected += 1;
          metrics.rejectionsByReason[reason ?? "UNKNOWN_REJECTION"] = (metrics.rejectionsByReason[reason ?? "UNKNOWN_REJECTION"] ?? 0) + 1;
          const classification = classifyRejection({
            reasonCode: reason,
            expectation: options.rejectionExpectation,
            unexpectedCategory: options.unexpectedCategory,
            unexpectedRationale: options.unexpectedRationale
          });
          recordRejectedCoverage(coverage, classification.category);
          metrics.rejectionAudit.push({
            tick: runtime.state.root.tick,
            playerId: bot.playerId,
            archetype: bot.archetype,
            action: type,
            reasonCode: reason ?? "UNKNOWN_REJECTION",
            category: classification.category,
            rationale: classification.rationale,
            target: targetFromPayload(payload),
            stateVersionBefore,
            stateVersionAfter: runtime.state.root.version,
            expectedStateVersion,
            commandId,
            decisionContext: { ...(options.decisionContext ?? {}) }
          });
        }
        recordTrace(metrics, runtime.state.root.tick, bot.playerId, bot.archetype, type, targetFromPayload(payload), response.accepted, reason, runtime.state.root.version);
        check(runtime, metrics);
        return { accepted: response.accepted, reason, commandId };
      } catch (error) {
        const message = error instanceof Error ? error.stack ?? error.message : String(error);
        metrics.unexpectedErrors.push(message);
        recordRejectedCoverage(coverage, "HARNESS_ERROR");
        recordTrace(metrics, runtime.state.root.tick, bot.playerId, bot.archetype, type, targetFromPayload(payload), false, "UNEXPECTED_EXCEPTION", runtime.state.root.version);
        return { accepted: false, reason: "UNEXPECTED_EXCEPTION", commandId };
      }
    },
    recordDecisionSkip: (bot, action, reasonCode) => {
      metrics.decisionSkips.push({
        tick: requiredRuntime(server, instanceId).state.root.tick,
        playerId: bot.playerId,
        action,
        reasonCode
      });
    },
    recordCityEventRewardObservation: (pendingRewardId, claimable) => {
      const target = claimable ? metrics.cityEventClaimableRewardIds : metrics.cityEventBlockedRewardIds;
      if (!target.includes(pendingRewardId)) target.push(pendingRewardId);
    },
    checkInvariants: () => check(requiredRuntime(server, instanceId), metrics)
  };
};

const recordAcceptedOutcome = (
  metrics: FullGameExecutionMetrics,
  state: Parameters<typeof checkGameStateInvariants>[0],
  playerId: string,
  commandId: string,
  type: GameCommand["type"],
  targetDistrictId: string | null,
  targetOwnerBefore: string | null
): void => {
  const outcomes = metrics.outcomesByPlayer[playerId] ??= {};
  const add = (key: string, amount = 1) => { outcomes[key] = (outcomes[key] ?? 0) + amount; };
  if (type === "attack-district" && targetDistrictId) {
    const ownerAfter = state.districtsById[targetDistrictId]?.ownerPlayerId ?? null;
    add(ownerAfter === playerId ? "attacksWon" : "attacksLost");
    if (ownerAfter === playerId && targetOwnerBefore !== playerId) add("districtsCaptured");
  }
  if (type === "spy-district") {
    const report = state.notificationsById[`notification:${commandId}:spy-report`];
    const result = String(report?.payload?.result ?? "unknown");
    add(result === "success" ? "spySuccesses" : "spyFailures");
  }
  if (type === "buy-player-market-listing") add("marketTrades");
};

const check = (runtime: ReturnType<typeof requiredRuntime>, metrics: FullGameExecutionMetrics): void => {
  const report = checkGameStateInvariants(runtime.state, {
    maxPlayers: runtime.config.balance.maxPlayersPerServer,
    maxAllianceSize: runtime.config.balance.maxAllianceSize
  });
  metrics.invariantChecks += report.checked;
  for (const violation of report.violations) {
    if (!metrics.invariantViolations.some((entry) => entry.tick === runtime.state.root.tick && entry.code === violation.code && entry.entityId === violation.entityId)) {
      metrics.invariantViolations.push({ tick: runtime.state.root.tick, ...violation });
    }
  }
};

const requiredRuntime = (server: ServerApp, instanceId: string) => {
  const runtime = server.instanceManager.getInstanceById(instanceId);
  if (!runtime) throw new Error(`Runtime ${instanceId} is missing.`);
  return runtime;
};

const coverageFor = (metrics: FullGameExecutionMetrics, action: string): ActionCoverageEntry =>
  metrics.actionCoverage[action] ??= {
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

const recordRejectedCoverage = (coverage: ActionCoverageEntry, category: RejectionCategory): void => {
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

const addSeed = (coverage: ActionCoverageEntry, seed: string): void => {
  if (!coverage.seeds.includes(seed)) coverage.seeds.push(seed);
};

const targetFromPayload = (payload: Record<string, unknown>): string | null => {
  for (const key of ["targetDistrictId", "districtId", "targetPlayerId", "listingId", "bountyId", "allianceId", "buildingId"]) {
    const value = payload[key];
    if (typeof value === "string") return value;
  }
  return null;
};

const recordTrace = (
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
