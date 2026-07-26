import { getDistrictPopupElements } from "./districtPopupElements.js";
import { createServerGameplayDistrictView as createView } from "./serverGameplayDistrictView.js";
import { createServerGameplayBuildingDetailController } from "./serverGameplayBuildingDetailController.js";
import {
  renderDistrictBuildingList,
  renderDistrictFlags,
  renderDistrictSummaryPanel
} from "./districtPanel.js";
import { renderDistrictActionHub } from "./districtActionHub.js";
import {
  hideDistrictPopupModal,
  showDistrictPopupModal
} from "./districtPopupModalHelpers.js";

const GAMEPLAY_SLICE_SCOPE_SELECTOR = "[data-gameplay-slice-client]";
const BUILDING_CHIP_SELECTOR = "[data-district-building-name]";

export function createServerGameplayDistrictController({
  root,
  source,
  documentRef = root?.ownerDocument || globalThis.document
} = {}) {
  let mounted = false;
  let elements = {};
  let closeElements = [];
  let summaryRows = [];
  let latestReadModel = null;
  let latestRenderState = null;
  let latestView = null;
  let latestFingerprint = "";
  let renderedFingerprint = "";
  let pendingSurfaceAction = false;
  let buildingDetailController = null;
  let originalParent = null;
  let originalNextSibling = null;
  const diagnostics = {
    updates: 0,
    renders: 0,
    opens: 0,
    closes: 0,
    surfaceActions: 0
  };

  const isOpen = () => Boolean(elements.popup && !elements.popup.hidden);
  const setText = (element, value) => {
    const text = String(value ?? "");
    if (!element || element.textContent === text) return 0;
    element.textContent = text;
    return 1;
  };
  const stopContentEvent = (event) => event.stopPropagation();
  const guardCloseEvent = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };
  const close = () => {
    if (!elements.popup || !isOpen()) return false;
    buildingDetailController?.close?.();
    hideDistrictPopupModal(elements.popup);
    diagnostics.closes += 1;
    return true;
  };
  const onClosePointer = (event) => guardCloseEvent(event);
  const onCloseClick = (event) => {
    guardCloseEvent(event);
    close();
  };
  const onKeydown = (event) => {
    if (buildingDetailController?.isOpen?.()) return;
    if (event.key === "Escape" && isOpen()) close();
  };

  const moveToTopLayer = () => {
    const body = elements.popup?.ownerDocument?.body;
    if (body && elements.popup.parentElement !== body) body.append(elements.popup);
  };

  const renderSummary = (view) => {
    let writes = 0;
    renderDistrictSummaryPanel({
      title: elements.popupTitle,
      type: elements.popupType,
      owner: elements.popupOwner,
      ownerMeta: elements.popupOwnerMeta,
      ownerAvatar: elements.popupOwnerAvatar,
      ownerAvatarFallback: elements.popupOwnerAvatarFallback,
      card: elements.popupCard
    }, view);
    writes += 4;
    writes += setText(elements.popupAtmosphereLabel, view.atmosphereLabel);
    writes += setText(elements.popupAtmosphereMood, view.atmosphereMood);
    writes += setText(elements.popupAlliance, view.allianceLabel);
    if (elements.popupAlliance) elements.popupAlliance.hidden = !view.allianceLabel;
    renderDistrictFlags(elements.popupFlags, view.flags);
    writes += 1;
    for (let index = 0; index < summaryRows.length; index += 1) {
      const metric = view.metrics[index] || { label: "—", value: "—" };
      writes += setText(summaryRows[index].label, metric.label);
      writes += setText(summaryRows[index].value, metric.value);
    }
    return writes;
  };

  const dispatchSurfaceAction = async (surfaceDataset) => {
    if (pendingSurfaceAction || !mounted || !surfaceDataset) return null;
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
    pendingSurfaceAction = true;
    if (elements.popup) elements.popup.dataset.surfaceActionState = "pending";
    diagnostics.surfaceActions += 1;
    try {
      const response = await source.handleSurfaceAction(proxy);
      if (response?.readModel) latestReadModel = response.readModel;
      if (response?.renderState) latestRenderState = response.renderState;
      if (response && isOpen()) render(true);
      if (elements.popup) elements.popup.dataset.surfaceActionState = response ? "ready" : "rejected";
      return response;
    } finally {
      pendingSurfaceAction = false;
      proxy.remove();
    }
  };

  const onBuildingClick = (event) => {
    const chip = event.target?.closest?.(BUILDING_CHIP_SELECTOR);
    if (!chip || chip.disabled || chip.dataset.districtBuildingInteractive === "false") return;
    const building = latestView?.buildings.find(
      (entry) => String(entry.buildingId) === String(chip.dataset.districtBuildingName)
    );
    if (!building) return;
    void openBuilding(building);
  };

  const openBuilding = async (building) => {
    const response = await dispatchSurfaceAction({
      buildingId: building.buildingId,
      buildingType: building.buildingTypeId
    });
    return Boolean(response && buildingDetailController?.open?.(building.buildingId));
  };
  const openBuildingByType = async (buildingTypeId) => {
    const normalizedTypeId = String(buildingTypeId || "").trim().replace(/-/gu, "_");
    const building = latestView?.buildings.find(
      (entry) => String(entry.buildingTypeId || "").trim().replace(/-/gu, "_") === normalizedTypeId
    );
    return building ? openBuilding(building) : false;
  };

  const render = (force = false) => {
    if (!mounted || !latestReadModel) return 0;
    const renderState = latestRenderState || source.getCurrentRenderState?.() || null;
    const view = createView(latestReadModel, renderState);
    if (!view) return 0;
    const fingerprint = JSON.stringify(view);
    latestView = view;
    latestRenderState = renderState;
    latestFingerprint = fingerprint;
    if (!force && fingerprint === renderedFingerprint) return 0;

    let writes = renderSummary(view);
    renderDistrictBuildingList({
      section: elements.popupBuildings,
      meta: elements.popupBuildingsMeta,
      list: elements.popupBuildingsList
    }, {
      buildings: view.buildings,
      emptyText: view.buildings.length === 0 ? "District nemá dostupné budovy." : "",
      interactive: true,
      metaText: view.buildingMetaText
    });
    writes += 1;
    renderDistrictActionHub({
      actions: view.actions,
      emptyText: view.actionEmptyText,
      hidden: view.actionHidden,
      headHidden: view.actionHidden
    }, {
      onAction: (selectedAction) => void dispatchSurfaceAction(selectedAction.surfaceDataset)
    }, {
      elements: {
        section: elements.districtActionSection,
        head: elements.districtActionSectionHead,
        mount: elements.districtActionsMount
      }
    });
    writes += 1;
    elements.popup.dataset.districtId = view.districtId;
    elements.popupCard.dataset.districtId = view.districtId;
    renderedFingerprint = fingerprint;
    diagnostics.renders += 1;
    buildingDetailController?.update?.();
    return writes;
  };

  const openFromSelection = (selection = {}) => {
    if (!mounted || selection?.response?.accepted === false) return false;
    const readModel = selection?.response?.readModel
      || selection?.readModel
      || source.getCurrentReadModel?.()
      || latestReadModel;
    const renderState = selection?.response?.renderState
      || selection?.renderState
      || source.getCurrentRenderState?.()
      || latestRenderState;
    const selectedDistrictId = String(
      readModel?.district?.districtId
      || renderState?.districtPanel?.districtId
      || ""
    );
    if (!selectedDistrictId || selectedDistrictId !== String(selection?.districtId || "")) {
      return false;
    }
    latestReadModel = readModel;
    latestRenderState = renderState;
    if (!render(true)) return false;
    moveToTopLayer();
    showDistrictPopupModal(elements.popup);
    diagnostics.opens += 1;
    return true;
  };

  const update = (readModel) => {
    latestReadModel = readModel || null;
    latestRenderState = source.getCurrentRenderState?.() || latestRenderState;
    diagnostics.updates += 1;
    return isOpen() ? render() : 0;
  };

  const mount = () => {
    if (mounted) return false;
    elements = getDistrictPopupElements(documentRef || root);
    if (!elements.popup || !elements.popupCard || !elements.popupTitle) return false;
    originalParent = elements.popup.parentNode;
    originalNextSibling = elements.popup.nextSibling;
    closeElements = elements.popupCloseElements || [];
    summaryRows = Array.from(
      elements.popupSummary?.querySelectorAll?.(".district-popup-summary-card") || []
    ).map((row) => ({
      label: row.querySelector(".district-popup-summary-card__label"),
      value: row.querySelector(".district-popup-summary-card__value")
    }));
    elements.popupCard.addEventListener("pointerdown", stopContentEvent);
    elements.popupCard.addEventListener("pointerup", stopContentEvent);
    elements.popupCard.addEventListener("click", stopContentEvent);
    elements.popupBuildingsList?.addEventListener?.("click", onBuildingClick);
    for (const element of closeElements) {
      element.addEventListener("pointerdown", onClosePointer);
      element.addEventListener("pointerup", onClosePointer);
      element.addEventListener("click", onCloseClick);
    }
    documentRef?.addEventListener?.("keydown", onKeydown);
    buildingDetailController = createServerGameplayBuildingDetailController({
      root,
      documentRef,
      dispatchSurfaceAction,
      getCurrentView: () => latestView,
      getCurrentRenderState: () => latestRenderState
    });
    buildingDetailController.mount();
    mounted = true;
    return true;
  };

  const destroy = () => {
    if (!mounted) return false;
    if (isOpen()) close();
    elements.popupCard?.removeEventListener?.("pointerdown", stopContentEvent);
    elements.popupCard?.removeEventListener?.("pointerup", stopContentEvent);
    elements.popupCard?.removeEventListener?.("click", stopContentEvent);
    elements.popupBuildingsList?.removeEventListener?.("click", onBuildingClick);
    for (const element of closeElements) {
      element.removeEventListener("pointerdown", onClosePointer);
      element.removeEventListener("pointerup", onClosePointer);
      element.removeEventListener("click", onCloseClick);
    }
    documentRef?.removeEventListener?.("keydown", onKeydown);
    buildingDetailController?.destroy?.();
    if (originalParent && elements.popup?.parentNode !== originalParent) {
      originalParent.insertBefore(
        elements.popup,
        originalNextSibling?.parentNode === originalParent ? originalNextSibling : null
      );
    }
    elements = {};
    closeElements = [];
    summaryRows = [];
    latestReadModel = null;
    latestRenderState = null;
    latestView = null;
    latestFingerprint = "";
    renderedFingerprint = "";
    buildingDetailController = null;
    mounted = false;
    return true;
  };

  return {
    mount,
    update,
    destroy,
    close,
    handleDistrictSelected: openFromSelection,
    openBuildingByType,
    getDiagnostics: () => ({
      ...diagnostics,
      mounted,
      open: isOpen(),
      buildingDetail: buildingDetailController?.getDiagnostics?.() || null
    })
  };
}
