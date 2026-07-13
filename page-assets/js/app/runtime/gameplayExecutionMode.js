export const GAMEPLAY_EXECUTION_MODES = Object.freeze({
  localDemo: "local-demo",
  serverAuthoritative: "server-authoritative",
  unavailable: "unavailable"
});

const LOCAL_DEMO_ALIASES = new Set(["local-demo", "demo", "legacy-fallback", "local"]);
const MODE_STORAGE_KEY = "empire:demo:execution-mode:v1";
const MODE_META_SELECTOR = 'meta[name="empire-gameplay-execution-mode"]';

export function isDevelopmentGameplayHost(windowRef = typeof window === "undefined" ? null : window) {
  const protocol = String(windowRef?.location?.protocol || "");
  const host = String(windowRef?.location?.hostname || "").toLowerCase();
  return protocol === "file:"
    || !host
    || host === "localhost"
    || host === "127.0.0.1"
    || host === "::1"
    || host.endsWith(".local");
}

export function normalizeGameplayExecutionMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (LOCAL_DEMO_ALIASES.has(normalized)) return GAMEPLAY_EXECUTION_MODES.localDemo;
  if (normalized === GAMEPLAY_EXECUTION_MODES.serverAuthoritative) return normalized;
  if (normalized === GAMEPLAY_EXECUTION_MODES.unavailable) return normalized;
  return null;
}

export function readRequestedGameplayExecutionMode(windowRef = typeof window === "undefined" ? null : window) {
  if (!isDevelopmentGameplayHost(windowRef)) return null;
  try {
    const queryMode = normalizeGameplayExecutionMode(new URLSearchParams(windowRef?.location?.search || "").get("runtimeMode"));
    if (queryMode) return queryMode;
    return normalizeGameplayExecutionMode(windowRef?.localStorage?.getItem?.(MODE_STORAGE_KEY));
  } catch (_error) {
    return null;
  }
}

export function readConfiguredGameplayExecutionMode(windowRef = typeof window === "undefined" ? null : window) {
  const documentRef = windowRef?.document || (typeof document === "undefined" ? null : document);
  const metaMode = normalizeGameplayExecutionMode(documentRef?.querySelector?.(MODE_META_SELECTOR)?.getAttribute?.("content"));
  if (metaMode) return metaMode;
  return normalizeGameplayExecutionMode(documentRef?.documentElement?.dataset?.gameplayExecutionMode);
}

export function getGameplayExecutionMode(options = {}) {
  const windowRef = options.windowRef || (typeof window === "undefined" ? null : window);
  const requestedMode = readRequestedGameplayExecutionMode(windowRef);
  if (requestedMode) return requestedMode;
  const configuredMode = readConfiguredGameplayExecutionMode(windowRef);
  if (configuredMode) return configuredMode;
  if (options.serverReady === true) return GAMEPLAY_EXECUTION_MODES.serverAuthoritative;
  const diagnosticsMode = normalizeGameplayExecutionMode(options.diagnosticsMode);
  if (diagnosticsMode === GAMEPLAY_EXECUTION_MODES.serverAuthoritative) return diagnosticsMode;
  return isDevelopmentGameplayHost(windowRef)
    ? GAMEPLAY_EXECUTION_MODES.localDemo
    : GAMEPLAY_EXECUTION_MODES.unavailable;
}

export function isLocalDemoGameplayMode(options = {}) {
  return getGameplayExecutionMode(options) === GAMEPLAY_EXECUTION_MODES.localDemo;
}
