import {
  applyMobilePerformanceMode,
  detectMobilePerformanceMode
} from "./performance/mobilePerformanceMode.js";

const PERFORMANCE_MEDIA_QUERIES = [
  "(max-width: 840px)",
  "(pointer: coarse)",
  "(prefers-reduced-motion: reduce)"
];

function initMobilePerformanceRuntime(windowRef = window, documentRef = document) {
  let frameId = null;
  let lastMode = null;

  const apply = () => {
    frameId = null;
    lastMode = detectMobilePerformanceMode({ windowRef, documentRef });
    applyMobilePerformanceMode(lastMode, { windowRef, documentRef });
    windowRef.dispatchEvent?.(new CustomEvent("empire:mobile-performance-mode-changed", {
      detail: lastMode
    }));
  };

  const requestApply = () => {
    if (frameId !== null) {
      return;
    }
    frameId = windowRef.requestAnimationFrame?.(apply) ?? windowRef.setTimeout?.(apply, 0) ?? null;
  };

  const syncVisibilityClass = () => {
    const hidden = Boolean(documentRef.hidden);
    documentRef.documentElement?.classList?.toggle?.("is-page-hidden", hidden);
    documentRef.body?.classList?.toggle?.("is-page-hidden", hidden);

    if (!hidden) {
      requestApply();
    }
  };

  apply();
  syncVisibilityClass();
  windowRef.addEventListener?.("resize", requestApply, { passive: true });
  windowRef.addEventListener?.("orientationchange", requestApply, { passive: true });
  documentRef.addEventListener?.("visibilitychange", syncVisibilityClass);

  for (const query of PERFORMANCE_MEDIA_QUERIES) {
    const media = windowRef.matchMedia?.(query);
    if (typeof media?.addEventListener === "function") {
      media.addEventListener("change", requestApply);
    } else if (typeof media?.addListener === "function") {
      media.addListener(requestApply);
    }
  }

  return {
    getMode: () => lastMode,
    refresh: apply
  };
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.empireStreetsMobilePerformanceRuntime = initMobilePerformanceRuntime(window, document);
}

export { initMobilePerformanceRuntime };

