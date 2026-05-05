export function getDefaultRuntimeRoot(pageRootSelector = "main[data-page]", documentRef = globalThis.document) {
  return documentRef?.querySelector?.(pageRootSelector) || null;
}

export function resolveRuntimeRoot(candidate = null, options = {}) {
  if (candidate?.root && typeof candidate.root.querySelector === "function") {
    return candidate.root;
  }

  if (candidate && typeof candidate.querySelector === "function") {
    return candidate;
  }

  return getDefaultRuntimeRoot(options.pageRootSelector, options.documentRef);
}

export function warnRuntimeOrchestrator(message, error = null, consoleRef = console) {
  if (typeof consoleRef?.warn !== "function") {
    return;
  }

  consoleRef.warn(`[Empire runtime] ${message}`, error || "");
}

export function readRuntimeSnapshotValue(label, read, fallback, options = {}) {
  try {
    return read();
  } catch (error) {
    warnRuntimeOrchestrator(`State snapshot failed: ${label}`, error, options.consoleRef);
    return fallback;
  }
}

if (typeof window !== "undefined") {
  window.EmpireRuntimeRoot = {
    getDefaultRuntimeRoot,
    readRuntimeSnapshotValue,
    resolveRuntimeRoot,
    warnRuntimeOrchestrator
  };
}
