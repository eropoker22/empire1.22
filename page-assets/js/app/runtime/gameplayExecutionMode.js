export const GAMEPLAY_EXECUTION_MODES = Object.freeze({
  localDemo: "local-demo",
  serverAuthoritative: "server-authoritative",
  unavailable: "unavailable"
});

export const CONFLICT_SYSTEM_IDS = Object.freeze([
  "attack",
  "defense",
  "spy",
  "heist",
  "rob",
  "occupy",
  "trap"
]);

export function getConflictAuthorityMatrix(mode) {
  const normalizedMode = normalizeGameplayExecutionMode(mode) || GAMEPLAY_EXECUTION_MODES.unavailable;
  const matrix = Object.fromEntries(CONFLICT_SYSTEM_IDS.map((systemId) => [systemId, Object.freeze({
    localMutation: normalizedMode === GAMEPLAY_EXECUTION_MODES.localDemo,
    serverCommand: normalizedMode === GAMEPLAY_EXECUTION_MODES.serverAuthoritative
  })]));
  assertConflictAuthorityMatrix(matrix, normalizedMode);
  return Object.freeze(matrix);
}

export function assertConflictAuthorityMatrix(matrix, mode) {
  const expectedAuthorities = mode === GAMEPLAY_EXECUTION_MODES.unavailable ? 0 : 1;
  for (const systemId of CONFLICT_SYSTEM_IDS) {
    const authority = matrix?.[systemId] || {};
    const activeAuthorities = Number(authority.localMutation === true) + Number(authority.serverCommand === true);
    if (activeAuthorities !== expectedAuthorities) {
      throw new Error(`Conflict authority invariant failed for ${systemId} in ${mode}.`);
    }
  }
  return true;
}

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
  if (requestedMode) return publishConflictAuthorityMatrix(windowRef, requestedMode);
  const configuredMode = readConfiguredGameplayExecutionMode(windowRef);
  if (configuredMode) return publishConflictAuthorityMatrix(windowRef, configuredMode);
  if (options.serverReady === true) {
    return publishConflictAuthorityMatrix(windowRef, GAMEPLAY_EXECUTION_MODES.serverAuthoritative);
  }
  const diagnosticsMode = normalizeGameplayExecutionMode(options.diagnosticsMode);
  if (diagnosticsMode === GAMEPLAY_EXECUTION_MODES.serverAuthoritative) {
    return publishConflictAuthorityMatrix(windowRef, diagnosticsMode);
  }
  return publishConflictAuthorityMatrix(windowRef, isDevelopmentGameplayHost(windowRef)
    ? GAMEPLAY_EXECUTION_MODES.localDemo
    : GAMEPLAY_EXECUTION_MODES.unavailable);
}

export function isLocalDemoGameplayMode(options = {}) {
  return getGameplayExecutionMode(options) === GAMEPLAY_EXECUTION_MODES.localDemo;
}

const publishConflictAuthorityMatrix = (windowRef, mode) => {
  const matrix = getConflictAuthorityMatrix(mode);
  if (windowRef && typeof windowRef === "object") {
    windowRef.__EMPIRE_CONFLICT_AUTHORITY_MATRIX__ = matrix;
  }
  return mode;
};
