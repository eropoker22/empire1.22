import { resolveModeConfig } from "@empire/game-config";
import { ServerInstanceManager } from "../runtime";
import { createAdminMonitoringFacade } from "../runtime/monitoring/admin-monitoring-facade";
import { createCommandIngress } from "../transport/command-ingress";
import { createGameplaySliceJsonHandler } from "../transport/gameplay-slice-json-handler";
import { createGameplaySliceTransport } from "../transport/gameplay-slice-transport";
import { createLiveUpdateGateway } from "../transport/live-update-gateway";
import { createInstanceCommandRouter } from "../runtime/orchestration/instance-command-router";
import { createInstanceHealthService } from "../runtime/orchestration/instance-health-service";
import { createSnapshotOrchestrator } from "../runtime/orchestration/snapshot-orchestrator";
import { createTickOrchestrator } from "../runtime/orchestration/tick-orchestrator";
import { createTickLoop } from "../runtime/scheduling/tick-loop";

/**
 * Responsibility: Top-level server application composition root.
 * Belongs here: runtime module registration and cross-layer wiring.
 * Does not belong here: gameplay rules, UI concerns, or inline transport logic.
 */
export const createServerApp = () => {
  const instanceManager = new ServerInstanceManager();
  const commandRouter = createInstanceCommandRouter(instanceManager);
  const commandIngress = createCommandIngress(commandRouter);
  const gameplaySliceTransport = createGameplaySliceTransport(instanceManager, commandIngress);
  const gameplaySliceJsonHandler = createGameplaySliceJsonHandler(gameplaySliceTransport);
  const liveUpdateGateway = createLiveUpdateGateway();
  const tickOrchestrator = createTickOrchestrator(instanceManager);
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
    tickLoop,
    snapshotOrchestrator,
    healthService,
    adminMonitoring
  };
};

export type ServerApp = ReturnType<typeof createServerApp>;
