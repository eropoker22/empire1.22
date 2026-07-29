import { isDevelopmentGameplayHost } from "../runtime/gameplayExecutionMode.js";
import { getTopOverlay } from "../ui/legacyOverlayCoordinator.js";

const DEBUG_QUERY_KEY = "uiOwnershipDebug";
const BUILDING_SURFACE_SELECTOR = [
  "[data-district-building-detail-popup]",
  "[data-pharmacy-popup]",
  "[data-druglab-popup]",
  "[data-factory-popup]",
  "[data-armory-popup]"
].join(",");
const WATCHED_ATTRIBUTE_FILTER = [
  "aria-hidden",
  "class",
  "data-district-id",
  "data-server-building-id",
  "data-ui-owner",
  "hidden",
  "style"
];

function isVisibleElement(element, windowRef) {
  if (!element || element.nodeType !== 1) return false;
  if (element.hidden || element.classList?.contains?.("hidden") || element.getAttribute?.("aria-hidden") === "true") {
    return false;
  }
  const style = windowRef?.getComputedStyle?.(element);
  return !style || (style.display !== "none" && style.visibility !== "hidden");
}

function collectVisible(documentRef, windowRef, selector) {
  return Array.from(documentRef?.querySelectorAll?.(selector) || [])
    .filter((element) => isVisibleElement(element, windowRef));
}

function describeElement(element) {
  if (!element) return null;
  return {
    id: String(element.id || ""),
    owner: String(element.dataset?.uiOwner || "unowned"),
    role: String(element.getAttribute?.("role") || ""),
    className: String(element.className || "")
  };
}

function collectDuplicateVisibleIds(visibleElements) {
  const counts = new Map();
  for (const element of visibleElements) {
    const id = String(element?.id || "").trim();
    if (id) counts.set(id, Number(counts.get(id) || 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => id);
}

function getModalScrollState(windowRef) {
  const state = windowRef?.EmpireModalScrollLock?.debugState?.();
  return {
    bodyLocked: state?.bodyLocked === true,
    stack: Array.isArray(state?.stack) ? state.stack.map((entry) => ({
      owner: String(entry?.owner || ""),
      type: String(entry?.type || "")
    })) : []
  };
}

function getExecutionMode(windowRef, documentRef) {
  return String(
    windowRef?.empireClientAuthorityState?.executionMode
    || windowRef?.empireStreetsRuntimeDiagnostics?.getSummary?.().runtimeMode
    || documentRef?.documentElement?.dataset?.runtimeMode
    || windowRef?.__EMPIRE_GAMEPLAY_EXECUTION_MODE__
    || "unknown"
  );
}

export function isUiOwnershipDebugEnabled(windowRef = typeof window === "undefined" ? null : window) {
  if (!windowRef || !isDevelopmentGameplayHost(windowRef)) return false;
  if (windowRef.__EMPIRE_E2E__ === true) return true;
  try {
    return new URLSearchParams(String(windowRef.location?.search || "")).get(DEBUG_QUERY_KEY) === "1";
  } catch {
    return false;
  }
}

export function createUiOwnershipDiagnostics(options = {}) {
  const windowRef = options.windowRef || (typeof window === "undefined" ? null : window);
  const documentRef = options.documentRef || windowRef?.document || (typeof document === "undefined" ? null : document);
  const enabled = options.enabled ?? isUiOwnershipDebugEnabled(windowRef);
  const selection = {
    requestedBuildingId: "",
    requestedDistrictId: "",
    status: "idle"
  };
  let destroyed = false;
  let observer = null;
  let scheduled = false;
  let lastSummary = null;
  let lastViolationFingerprint = "";

  const getSummary = () => {
    const districtPopups = collectVisible(documentRef, windowRef, "[data-district-popup]");
    const buildingDetails = collectVisible(documentRef, windowRef, BUILDING_SURFACE_SELECTOR);
    const cityEventsMain = collectVisible(documentRef, windowRef, "#events-modal");
    const cityEventsDetail = collectVisible(documentRef, windowRef, "#event-detail-modal");
    const visibleModals = collectVisible(documentRef, windowRef, "[role='dialog'], .modal");
    const legacyDistrictPopup = districtPopups.find((element) => (
      element.dataset?.uiOwner === "legacy-shared"
      && String(element.dataset?.districtId || "")
    )) || districtPopups.at(-1);
    const modalScroll = getModalScrollState(windowRef);
    const districtSheetCount = modalScroll.stack.filter((entry) => entry.type === "district_sheet").length;
    const legacyTop = getTopOverlay();
    const topOverlay = legacyTop?.element
      ? {
          ...describeElement(legacyTop.element),
          type: String(legacyTop.type || "legacy")
        }
      : modalScroll.stack.at(-1) || null;
    const serverReadModel = windowRef?.empireStreetsGameplaySliceReadModel || null;
    const activeBuilding = buildingDetails.at(-1) || null;
    const visibleSurfaceOwners = visibleModals.map(describeElement);
    const bodyLocked = modalScroll.bodyLocked
      || documentRef?.body?.classList?.contains?.("game-modal-scroll-locked") === true
      || documentRef?.body?.dataset?.overlayScrollLocked === "true";
    const violations = [];

    if (districtPopups.length > 1) violations.push("multiple-visible-district-popups");
    if (buildingDetails.length > 1) violations.push("multiple-visible-building-details");
    if (cityEventsMain.length > 1) violations.push("multiple-visible-city-events-main-modals");
    if (cityEventsDetail.length > 1) violations.push("multiple-visible-city-events-detail-modals");
    if (districtSheetCount > 1) violations.push("multiple-active-district-sheet-overlays");

    const duplicateVisibleIds = collectDuplicateVisibleIds(visibleModals);
    if (duplicateVisibleIds.length > 0) violations.push("duplicate-visible-modal-ids");
    if (bodyLocked && visibleModals.length === 0 && districtSheetCount === 0) {
      violations.push("hidden-renderer-holds-scroll-lock");
    }

    const sliceRoot = documentRef?.querySelector?.("[data-gameplay-slice-client]");
    if (
      districtSheetCount > 0
      && sliceRoot?.hidden === true
      && sliceRoot?.dataset?.spawnSelectionVisible !== "true"
    ) {
      violations.push("hidden-server-slice-holds-district-sheet");
    }

    return {
      activeOverlay: topOverlay,
      bodyOverflow: String(documentRef?.body?.style?.overflow || ""),
      bodyScrollLocked: bodyLocked,
      duplicateVisibleIds,
      executionMode: getExecutionMode(windowRef, documentRef),
      legacySelectedDistrictId: String(legacyDistrictPopup?.dataset?.districtId || ""),
      requestedBuildingId: selection.requestedBuildingId,
      requestedDistrictId: selection.requestedDistrictId,
      requestStatus: selection.status,
      serverBuildingId: String(
        activeBuilding?.dataset?.serverBuildingId
        || serverReadModel?.district?.buildings?.find?.((building) => (
          String(building?.buildingId || "") === selection.requestedBuildingId
        ))?.buildingId
        || ""
      ),
      serverSelectedDistrictId: String(serverReadModel?.district?.districtId || ""),
      stateVersion: serverReadModel?.server?.stateVersion ?? null,
      violations,
      visibleBuildingDetailCount: buildingDetails.length,
      visibleCityEventsDetailCount: cityEventsDetail.length,
      visibleCityEventsMainCount: cityEventsMain.length,
      visibleDistrictPopupCount: districtPopups.length,
      visibleDistrictSheetCount: districtSheetCount,
      visibleModalOwners: visibleSurfaceOwners
    };
  };

  const audit = (reason = "manual") => {
    if (!enabled || destroyed) return null;
    const summary = { ...getSummary(), reason };
    lastSummary = summary;
    const violationFingerprint = JSON.stringify(summary.violations);
    if (summary.violations.length > 0 && violationFingerprint !== lastViolationFingerprint) {
      windowRef?.console?.warn?.("[Empire Streets UI ownership]", summary);
    }
    lastViolationFingerprint = violationFingerprint;
    return summary;
  };

  const scheduleAudit = (reason) => {
    if (!enabled || destroyed || scheduled) return;
    scheduled = true;
    const run = () => {
      scheduled = false;
      audit(reason);
    };
    if (typeof windowRef?.queueMicrotask === "function") {
      windowRef.queueMicrotask(run);
    } else {
      Promise.resolve().then(run);
    }
  };

  const recordSelection = (detail = {}) => {
    if (!enabled || destroyed) return null;
    selection.requestedDistrictId = String(detail.requestedDistrictId || detail.districtId || selection.requestedDistrictId || "");
    selection.requestedBuildingId = String(detail.requestedBuildingId || detail.buildingId || selection.requestedBuildingId || "");
    selection.status = String(detail.status || "requested");
    return audit("selection");
  };

  const onSurfaceChanged = () => scheduleAudit("surface-event");
  const onPageHide = () => destroy();
  const eventNames = [
    "empire:building-opened",
    "empire:district-closed",
    "empire:district-opened",
    "empire:gameplay-slice-rendered",
    "empire:runtime-mode-changed"
  ];

  const destroy = () => {
    if (destroyed) return false;
    destroyed = true;
    observer?.disconnect?.();
    observer = null;
    for (const eventName of eventNames) {
      documentRef?.removeEventListener?.(eventName, onSurfaceChanged);
    }
    windowRef?.removeEventListener?.("pagehide", onPageHide);
    return true;
  };

  if (enabled && documentRef) {
    for (const eventName of eventNames) {
      documentRef.addEventListener(eventName, onSurfaceChanged);
    }
    windowRef?.addEventListener?.("pagehide", onPageHide, { once: true });
    if (typeof windowRef?.MutationObserver === "function" && documentRef.documentElement) {
      observer = new windowRef.MutationObserver(() => scheduleAudit("dom-mutation"));
      observer.observe(documentRef.documentElement, {
        attributes: true,
        attributeFilter: WATCHED_ATTRIBUTE_FILTER,
        childList: true,
        subtree: true
      });
    }
    scheduleAudit("init");
  }

  return {
    audit,
    destroy,
    enabled,
    getSummary: () => lastSummary || (enabled ? getSummary() : null),
    recordSelection
  };
}

if (typeof window !== "undefined" && typeof document !== "undefined" && isUiOwnershipDebugEnabled(window)) {
  window.empireUiOwnershipDiagnostics = createUiOwnershipDiagnostics({
    windowRef: window,
    documentRef: document,
    enabled: true
  });
}
