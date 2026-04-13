window.Empire = window.Empire || {};

(function initEmpireMode() {
  const MODE_KEY = "mode";
  const storagePrefixToken = "empire";
  const LAST_MODE_KEY = "empire:last_mode";
  const query = new URLSearchParams(window.location.search);
  const path = window.location.pathname.toLowerCase();
  const fromPath = path.includes("/free") ? "free" : (path.includes("/war") ? "war" : "");
  const storage = window.localStorage;
  const original = window.Empire.__storagePatch || {
    getItem: storage.getItem.bind(storage),
    setItem: storage.setItem.bind(storage),
    removeItem: storage.removeItem.bind(storage),
    clear: storage.clear.bind(storage),
    key: storage.key.bind(storage)
  };
  const storedModeRaw = original.getItem(LAST_MODE_KEY);
  const storedMode = storedModeRaw ? (window.Empire.GameModes?.normalizeMode(storedModeRaw) || "war") : "";
  const initialMode = window.Empire.GameModes?.normalizeMode(query.get(MODE_KEY) || fromPath || storedMode || "war") || "war";

  function resolveMode() {
    return window.Empire.GameModes?.normalizeMode(window.Empire.mode || initialMode) || "war";
  }

  function prefixKey(key) {
    return `${storagePrefixToken}:${resolveMode()}:${String(key)}`;
  }

  function applyMode(nextMode, options = {}) {
    const mode = window.Empire.GameModes?.normalizeMode(nextMode) || "war";
    window.Empire.mode = mode;
    window.Empire.modeConfig = window.Empire.GameModes?.getConfig(mode) || null;
    document.documentElement.dataset.gameMode = mode;
    if (document.body) {
      document.body.dataset.gameMode = mode;
      document.body.classList.toggle("auth-body--free", mode === "free");
      document.body.classList.toggle("auth-body--war", mode === "war");
    }
    document.documentElement.style.setProperty("--auth-accent", window.Empire.modeConfig?.loginAccent || "#22d3ee");
    document.documentElement.style.setProperty("--auth-accent-2", window.Empire.modeConfig?.loginAccentAlt || "#f472b6");
    document.documentElement.style.setProperty("--auth-surface", window.Empire.modeConfig?.loginSurface || "rgba(12, 18, 32, 0.7)");
    document.documentElement.style.setProperty("--auth-surface-strong", window.Empire.modeConfig?.loginSurfaceStrong || "rgba(7, 8, 15, 0.94)");
    document.documentElement.style.setProperty("--auth-route-slug", mode);
    original.setItem(LAST_MODE_KEY, mode);
    if (!options.skipUrlSync && query.get(MODE_KEY) !== mode) {
      query.set(MODE_KEY, mode);
      const nextUrl = `${window.location.pathname}?${query.toString()}${window.location.hash || ""}`;
      window.history.replaceState({}, "", nextUrl);
    }
    return window.Empire.modeConfig;
  }

  if (!window.Empire.__storagePatch) {
    try {
      storage.getItem = function getItem(key) {
        return original.getItem(prefixKey(key));
      };
      storage.setItem = function setItem(key, value) {
        return original.setItem(prefixKey(key), value);
      };
      storage.removeItem = function removeItem(key) {
        return original.removeItem(prefixKey(key));
      };
      storage.clear = function clear() {
        const keysToRemove = [];
        for (let index = 0; index < storage.length; index += 1) {
          const key = original.key(index);
          if (key && key.startsWith(`${storagePrefixToken}:${resolveMode()}:`)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => original.removeItem(key));
      };
      storage.key = function storageKey(index) {
        return original.key(index);
      };
      window.Empire.__storagePatch = original;
    } catch (error) {
      console.error("Storage mode patch failed:", error);
      window.Empire.__storagePatch = original;
    }
  }

  window.Empire.mode = initialMode;
  window.Empire.modeConfig = window.Empire.GameModes?.getConfig(initialMode) || null;
  window.Empire.applyGameMode = applyMode;
  window.Empire.getGameModeUrl = function getGameModeUrl(page, mode = resolveMode()) {
    const normalizedMode = window.Empire.GameModes?.normalizeMode(mode) || "war";
    const basePage = String(page || "index").replace(/\.html?$/i, "");
    return `/${basePage}.html?mode=${normalizedMode}`;
  };
  window.Empire.getGameModeBasePath = function getGameModeBasePath(mode = resolveMode()) {
    return `/${window.Empire.GameModes?.normalizeMode(mode) || "war"}`;
  };

  applyMode(initialMode, { skipUrlSync: true });
})();
