import { createClientApp, createClientSurfaceActionRouter, resolveClientSurfaceAction, type ClientRenderState } from "../app";
import { escapeHtml, refreshLiveCooldownLabels } from "../shared-ui";
import { createFetchClientTransport, createGameplaySlicePoller, type ClientTransport } from "../transport";
import { createOverlayBackdrop } from "../modals/overlay-backdrop";
import { getTopOverlay, isOverlayOpen, shouldSuppressMapInput } from "../modals/overlay-state";
import { resolveGameplaySliceBootstrapRequest } from "./gameplay-slice-bootstrap";
import { createDistrictSheetOverlayController } from "./gameplay-slice-overlays";
import {
  createGameplaySliceVisibilityRuntime,
  getGameplaySlicePollerPerformanceOptions,
  recordClientStateRecompute,
  recordGameplaySliceRefresh
} from "./gameplay-slice-performance-metrics";
import {
  createSafeErrorMessage,
  isGameplayDiagnosticsEnabled,
  renderGameplaySliceDiagnostic,
  setGameplayRuntimeMarker,
  writeGameplaySliceDiagnostic
} from "./gameplay-slice-runtime-diagnostics";
import {
  applyDevelopmentRuntimeOverride,
  markGameplaySliceUnavailableRuntime,
  markMissingGameplaySessionRuntime
} from "./gameplay-slice-runtime-policy";
export { setGameplayRuntimeMarker, type GameplayRuntimeMarker } from "./gameplay-slice-runtime-diagnostics";
const DEFAULT_ENDPOINT_BASE = "/api/gameplay-slice";
const LEGACY_DISTRICT_POPUP_SELECTOR = "[data-testid='district-popup']";
const MOBILE_SHEET_SELECTOR = ".mobile-sheet";
const MAP_TAP_PIXEL_THRESHOLD = 10;
const DISTRICT_TAP_DEBOUNCE_MS = 350;
export interface GameplaySlicePageMountOptions { root: HTMLElement; transport?: ClientTransport; }
export interface MountedGameplaySlicePage { destroy(): void; }
interface MountedGameplaySlicePageInternal extends MountedGameplaySlicePage { closeDistrictSheetFromExternal(reason?: string): boolean; }
declare global { interface Window { EmpireGameplaySliceClient?: { closeDistrictSheet(reason?: string): boolean; mount(options: GameplaySlicePageMountOptions): MountedGameplaySlicePage | null; autoMount(): MountedGameplaySlicePage[]; }; } }
const activeGameplaySlicePages = new Set<MountedGameplaySlicePageInternal>();

/**
 * Responsibility: Browser mount for the server-fed gameplay slice on game.html.
 * Belongs here: DOM event wiring and rendering already prepared client HTML.
 * Does not belong here: gameplay resolution or legacy runtime mutation.
 */
export const mountGameplaySlicePage = (options: GameplaySlicePageMountOptions): MountedGameplaySlicePage | null => {
  if (applyDevelopmentRuntimeOverride(options.root)) return null;
  const request = resolveGameplaySliceBootstrapRequest(options.root.dataset);

  if (!request) {
    markMissingGameplaySessionRuntime(options.root);
    return null;
  }
  const endpointBase = options.root.dataset.gameplaySliceEndpointBase || DEFAULT_ENDPOINT_BASE;
  setGameplayRuntimeMarker(options.root, "initializing", { endpoint: `${endpointBase}/load` });
  const client = createClientApp({
    transport: options.transport ?? createFetchClientTransport({ endpointBase }),
    onStateRecompute: recordClientStateRecompute
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
  const clearDistrictSheetFocus = (): void => {
    activeDistrictSheetId = null;
    currentLoadRequest = {
      ...currentLoadRequest,
      districtId: undefined
    };
  };
  const overlayBackdrop = createOverlayBackdrop({
    mount: options.root,
    onCloseTopOverlay: (type) => {
      if (type !== "district_sheet") {
        return;
      }

      clearDistrictSheetFocus();
      districtSheetOverlay.markClosedByBackdrop();
      render(client.clearDistrictSelection?.() ?? client.getRenderState());
    }
  });
  const closeDistrictSheetAfterLegacyClose = (reason: string): boolean => {
    if (!districtSheetOverlay.isOpen() && getTopOverlay() !== "district_sheet") {
      return false;
    }

    clearDistrictSheetFocus();
    districtSheetOverlay.closeFromExternal(reason);
    overlayBackdrop.sync();
    render(client.clearDistrictSelection?.() ?? client.getRenderState());
    return true;
  };
  const handleLegacyDistrictClosed = (): void => {
    closeDistrictSheetAfterLegacyClose("legacy district popup closed");
  };
  const legacyDistrictPopup = document.querySelector<HTMLElement>(LEGACY_DISTRICT_POPUP_SELECTOR);
  const legacyDistrictPopupObserver = typeof MutationObserver !== "undefined" && legacyDistrictPopup
    ? new MutationObserver(() => {
        const isHidden = legacyDistrictPopup.hidden
          || legacyDistrictPopup.getAttribute("aria-hidden") === "true"
          || legacyDistrictPopup.classList.contains("hidden");
        if (isHidden) {
          closeDistrictSheetAfterLegacyClose("legacy district popup hidden");
        }
      })
    : null;

  const hideUnavailableGameplaySlice = (state: ClientRenderState | null = null): void => {
    const message = state?.connection.lastErrorMessage || "Gameplay slice did not return an authoritative read model.";
    const endpoint = `${endpointBase}/load`;
    const allowLegacyFallback = markGameplaySliceUnavailableRuntime(options.root, endpoint, message);
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

  function render(state: ClientRenderState, reason = "ui-interaction"): void {
    const gameplaySlice = client.getGameplaySlice();
    if (!gameplaySlice && state.connection.status === "error") {
      hideUnavailableGameplaySlice(state);
      return;
    }

    delete options.root.dataset.gameplaySliceUnavailable;
    setGameplayRuntimeMarker(options.root, "server-authoritative-ready");
    options.root.dataset.lastClientRenderReason = reason;
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
    const phase = state.player?.dayNight?.uiThemeHint;
    if (phase) {
      document.body.dataset.cityPhase = phase;
    }
    document.dispatchEvent(new CustomEvent("empire:gameplay-slice-rendered", {
      detail: { gameplaySlice, playerView: gameplaySlice?.player ?? null, connection: state.connection }
    }));
    document.dispatchEvent(new CustomEvent("empire:gameplay-connection-state", { detail: state.connection }));
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
            recordGameplaySliceRefresh(client.getGameplaySlice());
            render(nextState, "ui:select-district");
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
      recordGameplaySliceRefresh(client.getGameplaySlice());
      render(nextState, `ui:${action?.kind || "command"}`);
    }
  };

  const poller = createGameplaySlicePoller<ClientRenderState>({
    load: (nextRequest) => client.load(nextRequest),
    getRequest: () => currentLoadRequest,
    intervalMs: parsePollingIntervalMs(options.root.dataset.gameplaySlicePollingIntervalMs),
    enabled: options.root.dataset.gameplaySlicePolling === "true",
    ...getGameplaySlicePollerPerformanceOptions(),
    onResponse: (state) => {
      const observation = recordGameplaySliceRefresh(client.getGameplaySlice());
      if (observation.changed) {
        render(state, "server-slice-change");
      }
    },
    onError: () => {
      mounts.status.innerHTML = [
        "<strong>Synchronizace se serverem zastarala</strong>",
        "<span>Obnova ze serveru selhala. Zůstává poslední známý stav.</span>"
      ].join("");
      document.dispatchEvent(new CustomEvent("empire:gameplay-connection-state", {
        detail: { status: "stale", lastErrorMessage: "Obnova ze serveru selhala.", staleData: true }
      }));
    }
  });

  const visibilityRuntime = createGameplaySliceVisibilityRuntime({ root: options.root, poller });
  visibilityRuntime.start();
  legacyDistrictPopupObserver?.observe(legacyDistrictPopup as HTMLElement, {
    attributeFilter: ["aria-hidden", "class", "hidden"],
    attributes: true
  });
  document.addEventListener("empire:district-closed", handleLegacyDistrictClosed);
  options.root.addEventListener("click", handleClick);
  options.root.addEventListener("pointerdown", handlePointerDown);
  options.root.addEventListener("pointerup", handlePointerUp);
  options.root.addEventListener("pointercancel", handlePointerCancel);
  void client
    .load(request)
    .then((state) => {
      recordGameplaySliceRefresh(client.getGameplaySlice());
      render(state, "server-slice-initial-load");
      poller.start();
    })
    .catch((error) => {
      document.dispatchEvent(new CustomEvent("empire:gameplay-connection-state", {
        detail: { status: "error", lastErrorMessage: createSafeErrorMessage(error), staleData: true }
      }));
      hideUnavailableGameplaySlice({
        ...client.getRenderState(),
        connection: {
          status: "error",
          lastErrorMessage: createSafeErrorMessage(error),
          staleData: true
        }
      });
    });

  const mountedPage: MountedGameplaySlicePageInternal = {
    closeDistrictSheetFromExternal: (reason = "external district popup close") =>
      closeDistrictSheetAfterLegacyClose(reason),
    destroy: () => {
      poller.destroy();
      visibilityRuntime.destroy();
      legacyDistrictPopupObserver?.disconnect();
      document.removeEventListener("empire:district-closed", handleLegacyDistrictClosed);
      options.root.removeEventListener("click", handleClick);
      options.root.removeEventListener("pointerdown", handlePointerDown);
      options.root.removeEventListener("pointerup", handlePointerUp);
      options.root.removeEventListener("pointercancel", handlePointerCancel);
      districtSheetOverlay.closeOnDestroy();
      overlayBackdrop.sync();
      overlayBackdrop.destroy();
      activeGameplaySlicePages.delete(mountedPage);
    }
  };
  activeGameplaySlicePages.add(mountedPage);
  return mountedPage;
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

export const closeDistrictSheet = (reason = "external district popup close"): boolean => {
  let closed = false;
  for (const mountedPage of activeGameplaySlicePages) {
    closed = mountedPage.closeDistrictSheetFromExternal(reason) || closed;
  }
  return closed;
};

const createPageApi = () => ({
  closeDistrictSheet,
  mount: (options: GameplaySlicePageMountOptions) => mountGameplaySlicePage(options),
  autoMount: () => Array.from(document.querySelectorAll<HTMLElement>("[data-gameplay-slice-client]"))
    .map((root) => mountGameplaySlicePage({ root }))
    .filter((mount): mount is MountedGameplaySlicePage => mount !== null)
});

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.EmpireGameplaySliceClient = createPageApi();
}
