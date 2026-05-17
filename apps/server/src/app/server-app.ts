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
import type { Clock } from "../runtime/scheduling/clock";
import { createTickLoop } from "../runtime/scheduling/tick-loop";
import type { ServerRuntimePersistenceRepositories } from "../runtime";

/**
 * Responsibility: Top-level server application composition root.
 * Belongs here: runtime module registration and cross-layer wiring.
 * Does not belong here: gameplay rules, UI concerns, or inline transport logic.
 */
export interface ServerAppOptions {
  clock?: Clock;
  persistence?: ServerRuntimePersistenceRepositories;
  gameplaySessionTokenSecret?: string;
}

const DEFAULT_DEV_GAMEPLAY_SESSION_TOKEN_SECRET = "empire-streets-local-gameplay-session-dev-secret";

export const createServerApp = (options: ServerAppOptions = {}) => {
  const instanceManager = new ServerInstanceManager({
    clock: options.clock,
    persistence: options.persistence
  });
  const commandRouter = createInstanceCommandRouter(instanceManager);
  const commandIngress = createCommandIngress(commandRouter);
  const gameplaySessionTokenCodec = createGameplaySessionTokenCodec({
    secret: options.gameplaySessionTokenSecret ?? DEFAULT_DEV_GAMEPLAY_SESSION_TOKEN_SECRET
  });
  const gameplaySliceTransport = createGameplaySliceTransport(instanceManager, commandIngress, {
    sessionTokenCodec: gameplaySessionTokenCodec
  });
  const gameplaySliceJsonHandler = createGameplaySliceJsonHandler(gameplaySliceTransport);
  const liveUpdateGateway = createLiveUpdateGateway();
  const tickOrchestrator = createTickOrchestrator(instanceManager);
  const serverInstanceCreationService = createServerInstanceCreationService(instanceManager, {
    clock: options.clock
  });
  const tickLoop = createTickLoop({
    tickOrchestrator,
    intervalMs: resolveModeConfig("free").tickRateMs
  });
  const snapshotOrchestrator = createSnapshotOrchestrator(instanceManager);
  const healthService = createInstanceHealthService(instanceManager);
  const adminMonitoring = createAdminMonitoringFacade(instanceManager, healthService);

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
    adminMonitoring
  };
};

export type ServerApp = ReturnType<typeof createServerApp>;
