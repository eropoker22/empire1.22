import { closeOverlay, openOverlay } from "./legacyOverlayCoordinator.js";
import { getCurrentPlayerId, getLeaderboardPlayers } from "../features/leaderboard.js";
import { leaveMembership, loadLobbyOverview, logoutAccount } from "../player-entry-client.js";

function isHtmlElement(element) {
  const view = element?.ownerDocument?.defaultView || (typeof window !== "undefined" ? window : null);
  return Boolean(view?.HTMLElement && element instanceof view.HTMLElement);
}

function showOverlay(element, options = {}) {
  if (!isHtmlElement(element)) {
    return false;
  }
  openOverlay(element, {
    type: "modal",
    ariaModal: true,
    ...options
  });
  element.hidden = false;
  element.classList.remove("hidden");
  return true;
}

function hideOverlay(element, options = {}) {
  if (!isHtmlElement(element)) {
    return false;
  }
  element.classList.add("hidden");
  element.hidden = true;
  closeOverlay(element, options);
  return true;
}

export function createRuntimePopupBinders(deps = {}) {
  const {
    NAV_SETTINGS_SELECTOR = '',
    SETTINGS_MODAL_SELECTOR = '',
    SETTINGS_MODAL_BACKDROP_SELECTOR = '',
    SETTINGS_MODAL_CLOSE_SELECTOR = '',
    SETTINGS_SAVE_SELECTOR = '',
    SETTINGS_MAP_BORDERS_SELECTOR = '',
    SETTINGS_MAP_ALLIANCE_SYMBOLS_SELECTOR = '',
    SETTINGS_MAP_REDUCED_EFFECTS_SELECTOR = '',
    SETTINGS_MAP_VISIBILITY_SELECTOR = '',
    SETTINGS_LANGUAGE_SELECTOR = '',
    PLAYER_PROFILE_OPEN_SELECTOR = '',
    PLAYER_POPUP_SELECTOR = '',
    PLAYER_POPUP_CARD_SELECTOR = '',
    PLAYER_POPUP_CLOSE_SELECTOR = '',
    PLAYER_POPUP_AVATAR_SELECTOR = '',
    PLAYER_POPUP_AVATAR_FALLBACK_SELECTOR = '',
    PLAYER_POPUP_IDENTITY_SELECTOR = '',
    PLAYER_POPUP_FACTION_SELECTOR = '',
    PLAYER_POPUP_SERVER_SELECTOR = '',
    PLAYER_POPUP_EMPIRE_SCORE_SELECTOR = '',
    PLAYER_POPUP_CLEAN_MONEY_SELECTOR = '',
    PLAYER_POPUP_DIRTY_MONEY_SELECTOR = '',
    PLAYER_POPUP_INFLUENCE_SELECTOR = '',
    PLAYER_POPUP_HEAT_SELECTOR = '',
    PLAYER_POPUP_PROTECTION_SELECTOR = '',
    PLAYER_POPUP_GANG_SELECTOR = '',
    PLAYER_POPUP_ALLIANCE_SELECTOR = '',
    PLAYER_POPUP_DISTRICTS_SELECTOR = '',
    ALLIANCE_POPUP_OPEN_SELECTOR = '',
    ALLIANCE_POPUP_SELECTOR = '',
    ALLIANCE_POPUP_CLOSE_SELECTOR = '',
    STORAGE_POPUP_OPEN_SELECTOR = '',
    STORAGE_POPUP_SELECTOR = '',
    STORAGE_POPUP_CLOSE_SELECTOR = '',
    NAV_LOGOUT_SELECTOR = '',
    TOPBAR_SPY_PILL_SELECTOR = '',
    TOPBAR_SPY_VALUE_SELECTOR = '',
    CURRENT_PLAYER_ID = 'current-player',
    FACTION_CATALOG = {},
    normalizeMapVisibilityMode = (value) => value || 'all',
    getSettingsState = () => ({}),
    applySettingsState = () => {},
    getDisplayedResourceSnapshot = () => ({}),
    getStoredRegistration = () => null,
    clearLegacyState = () => {},
    clearAccountIdentity = () => {},
    leaveActiveServerRegistration = () => {},
    getLaunchPlayerAvatar = () => '',
    getCurrentPlayerDistrictSourceSnapshot = () => ({ districtCount: 0 }),
    syncCurrentPlayerDistrictCountDisplays = () => {},
    getResolvedGangState = () => ({}),
    getLaunchPlayerColor = () => '#67e1ff',
    createPlayerProfileViewModel = (value) => value,
    resolveRuntimeAssetUrl = (value) => value,
    formatGangHeatProtectionLabel = () => '',
    renderPlayerProfilePanel = () => {},
    renderStorageList = () => {},
    renderSpyResourceState = () => {},
    getResolvedWeaponInventory = () => ({}),
    getResolvedMaterialInventory = () => ({}),
    getResolvedDrugInventory = () => ({}),
    getStoredFactorySupplies = () => ({}),
    getServerStorageSummary = () => null,
    now = () => Date.now(),
    loadLobbyOverviewRequest = loadLobbyOverview,
    leaveMembershipRequest = leaveMembership,
    logoutAccountRequest = logoutAccount,
    gameplayLogoutEndpoint = "/api/gameplay-slice/logout",
    windowRef = typeof window !== 'undefined' ? window : null
  } = deps;

function bindSettingsModal(root) {
    if (!root) {
      return;
    }
  const scope = root.ownerDocument || document;
  const openButtons = Array.from(scope.querySelectorAll(NAV_SETTINGS_SELECTOR));
  const modal = scope.querySelector(SETTINGS_MODAL_SELECTOR);
  const backdrop = scope.querySelector(SETTINGS_MODAL_BACKDROP_SELECTOR);
  const closeButton = scope.querySelector(SETTINGS_MODAL_CLOSE_SELECTOR);
  const saveButton = scope.querySelector(SETTINGS_SAVE_SELECTOR);
  const mapBordersInput = scope.querySelector(SETTINGS_MAP_BORDERS_SELECTOR);
  const mapAllianceSymbolsInput = scope.querySelector(SETTINGS_MAP_ALLIANCE_SYMBOLS_SELECTOR);
  const mapReducedEffectsInput = scope.querySelector(SETTINGS_MAP_REDUCED_EFFECTS_SELECTOR);
  const mapVisibilitySelect = scope.querySelector(SETTINGS_MAP_VISIBILITY_SELECTOR);
  const languageSelect = scope.querySelector(SETTINGS_LANGUAGE_SELECTOR);

  if (
    openButtons.length === 0
    || !(modal instanceof HTMLElement)
    || !(saveButton instanceof HTMLButtonElement)
    || !(mapBordersInput instanceof HTMLInputElement)
    || !(mapAllianceSymbolsInput instanceof HTMLInputElement)
    || !(mapReducedEffectsInput instanceof HTMLInputElement)
    || !(mapVisibilitySelect instanceof HTMLSelectElement)
    || !(languageSelect instanceof HTMLSelectElement)
  ) {
    return;
  }

  let settingsSnapshot = null;
  const mobileMedia = window.matchMedia("(max-width: 720px)");

  const syncMobileSettingsBackdropState = (open) => {
    scope.body?.classList.toggle("mobile-settings-modal-open", Boolean(open) && mobileMedia.matches);
  };

  const setImportantStyle = (element, property, value) => {
    if (!(element instanceof HTMLElement)) return;
    element.style.setProperty(property, value, "important");
  };

  const applyOpaqueMobileSettingsStyles = () => {
    if (!mobileMedia.matches) return;
    setImportantStyle(modal, "background", "#01040b");
    setImportantStyle(modal, "background-color", "#01040b");
    setImportantStyle(modal, "background-image", "none");
    setImportantStyle(modal, "opacity", "1");
    setImportantStyle(modal, "visibility", "visible");
    setImportantStyle(modal, "pointer-events", "auto");
    setImportantStyle(modal, "z-index", "9999");

    if (backdrop instanceof HTMLElement) {
      setImportantStyle(backdrop, "background", "#01040b");
      setImportantStyle(backdrop, "background-color", "#01040b");
      setImportantStyle(backdrop, "background-image", "none");
      setImportantStyle(backdrop, "opacity", "1");
      setImportantStyle(backdrop, "visibility", "visible");
      setImportantStyle(backdrop, "pointer-events", "auto");
      setImportantStyle(backdrop, "backdrop-filter", "none");
      setImportantStyle(backdrop, "-webkit-backdrop-filter", "none");
    }

    const content = modal.querySelector(".settings-modal__content");
    setImportantStyle(content, "background", "#030814");
    setImportantStyle(content, "background-color", "#030814");
    setImportantStyle(content, "background-image", "none");
    setImportantStyle(content, "opacity", "1");
    setImportantStyle(content, "visibility", "visible");
    setImportantStyle(content, "pointer-events", "auto");
    setImportantStyle(content, "animation", "none");

    const header = modal.querySelector(".settings-modal__content > .modal__header");
    setImportantStyle(header, "background", "#061123");
    setImportantStyle(header, "background-color", "#061123");
    setImportantStyle(header, "background-image", "none");
    setImportantStyle(header, "opacity", "1");
    setImportantStyle(header, "visibility", "visible");
    setImportantStyle(header, "pointer-events", "auto");
    setImportantStyle(header, "animation", "none");

    const body = modal.querySelector(".settings-modal__body");
    setImportantStyle(body, "background", "#020610");
    setImportantStyle(body, "background-color", "#020610");
    setImportantStyle(body, "background-image", "none");
    setImportantStyle(body, "opacity", "1");
    setImportantStyle(body, "visibility", "visible");
    setImportantStyle(body, "pointer-events", "auto");
    setImportantStyle(body, "animation", "none");

    modal.querySelectorAll(".settings-modal__row").forEach((row) => {
      setImportantStyle(row, "background", "#071426");
      setImportantStyle(row, "background-color", "#071426");
      setImportantStyle(row, "background-image", "none");
      setImportantStyle(row, "opacity", "1");
      setImportantStyle(row, "visibility", "visible");
      setImportantStyle(row, "animation", "none");
    });

    modal.querySelectorAll(".settings-modal__actions, .settings-modal__section-title, .settings-modal__save-btn").forEach((element) => {
      setImportantStyle(element, "opacity", "1");
      setImportantStyle(element, "visibility", "visible");
      setImportantStyle(element, "animation", "none");
    });

    modal.querySelectorAll(".settings-modal__select select").forEach((select) => {
      setImportantStyle(select, "background", "#030812");
      setImportantStyle(select, "background-color", "#030812");
      setImportantStyle(select, "background-image", "none");
      setImportantStyle(select, "opacity", "1");
      setImportantStyle(select, "visibility", "visible");
    });
  };

  const applySettingsToForm = (settings) => {
    mapBordersInput.checked = Boolean(settings.mapDistrictBorders);
    mapAllianceSymbolsInput.checked = Boolean(settings.mapAllianceSymbols);
    mapReducedEffectsInput.checked = Boolean(settings.reducedMapEffects);
    mapVisibilitySelect.value = normalizeMapVisibilityMode(settings.mapVisibilityMode);
    languageSelect.value = settings.language === "en" ? "en" : "cs";
  };

  const captureFormSettings = () => ({
    mapDistrictBorders: Boolean(mapBordersInput.checked),
    mapAllianceSymbols: Boolean(mapAllianceSymbolsInput.checked),
    reducedMapEffects: Boolean(mapReducedEffectsInput.checked),
    mapVisibilityMode: normalizeMapVisibilityMode(mapVisibilitySelect.value),
    language: languageSelect.value === "en" ? "en" : "cs"
  });

  const previewSettings = () => {
    applySettingsState(captureFormSettings());
  };

  const closeModal = ({ revert = false } = {}) => {
    if (revert && settingsSnapshot) {
      applySettingsState(settingsSnapshot);
    }
    settingsSnapshot = null;
    hideOverlay(modal);
    syncMobileSettingsBackdropState(false);
  };

  const openModal = () => {
    settingsSnapshot = getSettingsState();
    applySettingsToForm(settingsSnapshot);
    showOverlay(modal, { restoreFocusOnClose: false });
    syncMobileSettingsBackdropState(true);
    applyOpaqueMobileSettingsStyles();
  };

  const saveSettings = () => {
    applySettingsState(captureFormSettings());
    settingsSnapshot = null;
    hideOverlay(modal);
    syncMobileSettingsBackdropState(false);
  };

  for (const button of openButtons) {
    button.addEventListener("click", openModal);
  }

  mapBordersInput.addEventListener("change", previewSettings);
  mapAllianceSymbolsInput.addEventListener("change", previewSettings);
  mapReducedEffectsInput.addEventListener("change", previewSettings);
  mapVisibilitySelect.addEventListener("change", previewSettings);
  languageSelect.addEventListener("change", previewSettings);
  backdrop?.addEventListener("click", () => closeModal({ revert: true }));
  closeButton?.addEventListener("click", () => closeModal({ revert: true }));
  saveButton.addEventListener("click", saveSettings);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      closeModal({ revert: true });
    }
  });
}

function bindPlayerProfilePopup(root) {
    if (!root) {
      return;
    }
  const scope = root.ownerDocument || document;
  const openButton = scope.querySelector(PLAYER_PROFILE_OPEN_SELECTOR);
  const popup = scope.querySelector(PLAYER_POPUP_SELECTOR);
  const popupCard = scope.querySelector(PLAYER_POPUP_CARD_SELECTOR);
  const closeElements = Array.from(scope.querySelectorAll(PLAYER_POPUP_CLOSE_SELECTOR));
  const popupAvatar = scope.querySelector(PLAYER_POPUP_AVATAR_SELECTOR);
  const popupAvatarFallback = scope.querySelector(PLAYER_POPUP_AVATAR_FALLBACK_SELECTOR);
  const popupName = scope.querySelector("[data-player-popup-name]");
  const popupIdentity = scope.querySelector(PLAYER_POPUP_IDENTITY_SELECTOR);
  const popupFaction = scope.querySelector(PLAYER_POPUP_FACTION_SELECTOR);
  const popupServer = scope.querySelector(PLAYER_POPUP_SERVER_SELECTOR);
  const popupEmpireScore = scope.querySelector(PLAYER_POPUP_EMPIRE_SCORE_SELECTOR);
  const popupCleanMoney = scope.querySelector(PLAYER_POPUP_CLEAN_MONEY_SELECTOR);
  const popupDirtyMoney = scope.querySelector(PLAYER_POPUP_DIRTY_MONEY_SELECTOR);
  const popupInfluence = scope.querySelector(PLAYER_POPUP_INFLUENCE_SELECTOR);
  const popupHeat = scope.querySelector(PLAYER_POPUP_HEAT_SELECTOR);
  const popupProtection = scope.querySelector(PLAYER_POPUP_PROTECTION_SELECTOR);
  const popupGang = scope.querySelector(PLAYER_POPUP_GANG_SELECTOR);
  const popupAlliance = scope.querySelector(PLAYER_POPUP_ALLIANCE_SELECTOR);
  const popupDistricts = scope.querySelector(PLAYER_POPUP_DISTRICTS_SELECTOR);

  if (!openButton || !popup || !popupCard || closeElements.length === 0) {
    return;
  }

  const syncPlayerProfileResources = () => {
    const displaySnapshot = getDisplayedResourceSnapshot();
    const registration = getStoredRegistration();
    const faction = registration?.factionId && FACTION_CATALOG[registration.factionId]
      ? FACTION_CATALOG[registration.factionId]
      : null;
    const avatarSrc = getLaunchPlayerAvatar(CURRENT_PLAYER_ID);
    const districtCount = getCurrentPlayerDistrictSourceSnapshot().districtCount;
    const allianceLabel = windowRef?.empireStreetsAllianceState?.getActiveAlliance?.()?.name
      || root.querySelector("[data-gang-alliance]")?.textContent?.trim()
      || "Žádná";
    const accentColor = getLaunchPlayerColor(CURRENT_PLAYER_ID);

    syncCurrentPlayerDistrictCountDisplays(root, districtCount);

    const gangState = getResolvedGangState();
    const leaderboardPlayers = getLeaderboardPlayers();
    const currentPlayerId = getCurrentPlayerId();
    const currentLeaderboardEntry = leaderboardPlayers.find((entry) => (
      entry?.isCurrentPlayer || String(entry?.id || "") === currentPlayerId
    ));
    const empireScore = Number(currentLeaderboardEntry?.empireScore || 0);
    const profileViewModel = createPlayerProfileViewModel({
      registration,
      faction,
      displaySnapshot,
      gangState,
      districtCount,
      empireScore,
      allianceLabel,
      avatarSrc,
      accentColor,
      assetResolver: resolveRuntimeAssetUrl,
      protectionLabel: formatGangHeatProtectionLabel(gangState.policeRaidProtectionUntil)
    });
    renderPlayerProfilePanel({
      openButton,
      card: popupCard,
      avatar: popupAvatar,
      avatarFallback: popupAvatarFallback,
      name: popupName,
      identity: popupIdentity,
      faction: popupFaction,
      server: popupServer,
      empireScore: popupEmpireScore,
      cleanMoney: popupCleanMoney,
      dirtyMoney: popupDirtyMoney,
      influence: popupInfluence,
      heat: popupHeat,
      protection: popupProtection,
      gang: popupGang,
      alliance: popupAlliance,
      districts: popupDistricts
    }, profileViewModel);
  };

  const openPopup = () => {
    syncPlayerProfileResources();
    showOverlay(popup, { focusTarget: popupCard, restoreFocusOnClose: false });
  };

  const closePopup = () => {
    hideOverlay(popup, { restoreFocus: false });
  };

  openButton.addEventListener("click", openPopup);

  for (const closeElement of closeElements) {
    closeElement.addEventListener("click", closePopup);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !popup.hidden) {
      closePopup();
    }
  });

  document.addEventListener("empire:gang-state-changed", syncPlayerProfileResources);
  document.addEventListener("empire:police-state-changed", syncPlayerProfileResources);
  document.addEventListener("empire:economy-state-changed", syncPlayerProfileResources);
  document.addEventListener("empire:world-state-changed", syncPlayerProfileResources);
  document.addEventListener("empire:runtime-refresh", syncPlayerProfileResources);
  windowRef?.addEventListener("empire:alliance-state-changed", syncPlayerProfileResources);

  syncPlayerProfileResources();
}

function bindAlliancePopup(root) {
    if (!root) {
      return;
    }
  const openButton = root.querySelector(ALLIANCE_POPUP_OPEN_SELECTOR);
  const popup = root.querySelector(ALLIANCE_POPUP_SELECTOR);
  const closeElements = Array.from(root.querySelectorAll(ALLIANCE_POPUP_CLOSE_SELECTOR));

  if (!openButton || !popup || closeElements.length === 0) {
    return;
  }

  const openPopup = () => {
    showOverlay(popup, { restoreFocusOnClose: false });
  };

  const closePopup = () => {
    hideOverlay(popup, { restoreFocus: false });
  };

  openButton.addEventListener("click", openPopup);

  for (const closeElement of closeElements) {
    closeElement.addEventListener("click", closePopup);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !popup.hidden) {
      closePopup();
    }
  });
}

function bindStoragePopup(root) {
    if (!root) {
      return;
    }
  const scope = root.ownerDocument || document;
  const openButton = scope.querySelector(STORAGE_POPUP_OPEN_SELECTOR);
  const popup = root.querySelector(STORAGE_POPUP_SELECTOR);
  const popupCard = popup?.querySelector(".storage-popup-card");
  const closeElements = Array.from(root.querySelectorAll(STORAGE_POPUP_CLOSE_SELECTOR));

  if (!openButton || !popup || closeElements.length === 0) {
    return;
  }

  const renderStorageInventory = () => {
    renderStorageList({
      summary: getServerStorageSummary(),
      weapons: getResolvedWeaponInventory(),
      materials: getResolvedMaterialInventory(),
      drugs: getResolvedDrugInventory(),
      factorySupplies: getStoredFactorySupplies()
    }, { root: scope });
  };

  const moveStoragePopupToTopLayer = () => {
    const body = popup.ownerDocument?.body || null;
    if (!body || popup.parentElement === body) {
      return false;
    }
    body.append(popup);
    return true;
  };

  const openPopup = () => {
    moveStoragePopupToTopLayer();
    renderStorageInventory();
    showOverlay(popup, {
      focusTarget: popupCard,
      restoreFocusOnClose: false,
      alwaysOnTop: true
    });
  };

  const closePopup = () => {
    hideOverlay(popup, { restoreFocus: false });
  };

  openButton.addEventListener("click", openPopup);
  popupCard?.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  popupCard?.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  for (const closeElement of closeElements) {
    closeElement.addEventListener("click", closePopup);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !popup.hidden) {
      closePopup();
    }
  });

  scope.addEventListener?.("empire:gameplay-slice-rendered", () => {
    if (!popup.hidden) {
      renderStorageInventory();
    }
  });

  renderStorageInventory();
}

function bindLogoutActions(root) {
  if (!root) {
    return;
  }
  const scope = root.ownerDocument || document;
  const buttons = Array.from(scope.querySelectorAll(NAV_LOGOUT_SELECTOR));
  if (buttons.length === 0) {
    return;
  }
  const modal = scope.querySelector("[data-game-lobby-modal]");
  if (!modal) {
    for (const button of buttons) button.addEventListener("click", () => navigate("./lobby.html"));
    return;
  }
  scope.body?.append(modal);
  const actionButtons = Array.from(modal.querySelectorAll("[data-game-lobby-action]"));
  const closeNodes = Array.from(modal.querySelectorAll("[data-game-lobby-close]"));
  const leaveButton = modal.querySelector('[data-game-lobby-action="leave-server"]');
  const cooldown = modal.querySelector("[data-game-leave-cooldown]");
  const errorMessage = modal.querySelector("[data-game-lobby-error]");
  let updateTimer = null;
  let busy = false;
  let previouslyFocused = null;
  let activeMembership = null;
  let membershipObservedAt = 0;

  const registration = () => getStoredRegistration() || {};
  const mode = () => String(registration().activeServerMode || registration().serverMode || "").trim().toLowerCase();
  const href = (page) => ["free", "war"].includes(mode()) ? `./${page}.html?mode=${mode()}` : `./${page}.html`;
  const leaveAvailability = () => {
    const serverRemaining = Number(activeMembership?.earlyLeaveRemainingMs || 0);
    const elapsed = membershipObservedAt > 0 ? Math.max(0, now() - membershipObservedAt) : 0;
    const preStart = Boolean(activeMembership?.canLeaveEarly && !activeMembership?.earlyLeaveDeadline);
    return {
      allowed: Boolean(activeMembership?.canLeaveEarly) && (preStart || serverRemaining - elapsed > 0),
      preStart,
      remainingMs: Math.max(0, serverRemaining - elapsed)
    };
  };
  const formatCooldown = (remainingMs) => {
    const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };
  const updateLeaveButton = () => {
    const availability = leaveAvailability();
    if (leaveButton) leaveButton.disabled = busy || !availability.allowed;
    if (cooldown) cooldown.textContent = availability.allowed
      ? availability.preStart ? "Dostupné před startem serveru" : `Dostupné ještě ${formatCooldown(availability.remainingMs)}`
      : "Možnost odhlášení ze serveru vypršela";
  };
  const setError = (message = "") => {
    if (errorMessage) errorMessage.textContent = message;
  };
  const setBusy = (value) => {
    busy = value;
    for (const button of actionButtons) button.disabled = value;
    updateLeaveButton();
  };
  const close = () => {
    if (busy) return;
    hideOverlay(modal);
    scope.body?.classList?.remove("is-game-lobby-modal-open");
    if (updateTimer !== null) windowRef?.clearInterval?.(updateTimer);
    updateTimer = null;
    previouslyFocused?.focus?.();
  };
  const refreshMembership = async () => {
    const overview = await loadLobbyOverviewRequest();
    activeMembership = overview.activeBlockingMembership;
    membershipObservedAt = now();
    updateLeaveButton();
  };
  const open = (event) => {
    event?.preventDefault?.();
    previouslyFocused = scope.activeElement;
    setError();
    showOverlay(modal, { trigger: event?.currentTarget, alwaysOnTop: true });
    scope.body?.classList?.add("is-game-lobby-modal-open");
    updateLeaveButton();
    void refreshMembership().catch(() => {
      activeMembership = null;
      updateLeaveButton();
    });
    if (updateTimer === null) updateTimer = windowRef?.setInterval?.(updateLeaveButton, 1000) ?? null;
    actionButtons[0]?.focus?.();
  };
  const revokeGameplaySession = async () => {
    if (typeof windowRef?.fetch !== "function") throw new Error("Odhlášení teď není dostupné.");
    const response = await windowRef.fetch(gameplayLogoutEndpoint, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: "{}"
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.accepted !== true) throw new Error("Session se nepodařilo bezpečně ukončit.");
  };
  const run = async (action) => {
    if (busy) return;
    if (action === "lobby") {
      navigate(href("lobby"));
      return;
    }
    if (action === "leave-server" && !leaveAvailability().allowed) {
      updateLeaveButton();
      return;
    }
    setBusy(true);
    setError();
    try {
      if (action === "leave-server") {
        if (!activeMembership?.membershipId) throw new Error("Aktivní membership se nepodařilo načíst.");
        await leaveMembershipRequest(activeMembership.membershipId);
        await revokeGameplaySession();
        const lobbyHref = href("lobby");
        navigate(lobbyHref);
      } else {
        await revokeGameplaySession();
        await logoutAccountRequest();
        navigate(href("login"));
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Akci se nepodařilo dokončit.");
      setBusy(false);
    }
  };

  for (const actionButton of actionButtons) {
    actionButton.addEventListener("click", () => void run(actionButton.dataset.gameLobbyAction));
  }
  for (const closeNode of closeNodes) closeNode.addEventListener("click", close);
  for (const button of buttons) {
    button.addEventListener("click", open);
  }
  scope.addEventListener?.("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) close();
  });

  function navigate(nextHref) {
    if (windowRef?.location) windowRef.location.href = nextHref;
  }
}

function bindSpyResourceToggle(root) {
    if (!root) {
      return;
    }
  const scope = root.ownerDocument || document;
  const spyPill = scope.querySelector(TOPBAR_SPY_PILL_SELECTOR);
  const spyValue = scope.querySelector(TOPBAR_SPY_VALUE_SELECTOR);

  if (!spyPill || !spyValue) {
    return;
  }

  if (!spyPill.dataset.resourceMode) {
    spyPill.dataset.resourceMode = "influence";
  }

  if (!spyValue.dataset.influenceValue) {
    spyValue.dataset.influenceValue = spyValue.textContent || "0";
  }

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const trigger = target.closest(TOPBAR_SPY_PILL_SELECTOR);

    if (!(trigger instanceof HTMLButtonElement) || trigger !== spyPill) {
      return;
    }

    event.preventDefault();
    spyPill.dataset.resourceMode = spyPill.dataset.resourceMode === "spy" ? "influence" : "spy";
    renderSpyResourceState(root, { animate: true });
  });

  renderSpyResourceState(root, { instant: true });
}

  return {
    bindAlliancePopup,
    bindLogoutActions,
    bindPlayerProfilePopup,
    bindSettingsModal,
    bindSpyResourceToggle,
    bindStoragePopup
  };
}

