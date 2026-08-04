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

export const createAdminIdempotencyKey = (): string => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `admin-ui:${globalThis.crypto.randomUUID()}`;
  }

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `admin-ui:${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
};

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
  visibility: "active" | "inactive";
}

export const DEFAULT_ADMIN_SERVER_FILTERS: AdminServerFilterState = {
  query: "",
  status: "all",
  mode: "all",
  worker: "all",
  visibility: "active"
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
      && (filters.worker === "all" || item.dataset.adminServerWorker === filters.worker)
      && item.dataset.adminServerVisibility === filters.visibility;
    item.hidden = !visible;
    if (visible && item.matches("tr")) visibleCount += 1;
  });
  const output = target?.querySelector<HTMLElement>("[data-admin-server-visible-count]");
  if (output) output.textContent = String(visibleCount);
};

export interface AdminPageStateSnapshot {
  scrollX: number;
  scrollY: number;
  openDetailIndexes: number[];
}

export const captureAdminPageState = (target: HTMLElement | null): AdminPageStateSnapshot | null => {
  if (!target || typeof window === "undefined") return null;
  return {
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    openDetailIndexes: [...target.querySelectorAll<HTMLDetailsElement>("details")]
      .flatMap((detail, index) => detail.open ? [index] : [])
  };
};

export const restoreAdminPageState = (
  target: HTMLElement | null,
  snapshot: AdminPageStateSnapshot | null
): void => {
  if (!target || !snapshot || typeof window === "undefined") return;
  const openIndexes = new Set(snapshot.openDetailIndexes);
  target.querySelectorAll<HTMLDetailsElement>("details").forEach((detail, index) => {
    detail.open = openIndexes.has(index);
  });
  window.scrollTo?.({ left: snapshot.scrollX, top: snapshot.scrollY, behavior: "auto" });
};

const normalize = (value: string): string => value
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
  .replace(/\s+/gu, " ")
  .trim()
  .toLocaleLowerCase("cs-CZ");
