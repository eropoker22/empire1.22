import type { AdminControlPlaneAvailabilityView, AdminCreateServerRequestView, AdminInstanceDetailView, AdminOverviewView, AdminSessionView, HostedLifecycleAction } from "@empire/shared-types";
import { AdminApiError, createAdminApiClient, type AdminApiClient } from "./admin-monitoring-client";
import { mapTotal, updateWizardReview, validateWizardPanel } from "./admin-create-wizard";
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
  let controlPlane: AdminControlPlaneAvailabilityView | null = null;
  let selectedInstanceId: string | null = selectedFromUrl();
  let requestSequence = 0;
  let activeRequest: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let backoff = pollInterval;
  let wizardOpen = false;
  let wizardStep = 1;
  let createIdempotencyKey: string | null = null;

  const mount = async (mountTarget?: HTMLElement | null): Promise<void> => {
    target = mountTarget ?? document.getElementById("admin-dashboard-root");
    if (!target) return;
    target.innerHTML = renderLoading();
    document.addEventListener("visibilitychange", handleVisibility);
    try { session = await client.getSession(); await refresh(); } catch (error) { handleError(error); }
  };

  const refresh = async (): Promise<void> => {
    if (!target || !session || document.hidden) return;
    if (wizardOpen) { schedule(pollInterval); return; }
    const sequence = ++requestSequence;
    activeRequest?.abort();
    activeRequest = new AbortController();
    try {
      const requestedInstanceId = selectedInstanceId;
      const [nextOverview, nextDetail, nextControlPlane] = await Promise.all([
        client.getOverview(activeRequest.signal),
        requestedInstanceId ? client.getInstance(requestedInstanceId, activeRequest.signal) : Promise.resolve(null),
        client.getControlPlane(activeRequest.signal)
      ]);
      if (sequence !== requestSequence || requestedInstanceId !== selectedInstanceId) return;
      overview = nextOverview;
      detail = nextDetail;
      controlPlane = nextControlPlane;
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
    target.innerHTML = renderDashboard({ session, overview, detail, selectedInstanceId, controlPlane, wizardOpen, wizardStep });
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
    target?.querySelector<HTMLElement>("[data-admin-create-open]")?.addEventListener("click", () => {
      wizardOpen = true; wizardStep = 1; createIdempotencyKey ??= createKey(); render();
    });
    target?.querySelector<HTMLElement>("[data-admin-create-cancel]")?.addEventListener("click", () => {
      wizardOpen = false; wizardStep = 1; createIdempotencyKey = null; render();
    });
    target?.querySelectorAll<HTMLElement>("[data-admin-wizard-next]").forEach((button) => button.addEventListener("click", () => {
      const form = target?.querySelector<HTMLFormElement>("[data-admin-create-form]");
      if (!form || !validateWizardPanel(form, wizardStep)) return;
      wizardStep = Math.min(4, wizardStep + 1); applyWizardStep();
    }));
    target?.querySelectorAll<HTMLElement>("[data-admin-wizard-back]").forEach((button) => button.addEventListener("click", () => {
      wizardStep = Math.max(1, wizardStep - 1); applyWizardStep();
    }));
    bindMapTotal();
    target?.querySelector<HTMLFormElement>("[data-admin-create-form]")?.addEventListener("submit", (event) => void submitCreate(event));
    target?.querySelectorAll<HTMLButtonElement>("[data-admin-lifecycle]").forEach((button) => button.addEventListener("click", () => void submitLifecycle(button)));
  };

  const submitCreate = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity() || !createIdempotencyKey) return;
    if (mapTotal(form) !== 161) {
      const message = form.querySelector<HTMLElement>("[data-admin-create-error]");
      if (message) message.textContent = "Mapa musí obsahovat přesně 161 districtů.";
      return;
    }
    const data = new FormData(form);
    const payload: AdminCreateServerRequestView = {
      displayName: String(data.get("displayName") ?? ""), mode: String(data.get("mode")) as "free" | "war",
      region: String(data.get("region")), capacity: Number(data.get("capacity")),
      joinPolicy: String(data.get("joinPolicy")) as AdminCreateServerRequestView["joinPolicy"],
      mapComposition: { downtown: 8, commercial: Number(data.get("commercial")), residential: Number(data.get("residential")),
        industrial: Number(data.get("industrial")), park: Number(data.get("park")) }
    };
    const submit = form.querySelector<HTMLButtonElement>("[type=submit]");
    if (submit) submit.disabled = true;
    try {
      const result = await client.createServer(payload, createIdempotencyKey);
      selectedInstanceId = result.server.serverInstanceId; updateUrl(selectedInstanceId);
      wizardOpen = false; wizardStep = 1; createIdempotencyKey = null;
      await refresh();
    } catch (error) {
      const message = form.querySelector<HTMLElement>("[data-admin-create-error]");
      if (message) message.textContent = error instanceof Error ? error.message : "Server nebylo možné vytvořit.";
      if (submit) submit.disabled = false;
    }
  };

  const submitLifecycle = async (button: HTMLButtonElement): Promise<void> => {
    const instanceId = button.dataset.adminServerId;
    const action = button.dataset.adminLifecycle as HostedLifecycleAction | undefined;
    const hosted = controlPlane?.servers.find((entry) => entry.serverInstanceId === instanceId);
    const reason = target?.querySelector<HTMLInputElement>("[data-admin-action-reason]")?.value.trim() ?? "";
    if (!instanceId || !action || !hosted) return;
    if (reason.length < 3) {
      const message = target?.querySelector<HTMLElement>("[data-admin-action-error]");
      if (message) message.textContent = "Uveďte důvod akce alespoň třemi znaky.";
      return;
    }
    button.disabled = true;
    try {
      await client.requestLifecycleAction(instanceId, { action, expectedVersion: hosted.version, reason }, createKey());
      await refresh();
    } catch (error) {
      const message = target?.querySelector<HTMLElement>("[data-admin-action-error]");
      if (message) message.textContent = error instanceof Error ? error.message : "Akci nebylo možné zařadit.";
      button.disabled = false;
    }
  };

  const bindMapTotal = (): void => {
    const form = target?.querySelector<HTMLFormElement>("[data-admin-create-form]");
    const output = form?.querySelector<HTMLOutputElement>("[data-admin-map-total]");
    if (!form || !output) return;
    const update = () => {
      const total = mapTotal(form);
      output.value = String(total); output.dataset.valid = String(total === 161);
      updateWizardReview(form);
    };
    form.querySelectorAll<HTMLInputElement>("[data-admin-map-count]").forEach((input) => input.addEventListener("input", update));
    update();
  };

  const applyWizardStep = (): void => {
    target?.querySelectorAll<HTMLElement>("[data-admin-wizard-panel]").forEach((panel) => {
      panel.hidden = Number(panel.dataset.adminWizardPanel) !== wizardStep;
    });
    const form = target?.querySelector<HTMLFormElement>("[data-admin-create-form]");
    if (form) updateWizardReview(form);
  };

  const bindLogin = (): void => {
    const form = target?.querySelector<HTMLFormElement>("[data-admin-login]");
    const usernameInput = target?.querySelector<HTMLInputElement>("[data-admin-username]");
    const passwordInput = target?.querySelector<HTMLInputElement>("[data-admin-password]");
    if (!form || !usernameInput || !passwordInput) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const username = usernameInput.value;
      const password = passwordInput.value;
      passwordInput.value = "";
      try {
        session = await client.login(username, password);
        overview = null; controlPlane = null;
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
    session = null; overview = null; detail = null; controlPlane = null;
    if (target) target.innerHTML = renderLogin("Admin session byla ukončena.");
    bindLogin();
  };

  const handleError = (error: unknown): void => {
    if (!target) return;
    if (error instanceof AdminApiError && (error.status === 401 || error.code.includes("SESSION"))) {
      session = null; overview = null; detail = null; controlPlane = null;
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
const createKey = (): string => `admin-ui:${crypto.randomUUID()}`;
