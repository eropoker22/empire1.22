export const selectedAdminInstanceFromUrl = (): string | null =>
  typeof location === "undefined" ? null : new URL(location.href).searchParams.get("instance");

export const updateAdminInstanceUrl = (instanceId: string | null): void => {
  const url = new URL(location.href);
  instanceId ? url.searchParams.set("instance", instanceId) : url.searchParams.delete("instance");
  history.replaceState(null, "", url);
};

export const readAdminFrontendBuildSha = (): string | null => {
  const value = document.querySelector<HTMLMetaElement>('meta[name="empire-build-sha"]')?.content.trim() ?? "";
  return value && value !== "__EMPIRE_BUILD_SHA__" && value !== "local" ? value : null;
};

export const isAdminLoopbackLocation = (): boolean => {
  const hostname = typeof location === "undefined" ? "" : location.hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
};

export const createAdminIdempotencyKey = (): string => `admin-ui:${crypto.randomUUID()}`;

export const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

export const hasFocusedAdminInput = (target: HTMLElement | null): boolean => {
  const active = document.activeElement;
  return Boolean(target?.contains(active) && (
    active instanceof HTMLInputElement
    || active instanceof HTMLSelectElement
    || active instanceof HTMLTextAreaElement
  ));
};

export interface AdminFocusSnapshot {
  tagName: string;
  id: string | null;
  dataAttribute: string | null;
  dataValue: string | null;
}

export const captureAdminFocus = (target: HTMLElement | null): AdminFocusSnapshot | null => {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !target?.contains(active)) return null;
  const dataAttribute = active.getAttributeNames().find((name) => name.startsWith("data-admin-")) ?? null;
  return {
    tagName: active.tagName.toLowerCase(),
    id: active.id || null,
    dataAttribute,
    dataValue: dataAttribute ? active.getAttribute(dataAttribute) : null
  };
};

export const restoreAdminFocus = (target: HTMLElement | null, snapshot: AdminFocusSnapshot | null): void => {
  if (!target || !snapshot) return;
  const byId = snapshot.id ? document.getElementById(snapshot.id) : null;
  if (byId instanceof HTMLElement && target.contains(byId)) {
    byId.focus({ preventScroll: true });
    return;
  }
  if (!snapshot.dataAttribute) return;
  const matching = [...target.querySelectorAll<HTMLElement>(snapshot.tagName)]
    .find((element) => element.getAttribute(snapshot.dataAttribute!) === snapshot.dataValue);
  matching?.focus({ preventScroll: true });
};

export const updateAdminRefreshUi = (
  target: HTMLElement | null,
  status: "loading" | "current" | "backoff" | "paused"
): void => {
  const node = target?.querySelector<HTMLElement>("[data-admin-refresh-state]");
  if (!node) return;
  node.dataset.state = status;
  const output = node.querySelector<HTMLElement>("span");
  if (output) output.textContent = {
    loading: "OBNOVUJI DATA",
    current: "DATA AKTUÁLNÍ",
    backoff: "OBNOVA OMEZENA",
    paused: "POLLING POZASTAVEN"
  }[status];
  const button = target?.querySelector<HTMLButtonElement>("[data-admin-refresh]");
  if (!button) return;
  button.disabled = status === "loading";
  button.setAttribute("aria-busy", String(status === "loading"));
  const label = button.querySelector<HTMLElement>("[data-admin-refresh-label]");
  if (label) label.textContent = status === "loading" ? "Obnovuji…" : "Obnovit";
};

export interface AdminServerFilterState {
  query: string;
  status: string;
  mode: string;
  worker: string;
}

export const DEFAULT_ADMIN_SERVER_FILTERS: AdminServerFilterState = {
  query: "",
  status: "all",
  mode: "all",
  worker: "all"
};

export const applyAdminServerFilters = (
  target: HTMLElement | null,
  filters: AdminServerFilterState
): void => {
  const query = normalize(filters.query);
  let visibleCount = 0;
  target?.querySelectorAll<HTMLElement>("[data-admin-server-item]").forEach((item) => {
    const visible = (!query || normalize(item.textContent ?? "").includes(query))
      && (filters.status === "all" || item.dataset.adminServerStatus === filters.status)
      && (filters.mode === "all" || item.dataset.adminServerMode === filters.mode)
      && (filters.worker === "all" || item.dataset.adminServerWorker === filters.worker);
    item.hidden = !visible;
    if (visible && item.matches("tr")) visibleCount += 1;
  });
  const output = target?.querySelector<HTMLElement>("[data-admin-server-visible-count]");
  if (output) output.textContent = String(visibleCount);
};

const normalize = (value: string): string => value
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
  .replace(/\s+/gu, " ")
  .trim()
  .toLocaleLowerCase("cs-CZ");
