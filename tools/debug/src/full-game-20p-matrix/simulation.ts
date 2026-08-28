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
import { createMutableSimulationClock } from "./mutable-clock";
import {
  buildReport,
  captureInitialPlayerState,
  initializeOwnershipTracking,
  lifecycleSignature,
  rotateBots,
  seedNumber,
  stateDigest,
  updateOwnershipTracking
} from "./simulation-report";
import type { FullGameReport, FullGameScenario } from "./types";

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

const requiredRuntime = (server: ServerApp, instanceId: string) => {
  const runtime = server.instanceManager.getInstanceById(instanceId);
  if (!runtime) throw new Error(`Runtime ${instanceId} is missing.`);
  return runtime;
};
