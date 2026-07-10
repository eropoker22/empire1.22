function getOwnerDocument(element, fallbackDocument = null) {
  return element?.ownerDocument || fallbackDocument || (typeof document !== "undefined" ? document : null);
}

function isElementLike(value) {
  return Boolean(value && typeof value === "object" && typeof value.querySelector === "function");
}

function getCanvasLike(value) {
  return value && typeof value.getContext === "function" ? value : null;
}

export function getMapShellElements(root, selectors = {}) {
  if (!isElementLike(root)) {
    return {
      root: root || null,
      canvas: null,
      phaseHost: null,
      viewport: null,
      canvasHost: null,
      mapStage: null,
      mapMount: null,
      tooltip: null,
      tooltipValue: null,
      tooltipType: null,
      tooltipGossip: null,
      overlayControls: null,
      legend: null,
      statusPanel: null
    };
  }

  const query = (selector) => selector ? root.querySelector(selector) : null;
  return {
    root,
    canvas: query(selectors.canvas),
    phaseHost: query(selectors.phaseHost),
    viewport: query(selectors.viewport),
    canvasHost: query(selectors.canvasHost),
    mapStage: query(selectors.mapStage || "#game-map-stage"),
    mapMount: query(selectors.mapMount || "#game-map-mount"),
    tooltip: query(selectors.tooltip),
    tooltipValue: query(selectors.tooltipValue),
    tooltipType: query(selectors.tooltipType),
    tooltipGossip: query(selectors.tooltipGossip),
    overlayControls: query(selectors.overlayControls || "[data-map-overlay-controls]"),
    legend: query(selectors.legend || "[data-map-legend]"),
    statusPanel: query(selectors.statusPanel || "[data-map-status]")
  };
}

export function canRenderMap(elements = {}) {
  return Boolean(elements.canvas && elements.phaseHost && elements.viewport && elements.canvasHost);
}

export function renderMapMissingState(message = "Mapa není dostupná.", options = {}) {
  const target = options.container || options.viewport || options.canvasHost || null;
  if (!target) {
    return false;
  }
  target.dataset.mapError = "missing";
  target.setAttribute?.("aria-label", String(message || "Mapa není dostupná."));
  return true;
}

export function clearMapShellUi(options = {}) {
  const { interactionOverlay, hoverCanvas, tooltip } = options;
  interactionOverlay?.classList?.remove?.("is-hovering", "is-focused");
  hoverCanvas?.getContext?.("2d")?.clearRect?.(0, 0, hoverCanvas.width || 0, hoverCanvas.height || 0);
  if (tooltip) {
    tooltip.hidden = true;
  }
  return true;
}

export function setMapBusy(isBusy, options = {}) {
  const target = options.container || options.viewport || options.canvasHost || null;
  target?.classList?.toggle?.("is-busy", Boolean(isBusy));
  if (target?.dataset) {
    target.dataset.mapBusy = Boolean(isBusy) ? "true" : "false";
  }
  return Boolean(target);
}

export function setMapError(message = "", options = {}) {
  const target = options.container || options.viewport || options.canvasHost || null;
  if (!target) {
    return false;
  }
  const safeMessage = String(message || "");
  target.dataset.mapError = safeMessage;
  target.classList?.toggle?.("has-error", Boolean(safeMessage));
  return true;
}

export function ensureMapInteractionOverlay(canvasHost, className, options = {}) {
  if (!canvasHost || !className) {
    return null;
  }

  let overlay = canvasHost.querySelector?.(`.${className}`) || null;
  if (overlay) {
    return overlay;
  }

  const ownerDocument = getOwnerDocument(canvasHost, options.document);
  if (!ownerDocument?.createElement) {
    return null;
  }

  overlay = ownerDocument.createElement("div");
  overlay.className = className;
  overlay.setAttribute?.("aria-hidden", "true");
  canvasHost.append?.(overlay);
  return overlay;
}

export function ensureMapHoverCanvas(canvas, canvasHost, className, options = {}) {
  if (!canvas || !canvasHost || !className) {
    return null;
  }

  let hoverCanvas = canvasHost.querySelector?.(`.${className}`) || null;
  if (getCanvasLike(hoverCanvas)) {
    return hoverCanvas;
  }

  const ownerDocument = getOwnerDocument(canvasHost, options.document);
  if (!ownerDocument?.createElement) {
    return null;
  }

  hoverCanvas = ownerDocument.createElement("canvas");
  hoverCanvas.className = className;
  hoverCanvas.setAttribute?.("aria-hidden", "true");
  if (typeof canvas.after === "function") {
    canvas.after(hoverCanvas);
  } else {
    canvasHost.append?.(hoverCanvas);
  }
  return hoverCanvas;
}

export function ensureMapEffectsCanvas(canvas, canvasHost, className, options = {}) {
  if (!canvas || !canvasHost || !className) {
    return null;
  }

  let effectsCanvas = canvasHost.querySelector?.(`.${className}`) || null;
  if (getCanvasLike(effectsCanvas)) {
    return effectsCanvas;
  }

  const ownerDocument = getOwnerDocument(canvasHost, options.document);
  if (!ownerDocument?.createElement) {
    return null;
  }

  effectsCanvas = ownerDocument.createElement("canvas");
  effectsCanvas.className = className;
  effectsCanvas.setAttribute?.("aria-hidden", "true");
  if (typeof canvas.after === "function") {
    canvas.after(effectsCanvas);
  } else {
    canvasHost.append?.(effectsCanvas);
  }
  return effectsCanvas;
}

export function setMapOverlayPoint(interactionOverlay, name, x, y) {
  if (!interactionOverlay?.style || !name) {
    return false;
  }
  const clampedX = Math.min(Math.max(Number(x) || 0, 0), 100);
  const clampedY = Math.min(Math.max(Number(y) || 0, 0), 100);
  interactionOverlay.style.setProperty(`--${name}-x`, `${clampedX}%`);
  interactionOverlay.style.setProperty(`--${name}-y`, `${clampedY}%`);
  return true;
}

export function syncMapShellVisualState(options = {}) {
  const {
    interactionOverlay,
    canvasHost,
    viewport,
    mapMount,
    mapStage,
    canvas,
    focusedDistrict = null,
    hasFocus = false,
    classes = {}
  } = options;
  const hasHover = false;

  interactionOverlay?.classList?.toggle?.("is-hovering", hasHover);
  interactionOverlay?.classList?.toggle?.("is-focused", Boolean(hasFocus));

  for (const element of [canvasHost, viewport, mapMount, mapStage]) {
    element?.classList?.toggle?.(classes.hasHover || "has-hover", hasHover);
    element?.classList?.toggle?.(classes.focused || "is-focused", Boolean(hasFocus));
  }

  if (hasFocus && focusedDistrict && canvas) {
    setMapOverlayPoint(
      interactionOverlay,
      "map-focus",
      (Number(focusedDistrict.centerX || 0) / Math.max(1, Number(canvas.width || 1))) * 100,
      (Number(focusedDistrict.centerY || 0) / Math.max(1, Number(canvas.height || 1))) * 100
    );
  }

  return true;
}

export function initMapShell(options = {}) {
  const elements = getMapShellElements(options.root, options.selectors || {});
  if (!canRenderMap(elements)) {
    renderMapMissingState(options.missingMessage, {
      viewport: elements.viewport,
      canvasHost: elements.canvasHost
    });
    return {
      ...elements,
      interactionOverlay: null,
      hoverCanvas: null,
      canRender: false
    };
  }

  const interactionOverlay = ensureMapInteractionOverlay(
    elements.canvasHost,
    options.classes?.interactionOverlay || options.interactionOverlayClass,
    options
  );
  const hoverCanvas = ensureMapHoverCanvas(
    elements.canvas,
    elements.canvasHost,
    options.classes?.hoverCanvas || options.hoverCanvasClass,
    options
  );
  const effectsCanvas = ensureMapEffectsCanvas(
    elements.canvas,
    elements.canvasHost,
    options.classes?.effectsCanvas || options.effectsCanvasClass,
    options
  );

  return {
    ...elements,
    interactionOverlay,
    effectsCanvas,
    hoverCanvas,
    canRender: true
  };
}
