import type {
  AdminAuditEntryView,
  AdminControlPlaneAvailabilityView,
  AdminInstanceDetailView,
  AdminOverviewView,
  AdminSessionView
} from "@empire/shared-types";
import { isAbortError } from "./admin-app-dom";
import { isSessionError } from "./admin-login-error-messages";
import type { AdminApiClient } from "./admin-monitoring-client";
import type { AdminRefreshStatus } from "./read-only-admin-page";

interface Context {
  mounted: boolean;
  session: AdminSessionView | null;
  selectedInstanceId: string | null;
  wizardOpen: boolean;
  auditEntries: AdminAuditEntryView[] | null;
  auditError: string | null;
}

interface RefreshResult {
  overview: AdminOverviewView;
  detail: AdminInstanceDetailView | null;
  controlPlane: AdminControlPlaneAvailabilityView;
  auditEntries: AdminAuditEntryView[] | null;
  auditError: string | null;
  refreshedAt: string;
}

export const createAdminRefreshController = (options: {
  client: AdminApiClient;
  pollInterval: number;
  maxBackoff: number;
  context: () => Context;
  apply: (result: RefreshResult) => void;
  syncClock: (generatedAt: string) => void;
  render: () => void;
  onStatus: (status: AdminRefreshStatus) => void;
  onError: (error: unknown) => void;
}) => {
  let requestSequence = 0;
  let activeRequest: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let backoff = options.pollInterval;

  const refresh = async (includeAudit = false): Promise<void> => {
    const context = options.context();
    if (!context.mounted || !context.session) return;
    if (document.hidden) { options.onStatus("paused"); return; }
    if (context.wizardOpen) { schedule(options.pollInterval); return; }
    const sequence = ++requestSequence;
    activeRequest?.abort();
    activeRequest = new AbortController();
    options.onStatus("loading");
    try {
      const requestedInstanceId = context.selectedInstanceId;
      const [overview, detail, controlPlane] = await Promise.all([
        options.client.getOverview(activeRequest.signal),
        requestedInstanceId ? options.client.getInstance(requestedInstanceId, activeRequest.signal) : Promise.resolve(null),
        options.client.getControlPlane(activeRequest.signal)
      ]);
      const audit = await loadAudit(context, includeAudit, activeRequest.signal);
      if (sequence !== requestSequence || requestedInstanceId !== options.context().selectedInstanceId) return;
      options.apply({
        overview,
        detail,
        controlPlane,
        auditEntries: audit.entries,
        auditError: audit.error,
        refreshedAt: new Date().toISOString()
      });
      options.syncClock(controlPlane.generatedAt);
      backoff = options.pollInterval;
      options.onStatus("current");
      options.render();
      schedule(options.pollInterval);
    } catch (error) {
      if (isAbortError(error)) return;
      backoff = Math.min(options.maxBackoff, backoff * 2);
      options.onStatus("backoff");
      options.onError(error);
      if (options.context().session) schedule(backoff);
    }
  };

  const loadAudit = async (context: Context, force: boolean, signal: AbortSignal) => {
    if (context.session?.role !== "owner" || (!force && context.auditEntries !== null)) {
      return { entries: context.auditEntries, error: context.auditError };
    }
    try {
      return { entries: await options.client.getAudit(signal), error: null };
    } catch (error) {
      if (isSessionError(error) || isAbortError(error)) throw error;
      return { entries: context.auditEntries, error: error instanceof Error ? error.message : "Audit trail není dostupný." };
    }
  };

  const schedule = (delay: number): void => {
    clearSchedule();
    if (options.context().mounted) timer = setTimeout(() => void refresh(), delay);
  };
  const clearSchedule = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  const cancel = (): void => {
    requestSequence += 1;
    activeRequest?.abort();
    activeRequest = null;
    clearSchedule();
  };
  const pause = (): void => {
    cancel();
    options.onStatus("paused");
  };

  return { refresh, cancel, pause };
};
