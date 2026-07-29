const GAMEPLAY_SLICE_SCOPE_SELECTOR = "[data-gameplay-slice-client]";

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
      if (value !== null && value !== undefined) proxy.dataset[key] = String(value);
    }
    if (surfaceDataset.buildingActionBuildingId && Number.isFinite(surfaceDataset.amount)) {
      const amountInput = documentRef.createElement("input");
      amountInput.dataset.buildingActionInput = "amount";
      amountInput.value = String(surfaceDataset.amount);
      proxy.append(amountInput);
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
