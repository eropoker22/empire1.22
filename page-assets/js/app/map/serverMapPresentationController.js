import { bindMapNavigation } from "../map-navigation.js";
import {
  ALL_MAP_RENDER_LAYERS,
  MAP_RENDER_LAYERS,
  diffGameplaySliceMapLayers
} from "./mapLayerInvalidation.js";
import { createMapRenderScheduler } from "./mapRenderScheduler.js";
import { createServerMapInteractionController } from "./serverMapInteractionController.js";
import { createServerMapLayerRenderer } from "./serverMapLayerRenderer.js";
import {
  createServerMapPresentationModel,
  resolveServerMapDistrictId
} from "./serverMapPresentationModel.js";
import {
  createServerMapInteractionState,
  normalizeServerMapSettings,
  syncServerMapInteractionState
} from "./serverMapPresentationState.js";
import {
  createServerMapPresentationShell,
  loadServerMapPresentationImages
} from "./serverMapPresentationShell.js";
const controllersByRoot = new WeakMap();
const createDefaultSource = () => ({
  getCurrentReadModel: () => null,
  subscribe: () => () => {}
});
export function createServerMapPresentationController(options = {}) {
  const root = options.root || null;
  const existing = root && controllersByRoot.get(root);
  if (existing) return existing;
  const documentRef = options.documentRef || root?.ownerDocument || globalThis.document;
  const windowRef = options.windowRef || documentRef?.defaultView || globalThis.window;
  const source = options.source || createDefaultSource();
  const modelRef = { current: null };
  let settings = normalizeServerMapSettings(options.getSettings?.());
  const interactionState = createServerMapInteractionState(settings);
  const deferredLayers = new Set();
  let shell = null;
  let layerRenderer = null;
  let interactionController = null;
  let navigationController = null;
  let scheduler = null;
  let unsubscribeSource = () => {};
  let resizeFrameId = null;
  let mounted = false;
  let destroyed = false;
  let visible = !documentRef?.hidden;
  const invalidate = (reason, layers, immediate = false) => {
    const uniqueLayers = [...new Set(layers || [])];
    if (!mounted || destroyed || uniqueLayers.length === 0) return false;
    if (!visible) {
      uniqueLayers.forEach((layer) => deferredLayers.add(layer));
      windowRef?.empireStreetsRuntimeDiagnostics?.recordMapInvalidation?.(reason);
      return true;
    }
    return scheduler?.invalidate?.(reason, { layers: uniqueLayers, immediate }) || false;
  };
  const update = (gameplaySlice) => {
    if (destroyed) return false;
    const nextModel = createServerMapPresentationModel(gameplaySlice, { now: options.now });
    if (!nextModel) return false;
    const previousModel = modelRef.current;
    modelRef.current = nextModel;
    syncServerMapInteractionState(interactionState, nextModel, settings);
    shell?.phaseHost?.setAttribute?.("data-map-phase", nextModel.phase);
    shell?.phaseHost?.setAttribute?.("data-game-phase", nextModel.gamePhase);
    const layers = !previousModel || previousModel.manifestKey !== nextModel.manifestKey
      ? [...ALL_MAP_RENDER_LAYERS]
      : diffGameplaySliceMapLayers(previousModel.fingerprints, nextModel.fingerprints);
    if (previousModel?.currentPlayerId !== nextModel.currentPlayerId) {
      layerRenderer?.resetComposition?.();
      layers.splice(0, layers.length, ...ALL_MAP_RENDER_LAYERS);
    } else if (previousModel?.phase !== nextModel.phase) {
      layers.push(
        MAP_RENDER_LAYERS.static,
        MAP_RENDER_LAYERS.state,
        MAP_RENDER_LAYERS.selection,
        MAP_RENDER_LAYERS.effects
      );
    }
    invalidate("server-slice-change", layers, !previousModel);
    layerRenderer?.syncEffects?.();
    return layers.length > 0;
  };

  const setSelection = async (districtId, selectionOptions = {}) => {
    if (destroyed) return null;
    const normalizedId = resolveServerMapDistrictId(districtId);
    if (!normalizedId) return null;
    const selectionChanged = interactionState.selectedDistrictId !== normalizedId;
    if (!selectionChanged && selectionOptions.forceSubmit !== true) return null;
    if (selectionChanged) {
      interactionState.selectedDistrictId = normalizedId;
      invalidate("selection-change", [MAP_RENDER_LAYERS.selection], true);
    }
    const rawId = modelRef.current?.rawDistrictIdById.get(normalizedId) || districtId;
    const response = selectionOptions.submit === false || typeof options.selectDistrict !== "function"
      ? null
      : await options.selectDistrict(rawId, modelRef.current?.gameplaySlice || null);
    if (response?.readModel) update(response.readModel);
    else if (response?.gameplaySlice) update(response.gameplaySlice);
    return {
      districtId: String(rawId),
      normalizedDistrictId: normalizedId,
      readModel: response?.readModel || response?.gameplaySlice || null,
      renderState: response?.renderState || null,
      response,
      selectionChanged,
      source: selectionOptions.source || "controller"
    };
  };

  const setVisibility = (nextVisible) => {
    if (destroyed) return false;
    const wasVisible = visible;
    visible = Boolean(nextVisible);
    if (wasVisible === visible) return false;
    interactionController?.setVisibility?.(visible);
    if (!visible) {
      if (resizeFrameId !== null) {
        windowRef?.cancelAnimationFrame?.(resizeFrameId);
        resizeFrameId = null;
        ALL_MAP_RENDER_LAYERS.forEach((layer) => deferredLayers.add(layer));
      }
      layerRenderer?.stopEffects?.();
      return wasVisible;
    }
    const layers = new Set(deferredLayers);
    deferredLayers.clear();
    layers.add(MAP_RENDER_LAYERS.selection);
    layers.add(MAP_RENDER_LAYERS.effects);
    layers.add(MAP_RENDER_LAYERS.hover);
    invalidate("visibility-return", [...layers], true);
    layerRenderer?.syncEffects?.();
    return !wasVisible;
  };

  const handleVisibility = () => setVisibility(!documentRef?.hidden);
  const updateSettings = (nextSettings = {}) => {
    settings = normalizeServerMapSettings({ ...settings, ...nextSettings });
    syncServerMapInteractionState(interactionState, modelRef.current, settings);
    return invalidate("settings-change", [
      MAP_RENDER_LAYERS.state,
      MAP_RENDER_LAYERS.selection,
      MAP_RENDER_LAYERS.effects
    ], true);
  };
  const handleSettingsChanged = (event) => updateSettings(event?.detail?.settings);
  const handleResize = () => {
    if (resizeFrameId !== null) return;
    if (!visible) {
      ALL_MAP_RENDER_LAYERS.forEach((layer) => deferredLayers.add(layer));
      return;
    }
    resizeFrameId = windowRef?.requestAnimationFrame?.(() => {
      resizeFrameId = null;
      invalidate("resize", [...ALL_MAP_RENDER_LAYERS], true);
    }) ?? null;
  };

  const mount = () => {
    if (destroyed) return null;
    if (mounted) return api;
    const active = root && controllersByRoot.get(root);
    if (active && active !== api) return active;
    shell = createServerMapPresentationShell({
      ...options,
      root,
      documentRef
    });
    if (!shell?.canRender) return null;
    mounted = true;
    if (root) controllersByRoot.set(root, api);
    layerRenderer = createServerMapLayerRenderer({
      ...options,
      shell,
      modelRef,
      interactionState,
      windowRef,
      documentRef,
      isVisible: () => visible,
      renderHover: (geometry) => interactionController?.renderHover?.(geometry)
    });
    interactionController = createServerMapInteractionController({
      shell,
      interactionState,
      windowRef,
      getGeometry: layerRenderer.getGeometry,
      getModel: () => modelRef.current,
      selectDistrict: setSelection,
      onDistrictSelected: options.onDistrictSelected
    });
    scheduler = (options.createScheduler || createMapRenderScheduler)({
      windowRef,
      documentRef,
      render: layerRenderer.render,
      frameIntervalMs: 1000 / Math.max(1, Number(options.getPerformanceMode?.()?.renderFpsCap || 60))
    });
    interactionController.mount();
    navigationController = (options.bindNavigation || bindMapNavigation)?.(root) || null;
    unsubscribeSource = options.manageSourceSubscription === false
      ? (() => {})
      : source.subscribe?.(update) || (() => {});
    windowRef?.addEventListener?.("resize", handleResize, { passive: true });
    if (options.managePageLifecycle !== false) {
      windowRef?.addEventListener?.("pagehide", destroy, { once: true });
    }
    documentRef?.addEventListener?.("visibilitychange", handleVisibility);
    documentRef?.addEventListener?.("empire:settings-changed", handleSettingsChanged);

    const current = options.manageSourceSubscription === false
      ? null
      : source.getCurrentReadModel?.();
    if (current) update(current);
    else invalidate("initial", [...ALL_MAP_RENDER_LAYERS], true);
    loadMapImages();
    return api;
  };

  const loadMapImages = () => {
    void loadServerMapPresentationImages({ ...options, windowRef }).then((images) => {
      if (destroyed || !layerRenderer) return;
      layerRenderer.setImageSet(images);
      invalidate("asset:map-images-loaded", [MAP_RENDER_LAYERS.static], true);
    }).catch(() => {});
  };

  const destroy = () => {
    if (destroyed) return false;
    destroyed = true;
    mounted = false;
    unsubscribeSource();
    scheduler?.destroy?.();
    interactionController?.destroy?.();
    navigationController?.destroy?.();
    layerRenderer?.destroy?.();
    if (resizeFrameId !== null) windowRef?.cancelAnimationFrame?.(resizeFrameId);
    windowRef?.removeEventListener?.("resize", handleResize);
    if (options.managePageLifecycle !== false) {
      windowRef?.removeEventListener?.("pagehide", destroy);
    }
    documentRef?.removeEventListener?.("visibilitychange", handleVisibility);
    documentRef?.removeEventListener?.("empire:settings-changed", handleSettingsChanged);
    if (root && controllersByRoot.get(root) === api) controllersByRoot.delete(root);
    return true;
  };

  const api = Object.freeze({
    mount,
    update,
    destroy,
    setSelection,
    setVisibility,
    updateSettings,
    isMounted: () => mounted && !destroyed,
    getLayerCanvases: () => shell ? {
      static: shell.staticCanvas,
      state: shell.canvas,
      selection: shell.selectionCanvas,
      effects: shell.effectsCanvas,
      hover: shell.hoverCanvas
    } : null,
    getPresentationModel: () => modelRef.current
  });
  return api;
}
