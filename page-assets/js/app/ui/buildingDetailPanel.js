import { closeOverlay, openOverlay } from "./legacyOverlayCoordinator.js";

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

const BUILDING_DETAIL_SHELL_CLASS_PREFIX = "building-detail--";
const BUILDING_DETAIL_CARD_CLASS_PREFIX = "building-detail-card--";

function normalizeBuildingDetailClassToken(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "") || "generic";
}

function replacePrefixedClass(element, prefix, nextClass) {
  if (!element) return;
  const classes = String(element.className || "")
    .split(/\s+/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !item.startsWith(prefix));
  if (nextClass) classes.push(nextClass);
  element.className = Array.from(new Set(classes)).join(" ");
}

function syncBuildingDetailIdentityHooks(shell, card, mechanicsType = "") {
  const token = normalizeBuildingDetailClassToken(mechanicsType);
  if (shell) {
    shell.dataset.buildingMechanicsType = token;
    shell.dataset.buildingDetailCssHook = `${BUILDING_DETAIL_SHELL_CLASS_PREFIX}${token}`;
    replacePrefixedClass(shell, BUILDING_DETAIL_SHELL_CLASS_PREFIX, `${BUILDING_DETAIL_SHELL_CLASS_PREFIX}${token}`);
  }
  if (card) {
    card.dataset.buildingMechanicsType = token;
    card.dataset.buildingDetailCssHook = `${BUILDING_DETAIL_CARD_CLASS_PREFIX}${token}`;
    replacePrefixedClass(card, BUILDING_DETAIL_CARD_CLASS_PREFIX, `${BUILDING_DETAIL_CARD_CLASS_PREFIX}${token}`);
  }
  return token;
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

function isCooldownOnlyActionDescription(value = "") {
  const normalized = String(value || "").trim();
  return /^(?:cooldown|zbývá)\b/iu.test(normalized);
}

function resolveActionButtonInlineDescription(rowView = {}) {
  const fallback = rowView.buttonCostLabel || rowView.rewardSummary || "";
  if (!rowView.disabled) {
    return fallback;
  }
  const disabledReason = String(rowView.disabledReason || "").trim();
  if (String(rowView.cooldownLabel || "").trim() && isCooldownOnlyActionDescription(disabledReason)) {
    return fallback;
  }
  return disabledReason || fallback;
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

  const headerTools = createElement(root, "div", "district-building-detail-header-tools");
  if (headerTools) headerTools.dataset.districtBuildingDetailHeaderTools = "true";

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

  if (headerTools) headerTools.append(levelBadge, collectButton, upgradeButton, closeButton);
  if (header) header.append(title, headerTools);

  const body = createElement(root, "div", "modal__body district-building-detail-body");

  const statsPanel = createElement(root, "div", "building-detail-panel district-building-detail-panel");
  if (statsPanel) statsPanel.dataset.districtBuildingDetailPanel = "stats";

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

  const actionSection = createElement(root, "div", "building-info-card__section");
  if (actionSection) actionSection.dataset.districtBuildingDetailActionSection = "true";
  const actionTitle = createElement(root, "h5");
  const actions = createElement(root, "div", "building-info-card__actions district-building-detail-actions");
  if (actionTitle) actionTitle.textContent = "Speciální akce";
  if (actions) actions.dataset.districtBuildingDetailActions = "true";
  if (actionSection) actionSection.append(actionTitle, actions);

  if (statsPanel) statsPanel.append(name, meta, stats, mechanicsSection, effectsSection, actionSection);
  if (body) body.append(statsPanel);
  card.append(header, body);
  shell.append(backdrop, card);
  root.append(shell);

  const guardCloseInteraction = (event) => {
    if (!event) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
  };

  const close = (event) => {
    guardCloseInteraction(event);
    shell.hidden = true;
    closeOverlay(shell, { restoreFocus: false });
    if (typeof callbacks.onClose === "function") callbacks.onClose(shell);
  };

  shell.querySelectorAll("[data-district-building-detail-close]").forEach((element) => {
    element.addEventListener("pointerdown", guardCloseInteraction);
    element.addEventListener("pointerup", guardCloseInteraction);
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
        const dealerControls = actionButton.closest("[data-dealer-sale-action]");
        const dealerSlot = dealerControls?.querySelector?.("[data-dealer-sale-slot]");
        const dealerItem = dealerControls?.querySelector?.("[data-dealer-sale-item]");
        const dealerAmount = dealerControls?.querySelector?.("[data-dealer-sale-amount]");
        callbacks.onRunAction(shell, {
          shell,
          actionIndex,
          actionId: actionButton.dataset.districtBuildingDetailActionId || "",
          buildingTypeId: actionButton.dataset.districtBuildingDetailBuildingTypeId || "",
          districtId: shell.dataset.districtBuildingDetailDistrictId || "",
          buildingId: shell.dataset.districtBuildingDetailName || "",
          buildingName: shell.dataset.districtBuildingDetailDisplayName || "",
          ...(dealerControls ? {
            dealerSlotId: dealerSlot?.value || "",
            itemId: dealerItem?.value || "",
            amount: Number(dealerAmount?.value)
          } : {})
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

function setImportantStyle(element, name, value) {
  if (!(element instanceof HTMLElement)) return;
  if (typeof element.style?.setProperty === "function") {
    element.style.setProperty(name, value, "important");
    return;
  }
  element.style[name] = value;
}

function removeInlineStyle(element, name) {
  if (!(element instanceof HTMLElement)) return;
  if (typeof element.style?.removeProperty === "function") {
    element.style.removeProperty(name);
    return;
  }
  element.style[name] = "";
}

function hardHideStructuralElement(element) {
  if (!(element instanceof HTMLElement)) return;
  element.hidden = true;
  element.classList?.add?.("hidden");
  element.setAttribute?.("aria-hidden", "true");
  for (const [name, value] of [
    ["display", "none"],
    ["width", "0"],
    ["height", "0"],
    ["min-width", "0"],
    ["min-height", "0"],
    ["max-height", "0"],
    ["margin", "0"],
    ["padding", "0"],
    ["border", "0"],
    ["outline", "0"],
    ["background", "transparent"],
    ["box-shadow", "none"],
    ["overflow", "hidden"]
  ]) {
    setImportantStyle(element, name, value);
  }
}

function clearHardHiddenStructuralElement(element) {
  if (!(element instanceof HTMLElement)) return;
  element.hidden = false;
  element.classList?.remove?.("hidden");
  element.setAttribute?.("aria-hidden", "false");
  for (const name of [
    "display",
    "width",
    "height",
    "min-width",
    "min-height",
    "max-height",
    "margin",
    "padding",
    "border",
    "outline",
    "background",
    "box-shadow",
    "overflow"
  ]) {
    removeInlineStyle(element, name);
  }
}

function hasMeaningfulInfoContent(infoSection) {
  if (!(infoSection instanceof HTMLElement)) return false;
  return Array.from(infoSection.children || []).some((child) => {
    if (!(child instanceof HTMLElement) || child.hidden) return false;
    if (child.matches?.("h5") && child.textContent?.trim().toLowerCase() === "info") return false;
    return Boolean(String(child.textContent || "").trim());
  });
}

function removeBuildingDetailInfoPanel(shell) {
  shell?.querySelectorAll?.(".district-building-detail-tabs, [data-district-building-detail-panel='info'], .district-building-detail-info-card")?.forEach((element) => {
    element.remove?.();
  });
}

function createStructuralSection(statsPanel, titleText, sectionDatasetKey, mountClassName, mountDatasetKey) {
  const section = createElement(statsPanel, "div", "building-info-card__section");
  const title = createElement(statsPanel, "h5");
  const mount = createElement(statsPanel, "div", mountClassName);
  if (!section || !title || !mount) return null;
  section.dataset[sectionDatasetKey] = "true";
  title.textContent = titleText;
  mount.dataset[mountDatasetKey] = "true";
  section.append(title, mount);
  return section;
}

function ensureBuildingDetailStructuralSections(shell) {
  const statsPanel = shell?.querySelector?.("[data-district-building-detail-panel='stats']");
  if (!(statsPanel instanceof HTMLElement)) return;

  if (!statsPanel.querySelector("[data-district-building-detail-mechanics]")) {
    const section = createStructuralSection(
      statsPanel,
      "Mechaniky",
      "districtBuildingDetailMechanicsSection",
      "building-detail-mechanics district-building-detail-mechanics",
      "districtBuildingDetailMechanics"
    );
    if (section) statsPanel.append(section);
  }

  if (!statsPanel.querySelector("[data-district-building-detail-effects]")) {
    const section = createStructuralSection(
      statsPanel,
      "Efekty",
      "districtBuildingDetailEffectsSection",
      "building-info-card__effects district-building-detail-effects-list",
      "districtBuildingDetailEffects"
    );
    if (section) statsPanel.append(section);
  }

  if (!statsPanel.querySelector("[data-district-building-detail-actions]")) {
    const section = createStructuralSection(
      statsPanel,
      "Speciální akce",
      "districtBuildingDetailActionSection",
      "building-info-card__actions district-building-detail-actions",
      "districtBuildingDetailActions"
    );
    if (section) statsPanel.append(section);
  }
}

function syncInlineBuildingIntro(statsPanel, introText = "") {
  if (!(statsPanel instanceof HTMLElement)) return;
  const text = String(introText || "").trim();
  const introCandidates = Array.from(statsPanel.children || []).filter((child) =>
    child instanceof HTMLElement
    && (
      child.dataset?.districtBuildingDetailInlineInfo === "true"
      || child.classList?.contains?.("building-detail-info-text")
    )
  );
  let intro = introCandidates[0] || null;
  introCandidates.slice(1).forEach((element) => element.remove?.());
  if (!text) {
    intro?.remove?.();
    return;
  }
  if (!(intro instanceof HTMLElement)) {
    intro = createElement(statsPanel, "p", "building-detail-info-text");
    if (!intro) return;
  }
  intro.dataset.districtBuildingDetailInlineInfo = "true";
  intro.dataset.districtBuildingDetailInfo = "true";
  intro.textContent = text;
  moveElementToStart(statsPanel, intro);
}

function getRenderedText(element) {
  if (!(element instanceof HTMLElement)) return "";
  const ownText = String(element.textContent || "").trim();
  const childText = Array.from(element.children || [])
    .map((child) => getRenderedText(child))
    .join(" ")
    .trim();
  return [ownText, childText].filter(Boolean).join(" ").trim();
}

function hasVisibleMeaningfulContent(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hidden || element.getAttribute?.("aria-hidden") === "true" || element.style?.display === "none") {
    return false;
  }
  if (element.matches?.("button") || element.matches?.("[data-district-building-detail-action-index]")) {
    return true;
  }
  if (element.matches?.(".district-building-detail-effect-cell")) {
    return Boolean(getRenderedText(element));
  }
  if (
    element.dataset?.districtBuildingDetailStats === "true"
    || element.dataset?.districtBuildingDetailMechanics === "true"
    || element.dataset?.districtBuildingDetailEffects === "true"
    || element.dataset?.districtBuildingDetailActions === "true"
  ) {
    return Array.from(element.children || []).some((child) => child instanceof HTMLElement);
  }
  return Array.from(element.children || []).some((child) => {
    if (!(child instanceof HTMLElement)) return false;
    if (child.matches?.("h5")) return false;
    return hasVisibleMeaningfulContent(child) || Boolean(getRenderedText(child));
  });
}

function removeEmptySinglePanelSections(shell) {
  const statsPanel = shell?.querySelector?.("[data-district-building-detail-panel='stats']");
  if (!(statsPanel instanceof HTMLElement) || !statsPanel.classList.contains("district-building-detail-panel--merged")) {
    return;
  }
  Array.from(statsPanel.children || []).forEach((section) => {
    if (!(section instanceof HTMLElement)) return;
    if (!section.matches?.(".building-info-card__section") && !section.matches?.(".district-building-detail-info-card")) return;
    if (
      section.dataset?.districtBuildingDetailMechanicsSection === "true"
      || section.dataset?.districtBuildingDetailEffectsSection === "true"
      || section.dataset?.districtBuildingDetailActionSection === "true"
    ) {
      return;
    }
    if (section.hidden || section.style?.display === "none" || section.getAttribute?.("aria-hidden") === "true") return;
    if (!hasVisibleMeaningfulContent(section)) {
      section.remove?.();
    }
  });
}

function mergeSinglePanelBuildingDetail(shell) {
  const statsPanel = shell?.querySelector?.("[data-district-building-detail-panel='stats']");
  const infoPanel = shell?.querySelector?.("[data-district-building-detail-panel='info']");
  if (!(statsPanel instanceof HTMLElement)) return;

  const infoSection = shell.querySelector(".district-building-detail-info-card");
  const intro = infoSection?.querySelector?.(".building-detail-info-text");
  const hasInfoContent = hasMeaningfulInfoContent(infoSection);
  const hasIntro = intro instanceof HTMLElement && Boolean(String(intro.textContent || "").trim());
  if (infoSection instanceof HTMLElement) {
    statsPanel.querySelectorAll?.(".building-detail-info-text")?.forEach((element) => {
      if (element !== intro && element.parentNode === statsPanel) {
        element.remove?.();
      }
    });
  }
  if (!infoSection) {
    statsPanel.querySelectorAll?.(".building-detail-info-text")?.forEach((element) => {
      if (element.parentNode === statsPanel && !String(element.textContent || "").trim()) {
        element.remove?.();
      }
    });
  }
  if (hasIntro) {
    moveElementToStart(statsPanel, intro);
  } else if (intro instanceof HTMLElement) {
    intro.remove();
  }
  if (infoSection instanceof HTMLElement && hasInfoContent && !hasIntro && infoSection.parentNode !== statsPanel) {
    statsPanel.append(infoSection);
  } else if (infoSection instanceof HTMLElement && infoPanel instanceof HTMLElement && infoSection.parentNode !== infoPanel) {
    infoPanel.append(infoSection);
  }

  statsPanel.hidden = false;
  statsPanel.classList.remove("hidden");
  statsPanel.classList.add("district-building-detail-panel--merged");
  statsPanel.setAttribute("aria-hidden", "false");
  if (infoPanel instanceof HTMLElement) hardHideStructuralElement(infoPanel);
}

function restoreTabbedBuildingDetail(shell) {
  const statsPanel = shell?.querySelector?.("[data-district-building-detail-panel='stats']");
  const infoPanel = shell?.querySelector?.("[data-district-building-detail-panel='info']");
  let infoSection = shell?.querySelector?.(".district-building-detail-info-card");
  if (statsPanel instanceof HTMLElement) {
    statsPanel.classList.remove("district-building-detail-panel--merged");
  }
  if (infoPanel instanceof HTMLElement) {
    clearHardHiddenStructuralElement(infoPanel);
    if (!(infoSection instanceof HTMLElement)) {
      infoSection = createElement(infoPanel, "div", "building-info-card building-info-card__section district-building-detail-info-card");
      if (infoSection) {
        infoSection.dataset.districtBuildingDetailInfoSection = "true";
        const infoTitle = createElement(infoPanel, "h5");
        const info = createElement(infoPanel, "p", "building-detail-info-text");
        if (infoTitle) infoTitle.textContent = "Info";
        if (info) info.dataset.districtBuildingDetailInfo = "true";
        infoSection.append(infoTitle, info);
      }
    }
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
    const phase = createElement(mount, "span", "building-info-action-row__phase");
    const cooldown = createElement(mount, "span", "building-info-action-row__cooldown");
    const command = createElement(mount, "span", "building-info-action-row__button");
    if (!row || !title || !description || !phase || !cooldown || !command) continue;
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
    row.dataset.districtBuildingDetailBaseDisabled = rowView.disabled ? "true" : "false";
    row.dataset.districtBuildingDetailDisabledTone = String(rowView.disabledTone || "");
    row.disabled = Boolean(rowView.disabled);
    if (rowView.disabledReason) {
      row.title = rowView.disabledReason;
      row.setAttribute("aria-label", `${rowView.title || "Akce"}: ${rowView.disabledReason}`);
    }
    title.textContent = rowView.title || "";
    const inlineDescription = resolveActionButtonInlineDescription(rowView);
    description.textContent = inlineDescription || "";
    description.hidden = !inlineDescription;
    const phaseLabel = String(rowView.phaseLockLabel || "").trim();
    phase.textContent = phaseLabel;
    phase.hidden = !phaseLabel;
    const cooldownLabel = String(rowView.cooldownLabel || "").trim();
    cooldown.textContent = cooldownLabel;
    cooldown.hidden = !cooldownLabel;
    command.textContent = Number(rowView.cooldownRemainingMs || 0) > 0
      ? "COOLDOWN"
      : rowView.disabled
        ? "NEDOSTUPNÉ"
        : "SPUSTIT";
    row.dataset.districtBuildingDetailHasPhaseLock = phaseLabel ? "true" : "false";
    row.dataset.districtBuildingDetailHasCooldown = cooldownLabel ? "true" : "false";
    row.append(title, description, phase, command, cooldown);
    if (rowView.dealerSale) {
      const wrapper = createDealerSaleControls(mount, row, rowView.dealerSale);
      if (wrapper) {
        mount.append(wrapper);
        continue;
      }
    }
    mount.append(row);
  }
  return true;
}

function createDealerSaleControls(scopeElement, actionButton, view) {
  const ownerDocument = scopeElement?.ownerDocument || globalThis.document;
  const wrapper = createElement(scopeElement, "div", "dealer-sale-action");
  const controls = createElement(scopeElement, "div", "dealer-sale-action__controls");
  const slotLabel = createElement(scopeElement, "label", "dealer-sale-action__field");
  const itemLabel = createElement(scopeElement, "label", "dealer-sale-action__field");
  const amountLabel = createElement(scopeElement, "label", "dealer-sale-action__field dealer-sale-action__field--amount");
  const slotCaption = createElement(scopeElement, "span", "dealer-sale-action__caption");
  const itemCaption = createElement(scopeElement, "span", "dealer-sale-action__caption");
  const amountCaption = createElement(scopeElement, "span", "dealer-sale-action__caption");
  const slotSelect = createElement(scopeElement, "select", "dealer-sale-action__select");
  const itemSelect = createElement(scopeElement, "input", "dealer-sale-action__select");
  const amountInput = createElement(scopeElement, "input", "dealer-sale-action__amount");
  const status = createElement(scopeElement, "p", "dealer-sale-action__status");
  if (!wrapper || !controls || !slotLabel || !itemLabel || !amountLabel || !slotCaption || !itemCaption || !amountCaption || !slotSelect || !itemSelect || !amountInput || !status) {
    return null;
  }
  wrapper.dataset.dealerSaleAction = "true";
  itemLabel.classList.add("dealer-sale-action__field--price");
  slotSelect.dataset.dealerSaleSlot = "true";
  itemSelect.dataset.dealerSaleItem = "true";
  amountInput.dataset.dealerSaleAmount = "true";
  slotCaption.textContent = "Prodávat";
  itemCaption.textContent = "Cena";
  amountCaption.textContent = "Ks";
  amountInput.type = "number";
  amountInput.min = "10";
  amountInput.step = "1";
  amountInput.value = "10";
  itemSelect.type = "hidden";

  for (const slot of Array.isArray(view.slots) ? view.slots : []) {
    const option = ownerDocument.createElement("option");
    option.value = slot.slotId;
    option.textContent = slot.statusLabel ? `${slot.label} · ${slot.statusLabel}` : slot.label;
    option.disabled = Boolean(slot.locked);
    slotSelect.append(option);
  }
  slotLabel.append(slotCaption, slotSelect);
  itemLabel.append(itemCaption, itemSelect);
  amountLabel.append(amountCaption, amountInput);
  controls.append(slotLabel, itemLabel, amountLabel);

  const command = actionButton.querySelector(".building-info-action-row__button");
  const cooldown = actionButton.querySelector(".building-info-action-row__cooldown");
  const defaultDisabledTone = actionButton.dataset.districtBuildingDetailDisabledTone || "";
  const defaultActionState = actionButton.dataset.districtBuildingDetailActionState || "ready";
  const defaultCooldownLabel = cooldown?.textContent || "";

  const sync = () => {
    const selectedSlot = view.slots?.find?.((slot) => slot.slotId === slotSelect.value) || null;
    const selectedItem = selectedSlot;
    const minimumAmount = Math.max(1, Number(selectedItem?.minimumAmountPerSale || 10));
    const maxAmount = Math.max(0, Number(selectedItem?.ownedAmount || 0));
    itemSelect.value = selectedItem?.itemId || "";
    itemSelect.setAttribute("data-dealer-sale-item-label", selectedItem?.itemLabel || "");
    itemSelect.title = selectedItem ? `${selectedItem.itemLabel} · $${selectedItem.unitSalePriceDirtyCash} dirty / ks` : "";
    itemSelect.value = selectedItem?.itemId || "";
    itemCaption.textContent = selectedItem ? `$${selectedItem.unitSalePriceDirtyCash} dirty / ks` : "Cena";
    amountInput.min = String(minimumAmount);
    if (Number(amountInput.value) < minimumAmount) amountInput.value = String(minimumAmount);
    amountInput.max = String(maxAmount);
    const amount = Number(amountInput.value);
    const requiredAmount = Number.isInteger(amount) && amount > 0 ? Math.max(minimumAmount, amount) : minimumAmount;
    const insufficientStock = Boolean(selectedItem && maxAmount < requiredAmount);
    const selectionBlocked = !selectedSlot || selectedSlot.locked || !selectedItem || insufficientStock || !Number.isInteger(amount) || amount < minimumAmount || amount > maxAmount;
    actionButton.disabled = actionButton.dataset.districtBuildingDetailBaseDisabled === "true" || selectionBlocked;
    actionButton.dataset.districtBuildingDetailDisabledTone = insufficientStock ? "insufficient-funds" : defaultDisabledTone;
    actionButton.dataset.districtBuildingDetailActionState = insufficientStock ? "disabled" : defaultActionState;
    if (command) command.textContent = insufficientStock ? "NEDOSTATEK" : "SPUSTIT";
    if (cooldown) cooldown.textContent = insufficientStock ? "NEDOSTATEK" : defaultCooldownLabel;
    status.textContent = selectedItem
      ? `${view.phaseStatusLabel || ""} · minimum ${minimumAmount} ks · vlastním ${maxAmount} ks · prodej $${amount * Number(selectedItem.unitSalePriceDirtyCash || 0)} dirty`
      : "Vyber látku.";
  };
  slotSelect.addEventListener("change", sync);
  amountInput.addEventListener("input", sync);
  wrapper.append(controls, status, actionButton);
  sync();
  return wrapper;
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
    const resultText = String(action.result || "").trim();
    result.textContent = resultText;
    result.hidden = !resultText;
    row.dataset.districtBuildingDetailHasCooldown = resultText ? "true" : "false";
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
  const rawMechanicsType = String(buildingViewModel.mechanicsType || shell.dataset?.buildingMechanicsType || buildingViewModel.buildingTypeId || buildingViewModel.title || "").trim();
  const districtType = String(buildingViewModel.districtType || shell.dataset?.buildingDistrictType || "").trim().toLowerCase();
  const isDowntownBuilding = districtType === "downtown" || buildingViewModel.isDowntownBuilding === true;
  const card = shell.querySelector(".district-building-detail-card");
  const mechanicsType = syncBuildingDetailIdentityHooks(shell, card, rawMechanicsType);
  const useSinglePanelLayout = SINGLE_PANEL_BUILDING_DETAIL_TYPES.has(mechanicsType);
  removeBuildingDetailInfoPanel(shell);
  ensureBuildingDetailStructuralSections(shell);

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
  setText("[data-district-building-detail-level]", buildingViewModel.levelLabel || "L1");
  setText("[data-district-building-detail-name]", buildingViewModel.name || buildingViewModel.title || "Budova");
  setText("[data-district-building-detail-meta]", buildingViewModel.meta || "");
  const titleBadge = shell.querySelector("[data-district-building-detail-badge]");
  if (titleBadge instanceof HTMLElement) {
    const countLabel = String(buildingViewModel.countLabel || "").trim();
    titleBadge.textContent = countLabel;
    titleBadge.hidden = !countLabel;
    titleBadge.style.display = countLabel ? "" : "none";
    titleBadge.dataset.districtBuildingDetailBadgeKind = countLabel ? "count" : "";
    titleBadge.classList.toggle("building-detail-title__badge--count", Boolean(countLabel));
    titleBadge.setAttribute("aria-hidden", countLabel ? "false" : "true");
  }
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
  const statsPanel = shell.querySelector("[data-district-building-detail-panel='stats']");
  syncInlineBuildingIntro(statsPanel, buildingViewModel.intro);

  const mechanicsMount = shell.querySelector("[data-district-building-detail-mechanics]");
  if (mechanicsMount) {
    const mechanicsSection = mechanicsMount.closest?.(".building-info-card__section");
    const hideMechanicsSection = Boolean(buildingViewModel.hideMechanicsSection);
    if (mechanicsSection instanceof HTMLElement) {
      mechanicsSection.hidden = hideMechanicsSection;
      mechanicsSection.style.display = hideMechanicsSection ? "none" : "";
      mechanicsSection.setAttribute("aria-hidden", hideMechanicsSection ? "true" : "false");
    }
    mechanicsMount.replaceChildren();
    const mechanics = Array.isArray(buildingViewModel.mechanics) ? buildingViewModel.mechanics : [];
    if (hideMechanicsSection) {
      // Hidden focused cards keep their effect chips as the single source of truth.
    } else if (mechanics.length === 0) {
      appendEmptyMessage(mechanicsMount, "Bez mechanik.");
    } else {
      mechanicsMount.replaceChildren(...mechanics.map((row) => createMechanicRow(mechanicsMount, row)).filter(Boolean));
    }
  }

  const actionSection = shell.querySelector("[data-district-building-detail-action-section]");
  const displayActions = useSinglePanelLayout && buildingViewModel.showActionsInSinglePanel !== true ? [] : buildingViewModel.actions || [];
  const hasSpecialActions = Array.isArray(displayActions) && displayActions.length > 0;
  if (actionSection instanceof HTMLElement) {
    actionSection.hidden = !hasSpecialActions;
    actionSection.style.display = hasSpecialActions ? "" : "none";
    actionSection.setAttribute("aria-hidden", hasSpecialActions ? "false" : "true");
    if (hasSpecialActions) {
      if (!actionSection.isConnected && statsPanel instanceof HTMLElement) statsPanel.append(actionSection);
    }
  }
  renderBuildingActions({
    actionsMount: shell.querySelector("[data-district-building-detail-actions]"),
    actions: displayActions
  }, callbacks);

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
  removeEmptySinglePanelSections(shell);
  const wasHidden = shell.hidden;
  shell.hidden = false;
  if (wasHidden) {
    openOverlay(shell, { type: "modal", ariaModal: true, restoreFocusOnClose: false });
  }
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
    closeOverlay(shell, { restoreFocus: false });
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
