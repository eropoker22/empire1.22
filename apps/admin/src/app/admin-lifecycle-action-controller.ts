import type {
  AdminControlPlaneAvailabilityView,
  AdminLifecycleActionResultView,
  HostedLifecycleAction
} from "@empire/shared-types";
import {
  adminActionLabel,
  renderLifecycleConfirmationDialog
} from "./admin-action-confirmation-dialog-view";
import type { AdminApiClient } from "./admin-monitoring-client";

interface Options {
  client: AdminApiClient;
  target: () => HTMLElement | null;
  controlPlane: () => AdminControlPlaneAvailabilityView | null;
  selectedInstanceId: () => string | null;
  actionReasons: Map<string, string>;
  createKey: () => string;
  render: () => void;
  refresh: () => Promise<void>;
  onAccepted: (instanceId: string, action: HostedLifecycleAction, result: AdminLifecycleActionResultView) => void;
}

export const createAdminLifecycleActionController = (options: Options) => {
  let submitting = false;

  const bind = (): void => {
    options.target()?.querySelectorAll<HTMLButtonElement>("[data-admin-lifecycle]").forEach((button) =>
      button.addEventListener("click", () => openDialog(button)));
  };

  const openDialog = (sourceButton: HTMLButtonElement): void => {
    if (sourceButton.disabled) return;
    const instanceId = sourceButton.dataset.adminServerId;
    const action = sourceButton.dataset.adminLifecycle as HostedLifecycleAction | undefined;
    const hosted = options.controlPlane()?.servers.find((entry) => entry.serverInstanceId === instanceId);
    if (!instanceId || !action || !hosted) return;
    options.target()?.querySelector("[data-admin-lifecycle-backdrop]")?.remove();
    options.target()?.insertAdjacentHTML("beforeend", renderLifecycleConfirmationDialog({
      server: hosted,
      action,
      reason: options.actionReasons.get(instanceId) ?? ""
    }));
    bindDialog();
    queueMicrotask(() => options.target()?.querySelector<HTMLTextAreaElement>("[data-admin-action-reason]")?.focus());
  };

  const bindDialog = (): void => {
    const target = options.target();
    const backdrop = target?.querySelector<HTMLElement>("[data-admin-lifecycle-backdrop]");
    const dialog = backdrop?.querySelector<HTMLElement>("[data-admin-lifecycle-dialog]");
    if (!backdrop || !dialog) return;
    const close = (): void => {
      const action = dialog.dataset.adminLifecycleAction as HostedLifecycleAction | undefined;
      dialog.closest("[data-admin-lifecycle-backdrop]")?.remove();
      options.render();
      if (action) queueMicrotask(() =>
        options.target()?.querySelector<HTMLButtonElement>(`[data-admin-lifecycle="${action}"]`)?.focus());
    };
    backdrop.addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
    dialog.querySelectorAll<HTMLButtonElement>("[data-admin-lifecycle-cancel]").forEach((button) =>
      button.addEventListener("click", close));
    dialog.querySelector<HTMLTextAreaElement>("[data-admin-action-reason]")?.addEventListener("input", (event) => {
      const instanceId = dialog.dataset.adminServerId;
      if (instanceId && event.currentTarget instanceof HTMLTextAreaElement) {
        options.actionReasons.set(instanceId, event.currentTarget.value);
      }
    });
    dialog.querySelector<HTMLButtonElement>("[data-admin-lifecycle-confirm]")?.addEventListener("click", (event) =>
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
    const action = dialog.dataset.adminLifecycleAction as HostedLifecycleAction | undefined;
    const hosted = options.controlPlane()?.servers.find((entry) => entry.serverInstanceId === instanceId);
    const reason = dialog.querySelector<HTMLTextAreaElement>("[data-admin-action-reason]")?.value.trim() ?? "";
    const message = dialog.querySelector<HTMLElement>("[data-admin-action-error]");
    if (!instanceId || !action || !hosted) return;
    options.actionReasons.set(instanceId, reason);
    if (reason.length < 3) {
      if (message) message.textContent = "Uveďte důvod akce alespoň třemi znaky.";
      dialog.querySelector<HTMLTextAreaElement>("[data-admin-action-reason]")?.focus();
      return;
    }
    if (action === "delete") {
      const confirmation = dialog.querySelector<HTMLInputElement>("[data-admin-delete-confirmation]")?.value.trim() ?? "";
      if (confirmation !== hosted.displayName) {
        if (message) message.textContent = "Pro smazání zadejte přesný název serveru.";
        dialog.querySelector<HTMLInputElement>("[data-admin-delete-confirmation]")?.focus();
        return;
      }
    }
    submitting = true;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "Provádím…";
    try {
      const result = await options.client.requestLifecycleAction(
        instanceId,
        { action, expectedVersion: hosted.version, reason,
          ...(action === "delete" ? { confirmationToken: "DELETE_SERVER" } : {}) },
        options.createKey()
      );
      options.actionReasons.delete(instanceId);
      options.onAccepted(instanceId, action, result);
      dialog.closest("[data-admin-lifecycle-backdrop]")?.remove();
      await options.refresh();
    } catch (error) {
      if (message) message.textContent = error instanceof Error ? error.message : "Akci nebylo možné zařadit.";
      button.disabled = false;
      button.setAttribute("aria-busy", "false");
      button.textContent = actionConfirmLabel(action);
    } finally {
      submitting = false;
    }
  };

  return { bind };
};

export { adminActionLabel };

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

const actionConfirmLabel = (action: HostedLifecycleAction): string =>
  action === "delete" ? "Smazat a vrátit hráče"
    : action === "stop" ? "Zastavit server"
    : action === "restart" ? "Bezpečně restartovat"
      : action === "start" ? "Spustit server"
        : action === "resume" ? "Obnovit server"
          : action === "pause" ? "Pozastavit server" : adminActionLabel(action);
