import { lockModalScroll, unlockModalScroll } from "./modalScrollLock.js";

const DEFAULT_GHOST_CLICK_SUPPRESSION_MS = 450;
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

const overlayStack = [];
let suppressMapInputUntil = 0;

function getElementView(element) {
  return element?.ownerDocument?.defaultView || (typeof window !== "undefined" ? window : null);
}

function isElementLike(element) {
  const view = getElementView(element);
  return Boolean(view?.Element && element instanceof view.Element);
}

function isHtmlElement(element) {
  const view = getElementView(element);
  return Boolean(view?.HTMLElement && element instanceof view.HTMLElement);
}

function now() {
  if (typeof window !== "undefined" && window.performance?.now) {
    return window.performance.now();
  }
  return Date.now();
}

function lockBodyScroll(element) {
  lockModalScroll(element?.ownerDocument || undefined);
}

function unlockBodyScroll(element) {
  unlockModalScroll(element?.ownerDocument || undefined);
}

function isElementVisible(element) {
  if (!isElementLike(element)) {
    return false;
  }
  if (element.hidden || element.classList.contains("hidden") || element.getAttribute("aria-hidden") === "true") {
    return false;
  }
  const view = getElementView(element);
  if (!view?.getComputedStyle) {
    return true;
  }
  const style = view.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

function safeFocus(element) {
  if (!isHtmlElement(element) || typeof element.focus !== "function") {
    return false;
  }

  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
  return true;
}

function resolveFocusTarget(element, preferredFocus) {
  if (isHtmlElement(preferredFocus)) {
    return preferredFocus;
  }

  const closeButton = element?.querySelector?.(
    "[aria-label*='Zavřít'], [data-district-popup-close], [data-attack-setup-close], [data-attack-confirm-close], [data-robbery-setup-close], [data-robbery-confirm-close], [data-defense-setup-close], [data-trap-confirm-close], [data-spy-confirm-close], [data-occupy-confirm-close], .modal__close"
  );
  if (isHtmlElement(closeButton)) {
    return closeButton;
  }

  const focusable = element?.querySelector?.(FOCUSABLE_SELECTOR);
  if (isHtmlElement(focusable)) {
    return focusable;
  }

  return isHtmlElement(element) ? element : null;
}

function pruneClosedOverlays() {
  const previousLength = overlayStack.length;
  let lastPrunedElement = null;
  for (let index = overlayStack.length - 1; index >= 0; index -= 1) {
    if (!isElementVisible(overlayStack[index].element)) {
      lastPrunedElement = overlayStack[index].element;
      overlayStack.splice(index, 1);
    }
  }
  if (previousLength > 0 && overlayStack.length === 0) {
    unlockBodyScroll(lastPrunedElement);
  }
}

export function suppressMapInput(ms = DEFAULT_GHOST_CLICK_SUPPRESSION_MS) {
  suppressMapInputUntil = Math.max(suppressMapInputUntil, now() + ms);
}

export function suppressMapInputFor(ms = DEFAULT_GHOST_CLICK_SUPPRESSION_MS) {
  suppressMapInput(ms);
}

export function isOverlayOpen() {
  pruneClosedOverlays();
  return overlayStack.length > 0;
}

export function getTopOverlay() {
  pruneClosedOverlays();
  return overlayStack.at(-1) || null;
}

export function shouldSuppressMapInput(event) {
  const suppressed = isOverlayOpen() || now() < suppressMapInputUntil;
  if (suppressed) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
  }
  return suppressed;
}

export function openOverlay(element, options = {}) {
  if (!isHtmlElement(element)) {
    return false;
  }

  pruneClosedOverlays();

  const restoreFocusTo = isHtmlElement(options.restoreFocusTo)
    ? options.restoreFocusTo
    : element.ownerDocument?.activeElement;

  element.setAttribute("role", options.role || "dialog");
  element.setAttribute("aria-modal", options.ariaModal === false ? "false" : "true");
  element.removeAttribute("aria-hidden");
  if (!element.hasAttribute("tabindex")) {
    element.setAttribute("tabindex", "-1");
  }

  const existingIndex = overlayStack.findLastIndex((entry) => entry.element === element);
  if (existingIndex >= 0) {
    const [existingEntry] = overlayStack.splice(existingIndex, 1);
    existingEntry.type = options.type || existingEntry.type || "modal";
    if (Object.prototype.hasOwnProperty.call(options, "restoreFocusOnClose")) {
      existingEntry.restoreFocusOnClose = options.restoreFocusOnClose !== false;
    }
    overlayStack.push(existingEntry);
    if (options.skipFocus !== true) {
      const focusTarget = resolveFocusTarget(element, options.focusTarget);
      safeFocus(focusTarget);
    }
    return true;
  }

  const entry = {
    element,
    type: options.type || "modal",
    restoreFocusTo: isHtmlElement(restoreFocusTo) ? restoreFocusTo : null,
    restoreFocusOnClose: options.restoreFocusOnClose !== false
  };

  if (overlayStack.length === 0) {
    lockBodyScroll(element);
  }
  overlayStack.push(entry);

  if (options.skipFocus !== true) {
    const focusTarget = resolveFocusTarget(element, options.focusTarget);
    safeFocus(focusTarget);
  }
  return true;
}

export function closeOverlay(element, options = {}) {
  if (!isHtmlElement(element)) {
    return false;
  }

  const index = overlayStack.findLastIndex((entry) => entry.element === element);
  const hadEntry = index >= 0;
  const [entry] = index >= 0 ? overlayStack.splice(index, 1) : [null];
  element.setAttribute("aria-hidden", "true");

  if (options.suppressMapInput !== false) {
    suppressMapInput(options.suppressionMs);
  }

  const shouldRestoreFocus = options.restoreFocus !== false && entry?.restoreFocusOnClose !== false;
  const focusTarget = entry?.restoreFocusTo;
  if (
    shouldRestoreFocus
    && isHtmlElement(focusTarget)
    && focusTarget.isConnected
    && !focusTarget.hidden
  ) {
    safeFocus(focusTarget);
  }

  if (hadEntry && overlayStack.length === 0) {
    unlockBodyScroll(element);
  }

  return hadEntry;
}

export function closeTopOverlay(options = {}) {
  const topOverlay = getTopOverlay();
  if (!topOverlay) {
    return false;
  }

  if (typeof options.close === "function") {
    options.close(topOverlay.element);
    return true;
  }

  topOverlay.element.hidden = true;
  closeOverlay(topOverlay.element, options);
  return true;
}

export function isTopOverlayElement(element) {
  const topOverlay = getTopOverlay();
  return Boolean(topOverlay?.element === element);
}

if (typeof window !== "undefined") {
  window.EmpireLegacyOverlay = {
    closeOverlay,
    closeTopOverlay,
    getTopOverlay,
    isOverlayOpen,
    isTopOverlayElement,
    openOverlay,
    shouldSuppressMapInput,
    suppressMapInput,
    suppressMapInputFor
  };
}
