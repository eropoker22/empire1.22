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
  openOverlay
} from "./legacyOverlayCoordinator.js";

const MAIN_DISTRICT_POPUP_SELECTOR = "[data-district-popup]";

function isMainDistrictPopup(element) {
  return Boolean(element?.matches?.(MAIN_DISTRICT_POPUP_SELECTOR));
}

export function showDistrictPopupModal(element) {
  if (!element) {
    return false;
  }

  openOverlay(element, {
    type: isMainDistrictPopup(element) ? "mobile-sheet" : "modal",
    ariaModal: true,
    restoreFocusOnClose: false,
    skipFocus: true
  });
  element.hidden = false;
  return true;
}

export function hideDistrictPopupModal(element) {
  if (!element) {
    return false;
  }

  element.hidden = true;
  closeOverlay(element, { restoreFocus: false });
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
  const escapeBound = bindEscapeKeyHandlers(documentRef, createDistrictPopupEscapeHandlers({
    elements,
    closeHandlers,
    resultHandlers
  }));

  return {
    modalCloseCount,
    resultCloseCount,
    contentGuardCount,
    escapeBound
  };
}
