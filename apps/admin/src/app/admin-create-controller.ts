import {
  FREE_HOSTED_STARTING_MATERIAL_IDS,
  resolveModeConfig
} from "@empire/game-config";
import type {
  AdminCreateServerRequestView,
  HostedStartingPlayerStateView
} from "@empire/shared-types";
import type { AdminApiClient } from "./admin-monitoring-client";
import { mapTotal, updateWizardReview, validateWizardPanel } from "./admin-create-wizard";

interface AdminCreateState {
  wizardOpen: boolean;
  wizardStep: number;
  idempotencyKey: string | null;
}

interface AdminCreateControllerOptions {
  client: AdminApiClient;
  target: () => HTMLElement | null;
  state: () => AdminCreateState;
  updateState: (state: Partial<AdminCreateState>) => void;
  selectInstance: (instanceId: string) => void;
  render: () => void;
  refresh: () => Promise<void>;
  createKey: () => string;
  onCreated?: (instanceId: string, displayName: string) => void;
}

const canonicalCapacity = resolveModeConfig("free").balance.maxPlayersPerServer;

export const createAdminCreateController = (options: AdminCreateControllerOptions) => {
  const bind = (): void => {
    const target = options.target();
    target?.querySelector<HTMLElement>("[data-admin-create-open]")?.addEventListener("click", () => {
      options.updateState({ wizardOpen: true, wizardStep: 1,
        idempotencyKey: options.state().idempotencyKey ?? options.createKey() });
      options.render();
      queueMicrotask(() => options.target()
        ?.querySelector<HTMLInputElement>("[data-admin-create-form] input:not([type=hidden])")?.focus());
    });
    const close = (): void => {
      options.updateState({ wizardOpen: false, wizardStep: 1, idempotencyKey: null });
      options.render();
      queueMicrotask(() => options.target()?.querySelector<HTMLElement>("[data-admin-create-open]")?.focus());
    };
    target?.querySelector<HTMLElement>("[data-admin-create-cancel]")?.addEventListener("click", close);
    target?.querySelectorAll<HTMLElement>("[data-admin-wizard-next]").forEach((button) => button.addEventListener("click", () => {
      const form = target.querySelector<HTMLFormElement>("[data-admin-create-form]");
      const state = options.state();
      if (!form || !validateWizardPanel(form, state.wizardStep)) return;
      options.updateState({ wizardStep: Math.min(5, state.wizardStep + 1) });
      applyStep();
    }));
    target?.querySelectorAll<HTMLElement>("[data-admin-wizard-back]").forEach((button) => button.addEventListener("click", () => {
      options.updateState({ wizardStep: Math.max(1, options.state().wizardStep - 1) });
      applyStep();
    }));
    bindTemplatePolicy();
    bindMapTotal();
    const form = target?.querySelector<HTMLFormElement>("[data-admin-create-form]");
    form?.addEventListener("submit", (event) => void submit(event));
    target?.querySelector<HTMLElement>("[role=dialog]")?.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === "Tab") trapDialogFocus(event);
    });
  };

  const submit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const idempotencyKey = options.state().idempotencyKey;
    if (!form.reportValidity() || !idempotencyKey) return;
    if (mapTotal(form) !== 161) return showError(form, "Mapa musí obsahovat přesně 161 districtů.");
    const data = new FormData(form);
    const startingPlayerState = readStartingPlayerStateFormData(data);
    if (!startingPlayerState) {
      return showError(form, "Počáteční stav hráče není kompletní nebo obsahuje neplatné číslo.");
    }
    const serverTemplate: AdminCreateServerRequestView["serverTemplate"] = data.get("serverTemplate") === "full" ? "full" : "control";
    const payload: AdminCreateServerRequestView = {
      displayName: String(data.get("displayName") ?? ""),
      mode: String(data.get("mode")) as "free" | "war",
      region: String(data.get("region")),
      capacity: Number(data.get("capacity")),
      serverTemplate,
      joinPolicy: "closed",
      mapComposition: {
        downtown: 8,
        commercial: Number(data.get("commercial")),
        residential: Number(data.get("residential")),
        industrial: Number(data.get("industrial")),
        park: Number(data.get("park"))
      },
      startingPlayerState
    };
    const submitButton = form.querySelector<HTMLButtonElement>("[type=submit]");
    if (submitButton) submitButton.disabled = true;
    try {
      const result = await options.client.createServer(payload, idempotencyKey);
      options.selectInstance(result.server.serverInstanceId);
      options.updateState({ wizardOpen: false, wizardStep: 1, idempotencyKey: null });
      options.onCreated?.(result.server.serverInstanceId, result.server.displayName);
      options.render();
      await options.refresh();
    } catch (error) {
      showError(form, error instanceof Error ? error.message : "Server nebylo možné vytvořit.");
      if (submitButton) submitButton.disabled = false;
    }
  };

  const bindMapTotal = (): void => {
    const form = options.target()?.querySelector<HTMLFormElement>("[data-admin-create-form]");
    const output = form?.querySelector<HTMLOutputElement>("[data-admin-map-total]");
    if (!form || !output) return;
    const update = () => {
      const total = mapTotal(form);
      output.value = String(total);
      output.dataset.valid = String(total === 161);
      updateWizardReview(form);
    };
    form.querySelectorAll<HTMLInputElement>("[data-admin-map-count]").forEach((input) => input.addEventListener("input", update));
    update();
  };

  const bindTemplatePolicy = (): void => {
    const form = options.target()?.querySelector<HTMLFormElement>("[data-admin-create-form]");
    const template = form?.querySelector<HTMLSelectElement>("[data-admin-server-template]");
    const capacity = form?.querySelector<HTMLInputElement>("[data-admin-server-capacity]");
    if (!form || !template || !capacity) return;
    const update = () => {
      const full = template.value === "full";
      if (full) capacity.value = String(canonicalCapacity);
      else if (capacity.dataset.serverTemplate === "full") capacity.value = String(capacity.min);
      capacity.readOnly = full;
      capacity.setAttribute("aria-readonly", String(full));
      capacity.dataset.serverTemplate = full ? "full" : "control";
      updateWizardReview(form);
    };
    template.addEventListener("change", update);
    update();
  };

  const applyStep = (): void => {
    const target = options.target();
    target?.querySelectorAll<HTMLElement>("[data-admin-wizard-panel]").forEach((panel) => {
      panel.hidden = Number(panel.dataset.adminWizardPanel) !== options.state().wizardStep;
    });
    const form = target?.querySelector<HTMLFormElement>("[data-admin-create-form]");
    if (form) {
      updateWizardReview(form);
      form.querySelector<HTMLElement>(`[data-admin-wizard-panel="${options.state().wizardStep}"] input:not([type=hidden]),
        [data-admin-wizard-panel="${options.state().wizardStep}"] select,
        [data-admin-wizard-panel="${options.state().wizardStep}"] button`)?.focus();
    }
  };

  return { bind };
};

export const readStartingPlayerStateFormData = (
  data: FormData
): HostedStartingPlayerStateView | null => {
  const cleanCash = readRequiredInteger(data, "startingCleanCash");
  const dirtyCash = readRequiredInteger(data, "startingDirtyCash");
  const population = readRequiredInteger(data, "startingPopulation");
  if (cleanCash === null || dirtyCash === null || population === null) return null;

  const materials = {} as HostedStartingPlayerStateView["materials"];
  for (const materialId of FREE_HOSTED_STARTING_MATERIAL_IDS) {
    const amount = readRequiredInteger(data, `startingMaterial:${materialId}`);
    if (amount === null) return null;
    materials[materialId] = amount;
  }

  return {
    cleanCash,
    dirtyCash,
    population,
    spySlots: 2,
    materials
  };
};

const readRequiredInteger = (data: FormData, name: string): number | null => {
  const raw = data.get(name);
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
};

const showError = (form: HTMLFormElement, text: string): void => {
  const message = form.querySelector<HTMLElement>("[data-admin-create-error]");
  if (message) message.textContent = text;
};

const trapDialogFocus = (event: KeyboardEvent): void => {
  const dialog = event.currentTarget as HTMLElement;
  const focusable = [...dialog.querySelectorAll<HTMLElement>(
    "button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])"
  )].filter((element) => !element.closest("[hidden]"));
  if (focusable.length === 0) return;
  const first = focusable[0]!;
  const last = focusable.at(-1)!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};
