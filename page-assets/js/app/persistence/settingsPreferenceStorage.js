import { STORAGE_KEYS } from "../../config.js";

const SETTINGS_STORAGE_KEY = STORAGE_KEYS.settings;

const getStorage = (options = {}) => (
  options.storage || globalThis.window?.localStorage || globalThis.localStorage || null
);

export function loadSettingsState(fallback = null, options = {}) {
  const storage = getStorage(options);
  if (!storage) return fallback && typeof fallback === "object" ? { ...fallback } : fallback;
  try {
    const rawValue = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!rawValue) return fallback && typeof fallback === "object" ? { ...fallback } : fallback;
    return JSON.parse(rawValue);
  } catch (error) {
    options.logger?.warn?.("[Empire settings] Invalid settings ignored.", { error });
    return fallback && typeof fallback === "object" ? { ...fallback } : fallback;
  }
}

export function saveSettingsState(state, options = {}) {
  const storage = getStorage(options);
  if (!storage) return false;
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    options.logger?.warn?.("[Empire settings] Settings write failed.", { error });
    return false;
  }
}
