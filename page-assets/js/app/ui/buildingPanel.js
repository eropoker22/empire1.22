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

export function createBuildingDetailStat(label, value) {
  const stat = createElement(null, "div", "building-info-card__stat");
  const statLabel = createElement(stat, "span");
  const statValue = createElement(stat, "strong");
  if (!stat || !statLabel || !statValue) {
    return null;
  }
  statLabel.textContent = label;
  statValue.textContent = value;
  stat.append(statLabel, statValue);
  return stat;
}

export function createBuildingDetailMechanicRow(label, value) {
  const row = createElement(null, "div", "district-building-detail-mechanic-row");
  const rowLabel = createElement(row, "span");
  const rowValue = createElement(row, "strong");
  if (!row || !rowLabel || !rowValue) {
    return null;
  }
  rowLabel.textContent = label;
  rowValue.textContent = value;
  row.append(rowLabel, rowValue);
  return row;
}

export function renderBuildingsPopupTypes(mount, view = {}) {
  if (!mount) {
    return false;
  }

  const buttons = [];
  for (const item of Array.isArray(view.types) ? view.types : []) {
    const isDisabled = Boolean(item.disabled);
    const button = createElement(
      mount,
      "button",
      `button buildings-popup__type-btn buildings-popup__type-btn--${item.typeKey || "unknown"}${item.active ? " is-active" : ""}${isDisabled ? " is-locked" : ""}`
    );
    const label = createElement(mount, "span", "buildings-popup__type-label");
    const count = createElement(mount, "span", "buildings-popup__type-meta");
    if (!button || !label || !count) {
      continue;
    }
    button.type = "button";
    button.disabled = isDisabled;
    if (isDisabled) {
      button.setAttribute("aria-disabled", "true");
      button.title = `${item.label || "Zóna"} nevlastníš`;
    } else {
      button.dataset.buildingsDistrictType = item.typeKey || "";
    }
    label.textContent = item.label || "";
    count.textContent = item.meta || "";
    if (Number(item.ownedDistrictCount) > 0) {
      count.dataset.mobileCount = String(item.ownedDistrictCount);
    }
    button.append(label, count);
    buttons.push(button);
  }

  const mobileCaption = createElement(mount, "div", "buildings-popup__mobile-type-caption");
  if (mobileCaption) {
    mobileCaption.textContent = view.activeLabel || "";
    mobileCaption.hidden = !view.activeLabel;
    mobileCaption.setAttribute("aria-live", "polite");
    buttons.push(mobileCaption);
  }

  mount.replaceChildren(...buttons);
  return true;
}

function appendEmptyMessage(parent, text) {
  const empty = createElement(parent, "div", "buildings-popup__empty");
  if (!empty) {
    return;
  }
  empty.textContent = text;
  parent.append(empty);
}

export function renderBuildingsPopupDetail(mount, view = {}) {
  if (!mount) {
    return false;
  }

  mount.replaceChildren();

  const card = createElement(mount, "section", "buildings-popup__detail-card");
  if (!card) {
    return false;
  }

  if (view.selectedType) {
    card.dataset.buildingDistrictType = view.selectedType;
  }

  const title = createElement(mount, "h4", "buildings-popup__detail-title");
  if (title) {
    title.textContent = view.title || "Vyber typ districtu";
    card.append(title);
  }

  if (view.copy) {
    const copy = createElement(mount, "p", "buildings-popup__detail-copy");
    if (copy) {
      copy.textContent = view.copy;
      card.append(copy);
    }
  }

  if (view.emptyText) {
    appendEmptyMessage(card, view.emptyText);
    mount.append(card);
    return true;
  }

  const buildingTypeGroup = createElement(mount, "div", "buildings-popup__group buildings-popup__group--types");
  const buildingTypeGrid = createElement(mount, "div", "buildings-popup__building-grid buildings-popup__building-grid--types");
  if (buildingTypeGroup && buildingTypeGrid) {
    for (const item of Array.isArray(view.baseTypes) ? view.baseTypes : []) {
      const button = createElement(
        mount,
        "button",
        `button buildings-popup__building buildings-popup__building--type buildings-popup__building--interactive${item.baseName === view.activeBaseName ? " is-active" : ""}`
      );
      const name = createElement(mount, "span");
      const count = createElement(mount, "span");
      if (!button || !name || !count) {
        continue;
      }
      button.type = "button";
      button.dataset.buildingsSelectBaseName = item.baseName || "";
      button.dataset.buildingsSelectBaseType = view.selectedType || "";
      name.textContent = item.baseName || "Budova";
      count.textContent = `${Math.max(0, Number(item.count || 0))}x`;
      button.append(name, count);
      buildingTypeGrid.append(button);
    }
    buildingTypeGroup.append(buildingTypeGrid);
  }

  const divider = createElement(mount, "div", "buildings-popup__group-divider");
  if (divider) {
    divider.setAttribute("aria-hidden", "true");
  }

  const variantsGroup = createElement(mount, "div", "buildings-popup__group buildings-popup__group--names");
  const variantsGrid = createElement(mount, "div", "buildings-popup__building-grid buildings-popup__building-grid--names");
  if (variantsGroup && variantsGrid) {
    const entries = Array.isArray(view.entries) ? view.entries : [];
    if (entries.length > 0) {
      for (const entry of entries) {
        const isOwnedByCurrentPlayer = entry.isOwnedByCurrentPlayer !== false;
        const button = createElement(
          mount,
          "button",
          `button buildings-popup__building buildings-popup__building--name${isOwnedByCurrentPlayer ? " buildings-popup__building--interactive" : " buildings-popup__building--locked"}`
        );
        const label = createElement(mount, "span");
        if (!button || !label) {
          continue;
        }
        button.type = "button";
        button.disabled = !isOwnedByCurrentPlayer;
        if (isOwnedByCurrentPlayer) {
          button.dataset.buildingsOpenBuildingName = entry.baseName || "";
          button.dataset.buildingsOpenBuildingDisplayName = entry.displayName || "";
          button.dataset.buildingsOpenBuildingDistrictId = String(entry.districtId || "");
          button.title = `${entry.displayName || entry.baseName || "Budova"} · ${entry.districtLabel || "District"}`;
        } else {
          button.setAttribute("aria-disabled", "true");
          button.title = `${entry.districtLabel || "District"} nevlastníš`;
        }
        label.textContent = entry.displayName || entry.baseName || "Budova";
        button.append(label);
        variantsGrid.append(button);
      }
      variantsGroup.append(variantsGrid);
    } else {
      appendEmptyMessage(variantsGroup, view.emptyVariantText || "Vyber typ budovy a zobrazí se její districty.");
    }
  }

  if (buildingTypeGroup) card.append(buildingTypeGroup);
  if (divider) card.append(divider);
  if (variantsGroup) card.append(variantsGroup);
  mount.append(card);
  return true;
}

export function renderBuildingActionRows(mount, rows = [], options = {}) {
  if (!mount) {
    return false;
  }

  mount.replaceChildren();

  for (const rowView of Array.isArray(rows) ? rows : []) {
    const row = createElement(mount, "button", "building-info-action-row");
    const title = createElement(mount, "strong", "building-info-action-row__title");
    const description = createElement(mount, "span", "building-info-action-row__desc");
    const cooldown = createElement(mount, "span", "building-info-action-row__cooldown");
    if (!row || !title || !description || !cooldown) {
      continue;
    }

    row.type = "button";
    row.dataset.districtBuildingDetailActionIndex = String(rowView.index ?? "");
    row.disabled = Boolean(rowView.disabled);
    title.textContent = rowView.title || "";
    description.textContent = rowView.description || "";
    cooldown.textContent = rowView.cooldownLabel || "";
    row.append(title, description, cooldown);

    if (typeof options.onRunAction === "function") {
      row.addEventListener("click", () => {
        options.onRunAction(rowView.index, rowView);
      });
    }

    mount.append(row);
  }

  return true;
}
