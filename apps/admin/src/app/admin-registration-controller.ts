import type { AdminControlPlaneAvailabilityView, AdminLifecycleActionRequestView, HostedLifecycleAction } from "@empire/shared-types";
import type { AdminApiClient } from "./admin-monitoring-client";

interface Options {
  client: AdminApiClient;
  target: () => HTMLElement | null;
  selectedInstanceId: () => string | null;
  controlPlane: () => AdminControlPlaneAvailabilityView | null;
  refresh: () => Promise<void>;
  createKey: () => string;
}

export const createAdminRegistrationController = (options: Options) => {
  const drafts = new Map<string, string>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let serverClockMs = Number.NaN;
  let performanceClockMs = 0;
  let refreshedBoundary = "";

  const bind = (): void => {
    const target = options.target();
    target?.querySelectorAll<HTMLButtonElement>("[data-admin-registration-action]").forEach((button) =>
      button.addEventListener("click", () => void submit(button)));
    target?.querySelector<HTMLInputElement>("[data-admin-registration-opens-at]")?.addEventListener("input", (event) => {
      const instanceId = options.selectedInstanceId();
      if (instanceId && event.currentTarget instanceof HTMLInputElement) drafts.set(instanceId, event.currentTarget.value);
    });
  };

  const schedulePayload = (instanceId: string): Pick<AdminLifecycleActionRequestView, "registrationOpensAt"> => {
    const input = options.target()?.querySelector<HTMLInputElement>("[data-admin-registration-opens-at]");
    const value = drafts.get(instanceId) ?? input?.value ?? "";
    const timestamp = value ? new Date(value) : null;
    return { registrationOpensAt: timestamp && Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : undefined };
  };

  const submit = async (button: HTMLButtonElement): Promise<void> => {
    const instanceId = button.dataset.adminServerId;
    const action = button.dataset.adminRegistrationAction as HostedLifecycleAction | undefined;
    const hosted = options.controlPlane()?.servers.find((entry) => entry.serverInstanceId === instanceId);
    const target = options.target();
    const reason = target?.querySelector<HTMLInputElement>("[data-admin-action-reason]")?.value.trim() ?? "";
    const message = target?.querySelector<HTMLElement>("[data-admin-action-error]");
    if (!instanceId || !action || !hosted) return;
    if (reason.length < 3) { if (message) message.textContent = "Uveďte důvod akce alespoň třemi znaky."; return; }
    if (action === "close-registration-now" && !window.confirm("Nouzově ukončit registraci? Existující hráči zůstanou na serveru.")) return;
    const payload: AdminLifecycleActionRequestView = { action, expectedVersion: hosted.version, reason,
      ...(action === "close-registration-now" ? { confirmationToken: "CLOSE_REGISTRATION" } : {}),
      ...(action === "schedule-registration" ? schedulePayload(instanceId) : {}) };
    if (action === "schedule-registration" && !payload.registrationOpensAt) {
      if (message) message.textContent = "Vyber platný čas otevření registrace.";
      return;
    }
    button.disabled = true;
    try {
      await options.client.requestLifecycleAction(instanceId, payload, options.createKey());
      if (action === "schedule-registration") drafts.delete(instanceId);
      await options.refresh();
    } catch (error) {
      if (message) message.textContent = error instanceof Error ? error.message : "Registraci nebylo možné změnit.";
      button.disabled = false;
    }
  };

  const restoreDraft = (): void => {
    const instanceId = options.selectedInstanceId();
    const input = options.target()?.querySelector<HTMLInputElement>("[data-admin-registration-opens-at]");
    if (instanceId && input && drafts.has(instanceId)) input.value = drafts.get(instanceId)!;
  };

  const syncClock = (generatedAt?: string): void => {
    const parsed = Date.parse(String(generatedAt || ""));
    if (!Number.isFinite(parsed)) return;
    serverClockMs = parsed;
    performanceClockMs = performance.now();
  };

  const updateCountdowns = (): void => {
    const nowMs = Number.isFinite(serverClockMs) ? serverClockMs + Math.max(0, performance.now() - performanceClockMs) : Date.now();
    options.target()?.querySelectorAll<HTMLElement>("[data-admin-registration-countdown]").forEach((node) => {
      const state = node.dataset.registrationState;
      const targetIso = state === "scheduled" ? node.dataset.registrationOpensAt : node.dataset.registrationClosesAt;
      const remainingMs = Date.parse(String(targetIso || "")) - nowMs;
      if ((state !== "scheduled" && state !== "open") || !Number.isFinite(remainingMs)) return;
      node.textContent = `${state === "scheduled" ? "začne za" : "zbývá"} ${formatDuration(remainingMs)}`;
      if (remainingMs > 0) return;
      const key = `${options.selectedInstanceId()}:${state}:${targetIso}`;
      if (refreshedBoundary === key) return;
      refreshedBoundary = key;
      void options.refresh();
    });
  };

  const start = (): void => { if (!timer) timer = setInterval(updateCountdowns, 1_000); };
  const stop = (): void => { if (timer) clearInterval(timer); timer = null; };
  return { bind, restoreDraft, start, stop, syncClock, updateCountdowns };
};

const formatDuration = (milliseconds: number): string => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
  return [Math.floor(seconds / 3_600), Math.floor((seconds % 3_600) / 60), seconds % 60]
    .map((value) => String(value).padStart(2, "0")).join(":");
};
