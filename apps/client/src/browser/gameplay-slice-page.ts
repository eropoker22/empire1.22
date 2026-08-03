import { createControllerClientApp } from "../app/create-controller-client-app";
import {
  createControllerSurfaceActionRouter,
  resolveClientSurfaceAction
} from "../app/client-surface-actions";
import type { ClientRenderState } from "../app/client-render-state";
import { createFetchClientTransport } from "../transport/fetch-client-transport";
import { createGameplaySlicePoller } from "../transport/gameplay-slice-poller";
import { resolveGameplaySliceBootstrapRequest } from "./gameplay-slice-bootstrap";
import {
  createBrowserCommandId,
  parseGameplaySlicePollingIntervalMs
} from "./gameplay-slice-controller-helpers";
import {
  getGameplaySlicePollerPerformanceOptions,
  recordClientStateRecompute,
  recordGameplayPollError,
  recordGameplaySliceRefresh
} from "./gameplay-slice-performance-metrics";
import {
  createSafeErrorMessage,
  setGameplayRuntimeMarker,
  writeGameplaySliceDiagnostic
} from "./gameplay-slice-runtime-diagnostics";
import {
  applyDevelopmentRuntimeOverride,
  markGameplaySliceUnavailableRuntime,
  markMissingGameplaySessionRuntime
} from "./gameplay-slice-runtime-policy";
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
const mountedGameplaySlicePagesByRoot = new WeakMap<HTMLElement, MountedGameplaySlicePageExternalPort>();

/** Headless browser controller for server-authoritative state and commands. */
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
  options.root.dataset.gameplaySlicePresentationMode = "controller-only";
  options.root.hidden = true;
  options.root.replaceChildren();
  setGameplayRuntimeMarker(options.root, "initializing", { endpoint: `${endpointBase}/load` });

  const transport = options.transport ?? createFetchClientTransport({ endpointBase });
  let activeCommandRequestCount = 0;
  const client = createControllerClientApp({
    transport: {
      load: (loadRequest) => transport.load(loadRequest),
      send: async (submitRequest) => {
        activeCommandRequestCount += 1;
        try {
          return await transport.send(submitRequest);
        } finally {
          activeCommandRequestCount -= 1;
        }
      }
    },
    onStateRecompute: recordClientStateRecompute
  });
  let currentLoadRequest = request;
  let lastPublishedConnectionKey = "";

  const selectDistrictWithPollingFocus = (districtId: string): Promise<ClientRenderState> => {
    currentLoadRequest = {
      ...currentLoadRequest,
      districtId
    };
    const selection = client.selectDistrict(districtId);
    void selection.then(() => {
      const confirmedDistrictId = client.getGameplaySlice()?.district?.districtId;
      if (confirmedDistrictId && confirmedDistrictId !== districtId) {
        currentLoadRequest = {
          ...currentLoadRequest,
          districtId: confirmedDistrictId
        };
      }
    });
    return selection;
  };

  const router = createControllerSurfaceActionRouter({
    client: {
      ...client,
      selectDistrict: selectDistrictWithPollingFocus
    },
    createCommandId: createBrowserCommandId
  });

  const publishConnectionState = (state: ClientRenderState): void => {
    lastPublishedConnectionKey = JSON.stringify(state.connection);
    document.dispatchEvent(new CustomEvent("empire:gameplay-connection-state", {
      detail: state.connection
    }));
  };

  const hideUnavailableGameplaySlice = (state: ClientRenderState): void => {
    const message = state.connection.lastErrorMessage
      || "Gameplay slice did not return an authoritative read model.";
    const endpoint = `${endpointBase}/load`;
    markGameplaySliceUnavailableRuntime(options.root, endpoint, message);
    writeGameplaySliceDiagnostic(endpoint, message);
    options.root.dataset.gameplaySliceUnavailable = "true";
    options.root.hidden = true;
    publishConnectionState(state);
  };

  const publish = (state: ClientRenderState, reason = "controller-update"): void => {
    const gameplaySlice = client.getGameplaySlice();
    if (!gameplaySlice && state.connection.status === "error") {
      hideUnavailableGameplaySlice(state);
      return;
    }

    delete options.root.dataset.gameplaySliceUnavailable;
    setGameplayRuntimeMarker(options.root, "server-authoritative-ready");
    options.root.dataset.lastClientRenderReason = reason;
    options.root.hidden = true;
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
    publishConnectionState(state);
  };

  const poller = createGameplaySlicePoller<ClientRenderState>({
    load: (nextRequest) => client.load(nextRequest),
    getRequest: () => activeCommandRequestCount > 0 ? null : currentLoadRequest,
    intervalMs: parseGameplaySlicePollingIntervalMs(options.root.dataset.gameplaySlicePollingIntervalMs),
    enabled: options.root.dataset.gameplaySlicePolling === "true",
    ...getGameplaySlicePollerPerformanceOptions(),
    getResponseError: (state) => state.connection.status === "error"
      ? new Error(state.connection.lastErrorMessage || "Gameplay slice polling failed.")
      : null,
    onResponse: (state) => {
      const observation = recordGameplaySliceRefresh(client.getGameplaySlice());
      const connectionKey = JSON.stringify(state.connection);
      if (observation.changed || connectionKey !== lastPublishedConnectionKey) {
        publish(state, "server-slice-change");
      }
    },
    onError: () => {
      recordGameplayPollError();
      const staleConnection = {
        status: "stale" as const,
        lastErrorMessage: "Obnova ze serveru selhala.",
        staleData: true
      };
      lastPublishedConnectionKey = JSON.stringify(staleConnection);
      document.dispatchEvent(new CustomEvent("empire:gameplay-connection-state", {
        detail: staleConnection
      }));
    }
  });

  void client
    .load(request)
    .then((state) => {
      recordGameplaySliceRefresh(client.getGameplaySlice());
      publish(state, "server-slice-initial-load");
      poller.start();
    })
    .catch((error) => {
      const message = createSafeErrorMessage(error);
      const state: ClientRenderState = {
        ...client.getRenderState(),
        connection: {
          status: "error",
          lastErrorMessage: message,
          staleData: true
        }
      };
      hideUnavailableGameplaySlice(state);
    });

  let destroyed = false;
  let unregisterMountedPage: () => void = () => {};
  const handlePageHide = (): void => {
    mountedPage.destroy();
  };
  const mountedPage: MountedGameplaySlicePageExternalPort = createMountedGameplaySlicePageExternalPort({
    root: options.root,
    allowExternalSurfaceActions: true,
    closeDistrictSheet: () => false,
    getCurrentReadModel: () => client.getGameplaySlice(),
    getCurrentRenderState: () => client.getRenderState(),
    handleSurfaceAction: (target) => router.handleTarget(target),
    selectDistrict: selectDistrictWithPollingFocus,
    submitCommand: (command) => client.dispatch(command),
    applyState: (state, reason) => {
      recordGameplaySliceRefresh(client.getGameplaySlice());
      publish(state, reason);
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      poller.destroy();
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
