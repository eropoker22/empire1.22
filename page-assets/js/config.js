const globalScope = typeof window !== "undefined" ? window : globalThis;
const overrides = globalScope.EmpireConfigOverrides || {};
const storageKeyOverrides = overrides.storageKeys || {};

const normalizeBasePath = (value, fallback) => {
  const basePath = String(value || fallback || "").trim();
  if (!basePath) {
    return "";
  }
  return basePath.endsWith("/") ? basePath : `${basePath}/`;
};

export const STORAGE_KEYS = Object.freeze({
  session: storageKeyOverrides.session || "empireStreets.session.v1",
  settings: storageKeyOverrides.settings || "empire_settings",
  guestUsername: storageKeyOverrides.guestUsername || "empire_guest_username",
  guestGangName: storageKeyOverrides.guestGangName || "empire_gang_name",
  token: storageKeyOverrides.token || "empire_token",
  structure: storageKeyOverrides.structure || "empire_structure",
  structureId: storageKeyOverrides.structureId || "empire_structure_id",
  avatar: storageKeyOverrides.avatar || "empire_avatar",
  gangColor: storageKeyOverrides.gangColor || "empire_gang_color",
  activeAuthMode: storageKeyOverrides.activeAuthMode || "empire:active_auth_mode",
  activeGuestMode: storageKeyOverrides.activeGuestMode || "empire:active_guest_mode",
  selectedServer: storageKeyOverrides.selectedServer || "empirestreets.selectedServer",
  debugAdminSlice: storageKeyOverrides.debugAdminSlice || "empire:debug:adminSlice"
});

export const API_BASE_URL = String(overrides.apiBaseUrl || "http://localhost:3000").replace(/\/+$/, "");
export const WEBSOCKET_BASE_URL = String(overrides.websocketBaseUrl || overrides.webSocketBaseUrl || "ws://localhost:3000").replace(/\/+$/, "");
export const ASSET_BASE_PATH = normalizeBasePath(overrides.assetBasePath, "../img/");

export const getAssetPath = (assetPath) => {
  const normalizedPath = String(assetPath || "").trim();
  if (
    !normalizedPath ||
    normalizedPath.startsWith("http:") ||
    normalizedPath.startsWith("https:") ||
    normalizedPath.startsWith("data:") ||
    normalizedPath.startsWith("/") ||
    normalizedPath.startsWith("./") ||
    normalizedPath.startsWith("../")
  ) {
    return normalizedPath;
  }

  return `${ASSET_BASE_PATH}${normalizedPath}`;
};

export const EMPIRE_CONFIG = Object.freeze({
  apiBaseUrl: API_BASE_URL,
  websocketBaseUrl: WEBSOCKET_BASE_URL,
  webSocketBaseUrl: WEBSOCKET_BASE_URL,
  assetBasePath: ASSET_BASE_PATH,
  storageKeys: STORAGE_KEYS,
  getAssetPath
});

globalScope.EmpireConfig = Object.freeze({
  ...(globalScope.EmpireConfig || {}),
  ...EMPIRE_CONFIG
});
