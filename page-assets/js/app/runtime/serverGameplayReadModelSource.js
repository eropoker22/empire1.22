import { getGameplayExecutionMode } from "./gameplayExecutionMode.js";
import { canSubmitServerGameplayCommand } from "./serverCommandAuthorityGuard.js";
import { mergeAuthoritativeGameplaySlice } from "../../../../packages/shared-types/src/views/authoritative-gameplay-slice.js";

const subscribers = new Set();
let latestReadModel = null;
let mountedDocument = null;

const getWindowRef = () => typeof window === "undefined" ? null : window;
const getDocumentRef = () => typeof document === "undefined" ? null : document;

export function setServerGameplaySliceReadModel(model, options = {}) {
  if (!model || typeof model !== "object" || model === latestReadModel) return false;
  const merged = mergeAuthoritativeGameplaySlice(latestReadModel, model, {
    allowScopeChange: options.allowScopeChange === true
  });
  if (!merged.accepted || !merged.model) return false;
  latestReadModel = merged.model;
  const windowRef = options.windowRef || getWindowRef();
  if (windowRef) windowRef.empireStreetsGameplaySliceReadModel = latestReadModel;
  subscribers.forEach((listener) => listener(latestReadModel));
  return true;
}

export function clearServerGameplaySliceReadModel(options = {}) {
  const previous = latestReadModel;
  latestReadModel = null;
  const windowRef = options.windowRef || getWindowRef();
  if (windowRef?.empireStreetsGameplaySliceReadModel === previous) {
    delete windowRef.empireStreetsGameplaySliceReadModel;
  }
  return previous !== null;
}

export function getServerGameplaySliceReadModel() {
  const windowRef = getWindowRef();
  const candidates = [
    [windowRef?.EmpireGameplaySliceClient?.getCurrentReadModel?.(), true],
    [windowRef?.empireStreetsGameplaySliceReadModel, false]
  ];
  for (const [candidate, allowScopeChange] of candidates) {
    if (candidate && candidate !== latestReadModel) {
      setServerGameplaySliceReadModel(candidate, { windowRef, allowScopeChange });
    }
  }
  return latestReadModel;
}

export function subscribeServerGameplaySlice(listener) {
  if (typeof listener !== "function") return () => {};
  subscribers.add(listener);
  const current = getServerGameplaySliceReadModel();
  if (current) listener(current);
  return () => subscribers.delete(listener);
}

export function getServerGameplayRenderState() {
  return getWindowRef()?.EmpireGameplaySliceClient?.getCurrentRenderState?.() || null;
}

const handleGameplaySliceRendered = (event) => {
  setServerGameplaySliceReadModel(event?.detail?.gameplaySlice, { allowScopeChange: true });
};

export function mountServerGameplaySource(documentRef = getDocumentRef()) {
  if (!documentRef || mountedDocument === documentRef) return false;
  if (mountedDocument) {
    mountedDocument.removeEventListener("empire:gameplay-slice-rendered", handleGameplaySliceRendered);
  }
  mountedDocument = documentRef;
  mountedDocument.addEventListener("empire:gameplay-slice-rendered", handleGameplaySliceRendered);
  getServerGameplaySliceReadModel();
  return true;
}

export function destroyServerGameplaySource() {
  const hadMountedDocument = Boolean(mountedDocument);
  mountedDocument?.removeEventListener?.("empire:gameplay-slice-rendered", handleGameplaySliceRendered);
  mountedDocument = null;
  clearServerGameplaySliceReadModel();
  subscribers.clear();
  return hadMountedDocument;
}

export function isServerGameplaySourceReady() {
  const windowRef = getWindowRef();
  const diagnosticsMode = windowRef?.empireStreetsRuntimeDiagnostics?.getSummary?.().runtimeMode;
  const executionMode = getGameplayExecutionMode({
    diagnosticsMode,
    serverReady: false,
    windowRef
  });
  const model = getServerGameplaySliceReadModel();
  return canSubmitServerGameplayCommand({
    onboardingSandboxActive: getDocumentRef()?.documentElement?.dataset?.onboardingSandbox === "true",
    documentAvailable: Boolean(getDocumentRef()),
    hasValidatedGameplaySlice: Boolean(
      model?.player?.playerId
      && model?.player?.instanceId
      && model?.server?.status === "running"
    ),
    executionMode
  });
}
