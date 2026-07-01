import {
  closeOverlay,
  openOverlay
} from "./legacyOverlayCoordinator.js";

export function hideElement(element, options = {}) {
  if (!element) {
    return false;
  }

  closeOverlay(element, options);
  element.hidden = true;
  return true;
}

export function hideElements(elements = [], options = {}) {
  let changed = false;
  for (const element of elements) {
    changed = hideElement(element, options) || changed;
  }
  return changed;
}

export function isElementVisible(element) {
  return Boolean(element && !element.hidden);
}

export function isClassModalVisible(element, hiddenClass = "hidden") {
  return Boolean(element && !element.classList.contains(hiddenClass));
}

export function bindEscapeKeyHandlers(documentRef, handlers = []) {
  if (!documentRef?.addEventListener) {
    return false;
  }

  documentRef.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    for (const handler of handlers.slice().reverse()) {
      const element = typeof handler.element === "function" ? handler.element() : handler.element;
      const isOpen = typeof handler.isOpen === "function"
        ? handler.isOpen(element)
        : isElementVisible(element);

      if (isOpen && typeof handler.close === "function") {
        event.preventDefault();
        event.stopPropagation();
        handler.close(element, event);
        break;
      }
    }
  });

  return true;
}

export function showElementAsOverlay(element, options = {}) {
  if (!element) {
    return false;
  }

  element.hidden = false;
  openOverlay(element, options);
  return true;
}
