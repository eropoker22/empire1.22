export const DEFAULT_SETTINGS = Object.freeze({
  language: "cs",
  mapDistrictBorders: true,
  mapAllianceSymbols: true,
  reducedMapEffects: false,
  mapVisibilityMode: "all"
});

export function normalizeMapVisibilityMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "all" || mode === "hide-enemies" || mode === "only-player") {
    return mode;
  }
  return DEFAULT_SETTINGS.mapVisibilityMode;
}

export function normalizeSettingsState(settings = {}) {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(settings && typeof settings === "object" ? settings : {})
  };

  return {
    ...merged,
    language: String(merged.language || DEFAULT_SETTINGS.language).trim().toLowerCase() === "en" ? "en" : "cs",
    mapDistrictBorders: Boolean(merged.mapDistrictBorders),
    mapAllianceSymbols: Boolean(merged.mapAllianceSymbols),
    reducedMapEffects: Boolean(merged.reducedMapEffects),
    mapVisibilityMode: normalizeMapVisibilityMode(merged.mapVisibilityMode)
  };
}

export function createSettingsStateRuntime(deps = {}) {
  const loadSettingsState = typeof deps.loadSettingsState === "function" ? deps.loadSettingsState : () => null;
  const saveSettingsState = typeof deps.saveSettingsState === "function" ? deps.saveSettingsState : () => {};
  const documentRef = deps.documentRef || (typeof document === "undefined" ? null : document);
  const CustomEventCtor = deps.CustomEventCtor || globalThis.CustomEvent;

  const getSettingsState = () => {
    try {
      return normalizeSettingsState(loadSettingsState(null));
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  };

  const applySettingsState = (settings) => {
    const normalized = normalizeSettingsState(settings);
    saveSettingsState(normalized);

    if (documentRef?.documentElement) {
      documentRef.documentElement.lang = normalized.language;
      documentRef.documentElement.dataset.language = normalized.language;
      documentRef.documentElement.dataset.mapVisibilityMode = normalized.mapVisibilityMode;
      documentRef.documentElement.dataset.mapEffects = normalized.reducedMapEffects ? "reduced" : "full";
    }
    if (documentRef?.dispatchEvent && typeof CustomEventCtor === "function") {
      documentRef.dispatchEvent(new CustomEventCtor("empire:settings-changed", {
        detail: { settings: normalized }
      }));
    }

    return normalized;
  };

  return {
    applySettingsState,
    getSettingsState
  };
}

if (typeof window !== "undefined") {
  window.EmpireSettingsState = {
    DEFAULT_SETTINGS,
    createSettingsStateRuntime,
    normalizeMapVisibilityMode,
    normalizeSettingsState
  };
}
