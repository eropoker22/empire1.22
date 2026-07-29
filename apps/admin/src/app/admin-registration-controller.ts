import type { AdminControlPlaneAvailabilityView, AdminLifecycleActionRequestView, HostedLifecycleAction } from "@empire/shared-types";
import { renderRegistrationConfirmationDialog } from "./admin-action-confirmation-dialog-view";
import type { AdminApiClient } from "./admin-monitoring-client";

interface Options {
  client: AdminApiClient;
  target: () => HTMLElement | null;
  selectedInstanceId: () => string | null;
  controlPlane: () => AdminControlPlaneAvailabilityView | null;
  actionReasons: Map<string, string>;
  render: () => void;
  refresh: () => Promise<void>;
  createKey: () => string;
  onActionAccepted?: (instanceId: string, action: HostedLifecycleAction) => void;
}

export const createAdminRegistrationController = (options: Options) => {
  const drafts = new Map<string, string>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let serverClockMs = Number.NaN;
  let performanceClockMs = 0;
  let refreshedBoundary = "";
  let submitting = false;

  const bind = (): void => {
    const target = options.target();
    target?.querySelectorAll<HTMLButtonElement>("[data-admin-registration-action]").forEach((button) =>
      button.addEventListener("click", () => openDialog(button)));
    target?.querySelector<HTMLInputElement>("[data-admin-registration-opens-at]")?.addEventListener("input", (event) => {
      const instanceId = options.selectedInstanceId();
      if (event.currentTarget instanceof HTMLInputElement) {
        event.currentTarget.setCustomValidity("");
        if (instanceId) drafts.set(instanceId, event.currentTarget.value);
      }
    });
  };

  const schedulePayload = (instanceId: string): Pick<AdminLifecycleActionRequestView, "registrationOpensAt"> => {
    const input = options.target()?.querySelector<HTMLInputElement>("[data-admin-registration-opens-at]");
    const value = drafts.get(instanceId) ?? input?.value ?? "";
    const timestamp = value ? new Date(value) : null;
    return { registrationOpensAt: timestamp && Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : undefined };
  };

  const openDialog = (sourceButton: HTMLButtonElement): void => {
    if (sourceButton.disabled) return;
    const instanceId = sourceButton.dataset.adminServerId;
    const action = sourceButton.dataset.adminRegistrationAction as HostedLifecycleAction | undefined;
    const hosted = options.controlPlane()?.servers.find((entry) => entry.serverInstanceId === instanceId);
    const target = options.target();
    if (!instanceId || !action || !hosted) return;
    const schedule = action === "schedule-registration" ? schedulePayload(instanceId).registrationOpensAt : undefined;
    if (action === "schedule-registration" && !schedule) {
      const input = target?.querySelector<HTMLInputElement>("[data-admin-registration-opens-at]");
      input?.setCustomValidity("Vyber platný čas otevření registrace.");
      input?.reportValidity();
      focusInvalid(input);
      return;
    }
    target?.querySelector("[data-admin-registration-backdrop]")?.remove();
    target?.insertAdjacentHTML("beforeend", renderRegistrationConfirmationDialog({
      server: hosted,
      action,
      reason: options.actionReasons.get(instanceId) ?? "",
      registrationOpensAt: schedule
    }));
    bindDialog();
    queueMicrotask(() => target?.querySelector<HTMLTextAreaElement>("[data-admin-registration-reason]")?.focus());
  };

  const bindDialog = (): void => {
    const target = options.target();
    const backdrop = target?.querySelector<HTMLElement>("[data-admin-registration-backdrop]");
    const dialog = backdrop?.querySelector<HTMLElement>("[data-admin-registration-dialog]");
    if (!backdrop || !dialog) return;
    const close = (): void => {
      dialog.closest("[data-admin-registration-backdrop]")?.remove();
      options.render();
      queueMicrotask(() => options.target()
        ?.querySelector<HTMLButtonElement>(`[data-admin-registration-action="${dialog.dataset.adminRegistrationAction}"]`)?.focus());
    };
    backdrop.addEventListener("click", (event) => { if (event.target === event.currentTarget && !submitting) close(); });
    dialog.querySelectorAll<HTMLButtonElement>("[data-admin-registration-cancel]").forEach((button) =>
      button.addEventListener("click", () => { if (!submitting) close(); }));
    dialog.querySelector<HTMLTextAreaElement>("[data-admin-registration-reason]")?.addEventListener("input", (event) => {
      const instanceId = dialog.dataset.adminServerId;
      if (instanceId && event.currentTarget instanceof HTMLTextAreaElement) {
        options.actionReasons.set(instanceId, event.currentTarget.value);
      }
    });
    dialog.querySelector<HTMLButtonElement>("[data-admin-registration-confirm]")?.addEventListener("click", (event) =>
      void submit(dialog, event.currentTarget as HTMLButtonElement));
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !submitting) {
        event.preventDefault();
        close();
      }
      if (event.key === "Tab") trapFocus(event);
    });
  };

  const submit = async (dialog: HTMLElement, button: HTMLButtonElement): Promise<void> => {
    if (submitting) return;
    const instanceId = dialog.dataset.adminServerId;
    const action = dialog.dataset.adminRegistrationAction as HostedLifecycleAction | undefined;
    const hosted = options.controlPlane()?.servers.find((entry) => entry.serverInstanceId === instanceId);
    const reason = dialog.querySelector<HTMLTextAreaElement>("[data-admin-registration-reason]")?.value.trim() ?? "";
    const message = dialog.querySelector<HTMLElement>("[data-admin-registration-error]");
    if (!instanceId || !action || !hosted) return;
    options.actionReasons.set(instanceId, reason);
    if (reason.length < 3) {
      if (message) message.textContent = "Uveďte důvod akce alespoň třemi znaky.";
      dialog.querySelector<HTMLTextAreaElement>("[data-admin-registration-reason]")?.focus();
      return;
    }
    const payload: AdminLifecycleActionRequestView = { action, expectedVersion: hosted.version, reason,
      ...(action === "close-registration-now" ? { confirmationToken: "CLOSE_REGISTRATION" } : {}),
      ...(action === "schedule-registration" ? schedulePayload(instanceId) : {}) };
    if (action === "schedule-registration" && !payload.registrationOpensAt) return;
    submitting = true;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "Provádím…";
    try {
      await options.client.requestLifecycleAction(instanceId, payload, options.createKey());
      if (action === "schedule-registration") drafts.delete(instanceId);
      options.onActionAccepted?.(instanceId, action);
      dialog.closest("[data-admin-registration-backdrop]")?.remove();
      await options.refresh();
    } catch (error) {
      if (message) message.textContent = error instanceof Error ? error.message : "Registraci nebylo možné změnit.";
      button.disabled = false;
      button.setAttribute("aria-busy", "false");
      button.textContent = "Potvrdit změnu";
    } finally {
      submitting = false;
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

const focusInvalid = (input: HTMLInputElement | null | undefined): void => {
  input?.focus();
  input?.scrollIntoView?.({ block: "center", behavior: "smooth" });
};

const trapFocus = (event: KeyboardEvent): void => {
  const dialog = event.currentTarget as HTMLElement;
  const focusable = [...dialog.querySelectorAll<HTMLElement>(
    "button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled)"
  )].filter((element) => !element.closest("[hidden]"));
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};
