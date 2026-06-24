import { createClientApp, createClientSurfaceActionRouter, type ClientRenderState } from "../app";
import { escapeHtml, refreshLiveCooldownLabels } from "../shared-ui";
import { createFetchClientTransport, createGameplaySlicePoller, type ClientTransport } from "../transport";
import { createOverlayBackdrop } from "../modals/overlay-backdrop";
import { resolveGameplaySliceBootstrapRequest } from "./gameplay-slice-bootstrap";
import { persistServerConfirmedGameplaySliceFocus } from "./gameplay-slice-focus-cache";
import { createDistrictSheetOverlayController } from "./gameplay-slice-overlays";
import {
  createSafeErrorMessage,
  isGameplayDiagnosticsEnabled,
  renderGameplaySliceDiagnostic,
  setGameplayRuntimeMarker,
  writeGameplaySliceDiagnostic
} from "./gameplay-slice-runtime-diagnostics";
export { persistServerConfirmedGameplaySliceFocus } from "./gameplay-slice-focus-cache";
export { setGameplayRuntimeMarker, type GameplayRuntimeMarker } from "./gameplay-slice-runtime-diagnostics";

const DEFAULT_ENDPOINT_BASE = "/api/gameplay-slice";

export interface GameplaySlicePageMountOptions { root: HTMLElement; transport?: ClientTransport; }
export interface MountedGameplaySlicePage { destroy(): void; }

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
export const mountGameplaySlicePage = (options: GameplaySlicePageMountOptions): MountedGameplaySlicePage | null => {
  const request = resolveGameplaySliceBootstrapRequest(options.root.dataset, getBrowserStorage());

  if (!request) {
    setGameplayRuntimeMarker(options.root, "legacy-fallback");
    options.root.hidden = true;
    return null;
  }

  const endpointBase = options.root.dataset.gameplaySliceEndpointBase || DEFAULT_ENDPOINT_BASE;
  setGameplayRuntimeMarker(options.root, "initializing", { endpoint: `${endpointBase}/load` });
  const client = createClientApp({
    transport: options.transport ?? createFetchClientTransport({ endpointBase })
  });
  const router = createClientSurfaceActionRouter({
    client,
    createCommandId: createBrowserCommandId
  });
  const mounts = resolveMounts(options.root);
  let currentLoadRequest = request;
  const overlayBackdrop = createOverlayBackdrop({ mount: options.root });
  const districtSheetOverlay = createDistrictSheetOverlayController();

  const hideUnavailableGameplaySlice = (state: ClientRenderState | null = null): void => {
    const message = state?.connection.lastErrorMessage || "Gameplay slice did not return an authoritative read model.";
    const endpoint = `${endpointBase}/load`;
    setGameplayRuntimeMarker(options.root, "server-authoritative-error", {
      endpoint,
      error: message,
      fallback: "legacy"
    });
    writeGameplaySliceDiagnostic(endpoint, message);
    options.root.dataset.gameplaySliceUnavailable = "true";
    if (isGameplayDiagnosticsEnabled()) {
      options.root.hidden = false;
      mounts.status.innerHTML = renderGameplaySliceDiagnostic(endpoint, message);
      mounts.topBar.innerHTML = "";
      mounts.map.innerHTML = "";
      mounts.panel.innerHTML = "";
    } else {
      options.root.hidden = true;
      Object.values(mounts).forEach((mount) => {
        mount.innerHTML = "";
      });
    }
  };

  const render = (state: ClientRenderState): void => {
    const gameplaySlice = client.getGameplaySlice();
    if (!gameplaySlice && state.connection.status === "error") {
      hideUnavailableGameplaySlice(state);
      return;
    }

    delete options.root.dataset.gameplaySliceUnavailable;
    setGameplayRuntimeMarker(options.root, "server-authoritative-ready");
    options.root.hidden = false;

    if (state.districtPanel?.districtId) {
      currentLoadRequest = {
        ...currentLoadRequest,
        districtId: state.districtPanel.districtId
      };
    }
    persistServerConfirmedGameplaySliceFocus(
      getBrowserStorage(),
      options.root.dataset.sessionStorageKey,
      client.getGameplaySlice()
    );

    const phase = state.player?.dayNight?.uiThemeHint;
    if (phase) {
      document.body.dataset.cityPhase = phase;
    }
    document.dispatchEvent(new CustomEvent("empire:gameplay-slice-rendered", { detail: { gameplaySlice, playerView: gameplaySlice?.player ?? null } }));
    mounts.status.innerHTML = renderGameplaySliceStatus(state);
    mounts.topBar.innerHTML = state.topBarHtml;
    mounts.map.innerHTML = state.mapHtml;
    mounts.panel.innerHTML = state.sidePanelHtml;
    refreshLiveCooldownLabels(options.root);
    districtSheetOverlay.syncFromState(state);
    overlayBackdrop.sync();
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

  const poller = createGameplaySlicePoller<ClientRenderState>({
    load: (nextRequest) => client.load(nextRequest),
    getRequest: () => currentLoadRequest,
    intervalMs: parsePollingIntervalMs(options.root.dataset.gameplaySlicePollingIntervalMs),
    enabled: options.root.dataset.gameplaySlicePolling === "true",
    onResponse: render,
    onError: () => {
      mounts.status.innerHTML = [
        "<strong>Synchronizace se serverem zastarala</strong>",
        "<span>Obnova ze serveru selhala. Zůstává poslední známý stav.</span>"
      ].join("");
    }
  });

  const cooldownTimerId = window.setInterval(() => refreshLiveCooldownLabels(options.root), 1000);
  options.root.addEventListener("click", handleClick);
  void client
    .load(request)
    .then((state) => {
      render(state);
      poller.start();
    })
    .catch((error) => {
      hideUnavailableGameplaySlice({
        ...client.getRenderState(),
        connection: {
          status: "error",
          lastErrorMessage: createSafeErrorMessage(error),
          staleData: true
        }
      });
    });

  return {
    destroy: () => {
      poller.stop();
      window.clearInterval(cooldownTimerId);
      options.root.removeEventListener("click", handleClick);
      districtSheetOverlay.closeOnDestroy();
      overlayBackdrop.sync();
      overlayBackdrop.destroy();
    }
  };
};

const resolveMounts = (root: HTMLElement) => ({
  status: getOrCreateMount(root, "status"), topBar: getOrCreateMount(root, "topbar"), map: getOrCreateMount(root, "map"), panel: getOrCreateMount(root, "panel")
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

const createBrowserCommandId = (prefix: string): string =>
  `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;

const parsePollingIntervalMs = (value: string | undefined): number => {
  const intervalMs = Number.parseInt(String(value ?? ""), 10);

  return Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 5000;
};

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
