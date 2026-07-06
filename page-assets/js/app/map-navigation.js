import { shouldSuppressMapInput } from "./ui/legacyOverlayCoordinator.js";

const MAP_VIEWPORT_SELECTOR = "[data-map-viewport]";
const MAP_CANVAS_SELECTOR = "[data-map-canvas]";
const MAP_ZOOM_BUTTON_SELECTOR = "[data-map-zoom]";
const MOBILE_MEDIA = "(max-width: 720px)";
const MIN_SCALE = 1;
const MAX_SCALE = 3;
const MOBILE_INITIAL_SCALE = 1.42;
const ZOOM_STEP = 0.18;
const PINCH_SUPPRESS_MS = 280;

function bindMapNavigation(root) {
  const viewport = root.querySelector(MAP_VIEWPORT_SELECTOR);
  const canvasHost = root.querySelector(MAP_CANVAS_SELECTOR);
  const zoomButtons = Array.from(root.querySelectorAll(MAP_ZOOM_BUTTON_SELECTOR));

  if (!viewport || !canvasHost) {
    return;
  }

  const initialScale = window.matchMedia?.(MOBILE_MEDIA)?.matches ? MOBILE_INITIAL_SCALE : MIN_SCALE;
  const state = {
    scale: initialScale,
    x: 0,
    y: 0,
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    pinching: false,
    pinchStartDistance: 0,
    pinchStartScale: initialScale,
    pinchStartMidX: 0,
    pinchStartMidY: 0,
    pinchOriginX: 0,
    pinchOriginY: 0
  };
  const activePointers = new Map();

  const clampOffset = () => {
    const maxX = Math.max(0, ((canvasHost.offsetWidth * state.scale) - viewport.clientWidth) / 2);
    const maxY = Math.max(0, ((canvasHost.offsetHeight * state.scale) - viewport.clientHeight) / 2);
    state.x = Math.min(Math.max(state.x, -maxX), maxX);
    state.y = Math.min(Math.max(state.y, -maxY), maxY);
  };

  const render = () => {
    clampOffset();
    canvasHost.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
  };

  const setScale = (nextScale) => {
    state.scale = Math.min(Math.max(nextScale, MIN_SCALE), MAX_SCALE);
    if (state.scale <= MIN_SCALE + 0.001) {
      state.x = 0;
      state.y = 0;
    }
    render();
  };

  const resetZoom = () => {
    state.scale = MIN_SCALE;
    state.x = 0;
    state.y = 0;
    render();
    return true;
  };

  const suppressMapClick = () => {
    viewport.dataset.mapGestureSuppressUntil = String(window.performance.now() + PINCH_SUPPRESS_MS);
  };

  const getPointerPair = () => {
    const pointers = Array.from(activePointers.values());
    return pointers.length >= 2 ? pointers.slice(0, 2) : null;
  };
  const getPointerDistance = (first, second) => Math.hypot(second.x - first.x, second.y - first.y);
  const getPointerMidpoint = (first, second) => ({
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2
  });

  const beginPinch = () => {
    const pair = getPointerPair();
    if (!pair) {
      return;
    }

    const [first, second] = pair;
    const midpoint = getPointerMidpoint(first, second);
    state.pinching = true;
    state.pointerId = null;
    state.pinchStartDistance = Math.max(1, getPointerDistance(first, second));
    state.pinchStartScale = state.scale;
    state.pinchStartMidX = midpoint.x;
    state.pinchStartMidY = midpoint.y;
    state.pinchOriginX = state.x;
    state.pinchOriginY = state.y;
    suppressMapClick();
    viewport.classList.add("is-dragging");
  };

  const updatePinch = (event) => {
    const pair = getPointerPair();
    if (!pair) {
      return false;
    }

    event.preventDefault();
    if (!state.pinching) {
      beginPinch();
    }

    const [first, second] = pair;
    const distance = Math.max(1, getPointerDistance(first, second));
    const midpoint = getPointerMidpoint(first, second);
    state.scale = Math.min(Math.max(state.pinchStartScale * (distance / Math.max(1, state.pinchStartDistance)), MIN_SCALE), MAX_SCALE);
    state.x = state.pinchOriginX + (midpoint.x - state.pinchStartMidX);
    state.y = state.pinchOriginY + (midpoint.y - state.pinchStartMidY);
    if (state.scale <= MIN_SCALE + 0.001) {
      state.x = 0;
      state.y = 0;
    }
    suppressMapClick();
    render();
    return true;
  };

  viewport.addEventListener("wheel", (event) => {
    if (shouldSuppressMapInput(event)) {
      return;
    }

    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    setScale(state.scale + direction * ZOOM_STEP);
  });

  for (const button of zoomButtons) {
    button.addEventListener("click", (event) => {
      if (shouldSuppressMapInput(event)) {
        return;
      }

      const direction = button.dataset.mapZoom === "in" ? 1 : -1;
      setScale(state.scale + direction * ZOOM_STEP);
    });
  }

  viewport.addEventListener("pointerdown", (event) => {
    if (shouldSuppressMapInput(event)) {
      return;
    }

    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    viewport.setPointerCapture(event.pointerId);

    if (activePointers.size >= 2) {
      beginPinch();
      return;
    }

    if (state.scale <= MIN_SCALE + 0.001) {
      return;
    }

    state.pointerId = event.pointerId;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.originX = state.x;
    state.originY = state.y;
    viewport.classList.add("is-dragging");
  });

  let dragPointerFrameId = null;
  let pendingDragEvent = null;

  const flushDragPointerMove = () => {
    dragPointerFrameId = null;
    const event = pendingDragEvent;
    pendingDragEvent = null;

    if (!event || state.pointerId !== event.pointerId) {
      return;
    }

    state.x = state.originX + (event.clientX - state.startX);
    state.y = state.originY + (event.clientY - state.startY);
    render();
  };

  viewport.addEventListener("pointermove", (event) => {
    if (shouldSuppressMapInput(event)) {
      activePointers.clear();
      state.pointerId = null;
      state.pinching = false;
      viewport.classList.remove("is-dragging");
      return;
    }

    if (activePointers.has(event.pointerId)) {
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (updatePinch(event) || state.pointerId !== event.pointerId) {
      return;
    }

    pendingDragEvent = event;
    if (dragPointerFrameId === null) {
      dragPointerFrameId = window.requestAnimationFrame(flushDragPointerMove);
    }
  });

  const releasePointer = (event) => {
    if (shouldSuppressMapInput(event)) {
      activePointers.clear();
      state.pointerId = null;
      state.pinching = false;
      viewport.classList.remove("is-dragging");
      return;
    }

    activePointers.delete(event.pointerId);
    if (state.pinching && activePointers.size < 2) {
      state.pinching = false;
      suppressMapClick();
    }

    if (state.pointerId === event.pointerId) {
      if (dragPointerFrameId !== null) {
        window.cancelAnimationFrame(dragPointerFrameId);
        dragPointerFrameId = null;
      }
      pendingDragEvent = null;
      state.pointerId = null;
    }

    if (activePointers.size === 0) {
      viewport.classList.remove("is-dragging");
    }
    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
  };

  viewport.addEventListener("pointerup", releasePointer);
  viewport.addEventListener("pointercancel", releasePointer);
  viewport.addEventListener("pointerleave", (event) => {
    if (state.pointerId === event.pointerId) {
      releasePointer(event);
    }
  });

  render();

  const controller = {
    getState: () => ({ scale: state.scale, x: state.x, y: state.y }),
    resetZoom,
    setScale
  };
  viewport.empireStreetsMapNavigation = controller;
  canvasHost.empireStreetsMapNavigation = controller;
  root.empireStreetsMapNavigation = controller;
  if (typeof window !== "undefined") {
    window.empireStreetsMapNavigation = controller;
  }
  return controller;
}

export { bindMapNavigation };
