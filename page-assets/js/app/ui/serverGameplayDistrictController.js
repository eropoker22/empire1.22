import { getDistrictPopupElements } from "./districtPopupElements.js";
import { createServerGameplayDistrictView as createView } from "./serverGameplayDistrictView.js";
import { createServerGameplayBuildingDetailController } from "./serverGameplayBuildingDetailController.js";
import { renderDistrictBuildingList } from "./districtPanel.js";
import { renderDistrictActionHub } from "./districtActionHub.js";
import { bindServerGameplayDistrictEvents } from "./serverGameplayDistrictEventBindings.js";
import { renderServerGameplayDistrictSummary } from "./serverGameplayDistrictSummaryRenderer.js";
import { createServerGameplayDistrictSurfaceActionDispatcher } from "./serverGameplayDistrictSurfaceActionDispatcher.js";
import { closeDistrictAtmosphereWindow, hideDistrictPopupModal, openDistrictAtmosphereWindow, showDistrictPopupModal } from "./districtPopupModalHelpers.js";

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
  let overviewEnabled = false;
  let buildingDetailController = null;
  let originalParent = null;
  let originalNextSibling = null;
  let releasePopupEvents = null;
  const diagnostics = {
    updates: 0,
    renders: 0,
    opens: 0,
    closes: 0,
    surfaceActions: 0
  };

  const isOpen = () => Boolean(elements.popup && !elements.popup.hidden);
  const stopContentEvent = (event) => event.stopPropagation();
  const guardCloseEvent = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };
  const close = () => {
    if (!elements.popup || !isOpen()) return false;
    buildingDetailController?.close?.();
    closeDistrictAtmosphereWindow({
      trigger: elements.popupAtmosphereHero,
      windowElement: elements.popupAtmosphereWindow
    });
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
    if (event.key !== "Escape") return;
    if (elements.popupAtmosphereWindow && !elements.popupAtmosphereWindow.hidden) {
      closeDistrictAtmosphereWindow({
        trigger: elements.popupAtmosphereHero,
        windowElement: elements.popupAtmosphereWindow
      });
      return;
    }
    if (isOpen()) close();
  };
  const onAtmosphereOpen = (event) => {
    if (!elements.popupAtmosphereHero || !elements.popupAtmosphereWindow) return;
    if (event?.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    openDistrictAtmosphereWindow({
      trigger: elements.popupAtmosphereHero,
      windowElement: elements.popupAtmosphereWindow
    });
  };
  const onAtmosphereClose = (event) => {
    guardCloseEvent(event);
    closeDistrictAtmosphereWindow({
      trigger: elements.popupAtmosphereHero,
      windowElement: elements.popupAtmosphereWindow
    });
  };
  const applyOverviewMode = () => {
    const value = overviewEnabled ? "true" : "false";
    if (elements.popup) elements.popup.dataset.overviewEnabled = value;
    if (elements.popupCard) elements.popupCard.dataset.overviewEnabled = value;
    if (elements.popupToggle) {
      elements.popupToggle.textContent = "Přehled";
      elements.popupToggle.setAttribute("aria-pressed", value);
      elements.popupToggle.setAttribute(
        "aria-label",
        overviewEnabled ? "Zavřít přehled districtu" : "Otevřít přehled districtu"
      );
    }
  };
  const setOverviewEnabled = (enabled) => {
    overviewEnabled = enabled === true;
    applyOverviewMode();
  };
  const onOverviewToggle = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOverviewEnabled(!overviewEnabled);
  };

  const moveToTopLayer = () => {
    const body = elements.popup?.ownerDocument?.body;
    if (body && elements.popup.parentElement !== body) body.append(elements.popup);
  };

  const dispatchSurfaceAction = createServerGameplayDistrictSurfaceActionDispatcher({
    documentRef,
    getElements: () => elements,
    isMounted: () => mounted,
    onDispatch: () => { diagnostics.surfaceActions += 1; },
    onResponse: (response) => {
      if (response?.readModel) latestReadModel = response.readModel;
      if (response?.renderState) latestRenderState = response.renderState;
      if (response && isOpen()) render(true);
    },
    source
  });

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
    if (!building || !buildingDetailController?.open?.(building.buildingId)) return false;
    await dispatchSurfaceAction({
      buildingId: building.buildingId,
      buildingType: building.buildingTypeId
    });
    return true;
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

    let writes = renderServerGameplayDistrictSummary({ elements, summaryRows, view });
    renderDistrictBuildingList({
      section: elements.popupBuildings,
      meta: elements.popupBuildingsMeta,
      list: elements.popupBuildingsList
    }, {
      buildings: view.buildings,
      emptyText: view.buildings.length === 0 ? view.buildingEmptyText : "",
      interactive: view.buildingsInteractive,
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
    setOverviewEnabled(false);
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
    releasePopupEvents = bindServerGameplayDistrictEvents({
      closeElements,
      documentRef,
      elements,
      handlers: {
        onAtmosphereClose,
        onAtmosphereOpen,
        onBuildingClick,
        onCloseClick,
        onClosePointer,
        onKeydown,
        onOverviewToggle,
        stopContentEvent
      }
    });
    buildingDetailController = createServerGameplayBuildingDetailController({
      root,
      documentRef,
      dispatchSurfaceAction,
      getCurrentView: () => latestView,
      getCurrentReadModel: () => latestReadModel,
      getCurrentRenderState: () => latestRenderState
    });
    buildingDetailController.mount();
    setOverviewEnabled(false);
    mounted = true;
    return true;
  };

  const destroy = () => {
    if (!mounted) return false;
    if (isOpen()) close();
    releasePopupEvents?.();
    releasePopupEvents = null;
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
    overviewEnabled = false;
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
