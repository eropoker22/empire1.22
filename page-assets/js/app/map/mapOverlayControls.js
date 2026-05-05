import { normalizeMapOverlayState } from "./mapOverlayState.js";

const DEFAULT_OVERLAY_ACTIONS = Object.freeze([
  Object.freeze({ key: "heatmap", label: "Heatmap" }),
  Object.freeze({ key: "influence", label: "Influence" }),
  Object.freeze({ key: "ownership", label: "Ownership" }),
  Object.freeze({ key: "trap", label: "Traps" })
]);

function getOwnerDocument(element, options = {}) {
  return element?.ownerDocument || options.document || (typeof document !== "undefined" ? document : null);
}

function createElement(container, tagName, className = "", options = {}) {
  const ownerDocument = getOwnerDocument(container, options);
  if (!ownerDocument?.createElement) {
    return null;
  }
  const element = ownerDocument.createElement(tagName);
  if (className) {
    element.className = className;
  }
  return element;
}

function getCallback(callbacks = {}, key = "") {
  if (key === "heatmap") return callbacks.onToggleHeatmap || callbacks.onToggleOverlay;
  if (key === "influence") return callbacks.onToggleInfluence || callbacks.onToggleOverlay;
  if (key === "ownership") return callbacks.onToggleOwnership || callbacks.onToggleOverlay;
  if (key === "trap") return callbacks.onToggleTrapOverlay || callbacks.onToggleOverlay;
  return callbacks.onToggleOverlay;
}

export function updateMapOverlayButtonStates(overlayState = {}, options = {}) {
  const container = options.container || options.mount || null;
  if (!container?.querySelectorAll) {
    return false;
  }

  const normalized = normalizeMapOverlayState(overlayState);
  for (const button of Array.from(container.querySelectorAll("[data-map-overlay-key]"))) {
    const key = button.dataset?.mapOverlayKey;
    const isActive = Boolean(normalized[key]);
    button.classList?.toggle?.("is-active", isActive);
    button.setAttribute?.("aria-pressed", isActive ? "true" : "false");
  }
  return true;
}

export function renderMapOverlayControls(overlayState = {}, callbacks = {}, options = {}) {
  const container = options.container || options.mount || null;
  if (!container) {
    return false;
  }

  const normalized = normalizeMapOverlayState(overlayState);
  const actions = Array.isArray(options.actions) ? options.actions : DEFAULT_OVERLAY_ACTIONS;
  container.replaceChildren?.();

  for (const action of actions) {
    const button = createElement(container, "button", "button map-overlay-control", options);
    if (!button) {
      continue;
    }
    const callback = getCallback(callbacks, action.key);
    button.type = "button";
    button.dataset.mapOverlayKey = action.key;
    button.textContent = action.label;
    button.disabled = typeof callback !== "function";
    button.classList?.toggle?.("is-active", Boolean(normalized[action.key]));
    button.setAttribute?.("aria-pressed", normalized[action.key] ? "true" : "false");
    button.addEventListener?.("click", () => {
      if (!button.disabled) {
        callback?.(action.key);
      }
    });
    container.append?.(button);
  }

  return true;
}

export function initMapOverlayControls(callbacks = {}, options = {}) {
  renderMapOverlayControls(options.overlayState, callbacks, options);
  return {
    update: (overlayState) => updateMapOverlayButtonStates(overlayState, options),
    render: (overlayState) => renderMapOverlayControls(overlayState, callbacks, options)
  };
}
