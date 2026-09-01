import {
  detectMobilePerformanceMode,
  getPerformanceMetrics,
  recordMapEffectRender,
  resolveMapCanvasResolution
} from "../performance/mobilePerformanceMode.js";
import { ALL_MAP_RENDER_LAYERS, MAP_RENDER_LAYERS } from "./mapLayerInvalidation.js";
import { createServerMapCanvasComposition } from "./serverMapCanvasComposition.js";
import {
  hasLiveServerMapEffects,
  hasServerMapEffectEntries,
  syncServerMapGeometryMetadata
} from "./serverMapPresentationState.js";

const clearCanvas = (canvas) => {
  canvas?.getContext?.("2d")?.clearRect?.(0, 0, canvas.width || 0, canvas.height || 0);
};

const hasAnimatedEffectEntries = (state) => (
  (state?.activeSpyDistrictIds?.size || 0) > 0
  || (state?.activePoliceDistrictIds?.size || 0) > 0
  || (state?.activeRobberyDistrictIds?.size || 0) > 0
  || (state?.activeTrapDistrictIds?.size || 0) > 0
  || ((state?.activeAttackDistrictIds?.size || 0) > 0 && state.activeAttackDistrictIds.size <= 5)
  || ((state?.activeOccupyDistrictIds?.size || 0) > 0 && state.activeOccupyDistrictIds.size <= 5)
);

export function createServerMapLayerRenderer(options = {}) {
  const {
    shell,
    modelRef,
    interactionState,
    windowRef,
    documentRef
  } = options;
  let composition = null;
  let compositionPlayerId = "";
  let geometry = null;
  let imageSet = null;
  let effectFrameId = null;
  let lastEffectFrameAt = 0;
  const baseWidth = Math.max(1, Number(shell.canvas.getAttribute?.("width") || shell.canvas.width || 1600));
  const baseHeight = Math.max(1, Number(shell.canvas.getAttribute?.("height") || shell.canvas.height || 980));
  const diagnostics = () => windowRef?.empireStreetsRuntimeDiagnostics || null;
  const getPerformanceMode = () => (
    options.getPerformanceMode?.()
    || windowRef?.empireStreetsPerformanceMode
    || detectMobilePerformanceMode({ windowRef, documentRef })
  );

  const ensureComposition = () => {
    const playerId = String(modelRef.current?.currentPlayerId || "current-player");
    if (composition && compositionPlayerId === playerId) return composition;
    compositionPlayerId = playerId;
    composition = (options.createCanvasComposition || createServerMapCanvasComposition)({
      currentPlayerId: playerId,
      documentRef,
      getFactionGlyph: options.getFactionGlyph,
      modelRef,
      windowRef
    });
    return composition;
  };

  const syncLayerSizes = () => {
    for (const canvas of [
      shell.staticCanvas,
      shell.selectionCanvas,
      shell.effectsCanvas,
      shell.hoverCanvas
    ]) {
      if (!canvas) continue;
      if (canvas.width !== shell.canvas.width) canvas.width = shell.canvas.width;
      if (canvas.height !== shell.canvas.height) canvas.height = shell.canvas.height;
    }
  };

  const syncResolution = () => {
    const rect = shell.canvasHost.getBoundingClientRect?.() || {};
    const cssWidth = Number(
      shell.canvasHost.clientWidth
      || shell.canvasHost.offsetWidth
      || rect.width
      || shell.canvas.width
    );
    const cssHeight = Number(
      shell.canvasHost.clientHeight
      || shell.canvasHost.offsetHeight
      || rect.height
      || Math.round(cssWidth * (baseHeight / baseWidth))
      || shell.canvas.height
    );
    if (!Number.isFinite(cssWidth) || !Number.isFinite(cssHeight) || cssWidth <= 0 || cssHeight <= 0) {
      return false;
    }
    const resolution = resolveMapCanvasResolution({
      windowRef,
      mode: getPerformanceMode(),
      cssWidth,
      baseWidth,
      baseHeight
    });
    const metrics = getPerformanceMetrics(windowRef);
    metrics.mapCanvasPixelRatio = resolution.pixelRatio;
    metrics.mapCanvasWidth = resolution.width;
    metrics.mapCanvasHeight = resolution.height;
    if (shell.canvas.width === resolution.width && shell.canvas.height === resolution.height) return false;
    shell.canvas.width = resolution.width;
    shell.canvas.height = resolution.height;
    syncLayerSizes();
    interactionState.geometryCache = null;
    geometry = null;
    return true;
  };

  const syncGeometry = (nextGeometry) => {
    geometry = syncServerMapGeometryMetadata(
      nextGeometry || geometry,
      modelRef.current,
      interactionState
    );
    return geometry;
  };

  const renderEffects = () => {
    if (!shell.effectsCanvas) return geometry;
    if (!hasServerMapEffectEntries(interactionState)) {
      clearCanvas(shell.effectsCanvas);
      return geometry;
    }
    const startedAt = windowRef?.performance?.now?.() ?? Date.now();
    syncGeometry(ensureComposition().renderDistrictEffectsCanvas(
      shell.effectsCanvas,
      modelRef.current?.phase || "day",
      interactionState,
      geometry,
      { reducedMapEffects: false }
    ));
    recordMapEffectRender(windowRef, (windowRef?.performance?.now?.() ?? Date.now()) - startedAt);
    diagnostics()?.recordMapLayerRedraw?.(MAP_RENDER_LAYERS.effects);
    diagnostics()?.recordEffectFrame?.();
    return geometry;
  };

  const render = ({ layers = ALL_MAP_RENDER_LAYERS } = {}) => {
    const requested = new Set(layers);
    if (syncResolution() || requested.has("all")) {
      requested.clear();
      ALL_MAP_RENDER_LAYERS.forEach((layer) => requested.add(layer));
    }
    diagnostics()?.recordMapRenderCycle?.([...requested]);
    syncLayerSizes();
    const activeComposition = ensureComposition();
    const phase = modelRef.current?.phase || shell.phaseHost?.dataset?.mapPhase || "day";
    const renderOptions = {
      renderActivityEffects: false,
      compactDistrictBorders: Boolean(getPerformanceMode().active)
    };
    interactionState.animationTick = Date.now();

    if (requested.has(MAP_RENDER_LAYERS.static) && shell.staticCanvas) {
      syncGeometry(activeComposition.renderDistrictStaticCanvas(
        shell.staticCanvas, phase, interactionState, imageSet, renderOptions
      ));
      diagnostics()?.recordMapLayerRedraw?.(MAP_RENDER_LAYERS.static);
    }
    if (requested.has(MAP_RENDER_LAYERS.state)) {
      syncGeometry(activeComposition.renderDistrictStateCanvas(
        shell.canvas, phase, interactionState, imageSet, renderOptions
      ));
      diagnostics()?.recordMapLayerRedraw?.(MAP_RENDER_LAYERS.state);
    }
    if (requested.has(MAP_RENDER_LAYERS.selection) && shell.selectionCanvas) {
      syncGeometry(activeComposition.renderDistrictSelectionCanvas(
        shell.selectionCanvas, phase, interactionState, imageSet, renderOptions
      ));
      diagnostics()?.recordMapLayerRedraw?.(MAP_RENDER_LAYERS.selection);
    }
    if (requested.has(MAP_RENDER_LAYERS.effects)) renderEffects();
    if (requested.has(MAP_RENDER_LAYERS.hover)) options.renderHover?.(geometry);
    return geometry;
  };

  const stopEffects = () => {
    if (effectFrameId !== null) windowRef?.cancelAnimationFrame?.(effectFrameId);
    effectFrameId = null;
    lastEffectFrameAt = 0;
    diagnostics()?.setMapRafActive?.(false);
  };

  const syncEffects = () => {
    if (!options.isVisible?.() || documentRef?.hidden) {
      stopEffects();
      return;
    }
    if (!hasServerMapEffectEntries(interactionState)) {
      clearCanvas(shell.effectsCanvas);
      stopEffects();
      return;
    }
    if (getPerformanceMode().reducedMotion || !hasLiveServerMapEffects(interactionState, Date.now())) {
      renderEffects();
      stopEffects();
      return;
    }
    if (effectFrameId !== null) return; interactionState.animationTick = Date.now(); renderEffects();
    const animate = (time) => {
      effectFrameId = null;
      if (!options.isVisible?.() || documentRef?.hidden) {
        stopEffects();
        return;
      }
      if (!hasLiveServerMapEffects(interactionState, Date.now())) {
        renderEffects();
        stopEffects();
        return;
      }
      const targetFps = hasAnimatedEffectEntries(interactionState)
        ? getPerformanceMode().active ? 15 : 30
        : 1;
      if (!lastEffectFrameAt || time - lastEffectFrameAt >= 1000 / targetFps) {
        lastEffectFrameAt = time;
        interactionState.animationTick = Date.now();
        renderEffects();
      }
      effectFrameId = windowRef?.requestAnimationFrame?.(animate) ?? null;
    };
    effectFrameId = windowRef?.requestAnimationFrame?.(animate) ?? null;
    diagnostics()?.setMapRafActive?.(effectFrameId !== null);
  };

  return {
    render,
    syncEffects,
    stopEffects,
    getGeometry: () => geometry,
    setImageSet(nextImageSet) {
      imageSet = nextImageSet;
    },
    resetComposition() {
      composition = null;
      compositionPlayerId = "";
    },
    destroy() {
      stopEffects();
      geometry = null;
      imageSet = null;
      composition = null;
    }
  };
}
