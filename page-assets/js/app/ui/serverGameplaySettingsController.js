import {
  BORDER_TOGGLE_SELECTOR,
  NAV_SETTINGS_SELECTOR,
  SETTINGS_LANGUAGE_SELECTOR,
  SETTINGS_MAP_ALLIANCE_SYMBOLS_SELECTOR,
  SETTINGS_MAP_BORDERS_SELECTOR,
  SETTINGS_MAP_VISIBILITY_SELECTOR,
  SETTINGS_MODAL_BACKDROP_SELECTOR,
  SETTINGS_MODAL_CLOSE_SELECTOR,
  SETTINGS_MODAL_SELECTOR,
  SETTINGS_SAVE_SELECTOR
} from "../runtime/constants.js";
import {
  loadSettingsState,
  saveSettingsState
} from "../persistence/settingsPreferenceStorage.js";
import {
  createSettingsStateRuntime,
  normalizeMapVisibilityMode
} from "../runtime/settingsState.js";
import { closeOverlay, openOverlay } from "./legacyOverlayCoordinator.js";

const ONBOARDING_LAUNCH_SELECTOR = "[data-onboarding-launch]";

const createDefaultSettingsRuntime = (windowRef, documentRef) => (
  createSettingsStateRuntime({
    documentRef,
    loadSettingsState: (fallback) => loadSettingsState(fallback, {
      storage: windowRef?.localStorage
    }),
    saveSettingsState: (settings) => saveSettingsState(settings, {
      storage: windowRef?.localStorage
    }),
    CustomEventCtor: windowRef?.CustomEvent || globalThis.CustomEvent
  })
);

export function createServerGameplaySettingsController(options = {}) {
  const root = options.root || null;
  const documentRef = options.documentRef || root?.ownerDocument || globalThis.document;
  const windowRef = options.windowRef || documentRef?.defaultView || globalThis.window;
  const settingsRuntime = options.settingsRuntime
    || createDefaultSettingsRuntime(windowRef, documentRef);
  let mounted = false;
  let destroyed = false;
  let open = false;
  let snapshot = null;
  let elements = null;
  const listeners = [];
  const diagnostics = { updates: 0, domWrites: 0, saves: 0 };

  const listen = (target, type, listener, listenerOptions) => {
    target?.addEventListener?.(type, listener, listenerOptions);
    listeners.push(() => target?.removeEventListener?.(type, listener, listenerOptions));
  };

  const readForm = () => ({
    mapDistrictBorders: Boolean(elements.borders?.checked),
    mapAllianceSymbols: Boolean(elements.allianceSymbols?.checked),
    mapVisibilityMode: normalizeMapVisibilityMode(elements.visibility?.value),
    language: elements.language?.value === "en" ? "en" : "cs"
  });

  const writeForm = (settings) => {
    let writes = 0;
    const values = {
      borders: Boolean(settings.mapDistrictBorders),
      allianceSymbols: Boolean(settings.mapAllianceSymbols),
      visibility: normalizeMapVisibilityMode(settings.mapVisibilityMode),
      language: settings.language === "en" ? "en" : "cs"
    };
    for (const [key, value] of Object.entries(values)) {
      const element = elements?.[key];
      const property = typeof value === "boolean" ? "checked" : "value";
      if (element && element[property] !== value) {
        element[property] = value;
        writes += 1;
      }
    }
    diagnostics.domWrites += writes;
    return writes;
  };

  const apply = (settings) => {
    diagnostics.saves += 1;
    return settingsRuntime.applySettingsState(settings);
  };

  const close = ({ revert = false } = {}) => {
    if (!open) return false;
    if (revert && snapshot) apply(snapshot);
    snapshot = null;
    open = false;
    elements.modal.hidden = true;
    elements.modal.classList?.add?.("hidden");
    documentRef?.body?.classList?.remove?.("mobile-settings-modal-open");
    closeOverlay(elements.modal);
    return true;
  };

  const show = (event) => {
    event?.preventDefault?.();
    if (!mounted || destroyed || open) return false;
    snapshot = settingsRuntime.getSettingsState();
    writeForm(snapshot);
    open = true;
    elements.modal.hidden = false;
    elements.modal.classList?.remove?.("hidden");
    documentRef?.body?.classList?.toggle?.(
      "mobile-settings-modal-open",
      Boolean(windowRef?.matchMedia?.("(max-width: 720px)")?.matches)
    );
    openOverlay(elements.modal, {
      type: "modal",
      ariaModal: true,
      restoreFocusOnClose: true,
      restoreFocusTo: event?.currentTarget
    });
    return true;
  };

  const preview = () => {
    if (!open) return false;
    apply(readForm());
    return true;
  };

  const toggleBorders = () => {
    const current = settingsRuntime.getSettingsState();
    apply({
      ...current,
      mapDistrictBorders: !current.mapDistrictBorders
    });
    update();
    return true;
  };

  const save = () => {
    if (!open) return false;
    apply(readForm());
    snapshot = null;
    return close();
  };

  const handleEscape = (event) => {
    if (event.key === "Escape" && open) close({ revert: true });
  };

  const update = () => {
    if (!mounted || destroyed) return 0;
    diagnostics.updates += 1;
    const settings = settingsRuntime.getSettingsState();
    const formWrites = open ? 0 : writeForm(settings);
    let buttonWrites = 0;
    for (const button of elements?.borderButtons || []) {
      const pressed = String(settings.mapDistrictBorders);
      if (button.getAttribute?.("aria-pressed") !== pressed) {
        button.setAttribute?.("aria-pressed", pressed);
        buttonWrites += 1;
      }
    }
    diagnostics.domWrites += buttonWrites;
    return formWrites + buttonWrites;
  };

  const mount = () => {
    if (destroyed || mounted) return false;
    const scope = documentRef || root;
    elements = {
      openButtons: Array.from(scope?.querySelectorAll?.(NAV_SETTINGS_SELECTOR) || []),
      borderButtons: Array.from(scope?.querySelectorAll?.(BORDER_TOGGLE_SELECTOR) || []),
      modal: scope?.querySelector?.(SETTINGS_MODAL_SELECTOR),
      backdrop: scope?.querySelector?.(SETTINGS_MODAL_BACKDROP_SELECTOR),
      closeButton: scope?.querySelector?.(SETTINGS_MODAL_CLOSE_SELECTOR),
      saveButton: scope?.querySelector?.(SETTINGS_SAVE_SELECTOR),
      borders: scope?.querySelector?.(SETTINGS_MAP_BORDERS_SELECTOR),
      allianceSymbols: scope?.querySelector?.(SETTINGS_MAP_ALLIANCE_SYMBOLS_SELECTOR),
      visibility: scope?.querySelector?.(SETTINGS_MAP_VISIBILITY_SELECTOR),
      language: scope?.querySelector?.(SETTINGS_LANGUAGE_SELECTOR),
      onboardingButton: scope?.querySelector?.(ONBOARDING_LAUNCH_SELECTOR)
    };
    if (!elements.modal || !elements.saveButton || elements.openButtons.length === 0) return false;
    mounted = true;
    elements.openButtons.forEach((button) => listen(button, "click", show));
    elements.borderButtons.forEach((button) => listen(button, "click", toggleBorders));
    for (const input of [
      elements.borders,
      elements.allianceSymbols,
      elements.visibility,
      elements.language
    ]) {
      listen(input, "change", preview);
    }
    listen(elements.backdrop, "click", () => close({ revert: true }));
    listen(elements.closeButton, "click", () => close({ revert: true }));
    listen(elements.onboardingButton, "click", () => close({ revert: true }));
    listen(elements.saveButton, "click", save);
    listen(documentRef, "keydown", handleEscape);
    if (options.managePageLifecycle !== false) listen(windowRef, "pagehide", destroy, { once: true });
    update();
    return true;
  };

  const destroy = () => {
    if (destroyed) return false;
    destroyed = true;
    if (open) close({ revert: true });
    while (listeners.length > 0) listeners.pop()();
    elements = null;
    mounted = false;
    return true;
  };

  return {
    mount,
    update,
    destroy,
    open: show,
    close,
    getSettings: () => settingsRuntime.getSettingsState(),
    getDiagnostics: () => ({ ...diagnostics, mounted, open })
  };
}
