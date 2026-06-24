import { escapeHtml } from "../shared-ui";

export type GameplayRuntimeMarker =
  | "initializing"
  | "server-authoritative-ready"
  | "server-authoritative-error"
  | "legacy-fallback";

export const setGameplayRuntimeMarker = (
  root: HTMLElement,
  marker: GameplayRuntimeMarker,
  details: {
    endpoint?: string;
    error?: string;
    fallback?: "legacy";
  } = {}
): void => {
  root.dataset.gameplayRuntime = marker;
  root.dataset.gameplaySliceRuntime = marker;
  root.dataset.gameplaySliceEndpoint = details.endpoint ?? root.dataset.gameplaySliceEndpoint ?? "";
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
    if (details.fallback) {
      document.body.dataset.gameplayFallback = details.fallback;
    } else {
      delete document.body.dataset.gameplayFallback;
    }
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
