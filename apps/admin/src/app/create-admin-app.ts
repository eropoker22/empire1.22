import type { AdminAuditEntryView, AdminControlPlaneAvailabilityView, AdminInstanceDetailView, AdminOverviewView, AdminSessionView } from "@empire/shared-types";
import {
  applyAdminServerFilters,
  captureAdminPageState,
  captureAdminFocus,
  DEFAULT_ADMIN_SERVER_FILTERS,
  hasFocusedAdminInput,
  isAdminLoopbackLocation,
  readAdminFrontendBuildSha,
  restoreAdminFocus,
  restoreAdminPageState,
  selectedAdminInstanceFromUrl,
  updateAdminRefreshUi,
  updateAdminInstanceUrl,
  type AdminServerFilterState
} from "./admin-app-dom";
import { createAdminAppControllers } from "./admin-app-controllers";
import { ADMIN_MAX_BACKOFF_MS, ADMIN_POLL_INTERVAL_MS, type AdminAppOptions } from "./admin-app-options";
import { createAdminDashboardBindings } from "./admin-dashboard-bindings";
import { initialAdminLoginMessage, isSessionError } from "./admin-login-error-messages";
import { createAdminLoginController } from "./admin-login-controller";
import { createAdminApiClient } from "./admin-monitoring-client";
import { createAdminRefreshController } from "./admin-refresh-controller";
import { renderDashboard, renderLoading, renderLogin, renderUnavailable, type AdminDashboardNotice, type AdminRefreshStatus } from "./read-only-admin-page";
export const createAdminApp = (options: AdminAppOptions = {}) => {
  const client = options.client ?? createAdminApiClient();
  const pollInterval = Math.max(1_000, options.pollIntervalMs ?? ADMIN_POLL_INTERVAL_MS);
  let target: HTMLElement | null = null;
  let session: AdminSessionView | null = null;
  let overview: AdminOverviewView | null = null;
  let detail: AdminInstanceDetailView | null = null;
  let controlPlane: AdminControlPlaneAvailabilityView | null = null;
  let auditEntries: AdminAuditEntryView[] | null = null;
  let auditError: string | null = null;
  let selectedInstanceId = selectedAdminInstanceFromUrl();
  let refreshStatus: AdminRefreshStatus = "loading";
  let lastSuccessfulRefreshAt: string | null = null;
  let refreshError: string | null = null;
  let serverFilters: AdminServerFilterState = { ...DEFAULT_ADMIN_SERVER_FILTERS };
  let mobileNavOpen = false;
  let notice: AdminDashboardNotice | null = null;
  const actionReasons = new Map<string, string>();
  let lifecycleSequence = 0;
  let wizardOpen = false;
  let wizardStep = 1;
  let createIdempotencyKey: string | null = null;
  let mounted = false;
  let pendingRender = false;
  const mount = async (mountTarget?: HTMLElement | null): Promise<void> => {
    if (mounted) return;
    const lifecycle = ++lifecycleSequence;
    mounted = true;
    target = mountTarget ?? document.getElementById("admin-dashboard-root");
    if (!target) { mounted = false; return; }
    target.innerHTML = renderLoading();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", destroy, { once: true });
    try {
      const nextSession = await client.getSession();
      if (!mounted || lifecycle !== lifecycleSequence) return;
      session = nextSession;
      registration.start();
      await refresh();
    } catch (error) {
      if (!mounted || lifecycle !== lifecycleSequence) return;
      showLogin(initialAdminLoginMessage(error));
    }
  };

  const refresh = async (includeAudit = false): Promise<void> => {
    await refreshController.refresh(includeAudit);
  };

  const render = (): void => {
    if (!mounted || !target || !session || !overview) return;
    const focusSnapshot = captureAdminFocus(target);
    const pageStateSnapshot = captureAdminPageState(target);
    target.innerHTML = renderDashboard({
      session,
      overview,
      detail,
      selectedInstanceId,
      controlPlane,
      wizardOpen,
      wizardStep,
      frontendBuildSha: readAdminFrontendBuildSha(),
      localDevelopment: isAdminLoopbackLocation(),
      auditEntries,
      auditError,
      refreshStatus,
      lastSuccessfulRefreshAt,
      refreshError,
      serverFilters,
      mobileNavOpen,
      notice
    });
    pendingRender = false;
    bindings.bind();
    registration.restoreDraft();
    registration.updateCountdowns();
    applyAdminServerFilters(target, serverFilters);
    restoreAdminFocus(target, focusSnapshot);
    restoreAdminPageState(target, pageStateSnapshot);
  };

  const renderOrDefer = (): void => {
    if (hasFocusedAdminInput(target) || target?.querySelector("[role=dialog]")) pendingRender = true;
    else render();
  };

  const flushPendingRender = (): void => {
    if (pendingRender && !hasFocusedAdminInput(target)) render();
  };

  const logout = async (): Promise<void> => {
    refreshController.cancel();
    registration.stop();
    try { await client.logout(); } catch (_error) { /* Server clears the cookie whenever reachable. */ }
    showLogin("Admin session byla ukončena.");
  };

  const showLogin = (message?: string): void => {
    refreshController.cancel();
    registration.stop();
    session = null;
    overview = null;
    detail = null;
    controlPlane = null;
    auditEntries = null;
    auditError = null;
    if (target) target.innerHTML = renderLogin(message);
    login.bind();
  };

  const handleError = (error: unknown): void => {
    if (!target) return;
    if (isSessionError(error)) {
      showLogin(error instanceof Error && "code" in error && error.code === "ADMIN_SESSION_EXPIRED"
        ? "Admin session vypršela."
        : undefined);
      return;
    }
    refreshError = error instanceof Error ? error.message : "Monitoring není dostupný.";
    refreshStatus = "backoff";
    if (session && overview) renderOrDefer();
    else {
      target.innerHTML = renderUnavailable(refreshError);
      target.querySelector<HTMLElement>("[data-admin-refresh]")?.addEventListener("click", () => void refresh());
    }
  };

  const handleVisibility = (): void => {
    if (document.hidden) {
      registration.stop();
      refreshController.pause();
    } else if (session) {
      registration.start();
      void refresh();
    }
  };

  const setRefreshStatus = (status: AdminRefreshStatus): void => {
    refreshStatus = status;
    updateAdminRefreshUi(target, status);
  };

  const destroy = (): void => {
    if (!mounted) return;
    mounted = false;
    lifecycleSequence += 1;
    refreshController.cancel();
    registration.stop();
    document.removeEventListener("visibilitychange", handleVisibility);
    window.removeEventListener("pagehide", destroy);
    target = null;
  };

  const { registration, lifecycle, creation } = createAdminAppControllers({
    client,
    target: () => target,
    selectedInstanceId: () => selectedInstanceId,
    selectInstance: (instanceId) => { selectedInstanceId = instanceId; updateAdminInstanceUrl(instanceId); },
    controlPlane: () => controlPlane,
    actionReasons,
    wizardState: () => ({ wizardOpen, wizardStep, idempotencyKey: createIdempotencyKey }),
    updateWizardState: (next) => {
      if (next.wizardOpen !== undefined) wizardOpen = next.wizardOpen;
      if (next.wizardStep !== undefined) wizardStep = next.wizardStep;
      if (next.idempotencyKey !== undefined) createIdempotencyKey = next.idempotencyKey;
    },
    render,
    refresh,
    clearAudit: () => { auditEntries = null; },
    setNotice: (next) => { notice = next; },
    onServerArchived: () => {
      selectedInstanceId = null; detail = null;
      updateAdminInstanceUrl(null); serverFilters = { ...serverFilters, visibility: "active" };
    }
  });
  const login = createAdminLoginController({
    client,
    target: () => target,
    onAuthenticated: async (authenticatedSession) => {
      session = authenticatedSession;
      overview = null;
      controlPlane = null;
      detail = null;
      auditEntries = null;
      if (target) target.innerHTML = renderLoading();
      registration.start();
      await refresh();
    }
  });
  const refreshController = createAdminRefreshController({
    client,
    pollInterval,
    maxBackoff: ADMIN_MAX_BACKOFF_MS,
    context: () => ({ mounted, session, selectedInstanceId, wizardOpen, auditEntries, auditError }),
    apply: (result) => {
      overview = result.overview;
      detail = result.detail;
      controlPlane = result.controlPlane;
      auditEntries = result.auditEntries;
      auditError = result.auditError;
      refreshError = null;
      lastSuccessfulRefreshAt = result.refreshedAt;
    },
    syncClock: (generatedAt) => registration.syncClock(generatedAt),
    render: renderOrDefer,
    onStatus: setRefreshStatus,
    onError: handleError
  });
  const bindings = createAdminDashboardBindings({
    target: () => target,
    selectedInstanceId: () => selectedInstanceId,
    selectInstance: (instanceId) => { selectedInstanceId = instanceId; detail = null; },
    render,
    refresh,
    logout,
    dismissNotice: () => { notice = null; render(); },
    serverFilters: () => serverFilters,
    updateServerFilters: (next) => { serverFilters = { ...serverFilters, ...next }; },
    mobileNavOpen: () => mobileNavOpen,
    setMobileNavOpen: (open) => { mobileNavOpen = open; },
    flushPendingRender,
    controllers: [creation, lifecycle, registration]
  });
  return { mount, refresh: () => refresh(), destroy };
};
