import { createClientApp, createClientSurfaceActionRouter, type ClientRenderState } from "../app";
import { refreshLiveCooldownLabels } from "../shared-ui";
import { createFetchClientTransport, type ClientTransport } from "../transport";
import { resolveGameplaySliceBootstrapRequest } from "./gameplay-slice-bootstrap";

const DEFAULT_ENDPOINT_BASE = "/api/gameplay-slice";

export interface GameplaySlicePageMountOptions {
  root: HTMLElement;
  transport?: ClientTransport;
}

export interface MountedGameplaySlicePage {
  destroy(): void;
}

declare global {
  interface Window {
    EmpireGameplaySliceClient?: {
      mount(options: GameplaySlicePageMountOptions): MountedGameplaySlicePage | null;
      autoMount(): MountedGameplaySlicePage[];
    };
  }
}

/**
 * Responsibility: Browser mount for the server-fed gameplay slice on game.html.
 * Belongs here: DOM event wiring and rendering already prepared client HTML.
 * Does not belong here: gameplay resolution or legacy runtime mutation.
 */
export const mountGameplaySlicePage = (
  options: GameplaySlicePageMountOptions
): MountedGameplaySlicePage | null => {
  const request = resolveGameplaySliceBootstrapRequest(options.root.dataset, getBrowserStorage());

  if (!request) {
    options.root.hidden = true;
    return null;
  }

  const endpointBase = options.root.dataset.gameplaySliceEndpointBase || DEFAULT_ENDPOINT_BASE;
  const client = createClientApp({
    transport: options.transport ?? createFetchClientTransport({ endpointBase })
  });
  const router = createClientSurfaceActionRouter({
    client,
    createCommandId: createBrowserCommandId
  });
  const mounts = resolveMounts(options.root);

  options.root.hidden = false;

  const render = (state: ClientRenderState): void => {
    mounts.status.innerHTML = renderStatus(state);
    mounts.topBar.innerHTML = state.topBarHtml;
    mounts.map.innerHTML = state.mapHtml;
    mounts.panel.innerHTML = state.sidePanelHtml || "<p class=\"gameplay-slice-client__empty\">No server district selected.</p>";
    refreshLiveCooldownLabels(options.root);
  };

  const handleClick = async (event: Event): Promise<void> => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const nextState = await router.handleTarget(target);

    if (nextState) {
      event.preventDefault();
      event.stopPropagation();
      render(nextState);
    }
  };

  const cooldownTimerId = window.setInterval(() => refreshLiveCooldownLabels(options.root), 1000);
  options.root.addEventListener("click", handleClick);
  void client
    .load(request)
    .then(render)
    .catch(() => {
      mounts.status.innerHTML = [
        "<strong>Server sync unavailable</strong>",
        "<span>The gameplay slice endpoint did not return a read model.</span>"
      ].join("");
    });

  return {
    destroy: () => {
      window.clearInterval(cooldownTimerId);
      options.root.removeEventListener("click", handleClick);
    }
  };
};

const resolveMounts = (root: HTMLElement) => ({
  status: getOrCreateMount(root, "status"),
  topBar: getOrCreateMount(root, "topbar"),
  map: getOrCreateMount(root, "map"),
  panel: getOrCreateMount(root, "panel")
});

const getOrCreateMount = (root: HTMLElement, role: string): HTMLElement => {
  const existing = root.querySelector<HTMLElement>(`[data-gameplay-slice-${role}]`);

  if (existing) {
    return existing;
  }

  const mount = document.createElement("div");
  mount.dataset[`gameplaySlice${role.charAt(0).toUpperCase()}${role.slice(1)}`] = "true";
  root.append(mount);
  return mount;
};

const renderStatus = (state: ClientRenderState): string => [
  `<strong>${state.connection.status === "ready" ? "Server synced" : state.connection.status}</strong>`,
  state.districtPanel
    ? `<span>${state.districtPanel.title}</span>`
    : "<span>Waiting for district projection</span>",
  state.errors.length > 0
    ? `<span class="gameplay-slice-client__error">${state.errors[0]?.message ?? "Unknown gameplay slice error"}</span>`
    : ""
].join("");

const createBrowserCommandId = (prefix: string): string =>
  `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;

const createPageApi = () => ({
  mount: (options: GameplaySlicePageMountOptions) => mountGameplaySlicePage(options),
  autoMount: () => Array.from(document.querySelectorAll<HTMLElement>("[data-gameplay-slice-client]"))
    .map((root) => mountGameplaySlicePage({ root }))
    .filter((mount): mount is MountedGameplaySlicePage => mount !== null)
});

const getBrowserStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch (_error) {
    return null;
  }
};

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.EmpireGameplaySliceClient = createPageApi();
  window.EmpireGameplaySliceClient.autoMount();
}
