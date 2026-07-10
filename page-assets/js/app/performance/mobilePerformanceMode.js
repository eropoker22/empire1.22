const MOBILE_MAX_WIDTH = 840;
const MOBILE_DPR_CAP = 1.5;
const DESKTOP_RENDER_FPS = 60;
const MOBILE_RENDER_FPS = 30;
const MOBILE_POLLING_MULTIPLIER = 2;
const METRICS_KEY = "empireStreetsPerformanceMetrics";
const MOBILE_PERFORMANCE_CLASS = "is-mobile-performance-mode";

function getViewportWidth(windowRef, documentRef) {
  const candidates = [
    windowRef?.visualViewport?.width,
    windowRef?.innerWidth,
    documentRef?.documentElement?.clientWidth
  ].map(Number).filter((value) => Number.isFinite(value) && value > 0);

  return candidates.length > 0 ? Math.min(...candidates) : 0;
}

function matchesMedia(windowRef, query) {
  try {
    return Boolean(windowRef?.matchMedia?.(query)?.matches);
  } catch (_error) {
    return false;
  }
}

function isMobileUserAgent(windowRef) {
  const userAgent = String(windowRef?.navigator?.userAgent || "");
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/iu.test(userAgent);
}

export function detectMobilePerformanceMode(options = {}) {
  const windowRef = options.windowRef || (typeof window === "undefined" ? null : window);
  const documentRef = options.documentRef || windowRef?.document || (typeof document === "undefined" ? null : document);
  const maxWidth = Number(options.maxWidth || MOBILE_MAX_WIDTH);
  const viewportWidth = getViewportWidth(windowRef, documentRef);
  const smallViewport = viewportWidth > 0 && viewportWidth <= maxWidth;
  const coarsePointer = matchesMedia(windowRef, "(pointer: coarse)");
  const reducedMotion = matchesMedia(windowRef, "(prefers-reduced-motion: reduce)");
  const mobileUserAgent = isMobileUserAgent(windowRef);
  const active = Boolean(reducedMotion || smallViewport || mobileUserAgent || (coarsePointer && viewportWidth <= 1024));

  return {
    active,
    smallViewport,
    coarsePointer,
    reducedMotion,
    mobileUserAgent,
    viewportWidth,
    dprCap: active ? MOBILE_DPR_CAP : Number.POSITIVE_INFINITY,
    renderFpsCap: active ? MOBILE_RENDER_FPS : DESKTOP_RENDER_FPS,
    pollingMultiplier: active ? MOBILE_POLLING_MULTIPLIER : 1
  };
}

export function getCappedDevicePixelRatio(windowRef, mode = null) {
  const rawDpr = Number(windowRef?.devicePixelRatio || 1);
  const safeDpr = Number.isFinite(rawDpr) && rawDpr > 0 ? rawDpr : 1;
  const cap = Number(mode?.dprCap || Number.POSITIVE_INFINITY);
  return Math.max(1, Math.min(safeDpr, cap));
}

export function getPerformanceMetrics(windowRef = typeof window === "undefined" ? null : window) {
  if (!windowRef) {
    return {
      fpsEstimate: 0,
      mapRendersPerMinute: 0,
      activeIntervalsCount: 0,
      gameplaySliceRefreshCount: 0,
      runtimeMode: "local",
      localTickActive: false,
      localProjectionActive: false,
      serverSliceActive: false,
      serverSliceRefreshPerMinute: 0,
      clientStateRecomputePerMinute: 0,
      mapInvalidationReasonCounts: {},
      lastMapInvalidationReason: null,
      demoFallbackActive: false,
      lastRenderDurationMs: 0,
      mobilePerformanceModeActive: false
    };
  }

  if (!windowRef[METRICS_KEY]) {
    windowRef[METRICS_KEY] = {
      fpsEstimate: 0,
      mapRendersPerMinute: 0,
      activeIntervalsCount: 0,
      gameplaySliceRefreshCount: 0,
      lastRenderDurationMs: 0,
      mobilePerformanceModeActive: false,
      mapRenderCount: 0,
      mapRenderTimestamps: [],
      managedIntervalCounts: {}
    };
  }

  const metrics = windowRef[METRICS_KEY];
  metrics.mapInvalidationReasonCounts ??= {};
  metrics.serverSliceRefreshPerMinute ??= 0;
  metrics.clientStateRecomputePerMinute ??= 0;

  return metrics;
}

export function applyMobilePerformanceMode(mode, options = {}) {
  const documentRef = options.documentRef || (typeof document === "undefined" ? null : document);
  const windowRef = options.windowRef || documentRef?.defaultView || (typeof window === "undefined" ? null : window);
  const metrics = getPerformanceMetrics(windowRef);
  const active = Boolean(mode?.active);

  for (const element of [documentRef?.documentElement, documentRef?.body]) {
    element?.classList?.toggle?.(MOBILE_PERFORMANCE_CLASS, active);
    if (element?.dataset) {
      element.dataset.mobilePerformanceMode = active ? "true" : "false";
    }
  }

  metrics.mobilePerformanceModeActive = active;
  metrics.mobilePerformanceMode = active;
  metrics.mapRenderFpsCap = Number(mode?.renderFpsCap || DESKTOP_RENDER_FPS);
  metrics.canvasDprCap = Number.isFinite(Number(mode?.dprCap)) ? Number(mode.dprCap) : null;

  if (windowRef) {
    windowRef.empireStreetsPerformanceMode = mode;
  }

  return active;
}

export function recordMapRender(windowRef, durationMs = 0, nowMs = Date.now()) {
  const metrics = getPerformanceMetrics(windowRef);
  const timestamps = Array.isArray(metrics.mapRenderTimestamps) ? metrics.mapRenderTimestamps : [];
  const cutoff = nowMs - 60_000;
  timestamps.push(nowMs);

  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }

  metrics.mapRenderTimestamps = timestamps;
  metrics.mapRenderCount = Number(metrics.mapRenderCount || 0) + 1;
  metrics.mapRendersPerMinute = timestamps.length;
  metrics.lastRenderDurationMs = Number(Number(durationMs || 0).toFixed(2));

  if (timestamps.length >= 2) {
    const first = timestamps[Math.max(0, timestamps.length - 10)];
    const last = timestamps[timestamps.length - 1];
    const sampleCount = Math.min(10, timestamps.length - 1);
    const averageFrameMs = (last - first) / Math.max(1, sampleCount);
    metrics.fpsEstimate = Number(Math.min(60, 1000 / Math.max(1, averageFrameMs)).toFixed(1));
  } else {
    metrics.fpsEstimate = 0;
  }

  return metrics;
}

export function recordMapEffectRender(windowRef, durationMs = 0, nowMs = Date.now()) {
  const metrics = getPerformanceMetrics(windowRef);
  const timestamps = Array.isArray(metrics.mapEffectRenderTimestamps) ? metrics.mapEffectRenderTimestamps : [];
  const cutoff = nowMs - 60_000;
  timestamps.push(nowMs);

  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }

  metrics.mapEffectRenderTimestamps = timestamps;
  metrics.mapEffectRendersPerMinute = timestamps.length;
  metrics.lastEffectRenderDurationMs = Number(Number(durationMs || 0).toFixed(2));
  metrics.lastRenderDurationMs = metrics.lastEffectRenderDurationMs;
  return metrics;
}

export function recordGameplaySliceRefresh(windowRef, nowMs = Date.now()) {
  const metrics = getPerformanceMetrics(windowRef);
  metrics.gameplaySliceRefreshCount = Number(metrics.gameplaySliceRefreshCount || 0) + 1;
  metrics.lastGameplaySliceRefreshAt = nowMs;
  return metrics;
}

export function trackManagedInterval(windowRef, label, delta) {
  const metrics = getPerformanceMetrics(windowRef);
  const key = String(label || "unknown");
  const counts = metrics.managedIntervalCounts && typeof metrics.managedIntervalCounts === "object"
    ? metrics.managedIntervalCounts
    : {};
  counts[key] = Math.max(0, Number(counts[key] || 0) + Number(delta || 0));
  metrics.managedIntervalCounts = counts;
  metrics.activeIntervalsCount = Object.values(counts).reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0);
  return metrics.activeIntervalsCount;
}
