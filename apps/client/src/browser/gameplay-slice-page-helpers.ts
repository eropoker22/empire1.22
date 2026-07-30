import type { ClientRenderState } from "../app";
import { escapeHtml } from "../shared-ui";
import { GAMEPLAY_SLICE_STABLE_POLL_INTERVAL_MS } from "./gameplay-slice-timing";

export const resolveGameplaySliceMounts = (root: HTMLElement) => ({
  status: getOrCreateMount(root, "status"),
  topBar: getOrCreateMount(root, "topbar"),
  map: getOrCreateMount(root, "map"),
  panel: getOrCreateMount(root, "panel")
});

const getOrCreateMount = (root: HTMLElement, role: string): HTMLElement => {
  const existing = root.querySelector<HTMLElement>(`[data-gameplay-slice-${role}]`);
  if (existing) return existing;

  const mount = document.createElement("div");
  mount.dataset[`gameplaySlice${role.charAt(0).toUpperCase()}${role.slice(1)}`] = "true";
  root.append(mount);
  return mount;
};

export const renderGameplaySliceStatus = (state: ClientRenderState): string => [
  state.connection.status === "error"
    ? ""
    : `<strong>${escapeHtml(state.connection.status === "ready" ? "Server synchronizován" : state.connection.status)}</strong>`,
  state.lastCommandStatus
    ? `<span class="gameplay-slice-client__command-status">${state.lastCommandStatus.accepted ? "Akce přijata" : "Akce odmítnuta"}</span>`
    : "",
  state.connection.status !== "error" && state.lastCommandStatus?.accepted === false && state.connection.lastErrorMessage
    ? `<span class="gameplay-slice-client__error">${escapeHtml(state.connection.lastErrorMessage)}</span>`
    : "",
  state.districtPanel
    ? `<span>${escapeHtml(state.districtPanel.title)}</span>`
    : ""
].join("");

export const createBrowserCommandId = (prefix: string): string =>
  `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;

export const parseGameplaySlicePollingIntervalMs = (value: string | undefined): number => {
  const intervalMs = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(intervalMs) && intervalMs > 0
    ? intervalMs
    : GAMEPLAY_SLICE_STABLE_POLL_INTERVAL_MS;
};
