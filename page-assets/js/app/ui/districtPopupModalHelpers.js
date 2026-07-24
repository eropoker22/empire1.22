import {
  ATTACK_RESULT_MODAL_SELECTOR,
  RAID_RESULT_MODAL_SELECTOR,
  SPY_RESULT_MODAL_SELECTOR,
  SPY_WARNING_MODAL_SELECTOR
} from "../runtime/constants.js";
import {
  bindEscapeKeyHandlers,
  isClassModalVisible,
  isElementVisible
} from "./modalHelpers.js";
import {
  closeOverlay,
  isOverlayElementOpen,
  openOverlay
} from "./legacyOverlayCoordinator.js";

const MAIN_DISTRICT_POPUP_SELECTOR = "[data-district-popup]";
const DISTRICT_OWNER_AVATAR_OPEN_SELECTOR = "[data-district-owner-avatar-open=\"true\"]";
const MOBILE_DISTRICT_POPUP_SCROLL_MEDIA = "(max-width: 720px), (hover: none) and (pointer: coarse), (any-hover: none), (any-pointer: coarse)";
let lastDistrictOwnerAvatarTrigger = null;

function isMainDistrictPopup(element) {
  return Boolean(element?.matches?.(MAIN_DISTRICT_POPUP_SELECTOR));
}

function shouldAllowMainDistrictBackgroundScroll(element) {
  if (!isMainDistrictPopup(element)) {
    return false;
  }
  const view = element?.ownerDocument?.defaultView;
  return Boolean(view?.matchMedia?.(MOBILE_DISTRICT_POPUP_SCROLL_MEDIA).matches);
}

function bindMobileDistrictPopupBackgroundScroll(element) {
  if (!isMainDistrictPopup(element) || element.dataset.districtPopupScrollBridgeBound === "true") {
    return;
  }

  const backdrop = element.querySelector?.(".district-popup-backdrop");
  const view = element.ownerDocument?.defaultView;
  if (!backdrop || !view) {
    return;
  }

  let lastTouchY = 0;
  const isActive = () => !element.hidden && shouldAllowMainDistrictBackgroundScroll(element);
  const scrollPageBy = (deltaY) => {
    if (!deltaY) {
      return;
    }
    if (typeof view.scrollBy !== "function") {
      return;
    }
    try {
      view.scrollBy({ top: deltaY, left: 0, behavior: "auto" });
    } catch {
      view.scrollBy(0, deltaY);
    }
  };

  backdrop.addEventListener("touchstart", (event) => {
    if (!isActive() || event.touches.length !== 1) {
      lastTouchY = 0;
      return;
    }
    lastTouchY = event.touches[0]?.clientY || 0;
  }, { passive: true });

  backdrop.addEventListener("touchmove", (event) => {
    if (!isActive() || event.touches.length !== 1) {
      return;
    }
    const currentTouchY = event.touches[0]?.clientY || lastTouchY;
    const deltaY = lastTouchY - currentTouchY;
    lastTouchY = currentTouchY;
    scrollPageBy(deltaY);
    event.preventDefault();
    event.stopPropagation();
  }, { passive: false });

  backdrop.addEventListener("wheel", (event) => {
    if (!isActive()) {
      return;
    }
    scrollPageBy(event.deltaY);
    event.preventDefault();
    event.stopPropagation();
  }, { passive: false });

  element.dataset.districtPopupScrollBridgeBound = "true";
}

function closeDistrictOwnerAvatarLightbox(documentRef) {
  const lightbox = documentRef?.getElementById?.("alliance-member-lightbox");
  const image = documentRef?.getElementById?.("alliance-member-lightbox-image");
  const HTMLImageElementCtor = documentRef?.defaultView?.HTMLImageElement;
  if (!lightbox) {
    return;
  }

  if (HTMLImageElementCtor && image instanceof HTMLImageElementCtor) {
    image.removeAttribute("src");
  }
  lightbox.classList.remove("avatar-lightbox--district-owner");
  lightbox.classList.add("hidden");
  lightbox.hidden = true;
  lightbox.setAttribute("aria-hidden", "true");
  closeOverlay(lightbox, { restoreFocus: false });
  const HTMLElementCtor = documentRef?.defaultView?.HTMLElement;
  if (HTMLElementCtor && lastDistrictOwnerAvatarTrigger instanceof HTMLElementCtor) {
    lastDistrictOwnerAvatarTrigger.focus({ preventScroll: true });
  }
  lastDistrictOwnerAvatarTrigger = null;
}

function openDistrictOwnerAvatarLightbox(trigger) {
  const documentRef = trigger?.ownerDocument;
  const avatarSrc = String(trigger?.getAttribute?.("data-district-owner-avatar-src") || "").trim();
  if (!documentRef || !avatarSrc) {
    return false;
  }

  const lightbox = documentRef.getElementById("alliance-member-lightbox");
  const image = documentRef.getElementById("alliance-member-lightbox-image");
  const title = documentRef.getElementById("alliance-member-lightbox-title");
  const metaEl = documentRef.getElementById("alliance-member-lightbox-meta");
  const HTMLImageElementCtor = documentRef.defaultView?.HTMLImageElement;
  if (!lightbox || !HTMLImageElementCtor || !(image instanceof HTMLImageElementCtor)) {
    return false;
  }

  const name = String(trigger.getAttribute("data-district-owner-avatar-name") || "Vlastník districtu").trim();
  const meta = String(trigger.getAttribute("data-district-owner-avatar-meta") || "Vlastník districtu").trim();
  const HTMLElementCtor = documentRef.defaultView?.HTMLElement;
  lastDistrictOwnerAvatarTrigger = HTMLElementCtor && trigger instanceof HTMLElementCtor ? trigger : null;
  image.src = avatarSrc;
  image.alt = `Avatar vlastníka ${name}`;
  if (title) title.textContent = name;
  if (metaEl) metaEl.textContent = meta;
  lightbox.classList.add("avatar-lightbox--district-owner");
  openOverlay(lightbox, { type: "modal", ariaModal: true, restoreFocusOnClose: false });
  lightbox.hidden = false;
  lightbox.classList.remove("hidden");
  lightbox.setAttribute("aria-hidden", "false");
  documentRef.getElementById("alliance-member-lightbox-close")?.focus({ preventScroll: true });
  return true;
}

function dispatchDistrictPopupClosed(element) {
  if (!isMainDistrictPopup(element)) {
    return;
  }

  const documentRef = element.ownerDocument;
  const view = documentRef?.defaultView;
  const modalScrollLock = view?.EmpireModalScrollLock;
  const modalStack = modalScrollLock?.debugState?.().stack || [];
  if (modalStack.at(-1)?.type === "district_sheet") {
    modalScrollLock?.closeTop?.("legacy district popup closed");
  }
  view?.EmpireGameplaySliceClient?.closeDistrictSheet?.("legacy district popup closed");

  const CustomEventCtor = view?.CustomEvent;
  if (!documentRef || typeof CustomEventCtor !== "function") {
    return;
  }

  documentRef.dispatchEvent(new CustomEventCtor("empire:district-closed", {
    detail: {
      source: "legacy-district-popup"
    }
  }));
}

export function showDistrictPopupModal(element) {
  if (!element) {
    return false;
  }

  bindMobileDistrictPopupBackgroundScroll(element);
  if (!isOverlayElementOpen(element)) {
    openOverlay(element, {
      type: isMainDistrictPopup(element) ? "mobile-sheet" : "modal",
      ariaModal: true,
      lockScroll: !shouldAllowMainDistrictBackgroundScroll(element),
      restoreFocusOnClose: false,
      skipFocus: true
    });
  }
  element.hidden = false;
  return true;
}

export function hideDistrictPopupModal(element) {
  if (!element) {
    return false;
  }

  element.hidden = true;
  closeOverlay(element, { restoreFocus: false });
  dispatchDistrictPopupClosed(element);
  return true;
}

export function hideDistrictPopupModalStack(options = {}) {
  const {
    popup,
    popupAtmosphereHero,
    popupAtmosphereWindow
  } = options;
  const modals = Array.isArray(options.modals)
    ? options.modals
    : [
        options.attackSetupPopup,
        options.attackConfirmPopup,
        options.robberySetupPopup,
        options.robberyConfirmPopup,
        options.defenseSetupPopup,
        options.trapConfirmPopup,
        options.spyConfirmPopup,
        options.occupyConfirmPopup
      ];

  popupAtmosphereHero?.setAttribute?.("aria-expanded", "false");
  let changed = false;
  for (const element of [
    popup,
    popupAtmosphereWindow,
    ...modals
  ]) {
    changed = hideDistrictPopupModal(element) || changed;
  }
  return changed;
}

export function hasVisibleDistrictPopupModal(elements = []) {
  return elements.some((element) => isElementVisible(element));
}

export function hasActiveDistrictPopupModal(elements = {}) {
  return hasVisibleDistrictPopupModal([
    elements.popup,
    elements.attackSetupPopup,
    elements.attackConfirmPopup,
    elements.robberySetupPopup,
    elements.robberyConfirmPopup,
    elements.defenseSetupPopup,
    elements.trapConfirmPopup,
    elements.spyConfirmPopup,
    elements.occupyConfirmPopup
  ]);
}

export function openDistrictAtmosphereWindow(options = {}) {
  const { trigger, windowElement } = options;
  if (!windowElement) {
    return false;
  }

  showDistrictPopupModal(windowElement);
  trigger?.setAttribute?.("aria-expanded", "true");
  return true;
}

export function closeDistrictAtmosphereWindow(options = {}) {
  const { trigger, windowElement } = options;
  const changed = hideDistrictPopupModal(windowElement);
  trigger?.setAttribute?.("aria-expanded", "false");
  return changed;
}

export function createDistrictPopupModalClosers(elements = {}) {
  return {
    closeRobberySetupPopup: () => hideDistrictPopupModal(elements.robberySetupPopup),
    closeRobberyConfirmPopup: () => hideDistrictPopupModal(elements.robberyConfirmPopup),
    closeDefenseSetupPopup: () => hideDistrictPopupModal(elements.defenseSetupPopup),
    closeTrapConfirmPopup: () => hideDistrictPopupModal(elements.trapConfirmPopup),
    closeOccupyConfirmPopup: () => hideDistrictPopupModal(elements.occupyConfirmPopup)
  };
}

export function bindDistrictAtmosphereWindowControls(options = {}) {
  const { trigger, windowElement, closeButton } = options;
  if (!trigger || typeof trigger.addEventListener !== "function") {
    return 0;
  }

  let boundCount = 0;
  const openWindow = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    openDistrictAtmosphereWindow({ trigger, windowElement });
  };

  trigger.addEventListener("click", openWindow);
  boundCount += 1;

  if (windowElement && typeof windowElement.addEventListener === "function") {
    windowElement.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    boundCount += 1;
  }

  trigger.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    openWindow();
  });
  boundCount += 1;

  if (closeButton && typeof closeButton.addEventListener === "function") {
    closeButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeDistrictAtmosphereWindow({
        trigger,
        windowElement
      });
    });
    boundCount += 1;
  }

  return boundCount;
}

export function bindDistrictModalCloseControls(closeElements = [], closeHandler) {
  if (typeof closeHandler !== "function") {
    return 0;
  }

  let boundCount = 0;
  const guardCloseEvent = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };
  for (const closeElement of closeElements || []) {
    if (!closeElement || typeof closeElement.addEventListener !== "function") {
      continue;
    }
    closeElement.addEventListener("pointerdown", guardCloseEvent);
    closeElement.addEventListener("pointerup", guardCloseEvent);
    closeElement.addEventListener("click", (event) => {
      guardCloseEvent(event);
      closeHandler();
    });
    boundCount += 3;
  }
  return boundCount;
}

export function bindDistrictPopupModalCloseControls(elements = {}, closeHandlers = {}) {
  return [
    bindDistrictModalCloseControls(elements.popupCloseElements, closeHandlers.closePopup),
    bindDistrictModalCloseControls(elements.buildingsPopupCloseElements, closeHandlers.closeBuildingsPopup),
    bindDistrictModalCloseControls(elements.attackSetupCloseElements, closeHandlers.closeAttackSetupPopup),
    bindDistrictModalCloseControls(elements.attackConfirmCloseElements, closeHandlers.closeAttackConfirmPopup),
    bindDistrictModalCloseControls(elements.robberySetupCloseElements, closeHandlers.closeRobberySetupPopup),
    bindDistrictModalCloseControls(elements.robberyConfirmCloseElements, closeHandlers.closeRobberyConfirmPopup),
    bindDistrictModalCloseControls(elements.defenseSetupCloseElements, closeHandlers.closeDefenseSetupPopup),
    bindDistrictModalCloseControls(elements.trapConfirmCloseElements, closeHandlers.closeTrapConfirmPopup),
    bindDistrictModalCloseControls(elements.spyConfirmCloseElements, closeHandlers.closeSpyConfirmPopup),
    bindDistrictModalCloseControls(elements.occupyConfirmCloseElements, closeHandlers.closeOccupyConfirmPopup)
  ].reduce((total, count) => total + count, 0);
}

export function createDistrictResultModalClosers(options = {}) {
  const { root, closeResultModal, closePoliceActionResultModal } = options;

  return {
    closeSpyResultModal: () => closeResultModal?.(root, SPY_RESULT_MODAL_SELECTOR),
    closeSpyWarningModal: () => closeResultModal?.(root, SPY_WARNING_MODAL_SELECTOR),
    closeRaidResultModal: () => closeResultModal?.(root, RAID_RESULT_MODAL_SELECTOR),
    closeAttackResultModal: () => closeResultModal?.(root, ATTACK_RESULT_MODAL_SELECTOR),
    closePoliceActionResultModal: () => closePoliceActionResultModal?.(root)
  };
}

export function bindDistrictResultModalCloseControls(entries = [], closers = {}) {
  let boundCount = 0;
  const normalizedEntries = Array.isArray(entries)
    ? entries
    : [
        {
          controls: [entries.spyResultModalBackdrop, entries.spyResultModalClose, entries.spyResultModalOk],
          close: closers.closeSpyResultModal
        },
        {
          controls: [entries.spyWarningModalBackdrop, entries.spyWarningModalClose, entries.spyWarningModalOk],
          close: closers.closeSpyWarningModal
        },
        {
          controls: [entries.raidResultModalBackdrop, entries.raidResultModalClose, entries.raidResultModalOk],
          close: closers.closeRaidResultModal
        },
        {
          controls: [entries.attackResultModalBackdrop, entries.attackResultModalClose, entries.attackResultModalOk],
          close: closers.closeAttackResultModal
        },
        {
          controls: [
            entries.policeActionResultModalBackdrop,
            entries.policeActionResultModalClose,
            entries.policeActionResultModalOk
          ],
          close: closers.closePoliceActionResultModal
        }
      ];

  for (const entry of normalizedEntries || []) {
    if (typeof entry?.close !== "function") {
      continue;
    }

    for (const control of entry.controls || []) {
      if (!control || typeof control.addEventListener !== "function") {
        continue;
      }
      const guardCloseEvent = (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      };
      control.addEventListener("pointerdown", guardCloseEvent);
      control.addEventListener("pointerup", guardCloseEvent);
      control.addEventListener("click", (event) => {
        guardCloseEvent(event);
        entry.close();
      });
      boundCount += 3;
    }
  }

  return boundCount;
}

export function bindDistrictModalContentGuards(documentRef) {
  if (!documentRef?.querySelectorAll) {
    return 0;
  }

  const contentSelectors = [
    "[data-district-popup-card]",
    "[data-attack-setup-card]",
    "[data-attack-confirm-card]",
    "[data-robbery-setup-card]",
    "[data-robbery-confirm-card]",
    "[data-defense-setup-card]",
    "[data-trap-confirm-card]",
    "[data-spy-confirm-card]",
    "[data-occupy-confirm-card]",
    ".district-action-confirm-popup-card",
    ".buildings-popup-card"
  ].join(",");
  const guardContentEvent = (event) => {
    event.stopPropagation();
  };
  let boundCount = 0;
  for (const element of Array.from(documentRef.querySelectorAll(contentSelectors))) {
    element.addEventListener("pointerdown", guardContentEvent);
    element.addEventListener("pointerup", guardContentEvent);
    element.addEventListener("click", guardContentEvent);
    boundCount += 3;
  }
  return boundCount;
}

export function createDistrictPopupEscapeHandlers(options = {}) {
  const elements = options.elements || {};
  const closeHandlers = options.closeHandlers || {};
  const resultHandlers = options.resultHandlers || {};

  return [
    { element: elements.popup, isOpen: isElementVisible, close: closeHandlers.closePopup },
    { element: elements.buildingsPopup, isOpen: isElementVisible, close: closeHandlers.closeBuildingsPopup },
    { element: elements.attackSetupPopup, isOpen: isElementVisible, close: closeHandlers.closeAttackSetupPopup },
    { element: elements.attackConfirmPopup, isOpen: isElementVisible, close: closeHandlers.closeAttackConfirmPopup },
    { element: elements.robberySetupPopup, isOpen: isElementVisible, close: closeHandlers.closeRobberySetupPopup },
    { element: elements.robberyConfirmPopup, isOpen: isElementVisible, close: closeHandlers.closeRobberyConfirmPopup },
    { element: elements.defenseSetupPopup, isOpen: isElementVisible, close: closeHandlers.closeDefenseSetupPopup },
    { element: elements.trapConfirmPopup, isOpen: isElementVisible, close: closeHandlers.closeTrapConfirmPopup },
    { element: elements.spyConfirmPopup, isOpen: isElementVisible, close: closeHandlers.closeSpyConfirmPopup },
    { element: elements.occupyConfirmPopup, isOpen: isElementVisible, close: closeHandlers.closeOccupyConfirmPopup },
    { element: elements.spyResultModal, isOpen: isClassModalVisible, close: resultHandlers.closeSpyResultModal },
    { element: elements.spyWarningModal, isOpen: isClassModalVisible, close: resultHandlers.closeSpyWarningModal },
    { element: elements.raidResultModal, isOpen: isClassModalVisible, close: resultHandlers.closeRaidResultModal },
    { element: elements.attackResultModal, isOpen: isClassModalVisible, close: resultHandlers.closeAttackResultModal },
    { element: elements.policeActionResultModal, isOpen: isClassModalVisible, close: resultHandlers.closePoliceActionResultModal }
  ].filter((handler) => handler.element && typeof handler.close === "function");
}

function bindDistrictOwnerAvatarLightboxControls(documentRef) {
  const rootDataset = documentRef?.documentElement?.dataset;
  if (!documentRef || !rootDataset || rootDataset.districtOwnerAvatarLightboxBound === "true") {
    return 0;
  }

  rootDataset.districtOwnerAvatarLightboxBound = "true";
  let boundCount = 0;

  documentRef.addEventListener("click", (event) => {
    const trigger = event.target?.closest?.(DISTRICT_OWNER_AVATAR_OPEN_SELECTOR);
    if (!trigger) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    openDistrictOwnerAvatarLightbox(trigger);
  }, true);
  boundCount += 1;

  documentRef.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && lastDistrictOwnerAvatarTrigger) {
      closeDistrictOwnerAvatarLightbox(documentRef);
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const trigger = event.target?.closest?.(DISTRICT_OWNER_AVATAR_OPEN_SELECTOR);
    if (!trigger) {
      return;
    }

    event.preventDefault();
    openDistrictOwnerAvatarLightbox(trigger);
  });
  boundCount += 1;

  documentRef.getElementById("alliance-member-lightbox-backdrop")?.addEventListener("click", () => {
    if (lastDistrictOwnerAvatarTrigger) {
      closeDistrictOwnerAvatarLightbox(documentRef);
    }
  });
  documentRef.getElementById("alliance-member-lightbox-close")?.addEventListener("click", () => {
    if (lastDistrictOwnerAvatarTrigger) {
      closeDistrictOwnerAvatarLightbox(documentRef);
    }
  });
  boundCount += 2;

  return boundCount;
}

export function bindDistrictPopupPresentationControls(options = {}) {
  const {
    documentRef,
    elements = {},
    closeHandlers = {},
    resultHandlers = {}
  } = options;

  const modalCloseCount = bindDistrictPopupModalCloseControls(elements, closeHandlers);
  const resultCloseCount = bindDistrictResultModalCloseControls(elements, resultHandlers);
  const contentGuardCount = bindDistrictModalContentGuards(documentRef);
  const ownerAvatarLightboxCount = bindDistrictOwnerAvatarLightboxControls(documentRef);
  const escapeBound = bindEscapeKeyHandlers(documentRef, createDistrictPopupEscapeHandlers({
    elements,
    closeHandlers,
    resultHandlers
  }));

  return {
    modalCloseCount,
    resultCloseCount,
    contentGuardCount,
    ownerAvatarLightboxCount,
    escapeBound
  };
}
