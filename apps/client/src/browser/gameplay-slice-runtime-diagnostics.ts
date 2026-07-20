import { escapeHtml } from "../shared-ui";

export type GameplayRuntimeMarker =
  | "initializing"
  | "demo-ready"
  | "server-authoritative-ready"
  | "server-authoritative-error"
  | "legacy-fallback";

export type GameplayServerRuntimeMarker =
  | "not-requested"
  | "server-authoritative-ready"
  | "server-authoritative-error";

declare global {
  interface EmpireStreetsRuntimeDiagnostics {
    readonly requestedMode?: "server-authoritative" | "demo" | "legacy-fallback" | "local" | null;
    shouldAllowDemoFallback?(): boolean;
    setMode?(mode: "server-authoritative" | "demo" | "legacy-fallback" | "local", details?: {
      serverSliceActive?: boolean;
      reason?: string;
    }): string;
  }
  interface Window {
    EmpireConfigOverrides?: {
      localDemoEnabled?: boolean;
    };
    empireStreetsRuntimeDiagnostics?: EmpireStreetsRuntimeDiagnostics;
  }
}

export const setGameplayRuntimeMarker = (
  root: HTMLElement,
  marker: GameplayRuntimeMarker,
  details: {
    endpoint?: string;
    error?: string;
    fallback?: "legacy";
    serverRuntime?: GameplayServerRuntimeMarker;
  } = {}
): void => {
  root.dataset.gameplayRuntime = marker;
  root.dataset.gameplaySliceRuntime = marker;
  root.dataset.gameplaySliceEndpoint = details.endpoint ?? root.dataset.gameplaySliceEndpoint ?? "";
  const serverRuntime = details.serverRuntime
    ?? (marker === "server-authoritative-ready" || marker === "server-authoritative-error" ? marker : null);
  if (serverRuntime) {
    root.dataset.gameplayServerRuntime = serverRuntime;
  } else {
    delete root.dataset.gameplayServerRuntime;
  }
  if (details.error) {
    root.dataset.gameplaySliceError = sanitizeDiagnosticText(details.error, 180);
  } else {
    delete root.dataset.gameplaySliceError;
  }
  if (details.fallback) {
    root.dataset.gameplayFallback = details.fallback;
  } else {
    delete root.dataset.gameplayFallback;
  }
  if (typeof document !== "undefined" && document.body) {
    document.body.dataset.gameplayRuntime = marker;
    if (serverRuntime) {
      document.body.dataset.gameplayServerRuntime = serverRuntime;
    } else {
      delete document.body.dataset.gameplayServerRuntime;
    }
    if (details.fallback) {
      document.body.dataset.gameplayFallback = details.fallback;
    } else {
      delete document.body.dataset.gameplayFallback;
    }
  }

  const diagnostics = typeof window === "undefined" ? null : window.empireStreetsRuntimeDiagnostics;
  if (marker === "server-authoritative-ready") {
    diagnostics?.setMode?.("server-authoritative", {
      serverSliceActive: true,
      reason: "gameplay-slice-ready"
    });
  } else if (marker === "server-authoritative-error") {
    diagnostics?.setMode?.("server-authoritative", {
      serverSliceActive: false,
      reason: "gameplay-slice-error"
    });
  } else if (marker === "legacy-fallback" || details.fallback === "legacy") {
    diagnostics?.setMode?.("legacy-fallback", {
      serverSliceActive: false,
      reason: "legacy-fallback"
    });
  } else if (marker === "demo-ready") {
    diagnostics?.setMode?.("demo", {
      serverSliceActive: false,
      reason: "demo-runtime"
    });
  }
};

export const isLegacyGameplayFallbackAllowed = (): boolean => {
  if (typeof window === "undefined") return false;
  const diagnosticsDecision = window.empireStreetsRuntimeDiagnostics?.shouldAllowDemoFallback?.();
  if (typeof diagnosticsDecision === "boolean") return diagnosticsDecision;
  const forcedMode = getForcedDevelopmentRuntimeMode();
  return forcedMode === "demo" || forcedMode === "legacy-fallback" || forcedMode === "local";
};

export type SelectedGameplayRuntimeMode = "server-authoritative" | "demo" | "legacy-fallback" | "local" | null;

const LOCAL_DEMO_SESSION_KEY = "empire:local-demo-session:v1";

const normalizeSelectedRuntimeMode = (value: unknown): SelectedGameplayRuntimeMode => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "local-demo") return "demo";
  if (normalized === "server-authoritative" || normalized === "demo" || normalized === "legacy-fallback" || normalized === "local") {
    return normalized;
  }
  return null;
};

export const getForcedDevelopmentRuntimeMode = (): SelectedGameplayRuntimeMode => {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  const queryMode = new URLSearchParams(window.location.search).get("runtimeMode");
  if (queryMode === "server-authoritative") return "server-authoritative";
  if (queryMode === "local-demo") return "demo";
  if (readBrowserStorageItem("sessionStorage", LOCAL_DEMO_SESSION_KEY) === "1") return "demo";

  const canUseDevelopmentOverride = window.location.protocol === "file:"
    || !host
    || host === "localhost"
    || host === "127.0.0.1"
    || host === "::1"
    || host.endsWith(".local");
  let requestedMode: SelectedGameplayRuntimeMode = null;
  if (canUseDevelopmentOverride) {
    try {
      requestedMode = normalizeSelectedRuntimeMode(
        window.empireStreetsRuntimeDiagnostics?.requestedMode
        || queryMode
        || readBrowserStorageItem("localStorage", "empire:demo:execution-mode:v1")
        || (window.EmpireConfigOverrides?.localDemoEnabled === true ? "demo" : null)
      );
    } catch (_error) {
      requestedMode = null;
    }
  }
  if (requestedMode) return requestedMode;

  return normalizeSelectedRuntimeMode(
    document.querySelector?.('meta[name="empire-gameplay-execution-mode"]')?.getAttribute?.("content")
    || document.documentElement?.dataset?.gameplayExecutionMode
  );
};

const readBrowserStorageItem = (storageName: "localStorage" | "sessionStorage", key: string): string | null => {
  try {
    return window[storageName]?.getItem?.(key) ?? null;
  } catch (_error) {
    return null;
  }
};

export const isGameplayDiagnosticsEnabled = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || window.location.search.includes("gameplayDiagnostics=1");
};

export const writeGameplaySliceDiagnostic = (endpoint: string, message: string): void => {
  if (!isGameplayDiagnosticsEnabled()) {
    return;
  }
  console.warn("[gameplay-slice] Server-authoritative runtime failed; legacy fallback remains active.", {
    endpoint,
    error: sanitizeDiagnosticText(message, 240)
  });
};

export const renderGameplaySliceDiagnostic = (endpoint: string, message: string): string => [
  `<strong>Server-authoritative gameplay slice unavailable</strong>`,
  `<span>Legacy fallback is active for this local session.</span>`,
  `<span data-gameplay-slice-diagnostic-endpoint>${escapeHtml(endpoint)}</span>`,
  `<span data-gameplay-slice-diagnostic-error>${escapeHtml(sanitizeDiagnosticText(message, 240))}</span>`
].join("");

export const createSafeErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message.trim()
    ? error.message.trim()
    : "Unknown gameplay slice error.";

const sanitizeDiagnosticText = (value: string, maxLength: number): string =>
  String(value || "")
    .replace(/(snapshotToken|sessionToken|token)["':=\s]+[^,}\s]+/giu, "$1=<redacted>")
    .replace(/[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/gu, "<redacted-token>")
    .slice(0, maxLength);
