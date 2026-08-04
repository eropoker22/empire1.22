import { MAP_HOVER_STROKE_STYLE } from "./mapConstants.js";
import { getDistrictAtPoint } from "./mapGeometry.js";
import { hideDistrictTooltip, renderDistrictTooltip } from "./mapTooltip.js";
import { buildMapTooltipViewModel, getMapTooltipContentKey } from "./mapTooltipViewModel.js";
import { clamp } from "../runtime/utils.js";
import { shouldSuppressMapInput } from "../ui/legacyOverlayCoordinator.js";

const DRAG_THRESHOLD_PX = 8;
const DRAG_CLICK_SUPPRESSION_MS = 280;

const toCanvasPoint = (event, shell) => {
  const rect = shell.canvasHost.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * shell.canvas.width,
    y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * shell.canvas.height
  };
};

export function createServerMapInteractionController(options = {}) {
  const { shell, interactionState, windowRef } = options;
  let mounted = false;
  let destroyed = false;
  let visible = true;
  let hoverFrameId = null;
  let pendingHoverEvent = null;
  let lastTooltipContentKey = "";
  let tooltipSize = { width: 84, height: 52 };
  const gesture = {
    pointerId: null,
    startX: 0,
    startY: 0,
    moved: false,
    suppressClickUntil: 0
  };

  const clearHover = () => {
    const canvas = shell.hoverCanvas;
    canvas?.getContext?.("2d")?.clearRect?.(0, 0, canvas.width || 0, canvas.height || 0);
  };

  const renderHover = (providedGeometry = null) => {
    const geometry = providedGeometry || options.getGeometry?.();
    const canvas = shell.hoverCanvas;
    const context = canvas?.getContext?.("2d");
    clearHover();
    if (!context || !geometry || !interactionState.hoveredDistrictId) return;
    const district = geometry.districts.find(
      (entry) => entry.id === interactionState.hoveredDistrictId
    );
    if (!district) return;
    context.save();
    context.beginPath();
    context.moveTo(district.polygon[0].x, district.polygon[0].y);
    district.polygon.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    context.closePath();
    context.strokeStyle = MAP_HOVER_STROKE_STYLE;
    context.lineWidth = 2.4;
    context.lineJoin = "round";
    context.stroke();
    context.restore();
    windowRef?.empireStreetsRuntimeDiagnostics?.recordMapLayerRedraw?.("hover");
  };

  const hideTooltip = () => {
    hideDistrictTooltip({ tooltip: shell.tooltip, gossip: shell.tooltipGossip });
    lastTooltipContentKey = "";
  };

  const renderTooltip = (event, district) => {
    if (!district || !shell.tooltip || (event.pointerType && event.pointerType !== "mouse")) {
      hideTooltip();
      return;
    }
    const viewportRect = shell.viewport.getBoundingClientRect();
    const model = options.getModel?.();
    const tooltipViewModel = buildMapTooltipViewModel(
      district,
      interactionState,
      {
        currentPlayerId: model?.currentPlayerId,
        getLaunchPlayerName: (ownerId) => String(ownerId),
        cityFeed: model?.gameplaySlice?.cityFeed
      }
    );
    const tooltipContentKey = getMapTooltipContentKey(tooltipViewModel);
    const result = renderDistrictTooltip(tooltipViewModel, {
      pointerX: event.clientX - viewportRect.left,
      pointerY: event.clientY - viewportRect.top
    }, {
      tooltip: shell.tooltip,
      value: shell.tooltipValue,
      type: shell.tooltipType,
      gossip: shell.tooltipGossip,
      viewportRect,
      tooltipSize,
      renderContent: tooltipContentKey !== lastTooltipContentKey,
      clamp
    });
    lastTooltipContentKey = tooltipContentKey;
    tooltipSize = result.tooltipSize || tooltipSize;
  };

  const flushHover = () => {
    hoverFrameId = null;
    const event = pendingHoverEvent;
    pendingHoverEvent = null;
    const geometry = options.getGeometry?.();
    if (!visible || !event || !geometry || (event.pointerType && event.pointerType !== "mouse")) return;
    const district = getDistrictAtPoint(geometry, toCanvasPoint(event, shell));
    const nextId = district?.id || null;
    if (nextId !== interactionState.hoveredDistrictId) {
      interactionState.hoveredDistrictId = nextId;
      renderHover(geometry);
    }
    renderTooltip(event, district);
  };

  const handlePointerMove = (event) => {
    if (gesture.pointerId === event.pointerId && !gesture.moved) {
      const distance = Math.hypot(
        event.clientX - gesture.startX,
        event.clientY - gesture.startY
      );
      gesture.moved = distance >= DRAG_THRESHOLD_PX;
    }
    pendingHoverEvent = event;
    if (hoverFrameId === null) {
      hoverFrameId = windowRef?.requestAnimationFrame?.(flushHover) ?? null;
    }
  };

  const handlePointerLeave = () => {
    if (hoverFrameId !== null) windowRef?.cancelAnimationFrame?.(hoverFrameId);
    hoverFrameId = null;
    pendingHoverEvent = null;
    interactionState.hoveredDistrictId = null;
    renderHover();
    hideTooltip();
  };

  const handlePointerDown = (event) => {
    if (shouldSuppressMapInput(event)) return;
    gesture.pointerId = event.pointerId;
    gesture.startX = event.clientX;
    gesture.startY = event.clientY;
    gesture.moved = false;
  };

  const handlePointerEnd = (event) => {
    if (gesture.pointerId !== event.pointerId) return;
    if (gesture.moved) {
      gesture.suppressClickUntil = (windowRef?.performance?.now?.() ?? Date.now())
        + DRAG_CLICK_SUPPRESSION_MS;
    }
    gesture.pointerId = null;
    gesture.moved = false;
  };

  const handleClick = async (event) => {
    const geometry = options.getGeometry?.();
    if (!geometry || shouldSuppressMapInput(event)) return;
    const now = windowRef?.performance?.now?.() ?? Date.now();
    const navigationSuppressUntil = Number(shell.viewport?.dataset?.mapGestureSuppressUntil || 0);
    if (now < gesture.suppressClickUntil || now < navigationSuppressUntil) {
      gesture.suppressClickUntil = 0;
      delete shell.viewport.dataset.mapGestureSuppressUntil;
      return;
    }
    const district = getDistrictAtPoint(geometry, toCanvasPoint(event, shell));
    if (!district) return;
    try {
      const selection = await options.selectDistrict?.(district.id, {
        forceSubmit: true,
        source: "map-click"
      });
      if (!destroyed && selection) {
        options.onDistrictSelected?.(selection);
      }
    } catch (error) {
      if (!destroyed) options.onDistrictSelectionError?.(error);
    }
  };

  const mount = () => {
    if (mounted || destroyed) return mounted;
    mounted = true;
    shell.viewport?.addEventListener?.("pointermove", handlePointerMove);
    shell.viewport?.addEventListener?.("pointerleave", handlePointerLeave);
    shell.viewport?.addEventListener?.("pointerdown", handlePointerDown);
    shell.viewport?.addEventListener?.("pointerup", handlePointerEnd);
    shell.viewport?.addEventListener?.("pointercancel", handlePointerEnd);
    shell.viewport?.addEventListener?.("click", handleClick);
    return true;
  };

  const destroy = () => {
    if (destroyed) return false;
    destroyed = true;
    mounted = false;
    if (hoverFrameId !== null) windowRef?.cancelAnimationFrame?.(hoverFrameId);
    hoverFrameId = null;
    pendingHoverEvent = null;
    shell.viewport?.removeEventListener?.("pointermove", handlePointerMove);
    shell.viewport?.removeEventListener?.("pointerleave", handlePointerLeave);
    shell.viewport?.removeEventListener?.("pointerdown", handlePointerDown);
    shell.viewport?.removeEventListener?.("pointerup", handlePointerEnd);
    shell.viewport?.removeEventListener?.("pointercancel", handlePointerEnd);
    shell.viewport?.removeEventListener?.("click", handleClick);
    clearHover();
    hideTooltip();
    return true;
  };

  return {
    mount,
    renderHover,
    setVisibility(nextVisible) {
      visible = Boolean(nextVisible);
      if (!visible) handlePointerLeave();
    },
    destroy
  };
}
