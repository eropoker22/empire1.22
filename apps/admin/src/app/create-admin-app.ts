import { createAdminAppShell } from "./admin-app-shell";
import {
  bindAdminSecretForm,
  fetchAdminOverviewFromEndpoint,
  renderAdminError
} from "./admin-monitoring-client";
import type {
  InstanceMonitoringSummary
} from "@empire/shared-types";
import {
  createAdminOverviewViewModel,
  createAdminInstanceViewModel,
  createAdminInstanceViewModelFromMonitoringSummary,
  type AdminOverviewViewModel
} from "../read-models";
import { renderInstanceListPage } from "../pages";
import {
  createAdminInstanceReadService,
  createAdminLogReadService,
  createAdminDiagnosticsReadService,
  type AdminDiagnosticsReadFacade,
  type AdminInstanceReadFacade,
  type AdminLogReadFacade
} from "../services";

export interface AdminAppReadFacades {
  instance?: AdminInstanceReadFacade;
  log?: AdminLogReadFacade;
  diagnostics?: AdminDiagnosticsReadFacade;
}

export interface AdminAppOptions {
  facades?: AdminAppReadFacades;
  monitoringEndpoint?: string;
  adminMonitoringSecret?: string;
  /** @deprecated use adminMonitoringSecret */
  adminMonitoringToken?: string;
  fetchAdminOverview?: () => Promise<AdminOverviewViewModel>;
  fetchMonitoringSummaries?: () => Promise<InstanceMonitoringSummary[]>;
}

/**
 * Responsibility: Composition root for the admin application.
 * Belongs here: wiring read services and command boundaries for admin UI modules.
 * Does not belong here: direct gameplay state access or server authority logic.
 */
export const createAdminApp = (options: AdminAppOptions = {}) => {
  const instanceReadService = createAdminInstanceReadService({
    facade: options.facades?.instance
  });
  const logReadService = createAdminLogReadService({
    facade: options.facades?.log
  });
  const diagnosticsReadService = createAdminDiagnosticsReadService({
    facade: options.facades?.diagnostics
  });

  return createAdminAppShell({
    mount: async (target) => {
      const mountTarget = target ?? resolveDefaultMountTarget();
      if (!mountTarget) {
        return;
      }

      mountTarget.innerHTML = renderInstanceListPage(createAdminOverviewViewModel([]));

      try {
        mountTarget.innerHTML = renderInstanceListPage(await loadAdminOverview());
      } catch (error) {
        mountTarget.innerHTML = renderAdminError(error);
        bindAdminSecretForm(mountTarget, () => createAdminApp(options).mount(mountTarget));
      }
    }
  });

  async function loadAdminOverview(): Promise<AdminOverviewViewModel> {
    if (options.fetchAdminOverview) {
      return options.fetchAdminOverview();
    }

    if (!options.fetchMonitoringSummaries && !options.facades?.instance) {
      const endpointOverview = await fetchAdminOverviewFromEndpoint(
        options.monitoringEndpoint ?? "/api/admin/monitoring",
        options.adminMonitoringSecret ?? options.adminMonitoringToken
      );
      if (endpointOverview) {
        return endpointOverview;
      }
    }

    const monitoringSummaries = await loadMonitoringSummaries(options);
    const viewModels = monitoringSummaries.length > 0
      ? monitoringSummaries.map(createAdminInstanceViewModelFromMonitoringSummary)
      : await loadLegacyInstanceViewModels();
    const selectedInstanceId = viewModels[0]?.instanceId ?? null;

    return createAdminOverviewViewModel(
      viewModels,
      {
        selectedLogs: selectedInstanceId ? await loadSelectedLogs(selectedInstanceId) : undefined
      }
    );
  }

  async function loadSelectedLogs(instanceId: string) {
    const [commands, events, diagnostics] = await Promise.all([
      logReadService.listRecentCommandLogs(instanceId, 20),
      logReadService.listRecentEventLogs(instanceId, 20),
      diagnosticsReadService.listRecentDiagnosticLogs(instanceId, 20)
    ]);

    return {
      instanceId,
      commands,
      events,
      diagnostics
    };
  }

  async function loadLegacyInstanceViewModels() {
    const summaries = await instanceReadService.listInstances();
    return Promise.all(summaries.map(async (summary) => {
      const [health, diagnostics, commandVolume, events, diagnosticLogs] = await Promise.all([
        instanceReadService.getHealthSummary(summary.instanceId),
        diagnosticsReadService.getDiagnosticsSummary(summary.instanceId),
        logReadService.getCommandVolumeSummary(summary.instanceId),
        logReadService.listRecentEventLogs(summary.instanceId, 100),
        diagnosticsReadService.listRecentDiagnosticLogs(summary.instanceId, 100)
      ]);

      return createAdminInstanceViewModel(summary, health, diagnostics, {
        commandCount: commandVolume.totalCommands,
        eventCount: events.length,
        diagnosticWarningCount: diagnosticLogs.filter((record) => record.level === "warn").length
      });
    }));
  }
};

const loadMonitoringSummaries = async (
  options: AdminAppOptions
): Promise<InstanceMonitoringSummary[]> => {
  if (options.fetchMonitoringSummaries) {
    return options.fetchMonitoringSummaries();
  }

  const facadeSummaries = await createAdminInstanceReadService({
    facade: options.facades?.instance
  }).listInstanceMonitoringSummaries();

  if (facadeSummaries.length > 0 || options.facades?.instance?.listInstanceMonitoringSummaries) {
    return facadeSummaries;
  }

  return (await fetchAdminOverviewFromEndpoint(
    options.monitoringEndpoint ?? "/api/admin/monitoring",
    options.adminMonitoringSecret ?? options.adminMonitoringToken
  ))?.instances
    .map((instance) => ({
      instanceId: instance.instanceId,
      mode: instance.mode,
      status: instance.status,
      displayName: instance.displayName,
      region: instance.region,
      currentTick: instance.currentTick,
      playerCount: instance.playerCount,
      allianceCount: instance.allianceCount,
      crashCount: instance.crashCount,
      healthStatus: instance.healthStatus,
      warningCount: instance.warningCount,
      lastTickStartedAt: instance.lastTickStartedAt,
      lastTickCompletedAt: instance.lastTickCompletedAt,
      lastErrorAt: instance.lastErrorAt,
      queuedEventCount: instance.queuedEventCount,
      commandCount: instance.commandCount,
      eventCount: instance.eventCount,
      diagnosticErrorCount: instance.diagnosticErrorCount,
      lastSnapshotAt: instance.lastSnapshotAt
    })) ?? [];
};

const resolveDefaultMountTarget = (): HTMLElement | null =>
  typeof document === "undefined"
    ? null
    : document.getElementById("admin-dashboard-root");
