const SESSION_STORAGE_KEY = "empireStreets.session.v1";
const SETTINGS_STORAGE_KEY = "empire_settings";
const DISTRICT_BUILDING_DETAIL_STATE_KEY = "empireStreets.districtBuildingDetails.v1";
const CLINIC_RECOVERY_POOL_KEY = "empireStreets.clinicRecoveryPool.v1";
const AVATAR_STORAGE_KEY = "empire_avatar";
const DEMO_STATE_STORAGE_PREFIX = "empireStreets.demoState";

export const LEGACY_STORAGE_KEYS = Object.freeze({
  session: SESSION_STORAGE_KEY,
  settings: SETTINGS_STORAGE_KEY,
  districtBuildingDetails: DISTRICT_BUILDING_DETAIL_STATE_KEY,
  clinicRecoveryPool: CLINIC_RECOVERY_POOL_KEY,
  avatar: AVATAR_STORAGE_KEY
});

function getStorage(options = {}) {
  return options.storage || globalThis.window?.localStorage || globalThis.localStorage || null;
}

function warnStorage(message, details = {}, options = {}) {
  const logger = options.logger || console;
  if (typeof logger?.warn !== "function") {
    return;
  }

  logger.warn(`[Empire legacy storage] ${message}`, details);
}

function normalizeMode(mode) {
  const normalized = String(mode || "").trim().toLowerCase();
  return normalized === "free" || normalized === "war" ? normalized : "";
}

function normalizeServerId(serverId) {
  return String(serverId || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeDemoId(id) {
  return String(id || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "default";
}

function cloneFallback(fallback) {
  if (Array.isArray(fallback)) {
    return [...fallback];
  }

  if (fallback && typeof fallback === "object") {
    return { ...fallback };
  }

  return fallback;
}

export function safeParseJson(rawValue, fallback = null, options = {}) {
  if (rawValue == null || rawValue === "") {
    return cloneFallback(fallback);
  }

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    warnStorage("Invalid JSON ignored.", { key: options.key || null, error }, options);
    return cloneFallback(fallback);
  }
}

export function loadJsonStorage(key, fallback = null, options = {}) {
  const storage = getStorage(options);
  if (!storage || !key) {
    return cloneFallback(fallback);
  }

  try {
    return safeParseJson(storage.getItem(key), fallback, { ...options, key });
  } catch (error) {
    warnStorage("Storage read failed.", { key, error }, options);
    return cloneFallback(fallback);
  }
}

export function saveJsonStorage(key, value, options = {}) {
  const storage = getStorage(options);
  if (!storage || !key) {
    return false;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    warnStorage("Storage write failed.", { key, error }, options);
    return false;
  }
}

export function clearStorageKey(key, options = {}) {
  const storage = getStorage(options);
  if (!storage || !key) {
    return false;
  }

  try {
    storage.removeItem(key);
    return true;
  } catch (error) {
    warnStorage("Storage clear failed.", { key, error }, options);
    return false;
  }
}

export function loadTextStorage(key, fallback = "", options = {}) {
  const storage = getStorage(options);
  if (!storage || !key) {
    return fallback;
  }

  try {
    const value = storage.getItem(key);
    return value == null ? fallback : String(value);
  } catch (error) {
    warnStorage("Storage text read failed.", { key, error }, options);
    return fallback;
  }
}

export function getStorageKey(mode = "", serverId = "") {
  const normalizedMode = normalizeMode(mode);
  const normalizedServerId = normalizeServerId(serverId);

  if (normalizedMode && normalizedServerId) {
    return `empireStreets.session.${normalizedMode}.${normalizedServerId}.v1`;
  }

  if (normalizedMode) {
    return `empireStreets.session.${normalizedMode}.v1`;
  }

  if (normalizedServerId) {
    return `empireStreets.session.${normalizedServerId}.v1`;
  }

  return SESSION_STORAGE_KEY;
}

function getStateFallbackKeys(mode = "", serverId = "") {
  const keys = [getStorageKey(mode, serverId)];
  const normalizedMode = normalizeMode(mode);

  if (normalizedMode) {
    keys.push(getStorageKey(normalizedMode, ""));
  }

  keys.push(SESSION_STORAGE_KEY);
  return [...new Set(keys)];
}

export function loadState(mode = "", serverId = "", options = {}) {
  const fallback = options.fallback ?? null;

  for (const key of getStateFallbackKeys(mode, serverId)) {
    const value = loadJsonStorage(key, null, options);
    if (value !== null) {
      return value;
    }
  }

  return cloneFallback(fallback);
}

export function saveState(mode = "", serverId = "", state, options = {}) {
  return saveJsonStorage(getStorageKey(mode, serverId), state, options);
}

export function clearState(mode = "", serverId = "", options = {}) {
  return clearStorageKey(getStorageKey(mode, serverId), options);
}

function getDemoStorageKey(id) {
  return `${DEMO_STATE_STORAGE_PREFIX}.${normalizeDemoId(id)}.v1`;
}

function getDemoFallbackKeys(id) {
  const normalizedId = normalizeDemoId(id);
  return [
    getDemoStorageKey(normalizedId),
    `${DEMO_STATE_STORAGE_PREFIX}.v1:${normalizedId}`,
    `empireStreets.demo.${normalizedId}.v1`
  ];
}

export function loadDemoState(id, options = {}) {
  const fallback = options.fallback ?? null;

  for (const key of getDemoFallbackKeys(id)) {
    const value = loadJsonStorage(key, null, options);
    if (value !== null) {
      return value;
    }
  }

  return cloneFallback(fallback);
}

export function saveDemoState(id, state, options = {}) {
  return saveJsonStorage(getDemoStorageKey(id), state, options);
}

export function loadSettingsState(fallback = null, options = {}) {
  return loadJsonStorage(SETTINGS_STORAGE_KEY, fallback, options);
}

export function saveSettingsState(state, options = {}) {
  return saveJsonStorage(SETTINGS_STORAGE_KEY, state, options);
}

export function loadClinicRecoveryPool(options = {}) {
  const value = loadJsonStorage(CLINIC_RECOVERY_POOL_KEY, [], options);
  return Array.isArray(value) ? value : [];
}

export function saveClinicRecoveryPool(pool, options = {}) {
  return saveJsonStorage(CLINIC_RECOVERY_POOL_KEY, Array.isArray(pool) ? pool : [], options);
}

export function loadDistrictBuildingDetailState(options = {}) {
  const value = loadJsonStorage(DISTRICT_BUILDING_DETAIL_STATE_KEY, {}, options);
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function saveDistrictBuildingDetailState(payload, options = {}) {
  const safePayload = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  return saveJsonStorage(DISTRICT_BUILDING_DETAIL_STATE_KEY, safePayload, options);
}
