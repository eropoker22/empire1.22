import { resolveModeConfig } from "@empire/game-config";
import { ServerInstanceManager } from "../runtime";
import { createAdminMonitoringFacade } from "../runtime/monitoring/admin-monitoring-facade";
import { createCommandIngress } from "../transport/command-ingress";
import { createGameplaySliceJsonHandler } from "../transport/gameplay-slice-json-handler";
import { createGameplaySliceTransport } from "../transport/gameplay-slice-transport";
import { createGameplaySessionTokenCodec } from "../transport/gameplay-session-token-codec";
import { createLiveUpdateGateway } from "../transport/live-update-gateway";
import { createInstanceCommandRouter } from "../runtime/orchestration/instance-command-router";
import { createInstanceHealthService } from "../runtime/orchestration/instance-health-service";
import { createSnapshotOrchestrator } from "../runtime/orchestration/snapshot-orchestrator";
import { createTickOrchestrator } from "../runtime/orchestration/tick-orchestrator";
import { createServerInstanceCreationService } from "../runtime/instance-manager/server-instance-creation-service";
import { createPublicServerMatchmakingService } from "../runtime/matchmaking/public-server-matchmaking-service";
import type { Clock } from "../runtime/scheduling/clock";
import { createTickLoop } from "../runtime/scheduling/tick-loop";
import type { ServerRuntimePersistenceRepositories } from "../runtime";
import { createRuntimePersistenceRepositoriesFromEnvironment } from "../runtime/instance-manager/instance-factory";
import {
  createDevAccountIdentityProvider,
  createInMemoryGameplaySessionService,
  createPersistentGameplaySessionService,
  createUnavailableAccountIdentityProvider,
  createUnavailableGameplaySessionService,
  type AccountIdentityProvider,
  type GameplaySessionService
} from "../auth";
import {
  createPostgresDatabase,
  createPostgresGameplayIdentitySessionRepository
} from "../runtime/persistence/postgres";
import { readPlayerAccountCookie } from "../player-entry/player-account-cookie";
import { createPostgresPlayerEntryRepository } from "../player-entry/postgres-player-entry-repository";

/**
 * Responsibility: Top-level server application composition root.
 * Belongs here: runtime module registration and cross-layer wiring.
 * Does not belong here: gameplay rules, UI concerns, or inline transport logic.
 */
export interface ServerAppOptions {
  clock?: Clock;
  persistence?: ServerRuntimePersistenceRepositories;
  environment?: Record<string, string | undefined>;
  gameplaySessionTokenSecret?: string;
  accountIdentityProvider?: AccountIdentityProvider | null;
  gameplaySessionService?: GameplaySessionService | null;
}

const DEFAULT_DEV_GAMEPLAY_SESSION_TOKEN_SECRET = "empire-streets-local-gameplay-session-dev-secret";

export const createServerApp = (options: ServerAppOptions = {}) => {
  const isProduction = options.environment?.NODE_ENV === "production";
  const selectedPersistence = options.persistence ?? createRuntimePersistenceRepositoriesFromEnvironment(options.environment);
  const persistence = isProduction && selectedPersistence.atomicCommandPersistenceMode !== "transactional"
    ? {
        ...selectedPersistence,
        commandReservationRepository: undefined,
        commandResultRepository: undefined,
        outboxRepository: undefined,
        atomicCommandTransaction: undefined
      }
    : selectedPersistence;
  const instanceManager = new ServerInstanceManager({
    clock: options.clock,
    persistence
  });
  const commandRouter = createInstanceCommandRouter(instanceManager);
  const commandIngress = createCommandIngress(commandRouter);
  const gameplaySessionTokenSecret = options.gameplaySessionTokenSecret ??
    options.environment?.GAMEPLAY_SLICE_SESSION_SECRET?.trim() ??
    (options.environment?.NODE_ENV === "production" ? null : DEFAULT_DEV_GAMEPLAY_SESSION_TOKEN_SECRET);
  const gameplaySessionTokenCodec = gameplaySessionTokenSecret
    ? createGameplaySessionTokenCodec({
        secret: gameplaySessionTokenSecret,
        clock: options.clock
      })
    : null;
  const accountIdentityProvider = options.accountIdentityProvider ?? createDefaultAccountIdentityProvider({
    environment: options.environment,
    isProduction
  });
  const gameplaySessionService = options.gameplaySessionService ?? createDefaultGameplaySessionService({
    environment: options.environment,
    isProduction
  });
  const gameplaySliceTransport = createGameplaySliceTransport(instanceManager, commandIngress, {
    sessionTokenCodec: gameplaySessionTokenCodec,
    gameplaySessionService
  });
  const gameplaySliceJsonHandler = createGameplaySliceJsonHandler(gameplaySliceTransport);
  const liveUpdateGateway = createLiveUpdateGateway();
  const tickOrchestrator = createTickOrchestrator(instanceManager);
  const serverInstanceCreationService = createServerInstanceCreationService(instanceManager, {
    clock: options.clock
  });
  const tickLoop = createTickLoop({
    tickOrchestrator,
    // Poll at the fastest public cadence; each instance scheduler gates actual
    // ticks with its own mode config tickRateMs.
    intervalMs: resolveModeConfig("free").tickRateMs
  });
  const snapshotOrchestrator = createSnapshotOrchestrator(instanceManager);
  const healthService = createInstanceHealthService(instanceManager);
  const adminMonitoring = createAdminMonitoringFacade(instanceManager, healthService);
  const publicServerMatchmaking = createPublicServerMatchmakingService(instanceManager, {
    clock: options.clock
  });

  return {
    instanceManager,
    commandIngress,
    gameplaySliceTransport,
    gameplaySliceJsonHandler,
    liveUpdateGateway,
    tickOrchestrator,
    serverInstanceCreationService,
    tickLoop,
    snapshotOrchestrator,
    healthService,
    adminMonitoring,
    publicServerMatchmaking,
    accountIdentityProvider,
    gameplaySessionService,
    gameplaySessionTokenCodec
  };
};

export type ServerApp = ReturnType<typeof createServerApp>;

const createDefaultGameplaySessionService = (
  options: {
    environment?: Record<string, string | undefined>;
    isProduction: boolean;
  }
): GameplaySessionService => {
  const driver = String(options.environment?.EMPIRE_PERSISTENCE_DRIVER ?? options.environment?.GAMEPLAY_PERSISTENCE_DRIVER ?? "")
    .trim().toLowerCase();
  const databaseUrl = String(
    options.environment?.EMPIRE_DATABASE_URL ??
    options.environment?.GAMEPLAY_DATABASE_URL ??
    ""
  ).trim();

  if (driver === "postgres" && databaseUrl) {
    const database = createPostgresDatabase(databaseUrl);
    return createPersistentGameplaySessionService(
      createPostgresGameplayIdentitySessionRepository(database),
      { productionReady: true }
    );
  }
  return options.isProduction
    ? createUnavailableGameplaySessionService()
    : createInMemoryGameplaySessionService({ productionReady: true });
};

const createDefaultAccountIdentityProvider = (options: {
  environment?: Record<string, string | undefined>;
  isProduction: boolean;
}): AccountIdentityProvider => {
  const driver = String(options.environment?.EMPIRE_PERSISTENCE_DRIVER ?? options.environment?.GAMEPLAY_PERSISTENCE_DRIVER ?? "")
    .trim().toLowerCase();
  const databaseUrl = String(options.environment?.EMPIRE_DATABASE_URL ?? options.environment?.GAMEPLAY_DATABASE_URL ?? "").trim();
  if (driver === "postgres" && databaseUrl) {
    const repository = createPostgresPlayerEntryRepository(createPostgresDatabase(databaseUrl));
    return {
      productionReady: true,
      resolve: async ({ headers }) => {
        const account = await repository.authenticate(readPlayerAccountCookie(headers) ?? "", false);
        return account ? { accountId: account.accountId, provider: "production" } : null;
      }
    };
  }
  return options.isProduction ? createUnavailableAccountIdentityProvider() : createDevAccountIdentityProvider({ allow: true });
};
