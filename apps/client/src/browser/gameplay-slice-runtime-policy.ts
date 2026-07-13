import {
  getForcedDevelopmentRuntimeMode,
  isLegacyGameplayFallbackAllowed,
  setGameplayRuntimeMarker
} from "./gameplay-slice-runtime-diagnostics";

export const applyDevelopmentRuntimeOverride = (root: HTMLElement): boolean => {
  const forcedMode = getForcedDevelopmentRuntimeMode();
  if (!forcedMode || forcedMode === "server-authoritative") return false;

  setGameplayRuntimeMarker(root, forcedMode === "legacy-fallback" ? "legacy-fallback" : "demo-ready", {
    ...(forcedMode === "legacy-fallback" ? { fallback: "legacy" as const } : {}),
    serverRuntime: "not-requested"
  });
  window.empireStreetsRuntimeDiagnostics?.setMode?.(forcedMode, {
    serverSliceActive: false,
    reason: "configured-runtime-override"
  });
  root.hidden = true;
  return true;
};

export const markMissingGameplaySessionRuntime = (root: HTMLElement): void => {
  if (isLegacyGameplayFallbackAllowed()) {
    setGameplayRuntimeMarker(root, "demo-ready", {
      fallback: "legacy",
      serverRuntime: "not-requested"
    });
  } else {
    setGameplayRuntimeMarker(root, "server-authoritative-error", {
      error: "A validated gameplay session is required.",
      serverRuntime: "not-requested"
    });
  }
  root.hidden = true;
};

export const markGameplaySliceUnavailableRuntime = (
  root: HTMLElement,
  endpoint: string,
  message: string
): boolean => {
  const allowLegacyFallback = isLegacyGameplayFallbackAllowed();
  setGameplayRuntimeMarker(root, allowLegacyFallback ? "legacy-fallback" : "server-authoritative-error", {
    endpoint,
    error: message,
    ...(allowLegacyFallback ? { fallback: "legacy" as const } : {}),
    serverRuntime: "server-authoritative-error"
  });
  return allowLegacyFallback;
};
