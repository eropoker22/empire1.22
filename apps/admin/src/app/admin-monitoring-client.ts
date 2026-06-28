import {
  resolveAdminMonitoringSecret,
  setRuntimeAdminMonitoringSecret
} from "./admin-monitoring-token";
import type {
  InstanceMonitoringSummary,
  ServerInstanceSummary
} from "@empire/shared-types";
import {
  createAdminInstanceViewModelFromMonitoringSummary,
  createAdminOverviewViewModel,
  type AdminOverviewViewModel
} from "../read-models";

export const fetchAdminOverviewFromEndpoint = async (
  endpoint: string,
  configuredSecret?: string
): Promise<AdminOverviewViewModel | null> => {
  if (typeof fetch === "undefined") {
    return null;
  }

  const secret = resolveAdminMonitoringSecret(configuredSecret);
  const headers: Record<string, string> = {
    accept: "application/json"
  };
  if (secret) {
    headers["x-empire-admin-secret"] = secret;
  }

  const response = await fetch(endpoint, { headers });
  if (!response.ok) {
    throw await createAdminMonitoringError(response);
  }

  const payload = await response.json() as {
    overview?: AdminOverviewViewModel;
    instances?: InstanceMonitoringSummary[];
    serverSummaries?: ServerInstanceSummary[];
    healthSummary?: {
      totalInstances: number;
      runningInstances: number;
      crashedInstances: number;
    };
  };
  if (payload.overview?.instances) {
    return payload.overview;
  }

  return Array.isArray(payload.instances)
    ? createAdminOverviewViewModel(payload.instances.map(createAdminInstanceViewModelFromMonitoringSummary), {
        serverSummaries: payload.serverSummaries ?? [],
        healthSummary: payload.healthSummary
      })
    : null;
};

export const renderAdminError = (error: unknown): string => `
  <section class="admin-monitoring" role="alert">
    <p class="admin-boot__eyebrow">Runtime monitoring</p>
    <h1>Empire Streets Admin</h1>
    <p>Admin monitoring se nepodařilo načíst.</p>
    ${isAdminUnauthorizedError(error) ? `
      <form class="admin-monitoring__secret-form" data-admin-secret-form>
        <label class="admin-monitoring__secret-field">
          <span>Admin secret</span>
          <input data-admin-secret-input type="password" autocomplete="off" placeholder="Zadej EMPIRE_ADMIN_SECRET">
        </label>
        <button type="submit">Retry with secret</button>
        <p>Secret se drží jen v paměti stránky a posílá se pouze v headeru <code>x-empire-admin-secret</code>.</p>
      </form>
    ` : ""}
    <pre>${escapeHtml(error instanceof Error ? error.message : String(error))}</pre>
  </section>
`;

export const bindAdminSecretForm = (
  target: HTMLElement,
  retry: () => void | Promise<void>
): void => {
  if (typeof target.querySelector !== "function") {
    return;
  }

  const form = target.querySelector<HTMLFormElement>("[data-admin-secret-form]");
  const input = target.querySelector<HTMLInputElement>("[data-admin-secret-input]");
  if (!form || !input) {
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    setRuntimeAdminMonitoringSecret(input.value);
    void retry();
  });
};

const createAdminMonitoringError = async (
  response: Response
): Promise<Error> => {
  const payload = await response.json().catch(() => null) as {
    errors?: Array<{
      message?: string;
    }>;
  } | null;
  const message = payload?.errors?.[0]?.message
    ?? `Admin monitoring request failed with HTTP ${response.status}.`;
  const error = new Error(message) as Error & {
    statusCode?: number;
  };
  error.statusCode = response.status;
  return error;
};

const isAdminUnauthorizedError = (error: unknown): boolean =>
  error instanceof Error
    && typeof (error as Error & { statusCode?: number }).statusCode === "number"
    && (error as Error & { statusCode?: number }).statusCode === 403;

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character] ?? character);
