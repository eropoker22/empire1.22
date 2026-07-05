import { createClientApp, createClientSurfaceActionRouter, resolveClientSurfaceAction, type ClientRenderState } from "../app";
import { escapeHtml, refreshLiveCooldownLabels } from "../shared-ui";
import { createFetchClientTransport, createGameplaySlicePoller, type ClientTransport } from "../transport";
import { createOverlayBackdrop } from "../modals/overlay-backdrop";
import { getTopOverlay, isOverlayOpen, shouldSuppressMapInput } from "../modals/overlay-state";
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
const MOBILE_SHEET_SELECTOR = ".mobile-sheet";
const MAP_TAP_PIXEL_THRESHOLD = 10;
const DISTRICT_TAP_DEBOUNCE_MS = 350;

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
    setGameplayRuntimeMarker(options.root, "demo-ready", {
      fallback: "legacy",
      serverRuntime: "not-requested"
    });
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
  const districtSheetOverlay = createDistrictSheetOverlayController();
  let pointerOrigin: { pointerId: number; x: number; y: number; atMs: number } | null = null;
  let lastPointerTapIsValid = true;
  let lastDistrictTap = { districtId: null as string | null, atMs: 0 };
  let pendingDistrictSelection = { districtId: null as string | null };
  let activeDistrictSheetId: string | null = null;
  const overlayBackdrop = createOverlayBackdrop({
    mount: options.root,
    onCloseTopOverlay: (type) => {
      if (type !== "district_sheet") {
        return;
      }

      activeDistrictSheetId = null;
      currentLoadRequest = {
        ...currentLoadRequest,
        districtId: undefined
      };
      districtSheetOverlay.markClosedByBackdrop();
      client.load(currentLoadRequest).then(render).catch(() => undefined);
    }
  });

  const hideUnavailableGameplaySlice = (state: ClientRenderState | null = null): void => {
    const message = state?.connection.lastErrorMessage || "Gameplay slice did not return an authoritative read model.";
    const endpoint = `${endpointBase}/load`;
    setGameplayRuntimeMarker(options.root, "demo-ready", {
      endpoint,
      error: message,
      fallback: "legacy",
      serverRuntime: "server-authoritative-error"
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

  function render(state: ClientRenderState): void {
    const gameplaySlice = client.getGameplaySlice();
    if (!gameplaySlice && state.connection.status === "error") {
      hideUnavailableGameplaySlice(state);
      return;
    }

    delete options.root.dataset.gameplaySliceUnavailable;
    setGameplayRuntimeMarker(options.root, "server-authoritative-ready");
    options.root.hidden = false;
    if (gameplaySlice?.spawnSelection?.status === "awaiting_spawn_selection" && !gameplaySlice.player.homeDistrictId) {
      options.root.dataset.spawnSelectionVisible = "true";
    } else {
      delete options.root.dataset.spawnSelectionVisible;
    }

    if (state.districtPanel?.districtId) {
      activeDistrictSheetId = state.districtPanel.districtId;
      currentLoadRequest = {
        ...currentLoadRequest,
        districtId: state.districtPanel.districtId
      };
    } else {
      activeDistrictSheetId = null;
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
  }

  const isInsideMobileSheet = (target: EventTarget | null): target is HTMLElement =>
    target instanceof HTMLElement && Boolean(target.closest(MOBILE_SHEET_SELECTOR));

  const handlePointerDown = (event: Event): void => {
    const target = event.target;
    if (!(event instanceof PointerEvent) || !(target instanceof HTMLElement)) {
      return;
    }

    if (isInsideMobileSheet(target)) {
      event.stopPropagation();
    } else if (shouldSuppressMapInput(event)) {
      return;
    }

    pointerOrigin = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      atMs: Date.now()
    };
    lastPointerTapIsValid = true;
  };

  const handlePointerUp = (event: Event): void => {
    if (!(event instanceof PointerEvent) || !pointerOrigin || event.pointerId !== pointerOrigin.pointerId) {
      return;
    }
    const target = event.target;
    if (target instanceof HTMLElement && !isInsideMobileSheet(target) && shouldSuppressMapInput(event)) {
      pointerOrigin = null;
      lastPointerTapIsValid = false;
      return;
    }

    const dx = event.clientX - pointerOrigin.x;
    const dy = event.clientY - pointerOrigin.y;
    lastPointerTapIsValid = Math.hypot(dx, dy) <= MAP_TAP_PIXEL_THRESHOLD;
    pointerOrigin = null;
  };

  const handlePointerCancel = (event: Event): void => {
    if (!(event instanceof PointerEvent) || !pointerOrigin || event.pointerId !== pointerOrigin.pointerId) {
      return;
    }

    lastPointerTapIsValid = false;
    pointerOrigin = null;
  };

  const handleClick = async (event: Event): Promise<void> => {
    const target = event.target;
    const canUsePointerTapForDistrictSelection = lastPointerTapIsValid;
    lastPointerTapIsValid = true;
    const insideSheet = isInsideMobileSheet(target);

    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (insideSheet) {
      event.stopPropagation();
    }

    const action = resolveClientSurfaceAction(target);

    if (action?.kind === "select-district") {
      if (!insideSheet && shouldSuppressMapInput(event)) {
        return;
      }

      if (!canUsePointerTapForDistrictSelection) {
        return;
      }

      const topOverlay = getTopOverlay();
      if (isOverlayOpen() && topOverlay !== "district_sheet") {
        return;
      }

      const selectedAtMs = Date.now();
      const isRapidRepeat = action.districtId === lastDistrictTap.districtId
        && selectedAtMs - lastDistrictTap.atMs < DISTRICT_TAP_DEBOUNCE_MS;
      const isSameDistrictAsOpen = action.districtId === activeDistrictSheetId;
      const isDistrictOpen = districtSheetOverlay.isOpen();

      if (isDistrictOpen && isSameDistrictAsOpen) {
        return;
      }

      if (!isDistrictOpen && (isRapidRepeat || pendingDistrictSelection.districtId !== null)) {
        return;
      }

      lastDistrictTap = { districtId: action.districtId, atMs: selectedAtMs };
      pendingDistrictSelection = { districtId: action.districtId };

      if (isDistrictOpen) {
        try {
          const nextState = await client.selectDistrict(action.districtId);
          if (nextState) {
            event.preventDefault();
            event.stopPropagation();
            render(nextState);
          }
        } finally {
          pendingDistrictSelection = { districtId: null };
        }

        return;
      }
    }

    if (action?.kind === "select-district" && isOverlayOpen()) {
      return;
    }

    let nextState: ClientRenderState | null = null;
    try {
      nextState = await router.handleTarget(target);
    } finally {
      if (action?.kind === "select-district") {
        pendingDistrictSelection = { districtId: null };
      }
    }

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
  options.root.addEventListener("pointerdown", handlePointerDown);
  options.root.addEventListener("pointerup", handlePointerUp);
  options.root.addEventListener("pointercancel", handlePointerCancel);
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
      options.root.removeEventListener("pointerdown", handlePointerDown);
      options.root.removeEventListener("pointerup", handlePointerUp);
      options.root.removeEventListener("pointercancel", handlePointerCancel);
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
