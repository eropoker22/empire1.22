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
const LOCKED_BODY_DATA_ATTRIBUTE = "legacyOverlayScrollLocked";
const LOCKED_BODY_CLASS = "game-modal-scroll-locked";
let bodyStyleSnapshot = null;

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

function getBody(element) {
  return element?.ownerDocument?.body || (typeof document !== "undefined" ? document.body : null);
}

function getScrollY(view, body) {
  const root = body?.ownerDocument?.documentElement || null;
  const lockedTop = Number.parseFloat(body?.style?.top || "");
  const lockedScrollY = body?.style?.position === "fixed" && Number.isFinite(lockedTop) && lockedTop < 0
    ? Math.abs(lockedTop)
    : 0;
  return Math.max(
    0,
    Math.floor(view?.scrollY || view?.pageYOffset || root?.scrollTop || body?.scrollTop || lockedScrollY || 0)
  );
}

function restorePageScroll(view, body, scrollY) {
  const root = body?.ownerDocument?.documentElement || null;
  if (root) {
    root.scrollTop = scrollY;
  }
  if (body) {
    body.scrollTop = scrollY;
  }
  if (typeof view?.scrollTo !== "function") {
    return;
  }
  try {
    view.scrollTo({ top: scrollY, left: 0, behavior: "instant" });
  } catch {
    view.scrollTo(0, scrollY);
  }
  if (Math.abs(getScrollY(view, body) - scrollY) > 1) {
    try {
      view.scrollTo(0, scrollY);
    } catch {
      // Older embedded browsers can reject scrollTo while layout is settling.
    }
  }
}

function schedulePageScrollRestore(view, body, scrollY) {
  const restore = () => restorePageScroll(view, body, scrollY);
  restore();
  view?.requestAnimationFrame?.(restore);
  view?.requestAnimationFrame?.(() => view?.requestAnimationFrame?.(restore));
  view?.setTimeout?.(restore, 80);
  view?.setTimeout?.(restore, 180);
}

function lockBodyScroll(element) {
  const body = getBody(element);
  const html = body?.ownerDocument?.documentElement || null;
  const view = body?.ownerDocument?.defaultView || (typeof window !== "undefined" ? window : null);
  if (!body || !view || body.dataset[LOCKED_BODY_DATA_ATTRIBUTE] === "true") {
    return;
  }

  const scrollY = getScrollY(view, body);
  bodyStyleSnapshot = {
    scrollY,
    left: body.style.left,
    position: body.style.position,
    right: body.style.right,
    top: body.style.top,
    width: body.style.width
  };

  body.dataset[LOCKED_BODY_DATA_ATTRIBUTE] = "true";
  html?.classList?.add(LOCKED_BODY_CLASS);
  body.classList.add(LOCKED_BODY_CLASS);
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
}

function unlockBodyScroll(element) {
  const body = getBody(element);
  const html = body?.ownerDocument?.documentElement || null;
  const view = body?.ownerDocument?.defaultView || (typeof window !== "undefined" ? window : null);
  if (!body || !view || body.dataset[LOCKED_BODY_DATA_ATTRIBUTE] !== "true") {
    return;
  }

  const fallbackScrollY = getScrollY(view, body);
  const savedStyles = bodyStyleSnapshot;
  const restoreScrollY = savedStyles?.scrollY ?? fallbackScrollY;
  body.style.left = savedStyles?.left || "";
  body.style.position = savedStyles?.position || "";
  body.style.right = savedStyles?.right || "";
  body.style.top = savedStyles?.top || "";
  body.style.width = savedStyles?.width || "";
  html?.classList?.remove(LOCKED_BODY_CLASS);
  body.classList.remove(LOCKED_BODY_CLASS);
  delete body.dataset[LOCKED_BODY_DATA_ATTRIBUTE];
  bodyStyleSnapshot = null;
  schedulePageScrollRestore(view, body, restoreScrollY);
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

  closeOverlay(element, { restoreFocus: false, suppressMapInput: false });

  const restoreFocusTo = isHtmlElement(options.restoreFocusTo)
    ? options.restoreFocusTo
    : element.ownerDocument?.activeElement;
  const entry = {
    element,
    type: options.type || "modal",
    restoreFocusTo: isHtmlElement(restoreFocusTo) ? restoreFocusTo : null,
    restoreFocusOnClose: options.restoreFocusOnClose !== false
  };

  element.setAttribute("role", options.role || "dialog");
  element.setAttribute("aria-modal", options.ariaModal === false ? "false" : "true");
  element.removeAttribute("aria-hidden");
  if (!element.hasAttribute("tabindex")) {
    element.setAttribute("tabindex", "-1");
  }

  if (overlayStack.length === 0) {
    lockBodyScroll(element);
  }
  overlayStack.push(entry);

  const focusTarget = resolveFocusTarget(element, options.focusTarget);
  safeFocus(focusTarget);
  return true;
}

export function closeOverlay(element, options = {}) {
  if (!isHtmlElement(element)) {
    return false;
  }

  const index = overlayStack.findLastIndex((entry) => entry.element === element);
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

  if (overlayStack.length === 0) {
    unlockBodyScroll(element);
  }

  return true;
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
