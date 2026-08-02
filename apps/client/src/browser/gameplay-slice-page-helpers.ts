import type { ClientRenderState } from "../app";
import { escapeHtml } from "../shared-ui";
export {
  createBrowserCommandId,
  parseGameplaySlicePollingIntervalMs
} from "./gameplay-slice-controller-helpers";

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
