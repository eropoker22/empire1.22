import type { AdminInstanceDetailView, AdminOverviewView, AdminSessionView } from "@empire/shared-types";
import { AdminApiError, createAdminApiClient, type AdminApiClient } from "./admin-monitoring-client";
import { renderDashboard, renderLoading, renderLogin, renderUnavailable } from "./read-only-admin-page";

const POLL_INTERVAL_MS = 10_000;
const MAX_BACKOFF_MS = 80_000;

export interface AdminAppOptions { client?: AdminApiClient; pollIntervalMs?: number; }

export const createAdminApp = (options: AdminAppOptions = {}) => {
  const client = options.client ?? createAdminApiClient();
  const pollInterval = Math.max(1_000, options.pollIntervalMs ?? POLL_INTERVAL_MS);
  let target: HTMLElement | null = null;
  let session: AdminSessionView | null = null;
  let overview: AdminOverviewView | null = null;
  let detail: AdminInstanceDetailView | null = null;
  let selectedInstanceId: string | null = selectedFromUrl();
  let requestSequence = 0;
  let activeRequest: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let backoff = pollInterval;

  const mount = async (mountTarget?: HTMLElement | null): Promise<void> => {
    target = mountTarget ?? document.getElementById("admin-dashboard-root");
    if (!target) return;
    target.innerHTML = renderLoading();
    document.addEventListener("visibilitychange", handleVisibility);
    try { session = await client.getSession(); await refresh(); } catch (error) { handleError(error); }
  };

  const refresh = async (): Promise<void> => {
    if (!target || !session || document.hidden) return;
    const sequence = ++requestSequence;
    activeRequest?.abort();
    activeRequest = new AbortController();
    try {
      const requestedInstanceId = selectedInstanceId;
      const [nextOverview, nextDetail] = await Promise.all([
        client.getOverview(activeRequest.signal),
        requestedInstanceId ? client.getInstance(requestedInstanceId, activeRequest.signal) : Promise.resolve(null)
      ]);
      if (sequence !== requestSequence || requestedInstanceId !== selectedInstanceId) return;
      overview = nextOverview;
      detail = nextDetail;
      backoff = pollInterval;
      render();
      schedule(pollInterval);
    } catch (error) {
      if (isAbort(error)) return;
      backoff = Math.min(MAX_BACKOFF_MS, backoff * 2);
      handleError(error);
      if (session) schedule(backoff);
    }
  };

  const render = (): void => {
    if (!target || !session || !overview) return;
    target.innerHTML = renderDashboard({ session, overview, detail, selectedInstanceId });
    bindActions();
  };

  const bindActions = (): void => {
    target?.querySelectorAll<HTMLElement>("[data-admin-instance]").forEach((link) => link.addEventListener("click", (event) => {
      event.preventDefault();
      const next = link.dataset.adminInstance?.trim() || null;
      if (next === selectedInstanceId) return;
      selectedInstanceId = next;
      detail = null;
      updateUrl(next);
      render();
      void refresh();
    }));
    target?.querySelector<HTMLElement>("[data-admin-refresh]")?.addEventListener("click", () => void refresh());
    target?.querySelector<HTMLElement>("[data-admin-logout]")?.addEventListener("click", () => void logout());
  };

  const bindLogin = (): void => {
    const form = target?.querySelector<HTMLFormElement>("[data-admin-login]");
    const input = target?.querySelector<HTMLInputElement>("[data-admin-secret]");
    if (!form || !input) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const secret = input.value;
      input.value = "";
      try {
        session = await client.login(secret);
        overview = null;
        detail = null;
        target!.innerHTML = renderLoading();
        await refresh();
      } catch (error) {
        const message = target?.querySelector<HTMLElement>("[data-admin-login-error]");
        if (message) message.textContent = error instanceof Error ? error.message : "Přihlášení selhalo.";
      }
    });
  };

  const logout = async (): Promise<void> => {
    activeRequest?.abort(); clearSchedule();
    try { await client.logout(); } catch (_error) { /* The server clears the cookie whenever reachable. */ }
    session = null; overview = null; detail = null;
    if (target) target.innerHTML = renderLogin("Admin session byla ukončena.");
    bindLogin();
  };

  const handleError = (error: unknown): void => {
    if (!target) return;
    if (error instanceof AdminApiError && (error.status === 401 || error.code.includes("SESSION"))) {
      session = null; overview = null; detail = null;
      target.innerHTML = renderLogin(error.code === "ADMIN_SESSION_EXPIRED" ? "Admin session vypršela." : undefined);
      bindLogin();
      return;
    }
    target.innerHTML = renderUnavailable(error instanceof Error ? error.message : "Monitoring není dostupný.");
    target.querySelector<HTMLElement>("[data-admin-refresh]")?.addEventListener("click", () => void refresh());
  };

  const handleVisibility = (): void => {
    if (document.hidden) { activeRequest?.abort(); clearSchedule(); }
    else if (session) void refresh();
  };
  const schedule = (delay: number): void => { clearSchedule(); timer = setTimeout(() => void refresh(), delay); };
  const clearSchedule = (): void => { if (timer) clearTimeout(timer); timer = null; };
  return { mount, refresh };
};

const selectedFromUrl = (): string | null => typeof location === "undefined" ? null : new URL(location.href).searchParams.get("instance");
const updateUrl = (instanceId: string | null): void => {
  const url = new URL(location.href);
  instanceId ? url.searchParams.set("instance", instanceId) : url.searchParams.delete("instance");
  history.replaceState(null, "", url);
};
const isAbort = (error: unknown): boolean => error instanceof DOMException && error.name === "AbortError";
