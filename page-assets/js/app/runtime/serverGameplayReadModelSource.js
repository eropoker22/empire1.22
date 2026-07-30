import { getGameplayExecutionMode } from "./gameplayExecutionMode.js";
import { canSubmitServerGameplayCommand } from "./serverCommandAuthorityGuard.js";

const subscribers = new Set();
let latestReadModel = null;
let mountedDocument = null;

const getWindowRef = () => typeof window === "undefined" ? null : window;
const getDocumentRef = () => typeof document === "undefined" ? null : document;

const getStateVersion = (model) => {
  const version = Number(model?.server?.stateVersion);
  return Number.isFinite(version) ? version : null;
};

const canReplaceReadModel = (current, next) => {
  if (!current) return true;
  const currentVersion = getStateVersion(current);
  const nextVersion = getStateVersion(next);
  return currentVersion === null || nextVersion === null || nextVersion >= currentVersion;
};

export function setServerGameplaySliceReadModel(model, options = {}) {
  if (!model || typeof model !== "object" || model === latestReadModel) return false;
  if (!canReplaceReadModel(latestReadModel, model)) return false;
  latestReadModel = model;
  const windowRef = options.windowRef || getWindowRef();
  if (windowRef) windowRef.empireStreetsGameplaySliceReadModel = model;
  subscribers.forEach((listener) => listener(model));
  return true;
}

export function getServerGameplaySliceReadModel() {
  const windowRef = getWindowRef();
  const candidates = [
    windowRef?.empireStreetsGameplaySliceReadModel,
    windowRef?.EmpireGameplaySliceClient?.getCurrentReadModel?.()
  ];
  for (const candidate of candidates) {
    if (candidate && candidate !== latestReadModel) {
      setServerGameplaySliceReadModel(candidate, { windowRef });
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
  setServerGameplaySliceReadModel(event?.detail?.gameplaySlice);
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
  if (!mountedDocument) return false;
  mountedDocument.removeEventListener("empire:gameplay-slice-rendered", handleGameplaySliceRendered);
  mountedDocument = null;
  subscribers.clear();
  return true;
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
    hasValidatedGameplaySlice: Boolean(model?.player?.playerId && model?.player?.instanceId),
    executionMode
  });
}
