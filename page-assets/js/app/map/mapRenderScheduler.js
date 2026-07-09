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

export function createMapRenderScheduler(options = {}) {
  const windowRef = options.windowRef || (typeof window === "undefined" ? null : window);
  const documentRef = options.documentRef || windowRef?.document || (typeof document === "undefined" ? null : document);
  const render = typeof options.render === "function" ? options.render : () => {};
  let frameIntervalMs = Math.max(0, Number(options.frameIntervalMs || 0));
  let dirty = false;
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

    if (!dirty && !flushOptions.force) {
      return false;
    }

    dirty = false;
    const startedAt = defaultNow(windowRef);
    render({ reason: lastReason, time });
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

      if (destroyed || isHidden() || !dirty) {
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

    dirty = true;
    lastReason = String(reason || "state-change");

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
    if (dirty) {
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
    isDirty: () => dirty,
    isScheduled: () => scheduled,
    getLastRenderAt: () => lastRenderAt,
    setFrameIntervalMs(nextIntervalMs) {
      frameIntervalMs = Math.max(0, Number(nextIntervalMs || 0));
    }
  };
}

