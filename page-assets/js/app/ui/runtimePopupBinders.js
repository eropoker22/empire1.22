import { closeOverlay, openOverlay } from "./legacyOverlayCoordinator.js";

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
    PLAYER_POPUP_START_DISTRICT_SELECTOR = '',
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
    getLaunchPlayerAvatar = () => '',
    getCurrentPlayerDistrictSourceSnapshot = () => ({ districtCount: 0 }),
    getCurrentPlayerLaunchStartDistrictId = () => 0,
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
  const popupStartDistrict = scope.querySelector(PLAYER_POPUP_START_DISTRICT_SELECTOR);
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
    const startDistrictId = Number(registration?.startDistrictId || 0) || getCurrentPlayerLaunchStartDistrictId();
    const allianceLabel = windowRef?.empireStreetsAllianceState?.getActiveAlliance?.()?.name
      || root.querySelector("[data-gang-alliance]")?.textContent?.trim()
      || "Žádná";
    const accentColor = getLaunchPlayerColor(CURRENT_PLAYER_ID);

    syncCurrentPlayerDistrictCountDisplays(root, districtCount);

    const gangState = getResolvedGangState();
    const profileViewModel = createPlayerProfileViewModel({
      registration,
      faction,
      displaySnapshot,
      gangState,
      districtCount,
      startDistrictId,
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
      startDistrict: popupStartDistrict,
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

  const logout = () => {
    const mode = String(getStoredRegistration()?.serverMode || "").trim().toLowerCase();
    clearLegacyState();
    const nextHref = mode === "war" || mode === "free"
      ? `./login.html?mode=${mode}`
      : "./login.html";

    if (windowRef?.location) {
      windowRef.location.href = nextHref;
    }
  };

  for (const button of buttons) {
    button.addEventListener("click", logout);
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

