import { renderMapOverlayControls, updateMapOverlayButtonStates } from "./mapOverlayControls.js";
import { clearMapStatusPanel, renderMapStatusPanel } from "./mapStatusPanel.js";

export function refreshMapUiShell(context = {}) {
  context.callbacks?.syncShellVisualState?.(context);
  return true;
}

export function refreshMapOverlayUi(context = {}) {
  const controls = context.elements?.overlayControls || context.overlayControls || null;
  if (!controls) {
    return false;
  }

  if (context.callbacks?.renderOverlayControls) {
    context.callbacks.renderOverlayControls(context);
    return true;
  }

  if (controls.children?.length > 0) {
    return updateMapOverlayButtonStates(context.overlayState, { container: controls });
  }

  return renderMapOverlayControls(context.overlayState, context.callbacks || {}, { container: controls });
}

export function refreshSelectedDistrictUi(context = {}) {
  context.callbacks?.refreshSelectedDistrict?.(context);
  return true;
}

export function refreshMapStatusUi(context = {}) {
  const container = context.elements?.statusPanel || context.statusPanel || null;
  if (!container) {
    return false;
  }

  const statusViewModel = context.statusViewModel || context.callbacks?.buildStatusViewModel?.(context) || null;
  if (!statusViewModel) {
    return clearMapStatusPanel({ container });
  }

  return renderMapStatusPanel(statusViewModel, { container });
}

export function refreshMapAfterStateChange(context = {}) {
  if (typeof context.callbacks?.redrawMap === "function") {
    context.callbacks.redrawMap(context);
  }
  refreshMapUiShell(context);
  refreshMapOverlayUi(context);
  refreshSelectedDistrictUi(context);
  refreshMapStatusUi(context);
  return true;
}
