function getDocument(scopeElement = null) {
  return scopeElement?.ownerDocument || (typeof document !== "undefined" ? document : null);
}

function createElement(scopeElement, tagName, className = "") {
  const scope = getDocument(scopeElement);
  if (!scope || typeof scope.createElement !== "function") {
    return null;
  }
  const element = scope.createElement(tagName);
  if (className) {
    element.className = className;
  }
  return element;
}

function createStat(scopeElement, row = {}) {
  const stat = createElement(scopeElement, "div", "building-info-card__stat");
  const label = createElement(scopeElement, "span");
  const value = createElement(scopeElement, "strong");
  if (!stat || !label || !value) return null;
  label.textContent = row.label || "";
  value.textContent = row.value || "";
  stat.append(label, value);
  return stat;
}

function createMechanicRow(scopeElement, row = {}) {
  const element = createElement(scopeElement, "div", "district-building-detail-mechanic-row");
  const label = createElement(scopeElement, "span");
  const value = createElement(scopeElement, "strong");
  if (!element || !label || !value) return null;
  label.textContent = row.label || "";
  value.textContent = row.value || "";
  element.dataset.detailRowLabel = normalizeDetailRowLabel(row.label);
  if (row.tone) {
    element.dataset.mechanicTone = String(row.tone);
  }
  element.append(label, value);
  return element;
}

function createEffectCell(scopeElement, effect = "", effectIndex = 0) {
  const element = createElement(scopeElement, "div", "district-building-detail-effect-cell");
  const text = createElement(scopeElement, "strong");
  if (!element || !text) return null;
  const value = typeof effect === "string" ? effect : effect?.text || "";
  const tone = typeof effect === "string" ? "" : String(effect?.tone || "").trim();
  text.textContent = value || "";
  element.dataset.effectIndex = String(effectIndex);
  if (tone) {
    element.dataset.effectTone = tone;
  }
  element.append(text);
  return element;
}

function resolveBuildingDetailBackgroundUrl(scopeElement, imagePath = "") {
  const value = String(imagePath || "").trim();
  if (!value) return "";
  if (/^(?:data|blob|https?):/iu.test(value)) return value;
  const baseUri = getDocument(scopeElement)?.baseURI || "";
  if (!baseUri || typeof URL === "undefined") return value;
  try {
    return new URL(value, baseUri).href;
  } catch {
    return value;
  }
}

const SINGLE_PANEL_BUILDING_DETAIL_TYPES = new Set([
  "apartment-block",
  "garage",
  "recruitment-center",
  "clinic",
  "arcade",
  "school",
  "restaurant",
  "fitness-club",
  "exchange",
  "auto-salon",
  "retail",
  "casino",
  "warehouse",
  "power-plant",
  "recycling-center",
  "street-dealers",
  "convenience-store",
  "smuggling-tunnel",
  "strip-club"
]);

function appendEmptyMessage(parent, text) {
  const empty = createElement(parent, "div", "buildings-popup__empty");
  if (!empty) return;
  empty.textContent = text || "Bez dat.";
  parent.append(empty);
}

export function initBuildingDetailPanel(options = {}) {
  return {
    open: (buildingViewModel, callbacks = {}) => openBuildingDetailPanel(buildingViewModel, callbacks, options),
    close: () => closeBuildingDetailPanel(options.root),
    render: (buildingViewModel, callbacks = {}) => renderBuildingDetailPanel(buildingViewModel, callbacks, options)
  };
}

export function ensureBuildingDetailPanel(root, callbacks = {}, options = {}) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return null;
  }

  const normalizedPopupKey = String(options.popupKey || "default").trim() || "default";
  let shell = Array.from(root.querySelectorAll("[data-district-building-detail-popup]"))
    .find((candidate) => candidate instanceof HTMLElement && candidate.dataset.districtBuildingDetailKey === normalizedPopupKey);
  if (shell instanceof HTMLElement) {
    return shell;
  }

  shell = createElement(root, "div", "district-building-detail-shell");
  if (!shell) return null;
  shell.dataset.districtBuildingDetailPopup = "true";
  shell.dataset.districtBuildingDetailKey = normalizedPopupKey;
  shell.hidden = true;

  const backdrop = createElement(root, "div", "district-building-detail-backdrop");
  if (backdrop) backdrop.dataset.districtBuildingDetailClose = "true";

  const card = createElement(root, "div", "district-building-detail-card building-detail-modal__content");
  if (!card) return shell;
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", "Detail budovy");

  const header = createElement(root, "div", "modal__header");
  const title = createElement(root, "h3", "district-building-detail-title");
  const titleText = createElement(root, "span");
  const titleBadge = createElement(root, "span", "building-detail-title__badge");
  if (titleText) {
    titleText.dataset.districtBuildingDetailTitle = "true";
    titleText.textContent = "Detail budovy";
  }
  if (titleBadge) titleBadge.dataset.districtBuildingDetailBadge = "true";
  if (title) title.append(titleText, titleBadge);

  const collectButton = createElement(root, "button", "building-detail-title__action-btn building-detail-title__action-btn--collect");
  if (collectButton) {
    collectButton.type = "button";
    collectButton.dataset.districtBuildingDetailCollect = "true";
    collectButton.setAttribute("aria-label", "Vybrat výstup budovy");
    collectButton.title = "Vybrat výstup budovy";
    collectButton.textContent = "+";
  }

  const upgradeButton = createElement(root, "button", "building-detail-title__action-btn building-detail-title__action-btn--upgrade");
  if (upgradeButton) {
    upgradeButton.type = "button";
    upgradeButton.dataset.districtBuildingDetailUpgrade = "true";
    upgradeButton.setAttribute("aria-label", "Upgradovat budovu");
    upgradeButton.title = "Upgradovat budovu";
    upgradeButton.textContent = "↑";
  }

  const levelBadge = createElement(root, "span", "building-detail-header-level");
  if (levelBadge) {
    levelBadge.dataset.districtBuildingDetailLevel = "true";
    levelBadge.textContent = "L1";
  }

  const closeButton = createElement(root, "button", "modal__close");
  if (closeButton) {
    closeButton.type = "button";
    closeButton.dataset.districtBuildingDetailClose = "true";
    closeButton.setAttribute("aria-label", "Zavřít detail budovy");
    closeButton.textContent = "✕";
  }

  if (header) header.append(title, collectButton, upgradeButton, levelBadge, closeButton);

  const body = createElement(root, "div", "modal__body district-building-detail-body");
  const tabs = createElement(root, "div", "building-detail-tabs district-building-detail-tabs");
  const statsTab = createElement(root, "button", "building-detail-tabs__btn is-active");
  const infoTab = createElement(root, "button", "building-detail-tabs__btn");
  if (statsTab) {
    statsTab.type = "button";
    statsTab.dataset.districtBuildingDetailTab = "stats";
    statsTab.textContent = "Statistiky";
  }
  if (infoTab) {
    infoTab.type = "button";
    infoTab.dataset.districtBuildingDetailTab = "info";
    infoTab.textContent = "Info";
  }
  if (tabs) tabs.append(statsTab, infoTab);

  const statsPanel = createElement(root, "div", "building-detail-panel district-building-detail-panel");
  if (statsPanel) statsPanel.dataset.districtBuildingDetailPanel = "stats";
  const infoPanel = createElement(root, "div", "building-detail-panel district-building-detail-panel hidden");
  if (infoPanel) infoPanel.dataset.districtBuildingDetailPanel = "info";

  const name = createElement(root, "h4", "district-building-detail-name");
  if (name) name.dataset.districtBuildingDetailName = "true";
  const meta = createElement(root, "p", "district-building-detail-meta");
  if (meta) meta.dataset.districtBuildingDetailMeta = "true";
  const stats = createElement(root, "div", "building-info-card__stats district-building-detail-stats");
  if (stats) stats.dataset.districtBuildingDetailStats = "true";

  const mechanicsSection = createElement(root, "div", "building-info-card__section");
  const mechanicsTitle = createElement(root, "h5");
  const mechanicsList = createElement(root, "div", "building-detail-mechanics district-building-detail-mechanics");
  if (mechanicsTitle) mechanicsTitle.textContent = "Mechaniky";
  if (mechanicsList) mechanicsList.dataset.districtBuildingDetailMechanics = "true";
  if (mechanicsSection) mechanicsSection.append(mechanicsTitle, mechanicsList);

  const effectsSection = createElement(root, "div", "building-info-card__section");
  if (effectsSection) effectsSection.dataset.districtBuildingDetailEffectsSection = "true";
  const effectsTitle = createElement(root, "h5");
  const effects = createElement(root, "div", "building-info-card__effects district-building-detail-effects-list");
  if (effectsTitle) effectsTitle.textContent = "Efekty";
  if (effects) effects.dataset.districtBuildingDetailEffects = "true";
  if (effectsSection) effectsSection.append(effectsTitle, effects);

  const infoSection = createElement(root, "div", "building-info-card building-info-card__section district-building-detail-info-card");
  if (infoSection) infoSection.dataset.districtBuildingDetailInfoSection = "true";
  const infoTitle = createElement(root, "h5");
  const info = createElement(root, "p", "building-detail-info-text");
  if (infoTitle) infoTitle.textContent = "Info";
  if (info) info.dataset.districtBuildingDetailInfo = "true";
  if (infoSection) infoSection.append(infoTitle, info);

  const actionSection = createElement(root, "div", "building-info-card__section");
  if (actionSection) actionSection.dataset.districtBuildingDetailActionSection = "true";
  const actionTitle = createElement(root, "h5");
  const actions = createElement(root, "div", "building-info-card__actions district-building-detail-actions");
  if (actionTitle) actionTitle.textContent = "Speciální akce";
  if (actions) actions.dataset.districtBuildingDetailActions = "true";
  if (actionSection) actionSection.append(actionTitle, actions);

  if (statsPanel) statsPanel.append(name, meta, stats, mechanicsSection, effectsSection, actionSection);
  if (infoPanel) infoPanel.append(infoSection);
  if (body) body.append(tabs, statsPanel, infoPanel);
  card.append(header, body);
  shell.append(backdrop, card);
  root.append(shell);

  const close = () => {
    shell.hidden = true;
    if (typeof callbacks.onClose === "function") callbacks.onClose(shell);
  };

  shell.querySelectorAll("[data-district-building-detail-close]").forEach((element) => {
    element.addEventListener("click", close);
  });
  collectButton?.addEventListener("click", () => {
    if (typeof callbacks.onCollect === "function") callbacks.onCollect(shell);
  });
  upgradeButton?.addEventListener("click", () => {
    if (typeof callbacks.onUpgrade === "function") callbacks.onUpgrade(shell);
  });
  body?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const tabButton = target.closest("[data-district-building-detail-tab]");
    if (tabButton instanceof HTMLElement) {
      syncBuildingDetailTabs(shell, tabButton.dataset.districtBuildingDetailTab || "stats");
      return;
    }
    const actionButton = target.closest("[data-district-building-detail-action-index]");
    if (actionButton instanceof HTMLButtonElement && typeof callbacks.onRunAction === "function") {
      const actionIndex = Number.parseInt(actionButton.dataset.districtBuildingDetailActionIndex || "", 10);
      if (Number.isFinite(actionIndex)) {
        callbacks.onRunAction(shell, {
          shell,
          actionIndex,
          actionId: actionButton.dataset.districtBuildingDetailActionId || "",
          buildingTypeId: actionButton.dataset.districtBuildingDetailBuildingTypeId || "",
          districtId: shell.dataset.districtBuildingDetailDistrictId || "",
          buildingId: shell.dataset.districtBuildingDetailName || "",
          buildingName: shell.dataset.districtBuildingDetailDisplayName || ""
        });
      }
    }
  });
  getDocument(root)?.addEventListener?.("keydown", (event) => {
    if (event.key === "Escape" && !shell.hidden) close();
  });

  return shell;
}

export function syncBuildingDetailTabs(shell, activeTab = "stats") {
  if (!shell) return false;
  const normalizedTab = String(activeTab || "stats");
  shell.dataset.activeDistrictBuildingDetailTab = normalizedTab;
  shell.querySelectorAll?.("[data-district-building-detail-tab]")?.forEach((button) => {
    const isActive = button.dataset.districtBuildingDetailTab === normalizedTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  shell.querySelectorAll?.("[data-district-building-detail-panel]")?.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.districtBuildingDetailPanel !== normalizedTab);
  });
  return true;
}

function moveElementToStart(parent, child) {
  if (!parent || !child || child.parentNode === parent && parent.children?.[0] === child) return;
  if (child.parentNode && child.parentNode !== parent && typeof child.remove === "function") {
    child.remove();
  }
  if (typeof parent.insertBefore === "function") {
    parent.insertBefore(child, parent.firstChild || null);
    return;
  }
  if (typeof parent.prepend === "function") {
    parent.prepend(child);
    return;
  }
  if (typeof parent.replaceChildren === "function") {
    parent.replaceChildren(child, ...(Array.from(parent.children || []).filter((item) => item !== child)));
  }
}

function moveElementToEnd(parent, child) {
  if (!parent || !child) return;
  const children = Array.from(parent.children || []);
  if (child.parentNode === parent && children[children.length - 1] === child) return;
  if (child.parentNode && child.parentNode !== parent && typeof child.remove === "function") {
    child.remove();
  }
  if (child.parentNode === parent && typeof parent.replaceChildren === "function") {
    parent.replaceChildren(...children.filter((item) => item !== child), child);
    return;
  }
  if (typeof parent.append === "function") {
    parent.append(child);
  }
}

function mergeSinglePanelBuildingDetail(shell) {
  const statsPanel = shell?.querySelector?.("[data-district-building-detail-panel='stats']");
  const infoPanel = shell?.querySelector?.("[data-district-building-detail-panel='info']");
  if (!(statsPanel instanceof HTMLElement) || !(infoPanel instanceof HTMLElement)) return;

  const infoSection = shell.querySelector(".district-building-detail-info-card");
  const intro = infoSection?.querySelector?.(".building-detail-info-text");
  statsPanel.querySelectorAll?.(".building-detail-info-text")?.forEach((element) => {
    if (element !== intro && element.parentNode === statsPanel) {
      element.remove?.();
    }
  });
  if (intro instanceof HTMLElement) {
    moveElementToStart(statsPanel, intro);
  }
  if (infoSection instanceof HTMLElement && infoSection.parentNode !== statsPanel) {
    statsPanel.append(infoSection);
  }

  statsPanel.hidden = false;
  statsPanel.classList.remove("hidden");
  statsPanel.classList.add("district-building-detail-panel--merged");
  statsPanel.setAttribute("aria-hidden", "false");
  infoPanel.hidden = true;
  infoPanel.classList.add("hidden");
  infoPanel.setAttribute("aria-hidden", "true");
}

function restoreTabbedBuildingDetail(shell) {
  const statsPanel = shell?.querySelector?.("[data-district-building-detail-panel='stats']");
  const infoPanel = shell?.querySelector?.("[data-district-building-detail-panel='info']");
  const infoSection = shell?.querySelector?.(".district-building-detail-info-card");
  if (statsPanel instanceof HTMLElement) {
    statsPanel.classList.remove("district-building-detail-panel--merged");
  }
  if (infoPanel instanceof HTMLElement && infoSection instanceof HTMLElement && infoSection.parentNode !== infoPanel) {
    infoPanel.append(infoSection);
  }
}

export function renderBuildingStats(buildingViewModel = {}, options = {}) {
  const mount = buildingViewModel.statsMount || options.mount || null;
  if (!mount) return false;
  mount.replaceChildren();
  const rows = Array.isArray(buildingViewModel.stats) ? buildingViewModel.stats : [];
  if (rows.length === 0) {
    appendEmptyMessage(mount, buildingViewModel.emptyStatsText || "Bez statistik.");
    return true;
  }
  mount.replaceChildren(...rows.map((row) => createStat(mount, row)).filter(Boolean));
  return true;
}

export function renderBuildingActions(buildingViewModel = {}, callbacks = {}, options = {}) {
  const mount = buildingViewModel.actionsMount || options.mount || null;
  if (!mount) return false;
  mount.replaceChildren();
  const rows = Array.isArray(buildingViewModel.actions) ? buildingViewModel.actions : [];
  mount.dataset.districtBuildingDetailActionCount = String(rows.length);
  for (const rowView of rows) {
    const row = createElement(mount, "button", "building-info-action-row");
    const title = createElement(mount, "strong", "building-info-action-row__title");
    const description = createElement(mount, "span", "building-info-action-row__desc");
    const cooldown = createElement(mount, "span", "building-info-action-row__cooldown");
    if (!row || !title || !description || !cooldown) continue;
    row.type = "button";
    row.dataset.districtBuildingDetailActionIndex = String(rowView.index ?? "");
    row.dataset.districtBuildingDetailActionId = String(rowView.actionId || "");
    row.dataset.districtBuildingDetailBuildingTypeId = String(rowView.buildingTypeId || "");
    row.dataset.districtBuildingDetailActionState = Number(rowView.cooldownRemainingMs || 0) > 0
      ? "cooldown"
      : rowView.disabled
        ? "disabled"
        : "ready";
    row.dataset.districtBuildingDetailSingleAction = rows.length === 1 ? "true" : "false";
    row.dataset.districtBuildingDetailDisabledTone = String(rowView.disabledTone || "");
    row.disabled = Boolean(rowView.disabled);
    if (rowView.disabledReason) {
      row.title = rowView.disabledReason;
      row.setAttribute("aria-label", `${rowView.title || "Akce"}: ${rowView.disabledReason}`);
    }
    title.textContent = rowView.title || "";
    const inlineDescription = rowView.buttonCostLabel || (rowView.disabled ? rowView.disabledReason : "");
    description.textContent = inlineDescription || "";
    description.hidden = !inlineDescription;
    cooldown.textContent = rowView.cooldownLabel || "";
    row.append(title, description, cooldown);
    mount.append(row);
  }
  return true;
}

export function renderBuildingEmptyState(options = {}) {
  const mount = options.mount || null;
  if (!mount) return false;
  mount.replaceChildren();
  appendEmptyMessage(mount, options.text || "Bez dat budovy.");
  return true;
}

function createBuildingDetailInfoLine(scopeElement, label, value) {
  const row = createElement(scopeElement, "div", "district-building-detail-mechanic-row district-building-detail-info-line");
  const rowLabel = createElement(scopeElement, "span");
  const rowValue = createElement(scopeElement, "strong");
  if (!row || !rowLabel || !rowValue) return null;
  rowLabel.textContent = label;
  rowValue.textContent = value;
  row.dataset.detailRowLabel = normalizeDetailRowLabel(label);
  row.append(rowLabel, rowValue);
  return row;
}

function normalizeDetailRowLabel(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function renderBuildingDetailInfoSection(infoElement, viewModel = {}) {
  const section = infoElement?.closest(".building-info-card__section") || infoElement?.parentElement;
  if (!section) {
    return false;
  }

  const title = viewModel.title ? createElement(section, "h5") : null;
  if (title) title.textContent = viewModel.title;

  const intro = viewModel.intro ? createElement(section, "p", "building-detail-info-text") : null;
  if (intro) intro.textContent = viewModel.intro;

  const infoRows = Array.isArray(viewModel.rows) ? viewModel.rows : [];
  const overview = infoRows.length > 0
    ? createElement(section, "div", "building-detail-mechanics district-building-detail-mechanics district-building-detail-info-grid")
    : null;
  if (overview) {
    overview.replaceChildren(...infoRows
      .map((row) => createBuildingDetailInfoLine(overview, row.label, row.value))
      .filter(Boolean));
  }

  const actionsTitle = viewModel.actionsTitle ? createElement(section, "h5") : null;
  if (actionsTitle) actionsTitle.textContent = viewModel.actionsTitle;

  const actionList = createElement(section, "div", "building-info-card__actions district-building-detail-actions district-building-detail-info-actions");
  for (const action of Array.isArray(viewModel.actions) ? viewModel.actions : []) {
    const row = createElement(section, "div", "building-info-action-row");
    const rowTitle = createElement(section, "strong", "building-info-action-row__title");
    const desc = createElement(section, "span", "building-info-action-row__desc");
    const result = createElement(section, "span", "building-info-action-row__cooldown");
    if (!row || !rowTitle || !desc || !result) continue;
    rowTitle.textContent = action.title;
    desc.textContent = action.description;
    result.textContent = action.result;
    row.append(rowTitle, desc, result);
    actionList?.append(row);
  }

  const children = [title, intro, overview].filter(Boolean);
  if (Array.isArray(viewModel.actions) && viewModel.actions.length > 0) {
    children.push(actionsTitle, actionList);
  }
  section.replaceChildren(...children.filter(Boolean));
  return true;
}

export function renderBuildingDetailPanel(buildingViewModel = {}, callbacks = {}, options = {}) {
  if (!buildingViewModel || typeof buildingViewModel !== "object") {
    return false;
  }
  const shell = buildingViewModel.shell || options.shell || null;
  if (!shell) return false;
  const mechanicsType = String(buildingViewModel.mechanicsType || shell.dataset?.buildingMechanicsType || "").trim();
  const districtType = String(buildingViewModel.districtType || shell.dataset?.buildingDistrictType || "").trim().toLowerCase();
  const isDowntownBuilding = districtType === "downtown" || buildingViewModel.isDowntownBuilding === true;
  const useSinglePanelLayout = SINGLE_PANEL_BUILDING_DETAIL_TYPES.has(mechanicsType);
  const card = shell.querySelector(".district-building-detail-card");

  if (districtType) {
    shell.dataset.buildingDistrictType = districtType;
    if (card instanceof HTMLElement) card.dataset.buildingDistrictType = districtType;
  } else {
    delete shell.dataset.buildingDistrictType;
    if (card instanceof HTMLElement) delete card.dataset.buildingDistrictType;
  }
  shell.classList.toggle("is-downtown-building-detail", isDowntownBuilding);
  if (card instanceof HTMLElement) {
    card.classList.toggle("is-downtown-building-card", isDowntownBuilding);
    const backgroundImagePath = resolveBuildingDetailBackgroundUrl(card, buildingViewModel.backgroundImagePath);
    if (backgroundImagePath) {
      card.style.setProperty("--building-detail-background-image", `url("${backgroundImagePath.replace(/"/g, '\\"')}")`);
      card.dataset.buildingHasCustomBackground = "true";
    } else {
      card.style.removeProperty("--building-detail-background-image");
      delete card.dataset.buildingHasCustomBackground;
    }
  }

  const setText = (selector, value) => {
    const element = shell.querySelector(selector);
    if (element) element.textContent = value || "";
  };

  setText("[data-district-building-detail-title]", buildingViewModel.title || "Detail budovy");
  setText("[data-district-building-detail-badge]", buildingViewModel.badge || "");
  setText("[data-district-building-detail-level]", buildingViewModel.levelLabel || "L1");
  setText("[data-district-building-detail-name]", buildingViewModel.name || buildingViewModel.title || "Budova");
  setText("[data-district-building-detail-meta]", buildingViewModel.meta || "");
  const levelBadge = shell.querySelector("[data-district-building-detail-level]");
  if (levelBadge instanceof HTMLElement) {
    const showLevel = buildingViewModel.showLevel !== false;
    levelBadge.hidden = !showLevel;
    levelBadge.style.display = showLevel ? "" : "none";
  }
  const effectsMount = shell.querySelector("[data-district-building-detail-effects]");
  if (effectsMount) {
    const effects = Array.isArray(buildingViewModel.effects) && buildingViewModel.effects.length > 0
      ? buildingViewModel.effects
      : String(buildingViewModel.effectsLabel || "Žádné aktivní mechaniky.")
        .split(" · ")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => ({ text: item, tone: "" }));
    effectsMount.replaceChildren(...effects.map((item, effectIndex) => createEffectCell(effectsMount, item, effectIndex)).filter(Boolean));
  }

  const collectButton = shell.querySelector("[data-district-building-detail-collect]");
  if (collectButton instanceof HTMLButtonElement) {
    const collect = buildingViewModel.collect || {};
    const showManualCollect = Boolean(collect.visible);
    collectButton.hidden = !showManualCollect;
    collectButton.style.display = showManualCollect ? "" : "none";
    collectButton.setAttribute("aria-hidden", showManualCollect ? "false" : "true");
    collectButton.tabIndex = showManualCollect ? 0 : -1;
    collectButton.disabled = showManualCollect && !collect.enabled;
    collectButton.classList.toggle("is-empty", showManualCollect && !collect.enabled);
    collectButton.title = showManualCollect ? (collect.title || "") : "";
  }

  const upgradeButton = shell.querySelector("[data-district-building-detail-upgrade]");
  if (upgradeButton instanceof HTMLButtonElement) {
    const upgrade = buildingViewModel.upgrade || {};
    const showUpgrade = upgrade.visible !== false;
    upgradeButton.hidden = !showUpgrade;
    upgradeButton.style.display = showUpgrade ? "" : "none";
    upgradeButton.disabled = Boolean(upgrade.disabled);
    upgradeButton.title = upgrade.title || "";
  }

  const statsMount = shell.querySelector("[data-district-building-detail-stats]");
  renderBuildingStats({ ...buildingViewModel, statsMount });

  const mechanicsMount = shell.querySelector("[data-district-building-detail-mechanics]");
  if (mechanicsMount) {
    mechanicsMount.replaceChildren();
    const mechanics = Array.isArray(buildingViewModel.mechanics) ? buildingViewModel.mechanics : [];
    if (mechanics.length === 0) {
      appendEmptyMessage(mechanicsMount, "Bez mechanik.");
    } else {
      mechanicsMount.replaceChildren(...mechanics.map((row) => createMechanicRow(mechanicsMount, row)).filter(Boolean));
    }
  }

  const actionSection = shell.querySelector("[data-district-building-detail-action-section]");
  const statsPanel = shell.querySelector("[data-district-building-detail-panel='stats']");
  const displayActions = useSinglePanelLayout && buildingViewModel.showActionsInSinglePanel !== true ? [] : buildingViewModel.actions || [];
  const hasSpecialActions = Array.isArray(displayActions) && displayActions.length > 0;
  if (actionSection instanceof HTMLElement) {
    actionSection.hidden = !hasSpecialActions;
    if (hasSpecialActions) {
      if (!actionSection.isConnected && statsPanel instanceof HTMLElement) statsPanel.append(actionSection);
    } else {
      actionSection.remove();
    }
  }
  renderBuildingActions({
    actionsMount: shell.querySelector("[data-district-building-detail-actions]"),
    actions: displayActions
  }, callbacks);

  const tabs = shell.querySelector(".district-building-detail-tabs");
  if (tabs instanceof HTMLElement) {
    tabs.hidden = useSinglePanelLayout;
    tabs.style.display = useSinglePanelLayout ? "none" : "";
    tabs.setAttribute("aria-hidden", useSinglePanelLayout ? "true" : "false");
  }
  shell.classList.toggle("is-building-detail-single-panel", useSinglePanelLayout);
  if (useSinglePanelLayout) {
    shell.dataset.activeDistrictBuildingDetailTab = "all";
    mergeSinglePanelBuildingDetail(shell);
  } else {
    restoreTabbedBuildingDetail(shell);
    syncBuildingDetailTabs(shell, shell.dataset.activeDistrictBuildingDetailTab === "all" ? "stats" : shell.dataset.activeDistrictBuildingDetailTab || "stats");
  }
  if (hasSpecialActions && actionSection instanceof HTMLElement && statsPanel instanceof HTMLElement) {
    moveElementToEnd(statsPanel, actionSection);
  }
  shell.hidden = false;
  return true;
}

export function openBuildingDetailPanel(buildingViewModel = {}, callbacks = {}, options = {}) {
  const root = buildingViewModel.root || options.root || null;
  const shell = buildingViewModel.shell || ensureBuildingDetailPanel(root, callbacks, options);
  if (!shell) return null;
  renderBuildingDetailPanel({ ...buildingViewModel, shell }, callbacks, options);
  return shell;
}

export function closeBuildingDetailPanel(root = null) {
  const scope = root || (typeof document !== "undefined" ? document : null);
  if (!scope?.querySelectorAll) return false;
  scope.querySelectorAll("[data-district-building-detail-popup]").forEach((shell) => {
    shell.hidden = true;
  });
  return true;
}

if (typeof window !== "undefined") {
  window.EmpireBuildingDetailPanel = {
    initBuildingDetailPanel,
    openBuildingDetailPanel,
    closeBuildingDetailPanel,
    renderBuildingDetailPanel,
    renderBuildingStats,
    renderBuildingActions,
    renderBuildingDetailInfoSection,
    renderBuildingEmptyState,
    ensureBuildingDetailPanel,
    syncBuildingDetailTabs
  };
}
