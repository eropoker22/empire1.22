import { createServerApp, type ServerApp } from "../../../../apps/server/src/app/server-app";
import {
  createInMemoryRuntimePersistenceRepositories,
  type ServerRuntimePersistenceRepositories
} from "../../../../apps/server/src/runtime/instance-manager/instance-factory";
import { createSeededRng } from "../free-br-simulation/seeded-rng";
import { bootstrapTwentyPlayers } from "./bootstrap";
import {
  establishAlliances,
  exerciseIdempotence,
  exerciseMarketConcurrency,
  runAuthorizedAttack,
  runBotDecision
} from "./actions";
import {
  createCommandExecutor,
  createExecutionMetrics,
  type FullGameExecutionMetrics
} from "./executor";
import { reevaluateGameReport } from "./evaluator";
import { createMutableSimulationClock } from "./mutable-clock";
import type {
  FullGameReport,
  FullGameScenario,
  PlayerSimulationMetrics,
  SimulationBot
} from "./types";
import {
  FULL_GAME_EVALUATION_VERSION,
  FULL_GAME_HARNESS_REVISION
} from "./types";

export interface RunFullGameOptions {
  seed?: string | number;
  scenario?: FullGameScenario;
  verbose?: boolean;
  sourceRevision?: string;
}

export const runFullGameSimulation = async (options: RunFullGameOptions = {}): Promise<FullGameReport> => {
  const seed = String(options.seed ?? 1);
  const scenario = options.scenario ?? "balanced-city";
  const rng = createSeededRng(`full-game:${scenario}:${seed}`);
  const seedOffset = seedNumber(seed);
  const clock = createMutableSimulationClock("2026-01-12T07:00:00.000Z");
  const persistence = createTransactionalMemoryPersistence();
  const server = createServerApp({ clock, persistence });
  const instanceId = `instance:free:full-game-matrix:${scenario}:${seed}`;
  const created = server.serverInstanceCreationService.createGameServerInstanceResult({
    serverInstanceId: instanceId,
    mode: "free",
    displayName: `Full Game Matrix ${scenario} ${seed}`,
    region: "simulation",
    capacity: 20,
    joinPolicy: "open",
    worldSeed: `full-game:${scenario}:${seed}`
  });
  if (!created.accepted) throw new Error(created.errors[0]?.code ?? "Simulation instance creation failed.");
  const bots = await bootstrapTwentyPlayers(server, clock, instanceId, scenario, seedOffset);
  const metrics = createExecutionMetrics();
  const executor = createCommandExecutor({ server, clock, instanceId, seed, metrics });
  const initial = captureInitialPlayerState(server, instanceId, bots);
  const ownership = initializeOwnershipTracking(server, instanceId, bots);
  const firstEliminationTick = created.runtime.config.balance.elimination?.firstEliminationTick ?? 0;
  const hardTimeoutTick = created.runtime.config.balance.hardTimeoutTicks ?? 60_480;
  const actionIntervalTicks = Math.max(1, Math.ceil((30 * 60_000) / created.runtime.config.tickRateMs));
  const spyAuthorizationTtlTicks = Math.max(1, created.runtime.config.balance.conflict?.spyAuthorizationTtlTicks ?? 120);
  const attackFollowUpIntervalTicks = Math.min(actionIntervalTicks, Math.max(1, Math.floor(spyAuthorizationTtlTicks / 2)));
  const restartAtTick = Math.max(2, Math.floor(firstEliminationTick / 2));
  let restartRecoveryVerified = false;
  let ownershipChanges = 0;
  let lastProgressTick = 0;
  let previousLifecycleSignature = lifecycleSignature(created.runtime.state);
  const stallThresholdTicks = Math.ceil((12 * 60 * 60_000) / created.runtime.config.tickRateMs);
  let stalled = false;

  executor.checkInvariants();
  await establishAlliances(executor, server, clock, instanceId, bots, scenario);
  // Alliance setup deliberately submits several commands at the same simulated
  // instant. Advance through one normal worker tick before the independent
  // market race so the production rate limiter observes a real elapsed window.
  clock.advance(created.runtime.config.tickRateMs);
  server.instanceManager.tickInstance(instanceId);
  drainRuntimeEvents(created.runtime, metrics);
  const idempotenceVerified = await exerciseIdempotence(executor, server, instanceId, bots.at(-1)!);
  const concurrencyVerified = await exerciseMarketConcurrency(executor, server, instanceId, bots);

  while (!requiredRuntime(server, instanceId).state.matchResult && requiredRuntime(server, instanceId).state.root.tick < hardTimeoutTick) {
    const runtime = requiredRuntime(server, instanceId);
    clock.advance(runtime.config.tickRateMs);
    server.instanceManager.tickInstance(instanceId);
    if (runtime.state.root.tick % runtime.config.technical.snapshotIntervalTicks === 0) {
      await server.instanceManager.saveInstanceSnapshot(instanceId);
    }
    drainRuntimeEvents(runtime, metrics);
    const changes = updateOwnershipTracking(runtime.state, ownership);
    ownershipChanges += changes;
    const lifecycle = lifecycleSignature(runtime.state);
    if (changes > 0 || lifecycle !== previousLifecycleSignature) {
      lastProgressTick = runtime.state.root.tick;
      previousLifecycleSignature = lifecycle;
    }

    if (runtime.state.matchResult) continue;

    if (runtime.state.root.tick === restartAtTick) {
      restartRecoveryVerified = await verifyRecovery(server, instanceId);
    }

    if (runtime.state.root.tick % attackFollowUpIntervalTicks === 0) {
      for (const bot of rotateBots(bots, runtime.state.root.tick + seedOffset)) {
        await runAuthorizedAttack({ executor, server, instanceId, bot, rng });
      }
    }

    if (runtime.state.root.tick % actionIntervalTicks === 0) {
      for (const bot of rotateBots(bots, runtime.state.root.tick + seedOffset)) {
        await runBotDecision({ executor, server, clock, instanceId, bot, rng });
      }
      executor.checkInvariants();
      if (options.verbose) {
        const active = Object.values(runtime.state.playersById).filter((player) => player.status === "active").length;
        console.log(`[full-game ${seed}] tick=${runtime.state.root.tick} active=${active} accepted=${metrics.commandsAccepted} rejected=${metrics.commandsRejected}`);
      }
    }

    if (runtime.state.root.tick - lastProgressTick > stallThresholdTicks && runtime.state.root.tick > firstEliminationTick) {
      stalled = true;
    }
    if (runtime.record.status === "crashed") {
      metrics.unexpectedErrors.push(`Runtime crashed at tick ${runtime.state.root.tick}.`);
      break;
    }
  }

  const runtime = requiredRuntime(server, instanceId);
  drainRuntimeEvents(runtime, metrics);
  await server.instanceManager.saveInstanceSnapshot(instanceId);
  const finalSnapshot = await persistence.snapshotRepository.loadRecoveryHead(instanceId);
  const finalOutcomeBeforeProbe = JSON.stringify(runtime.state.matchResult);
  const postGame = runtime.state.matchResult
    ? await executor.submit(bots[0]!, "send-city-chat-message", { body: "post-game mutation probe" }, {
        rejectionExpectation: {
          category: "EXPECTED_GAMEPLAY_REJECTION",
          codes: ["GAME_FINISHED", "server.instance_resolved"],
          rationale: "Deliberate post-game mutation probe must be rejected by the resolved-instance lifecycle gate."
        },
        decisionContext: { probe: "post-game-mutation" }
      })
    : { accepted: false, reason: null };
  clock.advance(runtime.config.tickRateMs);
  server.instanceManager.tickInstance(instanceId);
  const postGameTickImmutable = JSON.stringify(runtime.state.matchResult) === finalOutcomeBeforeProbe;
  const report = buildReport({
    seed,
    scenario,
    server,
    instanceId,
    bots,
    metrics,
    initial,
    ownership,
    ownershipChanges,
    restartRecoveryVerified,
    idempotenceVerified,
    concurrencyVerified,
    stalled,
    finalResultPersisted: Boolean(finalSnapshot?.state.matchResult && finalSnapshot.state.matchResult.id === runtime.state.matchResult?.id),
    postGameMutationBlocked: postGame.accepted === false && ["GAME_FINISHED", "server.instance_resolved"].includes(String(postGame.reason)),
    postGameTickImmutable,
    sourceRevision: options.sourceRevision ?? "working-tree"
  });
  await persistence.close?.();
  return report;
};

const createTransactionalMemoryPersistence = (): ServerRuntimePersistenceRepositories => {
  const persistence = createInMemoryRuntimePersistenceRepositories();
  if (!persistence.commandReservationRepository || !persistence.commandResultRepository || !persistence.outboxRepository) {
    throw new Error("Complete in-memory persistence repositories are required.");
  }
  persistence.atomicCommandTransaction = {
    run: async (_instanceId, callback) => callback({
      commandLogRepository: persistence.commandLogRepository,
      commandReservationRepository: persistence.commandReservationRepository!,
      commandResultRepository: persistence.commandResultRepository!,
      eventLogRepository: persistence.eventLogRepository,
      outboxRepository: persistence.outboxRepository!,
      snapshotRepository: persistence.snapshotRepository
    })
  };
  persistence.atomicCommandPersistenceMode = "transactional";
  return persistence;
};

const verifyRecovery = async (server: ServerApp, instanceId: string): Promise<boolean> => {
  const runtime = requiredRuntime(server, instanceId);
  await server.instanceManager.saveInstanceSnapshot(instanceId);
  const before = stateDigest(runtime.state);
  await server.instanceManager.restoreInstance(instanceId);
  return before === stateDigest(runtime.state);
};

const drainRuntimeEvents = (
  runtime: ReturnType<typeof requiredRuntime>,
  metrics: FullGameExecutionMetrics
): void => {
  for (const event of runtime.eventQueue.drain() as Array<{ type?: string }>) {
    const type = String(event.type ?? "unknown");
    metrics.eventCounts[type] = (metrics.eventCounts[type] ?? 0) + 1;
  }
};

interface OwnershipTracking {
  ownerByDistrict: Record<string, string | null>;
  maxByPlayer: Record<string, number>;
  capturedByPlayer: Record<string, number>;
  lostByPlayer: Record<string, number>;
}

const initializeOwnershipTracking = (server: ServerApp, instanceId: string, bots: SimulationBot[]): OwnershipTracking => {
  const state = requiredRuntime(server, instanceId).state;
  const ownerByDistrict = Object.fromEntries(Object.values(state.districtsById).map((district) => [district.id, district.ownerPlayerId]));
  const counts = districtCounts(state);
  return {
    ownerByDistrict,
    maxByPlayer: Object.fromEntries(bots.map((bot) => [bot.playerId, counts[bot.playerId] ?? 0])),
    capturedByPlayer: {},
    lostByPlayer: {}
  };
};

const updateOwnershipTracking = (state: ReturnType<typeof requiredRuntime>["state"], tracking: OwnershipTracking): number => {
  let changes = 0;
  for (const district of Object.values(state.districtsById)) {
    const before = tracking.ownerByDistrict[district.id] ?? null;
    const after = district.ownerPlayerId ?? null;
    if (before !== after) {
      changes += 1;
      if (before) tracking.lostByPlayer[before] = (tracking.lostByPlayer[before] ?? 0) + 1;
      if (after) tracking.capturedByPlayer[after] = (tracking.capturedByPlayer[after] ?? 0) + 1;
      tracking.ownerByDistrict[district.id] = after;
    }
  }
  const counts = districtCounts(state);
  for (const [playerId, count] of Object.entries(counts)) tracking.maxByPlayer[playerId] = Math.max(tracking.maxByPlayer[playerId] ?? 0, count);
  return changes;
};

const buildReport = (input: {
  seed: string;
  scenario: FullGameScenario;
  server: ServerApp;
  instanceId: string;
  bots: SimulationBot[];
  metrics: FullGameExecutionMetrics;
  initial: Record<string, { cash: number; dirtyCash: number; influence: number; heat: number }>;
  ownership: OwnershipTracking;
  ownershipChanges: number;
  restartRecoveryVerified: boolean;
  idempotenceVerified: boolean;
  concurrencyVerified: boolean;
  stalled: boolean;
  finalResultPersisted: boolean;
  postGameMutationBlocked: boolean;
  postGameTickImmutable: boolean;
  sourceRevision: string;
}): FullGameReport => {
  const runtime = requiredRuntime(input.server, input.instanceId);
  const state = runtime.state;
  const factionsRepresented = [...new Set(input.bots.map((bot) => bot.factionId))].sort();
  const playerMetrics = createPlayerMetrics(input, state);
  const bounties = Object.values(state.bountiesById ?? {});
  const alliances = Object.values(state.alliancesById);
  const report: FullGameReport = {
    schemaVersion: 2,
    evaluationVersion: FULL_GAME_EVALUATION_VERSION,
    harnessRevision: FULL_GAME_HARNESS_REVISION,
    sourceRevision: input.sourceRevision,
    seed: input.seed,
    scenario: input.scenario,
    passed: false,
    failureCodes: [],
    errors: [],
    architecture: ["gameplay session identity", "gameplaySliceTransport", "command ingress", "atomic command dispatcher", "game-core handlers", "transactional persistence boundary", "authoritative projections", "durable worker tick", "snapshot recovery"],
    durationTicks: state.root.tick,
    durationGameTimeMs: state.root.tick * runtime.config.tickRateMs,
    commandsAttempted: input.metrics.commandsAttempted,
    commandsAccepted: input.metrics.commandsAccepted,
    commandsRejected: input.metrics.commandsRejected,
    rejectionsByReason: input.metrics.rejectionsByReason,
    rejectionAudit: input.metrics.rejectionAudit,
    decisionSkips: input.metrics.decisionSkips,
    playersStarted: 20,
    playersEliminated: Object.values(state.playersById).filter((player) => player.status === "defeated").length,
    playersFinished: state.matchResult?.ranking.length ?? 0,
    factionsRepresented,
    alliancesCreated: alliances.length,
    maxAllianceSize: Math.max(0, ...alliances.map((alliance) => alliance.memberIds.length)),
    districtOwnershipChanges: input.ownershipChanges,
    attacks: input.metrics.actionCoverage["attack-district"]?.success ?? 0,
    spies: input.metrics.actionCoverage["spy-district"]?.success ?? 0,
    robberies: input.metrics.actionCoverage["rob-district"]?.success ?? 0,
    heists: input.metrics.actionCoverage["heist-district"]?.success ?? 0,
    marketTrades: input.metrics.actionCoverage["buy-player-market-listing"]?.success ?? 0,
    marketVolume: calculateMarketVolume(state),
    bountiesCreated: bounties.length,
    bountiesClaimed: bounties.filter((bounty) => bounty.status === "claimed").length,
    bountyLifecycle: {
      created: bounties.length,
      claimed: bounties.filter((bounty) => bounty.status === "claimed").length,
      paid: bounties.filter((bounty) => bounty.status === "claimed" && bounty.claimedByPlayerId).length,
      cancelled: bounties.filter((bounty) => bounty.status === "cancelled").length,
      expired: bounties.filter((bounty) => bounty.status === "expired").length,
      invalid: Math.max(0, (input.metrics.actionCoverage["create-bounty"]?.executed ?? 0) - (input.metrics.actionCoverage["create-bounty"]?.success ?? 0))
    },
    cityEventRewardClaims: input.metrics.actionCoverage["claim-city-event-reward"]?.success ?? 0,
    cityEventClaimableRewardsObserved: input.metrics.cityEventClaimableRewardIds.length,
    cityEventBlockedRewardsObserved: input.metrics.cityEventBlockedRewardIds.length,
    policeRaids: input.metrics.eventCounts["police-raid-triggered"] ?? 0,
    cityEvents: (input.metrics.eventCounts["city-event-succeeded"] ?? 0) + (input.metrics.eventCounts["city-event-failed"] ?? 0),
    purgeStarted: (state.eliminationState?.eliminationCount ?? 0) > 0,
    purgeCompleted: (state.eliminationState?.eliminationCount ?? 0) > 0
      && Object.values(state.playersById).filter((player) => player.status === "active").length <= 8,
    finalLockdownStarted: (input.metrics.eventCounts["final-lockdown-started"] ?? 0) > 0,
    finalLockdownCompleted: state.finalLockdownState?.status === "resolved",
    winnerId: state.matchResult?.winnerPlayerId ?? null,
    finalResultPersisted: input.finalResultPersisted,
    restartRecoveryVerified: input.restartRecoveryVerified,
    idempotenceVerified: input.idempotenceVerified,
    concurrencyVerified: input.concurrencyVerified,
    postGameMutationBlocked: input.postGameMutationBlocked,
    postGameTickImmutable: input.postGameTickImmutable,
    stalled: input.stalled,
    invariantChecks: input.metrics.invariantChecks,
    invariantViolations: input.metrics.invariantViolations,
    unexpectedErrors: input.metrics.unexpectedErrors,
    actionCoverage: input.metrics.actionCoverage,
    players: playerMetrics,
    traceTail: input.metrics.traces
  };
  return reevaluateGameReport(report);
};

const createPlayerMetrics = (
  input: Parameters<typeof buildReport>[0],
  state: ReturnType<typeof requiredRuntime>["state"]
): PlayerSimulationMetrics[] => {
  const counts = districtCounts(state);
  const ranking = new Map((state.matchResult?.ranking ?? []).map((entry) => [entry.subjectId, entry.rank]));
  return input.bots.map((bot) => {
    const player = state.playersById[bot.playerId]!;
    const resources = state.resourceStatesById[player.resourceStateId]?.balances ?? {};
    const police = state.policeStatesById[player.policeStateId];
    const actions = input.metrics.acceptedActionsByPlayer[player.id] ?? {};
    const outcomes = input.metrics.outcomesByPlayer[player.id] ?? {};
    const ownedBuildings = Object.values(state.buildingsById).filter((building) => building.ownerPlayerId === player.id);
    const bounties = Object.values(state.bountiesById ?? {});
    const initial = input.initial[player.id]!;
    const eliminationReason = typeof player.metadata?.eliminationReason === "string"
      ? player.metadata.eliminationReason
      : null;
    const eliminatedAt = Number(player.metadata?.eliminatedAtTick);
    return {
      playerId: player.id, faction: bot.factionId, archetype: bot.archetype, startingDistrict: bot.startingDistrictId,
      finalDistrictCount: counts[player.id] ?? 0, maxDistrictCount: input.ownership.maxByPlayer[player.id] ?? 0,
      cleanCashEarned: Math.max(0, Number(resources.cash ?? 0) - initial.cash), dirtyCashEarned: Math.max(0, Number(resources["dirty-cash"] ?? 0) - initial.dirtyCash),
      influenceEarned: Math.max(0, ownedInfluence(state, player.id) - initial.influence), buildingsOwned: ownedBuildings.length,
      buildingUpgrades: actions["upgrade-building"] ?? 0, productionStarted: actions["craft-item"] ?? 0, productionCompleted: actions["collect-production"] ?? 0,
      marketOffers: actions["create-player-market-listing"] ?? 0, marketTrades: actions["buy-player-market-listing"] ?? 0, marketVolume: 0,
      bountiesCreated: bounties.filter((bounty) => bounty.createdByPlayerId === player.id).length,
      bountiesClaimed: bounties.filter((bounty) => bounty.claimedByPlayerId === player.id).length,
      bountyValuePaid: bounties.filter((bounty) => bounty.createdByPlayerId === player.id).reduce((sum, bounty) => sum + bounty.rewardCleanCash, 0),
      bountyValueEarned: bounties.filter((bounty) => bounty.claimedByPlayerId === player.id).reduce((sum, bounty) => sum + bounty.rewardCleanCash, 0),
      spyAttempts: actions["spy-district"] ?? 0, spySuccesses: outcomes.spySuccesses ?? 0, spyFailures: outcomes.spyFailures ?? 0,
      robberies: actions["rob-district"] ?? 0, heists: actions["heist-district"] ?? 0, attacksStarted: actions["attack-district"] ?? 0,
      attacksWon: outcomes.attacksWon ?? 0, attacksLost: outcomes.attacksLost ?? 0,
      districtsCaptured: input.ownership.capturedByPlayer[player.id] ?? 0, districtsLost: input.ownership.lostByPlayer[player.id] ?? 0,
      heatGenerated: Math.max(0, Number(police?.heat ?? 0) - initial.heat), maxHeat: Number(police?.heat ?? 0),
      policeRaids: police?.lastRaidCreatedAtTick ? 1 : 0, policePenalties: police?.activeFlags?.length ?? 0,
      allianceJoined: Boolean(player.allianceId), allianceId: player.allianceId,
      purgeOutcome: eliminationReason === "scheduled_weakest_player"
        ? "eliminated-by-purge"
        : player.status === "defeated" ? "defeated-other" : "survived",
      finalLockdownOutcome: state.matchResult?.winnerPlayerId === player.id ? "winner" : "ranked",
      eliminatedAt: player.status === "defeated" && Number.isFinite(eliminatedAt) ? eliminatedAt : null,
      eliminationReason,
      finalPlacement: ranking.get(player.id) ?? 20, winner: state.matchResult?.winnerPlayerId === player.id
    };
  }).sort((left, right) => left.finalPlacement - right.finalPlacement);
};

const captureInitialPlayerState = (server: ServerApp, instanceId: string, bots: SimulationBot[]) => {
  const state = requiredRuntime(server, instanceId).state;
  return Object.fromEntries(bots.map((bot) => {
    const player = state.playersById[bot.playerId]!;
    const resources = state.resourceStatesById[player.resourceStateId]?.balances ?? {};
    return [bot.playerId, { cash: Number(resources.cash ?? 0), dirtyCash: Number(resources["dirty-cash"] ?? 0), influence: ownedInfluence(state, bot.playerId), heat: Number(state.policeStatesById[player.policeStateId]?.heat ?? 0) }];
  }));
};

const calculateMarketVolume = (state: ReturnType<typeof requiredRuntime>["state"]): number =>
  ((state.market as { transactions?: Array<{ totalPrice?: number }> } | undefined)?.transactions ?? [])
    .reduce((sum: number, transaction: { totalPrice?: number }) => sum + Number(transaction.totalPrice ?? 0), 0);

const districtCounts = (state: ReturnType<typeof requiredRuntime>["state"]): Record<string, number> =>
  Object.values(state.districtsById).reduce<Record<string, number>>((counts, district) => {
    if (district.ownerPlayerId && district.status !== "destroyed") counts[district.ownerPlayerId] = (counts[district.ownerPlayerId] ?? 0) + 1;
    return counts;
  }, {});

const ownedInfluence = (state: ReturnType<typeof requiredRuntime>["state"], playerId: string): number =>
  Object.values(state.districtsById).filter((district) => district.ownerPlayerId === playerId && district.status !== "destroyed").reduce((sum, district) => sum + Number(district.influence ?? 0), 0);

const lifecycleSignature = (state: ReturnType<typeof requiredRuntime>["state"]): string =>
  `${state.root.phase}:${state.eliminationState?.eliminatedPlayerIds.length ?? 0}:${state.finalLockdownState?.status ?? "none"}`;

const stateDigest = (state: ReturnType<typeof requiredRuntime>["state"]): string => JSON.stringify({
  root: state.root,
  players: state.playersById,
  districts: state.districtsById,
  resources: state.resourceStatesById,
  market: state.market,
  bounties: state.bountiesById,
  alliances: state.alliancesById,
  police: state.policeStatesById,
  finalLockdown: state.finalLockdownState,
  matchResult: state.matchResult
});

const rotateBots = (bots: SimulationBot[], offset: number): SimulationBot[] => bots.map((_, index) => bots[(index + offset) % bots.length]!);
const seedNumber = (seed: string): number => [...seed].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 0);
const requiredRuntime = (server: ServerApp, instanceId: string) => {
  const runtime = server.instanceManager.getInstanceById(instanceId);
  if (!runtime) throw new Error(`Runtime ${instanceId} is missing.`);
  return runtime;
};
