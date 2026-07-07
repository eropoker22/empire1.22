function getElementDocument(element) {
  return element?.ownerDocument || (typeof document !== "undefined" ? document : null);
}

function createElement(scopeElement, tagName, className = "") {
  const scope = getElementDocument(scopeElement);
  if (!scope || typeof scope.createElement !== "function") {
    return null;
  }
  const element = scope.createElement(tagName);
  if (className) {
    element.className = className;
  }
  return element;
}

function setText(element, value) {
  if (element) {
    element.textContent = String(value ?? "");
  }
}

export function renderDistrictSummaryPanel(elements = {}, view = {}) {
  const {
    title,
    type,
    owner,
    ownerMeta,
    ownerAvatar,
    ownerAvatarFallback,
    card
  } = elements;

  setText(title, view.title || "District");
  setText(type, view.typeLabel || "District");
  setText(owner, view.ownerLabel || "Neznámý vlastník");
  setText(ownerMeta, view.ownerMeta || "");

  if (ownerAvatar) {
    ownerAvatar.src = view.ownerAvatarSrc || "";
    ownerAvatar.classList?.toggle?.("is-empty", Boolean(view.ownerAvatarEmpty));
  }

  if (ownerAvatarFallback) {
    ownerAvatarFallback.textContent = String(view.ownerFallback || "?").slice(0, 1).toUpperCase();
  }

  if (card) {
    const hasOwnerAvatar = Boolean(view.ownerAvatarBackgroundUrl);
    const safeOwnerAvatarUrl = hasOwnerAvatar
      ? `url("${String(view.ownerAvatarBackgroundUrl).replace(/(["\\])/g, "\\$1")}")`
      : "none";
    card.classList?.toggle?.("district-owner-bg-active", hasOwnerAvatar);
    card.style?.setProperty?.("--district-owner-avatar-url", safeOwnerAvatarUrl);
    card.style?.setProperty?.("--district-owner-avatar-opacity", hasOwnerAvatar ? "0.24" : "0");
  }

  return Boolean(title || type || owner || ownerMeta || ownerAvatar || ownerAvatarFallback || card);
}

export function renderDistrictMetricSummary(elements = {}, metrics = {}) {
  setText(elements.defense, metrics.defenseLabel);
  setText(elements.defensePower, metrics.defensePowerLabel);
  setText(elements.residents, metrics.residentsLabel);
  setText(elements.income, metrics.incomeLabel);
  setText(elements.heat, metrics.heatLabel);
  setText(elements.influence, metrics.influenceLabel);
  return true;
}

export function renderDistrictFlags(flagsMount, flags = []) {
  if (!flagsMount) {
    return false;
  }

  flagsMount.replaceChildren();

  for (const flag of Array.isArray(flags) ? flags : []) {
    const element = createElement(flagsMount, "span", `district-popup-flag district-popup-flag--${flag?.tone || "neutral"}`);
    if (!element) {
      continue;
    }
    element.textContent = flag?.label || "";
    flagsMount.append(element);
  }

  return true;
}

function appendBuildingEmptyMessage(listElement, text) {
  const empty = createElement(listElement, "div", "district-popup-buildings__empty");
  if (!empty) {
    return;
  }
  empty.textContent = text;
  listElement.append(empty);
}

function resolveBuildingKindToken(kindLabel = "") {
  const normalizedLabel = String(kindLabel || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalizedLabel.includes("spustit")) {
    return "action";
  }
  if (normalizedLabel.includes("pasivni")) {
    return "passive";
  }
  if (normalizedLabel.includes("vyroba")) {
    return "production";
  }

  return normalizedLabel
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

export function renderDistrictBuildingList(elements = {}, view = {}) {
  const { section, meta, list } = elements;
  if (!meta || !list) {
    return false;
  }

  if (section) {
    section.hidden = false;
  }
  list.replaceChildren();
  meta.textContent = view.metaText ?? "";

  if (view.emptyText) {
    appendBuildingEmptyMessage(list, view.emptyText);
    return true;
  }

  for (const building of Array.isArray(view.buildings) ? view.buildings : []) {
    const chip = createElement(list, "button", "button district-popup-buildings__chip district-popup-buildings__chip--button");
    if (!chip) {
      continue;
    }
    chip.type = "button";
    chip.dataset.districtBuildingName = building.name || building.displayName || "";
    chip.dataset.districtBuildingDisplayName = building.displayName || building.name || "";
    chip.dataset.districtBuildingKind = building.kindLabel || "";
    const kindToken = resolveBuildingKindToken(building.kindLabel || "");
    chip.dataset.districtBuildingKindType = kindToken;
    chip.classList.add(`district-popup-buildings__chip--kind-${kindToken}`);

    const label = createElement(list, "span", "district-popup-buildings__chip-label");
    if (label) {
      label.textContent = building.label || building.displayName || building.name || "Budova";
      chip.append(label);
    } else {
      chip.textContent = building.label || building.displayName || building.name || "Budova";
    }

    if (building.kindLabel) {
      const kind = createElement(list, "span", "district-popup-buildings__chip-kind");
      if (kind) {
        kind.classList.add(`district-popup-buildings__chip-kind--${kindToken}`);
        kind.dataset.districtBuildingKindType = kindToken;
        kind.textContent = building.kindLabel;
        chip.append(kind);
      }
    }
    if (building.name && building.displayName && building.displayName !== building.name) {
      chip.title = building.name;
    }
    list.append(chip);
  }

  if (view.trap?.visible) {
    const trapCard = createElement(list, "div", "district-popup-buildings__chip district-popup-buildings__chip--trap");
    const trapLabel = createElement(list, "span", "district-popup-buildings__trap-label");
    const trapMeta = createElement(list, "span", "district-popup-buildings__trap-meta");
    if (trapCard && trapLabel && trapMeta) {
      trapLabel.textContent = view.trap.label || "Toxická past";
      trapMeta.textContent = view.trap.meta || "aktivní";
      trapCard.dataset.districtBuildingTrap = "active";
      trapCard.append(trapLabel, trapMeta);
      list.append(trapCard);
    }
  }

  return true;
}

function createDistrictActionButton(mount, action) {
  const button = createElement(mount, "button", "button district-popup-action");
  if (!button) {
    return null;
  }
  button.type = "button";
  button.dataset.districtActionId = action.id || "";
  button.dataset.districtActionLabel = action.label || "";
  button.disabled = !action.enabled;

  if (action.stacked) {
    button.classList.add("district-popup-action--stacked");
    if (action.trapState) {
      button.dataset.districtTrapState = action.trapState;
    }

    const label = createElement(mount, "span", "district-popup-action__label");
    if (label) {
      label.textContent = action.label || "";
      button.append(label);
    }

    if (action.subtitle) {
      const subtitle = createElement(mount, "span", "district-popup-action__sub");
      if (subtitle) {
        subtitle.textContent = action.subtitle;
        button.append(subtitle);
      }
    }
  } else {
    button.textContent = action.label || "";
  }

  if (action.title) {
    button.title = action.title;
  }

  return button;
}

export function renderDistrictActionPanel(elements = {}, view = {}) {
  const { section, head, mount } = elements;
  if (section) {
    section.hidden = Boolean(view.hidden);
    section.style.display = section.hidden ? "none" : "";
  }
  if (head) {
    head.hidden = Boolean(view.headHidden);
  }
  if (!mount) {
    return false;
  }

  mount.replaceChildren();

  const statusMessage = view.policeMessage || view.statusMessage || "";
  if (statusMessage) {
    const actionRow = createElement(mount, "div", "district-popup-action-row");
    const reason = createElement(mount, "p", "district-popup-action-reason");
    if (actionRow && reason) {
      reason.textContent = statusMessage;
      actionRow.append(reason);
      mount.append(actionRow);
    }
    return true;
  }

  if (view.noticeMessage) {
    const actionRow = createElement(mount, "div", "district-popup-action-row");
    const reason = createElement(mount, "p", "district-popup-action-reason");
    if (actionRow && reason) {
      reason.textContent = view.noticeMessage;
      actionRow.append(reason);
      mount.append(actionRow);
    }
  }

  for (const action of Array.isArray(view.actions) ? view.actions : []) {
    const actionRow = createElement(mount, "div", "district-popup-action-row");
    const button = createDistrictActionButton(mount, action);
    if (!actionRow || !button) {
      continue;
    }

    actionRow.append(button);

    if (action.reason) {
      const reason = createElement(mount, "p", "district-popup-action-reason");
      if (reason) {
        reason.textContent = action.reason;
        actionRow.append(reason);
      }
    }

    mount.append(actionRow);
  }

  return true;
}
