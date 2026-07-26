import { createServerMapPresentationController } from "../map/serverMapPresentationController.js";
import { loadSettingsState } from "../persistence/settingsPreferenceStorage.js";
import {
  destroy,
  getCurrentReadModel,
  getCurrentRenderState,
  handleSurfaceAction,
  mount,
  retryPendingCommands,
  selectDistrict,
  submitCommand,
  subscribe
} from "../runtime/serverGameplaySource.js";
import { PAGE_ROOT_SELECTOR } from "../runtime/constants.js";
import { normalizeSettingsState } from "../runtime/settingsState.js";
import { createServerGameplayUiController } from "../ui/serverGameplayUiController.js";
import { createGameplayPresentationCoordinator } from "./gameplayPresentationCoordinator.js";

const controllersByRoot = new WeakMap();
const SERVER_AUTHORITY_MODE = "server-authoritative";
const LOCAL_AUTHORITY_MODES = new Set(["local-demo", "demo", "legacy-fallback", "local"]);

const canonicalSource = Object.freeze({
  destroy,
  getCurrentReadModel,
  getCurrentRenderState,
  handleSurfaceAction,
  mount,
  retryPendingCommands,
  selectDistrict,
  submitCommand,
  subscribe
});

export { PAGE_ROOT_SELECTOR };

const readSelectedAuthorityMode = ({ documentRef, windowRef }) => String(
  windowRef?.__EMPIRE_GAMEPLAY_EXECUTION_MODE__
  || documentRef?.documentElement?.dataset?.gameplayExecutionMode
  || ""
).trim().toLowerCase();

const assertServerAuthorityCanMount = ({ root, documentRef, windowRef }) => {
  const rootAuthority = String(root.dataset.gameplayAuthority || "").trim().toLowerCase();
  const runtimeInit = String(root.dataset.runtimeInit || "").trim().toLowerCase();
  const selectedMode = readSelectedAuthorityMode({ documentRef, windowRef });
  const localRuntimeMounted = rootAuthority === "local-demo"
    || (runtimeInit && runtimeInit !== SERVER_AUTHORITY_MODE);

  if (localRuntimeMounted || LOCAL_AUTHORITY_MODES.has(selectedMode)) {
    throw new Error(
      "Server-authoritative gameplay cannot mount beside an active local-demo runtime. "
      + "Destroy local-demo before switching authority."
    );
  }
};

export function createServerAuthoritativePageController({
  root,
  documentRef = root?.ownerDocument || globalThis.document,
  windowRef = documentRef?.defaultView || globalThis.window,
  source = canonicalSource,
  createMapController = createServerMapPresentationController,
  createUiController = createServerGameplayUiController
} = {}) {
  if (!root) {
    throw new Error("Server-authoritative page root is missing.");
  }
  const existing = controllersByRoot.get(root);
  if (existing) {
    return existing;
  }

  let mounted = false;
  let destroyed = false;
  let suspended = false;
  let uiController = null;
  let mapController = null;
  let coordinator = null;

  const handleConnectionState = (event) => {
    const status = String(event?.detail?.status || "connecting");
    root.dataset.presentationConnection = status;
    if (status === "ready" || status === "connected") {
      void source.retryPendingCommands?.();
    }
  };

  const createPresentationControllers = () => {
    uiController = createUiController({
      root,
      source,
      manageSourceSubscription: false,
      managePageLifecycle: false,
      documentRef,
      windowRef
    });
    mapController = createMapController({
      root,
      source,
      selectDistrict: source.selectDistrict,
      onDistrictSelected: (selection) => uiController?.handleDistrictSelected?.(selection),
      getSettings: () => normalizeSettingsState(loadSettingsState()),
      manageSourceSubscription: false,
      managePageLifecycle: false,
      documentRef,
      windowRef
    });
    coordinator = createGameplayPresentationCoordinator({
      root,
      source,
      controllers: [mapController, uiController],
      managePageLifecycle: false,
      documentRef,
      windowRef
    });
  };

  const teardownMountedPresentation = () => {
    if (!mounted) {
      return false;
    }
    mounted = false;
    coordinator?.destroy();
    coordinator = null;
    mapController = null;
    uiController = null;
    documentRef?.removeEventListener?.("empire:gameplay-connection-state", handleConnectionState);
    windowRef?.removeEventListener?.("pagehide", handlePageHide);
    source.destroy?.();
    delete root.dataset.bootstrap;
    delete root.dataset.runtimeInit;
    delete root.dataset.gameplayAuthority;
    return true;
  };

  const handlePageShow = (event) => {
    windowRef?.removeEventListener?.("pageshow", handlePageShow);
    if (destroyed || !suspended || event?.persisted !== true) {
      return;
    }
    suspended = false;
    mount();
  };

  const handlePageHide = (event) => {
    if (event?.persisted === true) {
      teardownMountedPresentation();
      suspended = true;
      windowRef?.addEventListener?.("pageshow", handlePageShow, { once: true });
      return;
    }
    destroy();
  };

  const mount = () => {
    if (destroyed || mounted) {
      return !destroyed;
    }
    assertServerAuthorityCanMount({ root, documentRef, windowRef });
    suspended = false;
    createPresentationControllers();
    mounted = true;
    try {
      source.mount?.(documentRef);
      documentRef?.addEventListener?.("empire:gameplay-connection-state", handleConnectionState);
      windowRef?.addEventListener?.("pagehide", handlePageHide, { once: true });
      coordinator.mount();
      root.dataset.bootstrap = "ready";
      root.dataset.runtimeInit = SERVER_AUTHORITY_MODE;
      root.dataset.gameplayAuthority = SERVER_AUTHORITY_MODE;
      documentRef.documentElement.dataset.page = root.dataset.page || "game";
      controllersByRoot.set(root, api);
      return true;
    } catch (error) {
      teardownMountedPresentation();
      controllersByRoot.delete(root);
      throw error;
    }
  };

  const destroy = () => {
    if (destroyed) {
      return false;
    }
    destroyed = true;
    suspended = false;
    windowRef?.removeEventListener?.("pageshow", handlePageShow);
    teardownMountedPresentation();
    controllersByRoot.delete(root);
    return true;
  };

  const api = Object.freeze({
    destroy,
    getCurrentReadModel: () => source.getCurrentReadModel?.() || null,
    getMapController: () => mapController,
    getUiController: () => uiController,
    handleSurfaceAction: (target) => source.handleSurfaceAction?.(target) || Promise.resolve(null),
    mount,
    selectDistrict: (districtId) => source.selectDistrict?.(districtId) || Promise.resolve(null)
  });

  return api;
}

export function mountServerAuthoritativePage(options = {}) {
  const documentRef = options.documentRef || globalThis.document;
  const root = options.root || documentRef?.querySelector?.(PAGE_ROOT_SELECTOR);
  if (!root) {
    return null;
  }
  const controller = createServerAuthoritativePageController({
    ...options,
    root,
    documentRef
  });
  controller.mount();
  return controller;
}
