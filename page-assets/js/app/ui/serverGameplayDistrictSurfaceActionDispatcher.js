const GAMEPLAY_SLICE_SCOPE_SELECTOR = "[data-gameplay-slice-client]";
const BUILDING_ACTION_INPUT_IDS = Object.freeze([
  "dealerSlotId",
  "itemId",
  "amount",
  "targetCategory",
  "category",
  "mode",
  "investmentCleanCash",
  "investment",
  "targetZone"
]);

const appendBuildingActionInput = (documentRef, proxy, inputId, value) => {
  if (value === null || value === undefined) return;
  const isDealerSelect = inputId === "dealerSlotId" || inputId === "itemId";
  const input = documentRef.createElement(isDealerSelect ? "select" : "input");
  input.dataset.buildingActionInput = inputId;
  if (inputId === "dealerSlotId") input.dataset.dealerSlotInput = "true";
  if (inputId === "itemId") input.dataset.dealerItemInput = "true";
  if (inputId === "amount") input.dataset.dealerAmountInput = "true";
  if (isDealerSelect) {
    const option = documentRef.createElement("option");
    option.value = String(value);
    option.textContent = String(value);
    input.append(option);
  } else {
    input.value = String(value);
  }
  proxy.append(input);
};

export function createServerGameplayDistrictSurfaceActionDispatcher({
  documentRef,
  getElements,
  isMounted,
  onDispatch,
  onResponse,
  source
}) {
  let pending = false;

  return async (surfaceDataset) => {
    if (pending || !isMounted() || !surfaceDataset) return null;
    const scope = documentRef?.querySelector?.(GAMEPLAY_SLICE_SCOPE_SELECTOR);
    if (!scope || typeof source?.handleSurfaceAction !== "function") return null;
    const isBuilding = Boolean(surfaceDataset.buildingId);
    const proxy = documentRef.createElement(isBuilding ? "article" : "button");
    for (const [key, value] of Object.entries(surfaceDataset)) {
      if (key === "buildingActionInputs") continue;
      if (value !== null && value !== undefined) proxy.dataset[key] = String(value);
    }
    if (surfaceDataset.buildingActionBuildingId) {
      proxy.dataset.buildingActionControls = String(surfaceDataset.buildingActionId || "true");
      const projectedInputs = surfaceDataset.buildingActionInputs
        && typeof surfaceDataset.buildingActionInputs === "object"
        ? surfaceDataset.buildingActionInputs
        : {};
      for (const inputId of BUILDING_ACTION_INPUT_IDS) {
        const value = Object.prototype.hasOwnProperty.call(projectedInputs, inputId)
          ? projectedInputs[inputId]
          : surfaceDataset[inputId];
        appendBuildingActionInput(documentRef, proxy, inputId, value);
      }
    }

    scope.append(proxy);
    pending = true;
    const elements = getElements();
    if (elements.popup) elements.popup.dataset.surfaceActionState = "pending";
    onDispatch();
    try {
      const response = await source.handleSurfaceAction(proxy);
      onResponse(response);
      if (elements.popup) {
        elements.popup.dataset.surfaceActionState = response ? "ready" : "rejected";
      }
      return response;
    } finally {
      pending = false;
      proxy.remove();
    }
  };
}
