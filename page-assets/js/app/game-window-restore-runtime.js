const PAGE_SELECTOR = 'main[data-page="game"]';
const STORAGE_KEY = "empire:game:last-open-window:v1";
const RESTORE_MAX_AGE_MS = 10 * 60 * 1000;
const RESTORE_DELAY_MS = 140;

export const GAME_WINDOW_RESTORE_DEFINITIONS = Object.freeze([
  {
    id: "settings",
    openSelector: "[data-nav-settings]",
    closeSelector: "#settings-modal-backdrop, #settings-modal-close, [data-nav-logout]",
    windowSelector: "#settings-modal"
  },
  {
    id: "player-profile",
    openSelector: "[data-player-profile-open]",
    closeSelector: "[data-player-popup-close], [data-nav-logout]",
    windowSelector: "[data-player-popup]"
  },
  {
    id: "storage",
    openSelector: "[data-storage-popup-open]",
    closeSelector: "[data-storage-popup-close], [data-nav-logout]",
    windowSelector: "[data-storage-popup]"
  },
  {
    id: "alliance",
    openSelector: "[data-alliance-popup-open]",
    closeSelector: "[data-alliance-popup-close], [data-nav-logout]",
    windowSelector: "[data-alliance-popup]"
  },
  {
    id: "leaderboard",
    openSelector: "[data-leaderboard-popup-open]",
    closeSelector: "[data-leaderboard-popup-close], [data-nav-logout]",
    windowSelector: "[data-leaderboard-popup]"
  },
  {
    id: "buildings",
    openSelector: "[data-buildings-popup-open]",
    closeSelector: "[data-buildings-popup-close], [data-nav-logout]",
    windowSelector: "[data-buildings-popup]"
  },
  {
    id: "market",
    openSelector: "[data-market-popup-open]",
    closeSelector: "[data-market-popup-close], [data-nav-logout]",
    windowSelector: "[data-market-popup]"
  },
  {
    id: "pharmacy",
    openSelector: "[data-pharmacy-popup-open]",
    closeSelector: "[data-pharmacy-popup-close], [data-nav-logout]",
    windowSelector: "[data-pharmacy-popup]"
  },
  {
    id: "druglab",
    openSelector: "[data-druglab-popup-open]",
    closeSelector: "[data-druglab-popup-close], [data-nav-logout]",
    windowSelector: "[data-druglab-popup]"
  },
  {
    id: "factory",
    openSelector: "[data-factory-popup-open]",
    closeSelector: "[data-factory-popup-close], [data-nav-logout]",
    windowSelector: "[data-factory-popup]"
  },
  {
    id: "armory",
    openSelector: "[data-armory-popup-open]",
    closeSelector: "[data-armory-popup-close], [data-nav-logout]",
    windowSelector: "[data-armory-popup]"
  },
  {
    id: "city-events",
    openSelector: "#city-events-open",
    closeSelector: "#events-modal-backdrop, #events-modal-close, [data-nav-logout]",
    windowSelector: "#events-modal"
  },
  {
    id: "bounty",
    openSelector: "[data-bounty-open-trigger]",
    closeSelector: "#bounty-modal-backdrop, #bounty-modal-close, [data-nav-logout]",
    windowSelector: "#bounty-modal"
  },
  {
    id: "boost",
    openSelector: "[data-boost-open-trigger]",
    closeSelector: "#boost-modal-backdrop, #boost-modal-close, [data-nav-logout]",
    windowSelector: "#boost-modal"
  },
  {
    id: "faction-actions",
    openSelector: "[data-faction-actions-open-trigger]",
    closeSelector: "#faction-actions-modal-backdrop, #faction-actions-modal-close, [data-nav-logout]",
    windowSelector: "#faction-actions-modal"
  },
  {
    id: "battle-royale-info",
    openSelector: "[data-br-info-open]",
    closeSelector: "[data-br-info-close], [data-nav-logout]",
    windowSelector: "#battle-royale-info-modal"
  },
  {
    id: "elimination-ai",
    openSelector: "[data-elimination-ai-panel-open]",
    closeSelector: "[data-elimination-ai-panel-close], [data-nav-logout]",
    windowSelector: "[data-elimination-ai-panel]"
  },
  {
    id: "wanted",
    openSelector: "[data-gang-heat]",
    closeSelector: "[data-wanted-popup-close], [data-nav-logout]",
    windowSelector: "[data-wanted-popup]"
  }
]);

const now = () => Date.now();

function safeStorage(windowRef) {
  try {
    return windowRef?.sessionStorage || null;
  } catch {
    return null;
  }
}

function getDefinitionById(id, definitions = GAME_WINDOW_RESTORE_DEFINITIONS) {
  return definitions.find((definition) => definition.id === id) || null;
}

function parseStoredWindow(value, currentTime = now()) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    const id = String(parsed?.id || "").trim();
    const savedAt = Number(parsed?.savedAt || 0);
    if (!id || !Number.isFinite(savedAt) || currentTime - savedAt > RESTORE_MAX_AGE_MS) {
      return null;
    }
    const buildingDetail = parsed?.buildingDetail && typeof parsed.buildingDetail === "object"
      ? {
          districtId: parsed.buildingDetail.districtId ?? null,
          buildingName: String(parsed.buildingDetail.buildingName || "").trim(),
          displayName: String(parsed.buildingDetail.displayName || "").trim()
        }
      : null;
    return { id, savedAt, buildingDetail };
  } catch {
    return null;
  }
}

function isElementVisibleWindow(element) {
  if (!element) {
    return false;
  }
  if (element.hidden) {
    return false;
  }
  if (element.classList?.contains?.("hidden")) {
    return false;
  }
  return true;
}

function getScope(root) {
  return root?.ownerDocument || (typeof document !== "undefined" ? document : null);
}

function readActiveOpenWindowId(root, definitions = GAME_WINDOW_RESTORE_DEFINITIONS) {
  const scope = getScope(root);
  const buildingDetail = scope?.querySelector?.("[data-district-building-detail-popup]:not([hidden])");
  if (isElementVisibleWindow(buildingDetail)) {
    return "building-detail";
  }

  for (const definition of definitions) {
    const element = scope?.querySelector?.(definition.windowSelector);
    if (isElementVisibleWindow(element)) {
      return definition.id;
    }
  }
  return "";
}

function readOpenBuildingDetail(scope) {
  const shell = scope?.querySelector?.("[data-district-building-detail-popup]:not([hidden])");
  if (!isElementVisibleWindow(shell)) {
    return null;
  }

  const buildingName = shell.querySelector?.("[data-district-building-detail-title]")?.textContent?.trim()
    || shell.querySelector?.("[data-district-building-detail-name]")?.textContent?.trim()
    || "";
  return buildingName ? { buildingName, displayName: buildingName } : null;
}

function readStoredWindow(storage) {
  return parseStoredWindow(storage?.getItem?.(STORAGE_KEY) || "");
}

function saveOpenWindow(storage, id, extra = {}) {
  if (!storage || !id) {
    return;
  }
  storage.setItem(STORAGE_KEY, JSON.stringify({ id, savedAt: now(), ...extra }));
}

function clearOpenWindow(storage) {
  storage?.removeItem?.(STORAGE_KEY);
}

function targetMatchesSelector(target, selector) {
  return Boolean(selector && target?.closest?.(selector));
}

function bindOpenCloseTracking(root, storage, definitions = GAME_WINDOW_RESTORE_DEFINITIONS) {
  const scope = getScope(root);
  scope?.addEventListener?.("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    for (const definition of definitions) {
      if (targetMatchesSelector(target, definition.openSelector)) {
        saveOpenWindow(storage, definition.id);
        return;
      }
      if (targetMatchesSelector(target, "[data-nav-logout]")) {
        clearOpenWindow(storage);
        return;
      }
    }
  }, true);

  scope?.addEventListener?.("empire:building-opened", (event) => {
    const detail = event?.detail || {};
    const buildingName = String(detail.buildingName || "").trim();
    if (!buildingName) {
      return;
    }

    saveOpenWindow(storage, "building-detail", {
      buildingDetail: {
        districtId: detail.districtId ?? null,
        buildingName,
        displayName: String(detail.displayName || buildingName).trim()
      }
    });
  });
}

function bindVisibilityTracking(root, storage, definitions = GAME_WINDOW_RESTORE_DEFINITIONS) {
  const scope = getScope(root);
  const observer = new MutationObserver(() => {
    const activeId = readActiveOpenWindowId(root, definitions);
    if (activeId === "building-detail") {
      const previous = readStoredWindow(storage);
      const activeDetail = readOpenBuildingDetail(scope);
      saveOpenWindow(storage, "building-detail", {
        buildingDetail: {
          ...(previous?.buildingDetail || {}),
          ...(activeDetail || {})
        }
      });
    } else if (activeId) {
      saveOpenWindow(storage, activeId);
    }
  });

  scope?.querySelectorAll?.("[data-district-building-detail-popup]")?.forEach((element) => {
    observer.observe(element, {
      attributes: true,
      attributeFilter: ["hidden", "class"]
    });
  });

  for (const definition of definitions) {
    const element = scope?.querySelector?.(definition.windowSelector);
    if (element) {
      observer.observe(element, {
        attributes: true,
        attributeFilter: ["hidden", "class"]
      });
    }
  }

  return observer;
}

function restoreOpenWindow(root, storage, definitions = GAME_WINDOW_RESTORE_DEFINITIONS) {
  const scope = getScope(root);
  const stored = readStoredWindow(storage);
  if (stored?.id === "building-detail") {
    const windowRef = scope?.defaultView || (typeof window !== "undefined" ? window : null);
    const buildingDetail = stored.buildingDetail || {};
    const buildingName = String(buildingDetail.buildingName || buildingDetail.displayName || "").trim();
    if (!buildingName) {
      clearOpenWindow(storage);
      return false;
    }

    windowRef?.setTimeout?.(() => {
      const api = windowRef.EmpireRuntime || windowRef;
      const districtId = buildingDetail.districtId ?? "";
      const opened = districtId
        ? api.openBuildingDetail?.(districtId, buildingName, {
            displayName: buildingDetail.displayName || buildingName,
            preferGenericDetail: true
          })
        : api.openBuildingDetail?.(buildingName, "", {
            displayName: buildingDetail.displayName || buildingName,
            preferGenericDetail: true
          });

      if (!opened) {
        const buildingsButton = scope?.querySelector?.("[data-buildings-popup-open]");
        buildingsButton?.click?.();
      }
    }, RESTORE_DELAY_MS);
    return true;
  }

  const definition = stored ? getDefinitionById(stored.id, definitions) : null;
  if (!definition) {
    clearOpenWindow(storage);
    return false;
  }

  const openButton = scope?.querySelector?.(definition.openSelector);
  if (!openButton || openButton.disabled || openButton.hidden) {
    clearOpenWindow(storage);
    return false;
  }

  const windowRef = scope?.defaultView || (typeof window !== "undefined" ? window : null);
  windowRef?.setTimeout?.(() => {
    const activeId = readActiveOpenWindowId(root, definitions);
    if (!activeId) {
      openButton.click();
    }
  }, RESTORE_DELAY_MS);
  return true;
}

export function initGameWindowRestoreRuntime({
  root = typeof document !== "undefined" ? document.querySelector(PAGE_SELECTOR) : null,
  windowRef = typeof window !== "undefined" ? window : null,
  definitions = GAME_WINDOW_RESTORE_DEFINITIONS
} = {}) {
  if (!root || !windowRef) {
    return null;
  }

  const storage = safeStorage(windowRef);
  if (!storage) {
    return null;
  }

  bindOpenCloseTracking(root, storage, definitions);
  const observer = bindVisibilityTracking(root, storage, definitions);
  restoreOpenWindow(root, storage, definitions);

  return {
    observer,
    readActiveOpenWindowId: () => readActiveOpenWindowId(root, definitions),
    restore: () => restoreOpenWindow(root, storage, definitions)
  };
}

if (typeof document !== "undefined") {
  initGameWindowRestoreRuntime();
}
