import { createClientApp, createClientSurfaceActionRouter, resolveClientSurfaceAction, type ClientRenderState } from "../app";
import { refreshLiveCooldownLabels } from "../shared-ui";
import { createFetchClientTransport, createGameplaySlicePoller } from "../transport";
import { createOverlayBackdrop } from "../modals/overlay-backdrop";
import { getTopOverlay, isOverlayOpen, shouldSuppressMapInput } from "../modals/overlay-state";
import { resolveGameplaySliceBootstrapRequest } from "./gameplay-slice-bootstrap";
import { createDistrictSheetOverlayController } from "./gameplay-slice-overlays";
import {
  createGameplaySliceVisibilityRuntime,
  getGameplaySlicePollerPerformanceOptions,
  recordClientStateRecompute,
  recordGameplayPollError,
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
import { createGameplaySliceSelectiveRenderer } from "./gameplay-slice-selective-renderer";
import {
  createBrowserCommandId,
  parseGameplaySlicePollingIntervalMs,
  renderGameplaySliceStatus,
  resolveGameplaySliceMounts
} from "./gameplay-slice-page-helpers";
export { renderGameplaySliceStatus } from "./gameplay-slice-page-helpers";
import {
  createMountedGameplaySlicePageExternalPort,
  installGameplaySlicePageApi,
  registerMountedGameplaySlicePage,
  type GameplaySlicePageMountOptions,
  type MountedGameplaySlicePage,
  type MountedGameplaySlicePageExternalPort
} from "./gameplay-slice-page-api";
export * from "./gameplay-slice-page-api";
export { setGameplayRuntimeMarker, type GameplayRuntimeMarker } from "./gameplay-slice-runtime-diagnostics";
const DEFAULT_ENDPOINT_BASE = "/api/gameplay-slice";
const LEGACY_DISTRICT_POPUP_SELECTOR = "[data-testid='district-popup']";
const MOBILE_SHEET_SELECTOR = ".mobile-sheet";
const MAP_TAP_PIXEL_THRESHOLD = 10;
const DISTRICT_TAP_DEBOUNCE_MS = 350;
const mountedGameplaySlicePagesByRoot = new WeakMap<HTMLElement, MountedGameplaySlicePageExternalPort>();
/** Browser mount for server-fed DOM state; gameplay resolution stays on the server. */
export const mountGameplaySlicePage = (options: GameplaySlicePageMountOptions): MountedGameplaySlicePage | null => {
  const existingMount = mountedGameplaySlicePagesByRoot.get(options.root);
  if (existingMount) return existingMount;
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
  const presentationMode = options.presentationMode
    || (options.root.dataset.gameplaySlicePresentationMode === "controller-only"
      ? "controller-only"
      : "full");
  const ownsVisiblePresentation = presentationMode === "full";
  options.root.dataset.gameplaySlicePresentationMode = presentationMode;
  const mounts = resolveGameplaySliceMounts(options.root);
  const selectiveRenderer = createGameplaySliceSelectiveRenderer();
  let currentLoadRequest = request;
  const districtSheetOverlay = ownsVisiblePresentation
    ? createDistrictSheetOverlayController()
    : null;
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
  const overlayBackdrop = ownsVisiblePresentation ? createOverlayBackdrop({
    mount: options.root,
    onCloseTopOverlay: (type) => {
      if (type !== "district_sheet") {
        return;
      }

      clearDistrictSheetFocus();
      districtSheetOverlay?.markClosedByBackdrop();
      render(client.clearDistrictSelection?.() ?? client.getRenderState());
    }
  }) : null;
  const closeDistrictSheetAfterLegacyClose = (reason: string): boolean => {
    if (!districtSheetOverlay || (!districtSheetOverlay.isOpen() && getTopOverlay() !== "district_sheet")) {
      return false;
    }

    clearDistrictSheetFocus();
    districtSheetOverlay.closeFromExternal(reason);
    overlayBackdrop?.sync();
    render(client.clearDistrictSelection?.() ?? client.getRenderState());
    return true;
  };
  const handleLegacyDistrictClosed = (): void => {
    closeDistrictSheetAfterLegacyClose("legacy district popup closed");
  };
  const legacyDistrictPopup = document.querySelector<HTMLElement>(LEGACY_DISTRICT_POPUP_SELECTOR);
  const legacyDistrictPopupObserver = ownsVisiblePresentation
    && typeof MutationObserver !== "undefined"
    && legacyDistrictPopup
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
    if (ownsVisiblePresentation && isGameplayDiagnosticsEnabled()) {
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
    const spawnSelectionVisible = gameplaySlice?.spawnSelection?.status === "awaiting_spawn_selection"
      && !gameplaySlice.player.homeDistrictId;
    options.root.hidden = !ownsVisiblePresentation && !spawnSelectionVisible;
    if (spawnSelectionVisible) {
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
      detail: {
        gameplaySlice,
        playerView: gameplaySlice?.player ?? null,
        connection: state.connection,
        renderState: state
      }
    }));
    document.dispatchEvent(new CustomEvent("empire:gameplay-connection-state", { detail: state.connection }));
    if (!ownsVisiblePresentation && !spawnSelectionVisible) {
      Object.values(mounts).forEach((mount) => {
        if (mount.childNodes.length > 0) mount.replaceChildren();
      });
      return;
    }
    selectiveRenderer.render(mounts, [renderGameplaySliceStatus(state), state.topBarHtml, state.mapHtml, state.sidePanelHtml], reason);
    refreshLiveCooldownLabels(options.root);
    districtSheetOverlay?.syncFromState(state);
    overlayBackdrop?.sync();
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
      const isDistrictOpen = districtSheetOverlay?.isOpen() === true;

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
    intervalMs: parseGameplaySlicePollingIntervalMs(options.root.dataset.gameplaySlicePollingIntervalMs),
    enabled: options.root.dataset.gameplaySlicePolling === "true",
    ...getGameplaySlicePollerPerformanceOptions(),
    onResponse: (state) => {
      const observation = recordGameplaySliceRefresh(client.getGameplaySlice());
      if (observation.changed) {
        render(state, "server-slice-change");
      }
    },
    onError: () => {
      recordGameplayPollError();
      if (ownsVisiblePresentation) {
        mounts.status.innerHTML = [
          "<strong>Synchronizace se serverem zastarala</strong>",
          "<span>Obnova ze serveru selhala. Zůstává poslední známý stav.</span>"
        ].join("");
      }
      document.dispatchEvent(new CustomEvent("empire:gameplay-connection-state", {
        detail: { status: "stale", lastErrorMessage: "Obnova ze serveru selhala.", staleData: true }
      }));
    }
  });

  const visibilityRuntime = createGameplaySliceVisibilityRuntime({ root: options.root });
  visibilityRuntime.start();
  if (ownsVisiblePresentation) {
    legacyDistrictPopupObserver?.observe(legacyDistrictPopup as HTMLElement, {
      attributeFilter: ["aria-hidden", "class", "hidden"],
      attributes: true
    });
    document.addEventListener("empire:district-closed", handleLegacyDistrictClosed);
    options.root.addEventListener("click", handleClick);
    options.root.addEventListener("pointerdown", handlePointerDown);
    options.root.addEventListener("pointerup", handlePointerUp);
    options.root.addEventListener("pointercancel", handlePointerCancel);
  }
  void client
    .load(request)
    .then((state) => {
      recordGameplaySliceRefresh(client.getGameplaySlice());
      render(state, "server-slice-initial-load");
      poller.start();
    })
    .catch((error) => {
      if (isGameplayDiagnosticsEnabled()) {
        console.warn("[gameplay-slice] Initial load failed.", error);
      }
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

  let destroyed = false;
  const handlePageHide = () => {
    mountedPage.destroy();
  };
  let unregisterMountedPage: () => void = () => {};
  const mountedPage: MountedGameplaySlicePageExternalPort = createMountedGameplaySlicePageExternalPort({
    root: options.root,
    closeDistrictSheet: (reason = "external district popup close") =>
      closeDistrictSheetAfterLegacyClose(reason),
    getCurrentReadModel: () => client.getGameplaySlice(),
    getCurrentRenderState: () => client.getRenderState(),
    handleSurfaceAction: (target) => router.handleTarget(target),
    selectDistrict: (districtId) => client.selectDistrict(districtId),
    submitCommand: (command) => client.dispatch(command),
    applyState: (state, reason) => {
      recordGameplaySliceRefresh(client.getGameplaySlice());
      render(state, reason);
    },
    destroy: () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      poller.destroy();
      visibilityRuntime.destroy();
      legacyDistrictPopupObserver?.disconnect();
      if (ownsVisiblePresentation) {
        document.removeEventListener("empire:district-closed", handleLegacyDistrictClosed);
        options.root.removeEventListener("click", handleClick);
        options.root.removeEventListener("pointerdown", handlePointerDown);
        options.root.removeEventListener("pointerup", handlePointerUp);
        options.root.removeEventListener("pointercancel", handlePointerCancel);
      }
      districtSheetOverlay?.closeOnDestroy();
      overlayBackdrop?.sync();
      overlayBackdrop?.destroy();
      unregisterMountedPage();
      mountedGameplaySlicePagesByRoot.delete(options.root);
      window.removeEventListener("pagehide", handlePageHide);
    }
  });
  unregisterMountedPage = registerMountedGameplaySlicePage(mountedPage);
  mountedGameplaySlicePagesByRoot.set(options.root, mountedPage);
  window.addEventListener("pagehide", handlePageHide, { once: true });
  return mountedPage;
};

installGameplaySlicePageApi(mountGameplaySlicePage);
