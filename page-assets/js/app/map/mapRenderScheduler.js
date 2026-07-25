import { recordMapRender } from "../performance/mobilePerformanceMode.js";

function defaultNow(windowRef) {
  return Number(windowRef?.performance?.now?.() || Date.now());
}

function requestFrame(windowRef, callback) {
  if (typeof windowRef?.requestAnimationFrame === "function") {
    return windowRef.requestAnimationFrame(callback);
  }

  if (typeof windowRef?.setTimeout === "function") {
    return windowRef.setTimeout(() => callback(defaultNow(windowRef)), 0);
  }

  callback(defaultNow(windowRef));
  return null;
}

function cancelFrame(windowRef, frameId) {
  if (frameId === null || frameId === undefined) {
    return;
  }

  if (typeof windowRef?.cancelAnimationFrame === "function") {
    windowRef.cancelAnimationFrame(frameId);
    return;
  }

  if (typeof windowRef?.clearTimeout === "function") {
    windowRef.clearTimeout(frameId);
  }
}

function normalizeInvalidationReason(reason) {
  if (typeof reason === "string" && reason.trim()) return reason.trim();
  if (reason?.detail?.reason) return String(reason.detail.reason);
  if (reason?.type) return `ui:${String(reason.type)}`;
  return "state-change";
}

export function createMapRenderScheduler(options = {}) {
  const windowRef = options.windowRef || (typeof window === "undefined" ? null : window);
  const documentRef = options.documentRef || windowRef?.document || (typeof document === "undefined" ? null : document);
  const render = typeof options.render === "function" ? options.render : () => {};
  let frameIntervalMs = Math.max(0, Number(options.frameIntervalMs || 0));
  const dirtyLayers = new Set();
  let scheduled = false;
  let frameId = null;
  let destroyed = false;
  let lastRenderAt = 0;
  let lastReason = "initial";

  const isHidden = () => Boolean(documentRef?.hidden);

  const clearScheduledFrame = () => {
    if (!scheduled) {
      return;
    }
    cancelFrame(windowRef, frameId);
    frameId = null;
    scheduled = false;
  };

  const flush = (time = defaultNow(windowRef), flushOptions = {}) => {
    if (destroyed || (isHidden() && !flushOptions.allowHidden)) {
      return false;
    }

    if (dirtyLayers.size === 0 && !flushOptions.force) {
      return false;
    }

    const layers = dirtyLayers.size > 0 ? [...dirtyLayers] : ["all"];
    dirtyLayers.clear();
    const startedAt = defaultNow(windowRef);
    render({ reason: lastReason, time, layers });
    const durationMs = Math.max(0, defaultNow(windowRef) - startedAt);
    lastRenderAt = Number(time) || defaultNow(windowRef);
    recordMapRender(options.metricsWindowRef || windowRef, durationMs);
    return true;
  };

  const schedule = () => {
    if (destroyed || scheduled || isHidden()) {
      return;
    }

    scheduled = true;
    frameId = requestFrame(windowRef, (time) => {
      scheduled = false;
      frameId = null;

      if (destroyed || isHidden() || dirtyLayers.size === 0) {
        return;
      }

      const elapsedMs = Math.max(0, Number(time || 0) - lastRenderAt);
      if (lastRenderAt > 0 && frameIntervalMs > 0 && elapsedMs < frameIntervalMs) {
        schedule();
        return;
      }

      flush(time);
    });
  };

  const invalidate = (reason = "state-change", invalidateOptions = {}) => {
    if (destroyed) {
      return false;
    }

    const layers = Array.isArray(invalidateOptions.layers) && invalidateOptions.layers.length > 0
      ? invalidateOptions.layers
      : Array.isArray(invalidateOptions.layers)
        ? []
        : ["all"];
    if (layers.length === 0) {
      return false;
    }
    for (const layer of layers) dirtyLayers.add(String(layer));
    lastReason = normalizeInvalidationReason(reason);
    windowRef?.empireStreetsRuntimeDiagnostics?.recordMapInvalidation?.(lastReason);

    if (invalidateOptions.immediate) {
      clearScheduledFrame();
      return flush(defaultNow(windowRef), { force: true });
    }

    schedule();
    return true;
  };

  const handleVisibilityChange = () => {
    if (isHidden()) {
      clearScheduledFrame();
      return;
    }

    options.onVisible?.();
    if (dirtyLayers.size > 0) {
      schedule();
    }
  };

  documentRef?.addEventListener?.("visibilitychange", handleVisibilityChange);

  return {
    invalidate,
    flush,
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      clearScheduledFrame();
      documentRef?.removeEventListener?.("visibilitychange", handleVisibilityChange);
    },
    isDirty: () => dirtyLayers.size > 0,
    getDirtyLayers: () => [...dirtyLayers],
    isScheduled: () => scheduled,
    getLastRenderAt: () => lastRenderAt,
    setFrameIntervalMs(nextIntervalMs) {
      frameIntervalMs = Math.max(0, Number(nextIntervalMs || 0));
    }
  };
}
