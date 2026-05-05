const OVERLAY_KEYS = new Set(["heatmap", "influence", "ownership", "trap"]);

export function createDefaultMapOverlayState() {
  return {
    activeOverlay: "ownership",
    heatmap: false,
    influence: false,
    ownership: true,
    trap: false
  };
}

export function normalizeMapOverlayState(raw = {}) {
  const defaults = createDefaultMapOverlayState();
  const source = raw && typeof raw === "object" ? raw : {};
  const activeOverlay = OVERLAY_KEYS.has(source.activeOverlay) ? source.activeOverlay : defaults.activeOverlay;
  return {
    activeOverlay,
    heatmap: Boolean(source.heatmap ?? source.heatmapEnabled ?? defaults.heatmap),
    influence: Boolean(source.influence ?? source.influenceEnabled ?? defaults.influence),
    ownership: Boolean(source.ownership ?? source.ownershipEnabled ?? defaults.ownership),
    trap: Boolean(source.trap ?? source.trapOverlayEnabled ?? defaults.trap)
  };
}

export function isOverlayEnabled(state = {}, overlayKey = "") {
  const normalized = normalizeMapOverlayState(state);
  return Boolean(normalized[overlayKey]);
}

export function setActiveOverlay(state = {}, overlayKey = "") {
  const normalized = normalizeMapOverlayState(state);
  if (!OVERLAY_KEYS.has(overlayKey)) {
    return normalized;
  }
  return {
    ...normalized,
    activeOverlay: overlayKey,
    heatmap: overlayKey === "heatmap",
    influence: overlayKey === "influence",
    ownership: overlayKey === "ownership",
    trap: overlayKey === "trap"
  };
}

export function toggleOverlay(state = {}, overlayKey = "") {
  const normalized = normalizeMapOverlayState(state);
  if (!OVERLAY_KEYS.has(overlayKey)) {
    return normalized;
  }
  const nextEnabled = !Boolean(normalized[overlayKey]);
  return {
    ...normalized,
    activeOverlay: nextEnabled ? overlayKey : normalized.activeOverlay,
    [overlayKey]: nextEnabled
  };
}
