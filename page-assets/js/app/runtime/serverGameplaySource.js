import {
  destroyServerGameplaySource,
  getServerGameplayRenderState,
  getServerGameplaySliceReadModel,
  mountServerGameplaySource,
  setServerGameplaySliceReadModel,
  subscribeServerGameplaySlice
} from "./serverGameplayReadModelSource.js";
import {
  cancelPendingServerGameplayCommandRetries,
  retryPendingServerGameplayCommands,
  submitServerGameplayCommand
} from "./serverGameplayCommandTransport.js";

const getWindowRef = () => typeof window === "undefined" ? null : window;

export {
  getServerGameplaySliceReadModel,
  isServerGameplaySourceReady,
  setServerGameplaySliceReadModel
} from "./serverGameplayReadModelSource.js";
export {
  cancelPendingServerGameplayCommandRetries,
  prepareServerGameplayCommand,
  retryPendingServerGameplayCommands,
  submitPreparedServerGameplayCommand,
  submitServerGameplayCommand,
  syncServerGameplaySliceResponse
} from "./serverGameplayCommandTransport.js";
export {
  activateServerPlayerBoost,
  submitServerAllianceCommand,
  submitServerBountyCommand,
  submitServerCityEventCommand,
  submitServerEmergencyRecoveryCommand
} from "./serverGameplayDomainCommands.js";

export async function selectServerDistrict(districtId) {
  const normalizedDistrictId = String(districtId || "").trim();
  const clientApi = getWindowRef()?.EmpireGameplaySliceClient;
  if (!normalizedDistrictId || typeof clientApi?.selectDistrict !== "function") {
    return {
      accepted: false,
      errors: [{ message: "Serverový district selector není připojený." }],
      readModel: getServerGameplaySliceReadModel()
    };
  }
  const renderState = await clientApi.selectDistrict(normalizedDistrictId);
  const readModel = clientApi.getCurrentReadModel?.() || getServerGameplaySliceReadModel();
  if (readModel) setServerGameplaySliceReadModel(readModel);
  return {
    accepted: Boolean(renderState && readModel?.district?.districtId === normalizedDistrictId),
    errors: renderState?.errors || [],
    readModel,
    renderState
  };
}

export async function handleServerGameplaySurfaceAction(target) {
  const clientApi = getWindowRef()?.EmpireGameplaySliceClient;
  if (
    typeof HTMLElement === "undefined"
    || !(target instanceof HTMLElement)
    || typeof clientApi?.handleSurfaceAction !== "function"
  ) {
    return null;
  }
  const renderState = await clientApi.handleSurfaceAction(target);
  const readModel = clientApi.getCurrentReadModel?.() || getServerGameplaySliceReadModel();
  if (readModel) setServerGameplaySliceReadModel(readModel);
  return renderState ? { readModel, renderState } : null;
}

export const getCurrentReadModel = getServerGameplaySliceReadModel;
export const getCurrentRenderState = getServerGameplayRenderState;
export const subscribe = subscribeServerGameplaySlice;
export const selectDistrict = selectServerDistrict;
export const submitCommand = submitServerGameplayCommand;
export const handleSurfaceAction = handleServerGameplaySurfaceAction;
export const mount = mountServerGameplaySource;
export const destroy = () => {
  cancelPendingServerGameplayCommandRetries();
  return destroyServerGameplaySource();
};
export const retryPendingCommands = retryPendingServerGameplayCommands;
