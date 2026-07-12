import {
  closeOverlay,
  openOverlay
} from "./legacyOverlayCoordinator.js";

function setText(element, value) {
  if (element) {
    element.textContent = String(value ?? "");
  }
}

function setDisabled(element, disabled) {
  if (element && "disabled" in element) {
    element.disabled = Boolean(disabled);
  }
}

function getOwnerDocument(element) {
  return element?.ownerDocument || (typeof document !== "undefined" ? document : null);
}

function createOption(selectElement, value, text) {
  const ownerDocument = getOwnerDocument(selectElement);
  if (!ownerDocument || typeof ownerDocument.createElement !== "function") {
    return null;
  }

  const option = ownerDocument.createElement("option");
  option.value = String(value ?? "");
  option.textContent = String(text ?? "");
  return option;
}

function applyPanelAtmosphere(elements = {}, atmosphereMeta = {}) {
  const { card, imageElement, labelElement } = elements;

  if (card?.dataset) {
    card.dataset.districtType = atmosphereMeta.typeKey || "unknown";
  }

  if (imageElement && "src" in imageElement) {
    const imagePath = atmosphereMeta.imagePath || "";
    imageElement.src = imagePath;
    imageElement.alt = `${atmosphereMeta.label || "Neznámá"} – atmosféra města`;
    if (imageElement.dataset) {
      imageElement.dataset.atmosphereImagePath = imagePath;
    }
  }

  setText(labelElement, atmosphereMeta.label || "");
}

function bindButtonCallback(button, callbackKey, callback, payloadResolver) {
  if (!button || typeof callback !== "function" || typeof button.addEventListener !== "function") {
    return;
  }

  const callbackProp = `__empire${callbackKey}Callback`;
  const boundProp = `__empire${callbackKey}Bound`;
  button[callbackProp] = callback;

  if (button[boundProp]) {
    return;
  }

  button[boundProp] = true;
  button.addEventListener("click", (event) => {
    const currentCallback = button[callbackProp];
    if (typeof currentCallback === "function") {
      currentCallback(typeof payloadResolver === "function" ? payloadResolver() : undefined, event);
    }
  });
}

function renderSourceSelect(selectElement, sourceDistrictIds = []) {
  if (!selectElement || typeof selectElement.replaceChildren !== "function") {
    return;
  }

  const safeSourceIds = Array.isArray(sourceDistrictIds)
    ? sourceDistrictIds.map((sourceDistrictId) => Number(sourceDistrictId)).filter(Boolean)
    : [];
  const placeholder = createOption(
    selectElement,
    "",
    safeSourceIds.length > 0 ? "Vyber district" : "Žádný sousední district"
  );

  selectElement.replaceChildren();
  if (placeholder) {
    selectElement.append(placeholder);
  }

  for (const sourceDistrictId of safeSourceIds) {
    const option = createOption(selectElement, sourceDistrictId, `District ${sourceDistrictId}`);
    if (option) {
      selectElement.append(option);
    }
  }

  if (safeSourceIds.length === 1) {
    selectElement.value = String(safeSourceIds[0]);
  }

  setDisabled(selectElement, safeSourceIds.length === 0);
}

function getWeaponIdFromElement(element, datasetKey) {
  return String(element?.dataset?.[datasetKey] || "").trim();
}

function syncOwnedWeaponLabels(elements = [], weaponInventory = {}) {
  for (const ownedElement of elements || []) {
    const weaponId = getWeaponIdFromElement(ownedElement, "attackOwned");
    if (weaponId) {
      ownedElement.textContent = String(weaponInventory[weaponId] ?? 0);
    }
  }
}

function syncWeaponInputs(elements = [], weaponInventory = {}, selectedLoadout = {}) {
  for (const input of elements || []) {
    const weaponId = getWeaponIdFromElement(input, "attackWeaponInput");
    const ownedAmount = weaponId ? Number(weaponInventory[weaponId] ?? 0) || 0 : 0;
    const selectedAmount = Math.max(0, Number(selectedLoadout[weaponId] ?? 0) || 0);

    input.value = String(Math.min(selectedAmount, ownedAmount));
    input.max = String(ownedAmount);
    setDisabled(input, ownedAmount <= 0);
  }
}

function formatPopulationRequirement(value) {
  const amount = Math.max(0, Math.floor(Number(value) || 0));
  if (amount === 1) return "1 obyvatel";
  if (amount >= 2 && amount <= 4) return `${amount} obyvatelé`;
  return `${amount} obyvatel`;
}

function syncWeaponMetadata(elements = [], weaponStats = {}) {
  for (const input of elements || []) {
    const weaponId = getWeaponIdFromElement(input, "attackWeaponInput");
    const weapon = weaponStats[weaponId];
    const statsElement = input?.closest?.("label")?.querySelector?.("[data-attack-weapon-stats]");
    if (!weapon || !statsElement) {
      continue;
    }
    statsElement.textContent = `Síla ${Math.max(0, Number(weapon.power) || 0)} · ${formatPopulationRequirement(weapon.residents)}`;
  }
}

export function renderAttackProgress(activeAttack = {}, options = {}) {
  const elements = options.elements || {};

  setText(elements.availablePopulation, activeAttack.availablePopulation ?? "");
  setText(elements.requiredPopulation, activeAttack.totalResidents ?? activeAttack.requiredPopulation ?? "");
  setText(elements.estimatedPower, activeAttack.powerLabel ?? activeAttack.totalPower ?? activeAttack.estimatedPower ?? "");
  setText(elements.status, activeAttack.status ?? "");
  setDisabled(elements.confirmButton, !activeAttack.canConfirm);

  if (elements.state && activeAttack.stateLabel != null) {
    elements.state.textContent = String(activeAttack.stateLabel);
    elements.state.classList?.remove?.("building-action-status__state--idle");
  }

  setText(elements.summary, activeAttack.summary ?? "");
  setText(elements.meta, activeAttack.meta ?? "");
  return true;
}

export function renderAttackPanel(attackViewModel = {}, callbacks = {}, options = {}) {
  const elements = options.elements || {};

  applyPanelAtmosphere(elements, attackViewModel.atmosphereMeta || {});
  setText(elements.title, attackViewModel.targetLabel || `District ${attackViewModel.targetDistrictId ?? ""}`.trim());
  renderSourceSelect(elements.sourceSelect, attackViewModel.sourceDistrictIds || []);
  syncOwnedWeaponLabels(elements.ownedElements, attackViewModel.weaponInventory || {});
  syncWeaponInputs(elements.weaponInputs, attackViewModel.weaponInventory || {}, attackViewModel.selectedLoadout || {});
  syncWeaponMetadata(elements.weaponInputs, attackViewModel.weaponStats || {});

  if (attackViewModel.summary) {
    renderAttackProgress(attackViewModel.summary, { elements });
  }

  bindButtonCallback(elements.confirmButton, "AttackPanelConfirm", callbacks.onConfirmAttack, () => attackViewModel);
  return Boolean(Object.keys(elements).length);
}

export function renderAttackConfirmPanel(attackViewModel = {}, callbacks = {}, options = {}) {
  const elements = options.elements || {};

  applyPanelAtmosphere(elements, attackViewModel.atmosphereMeta || {});
  setText(elements.title, attackViewModel.targetLabel || `District ${attackViewModel.targetDistrictId ?? ""}`.trim());
  setText(elements.source, attackViewModel.sourceLabel || "Žádný soused");
  setText(elements.members, attackViewModel.membersLabel ?? attackViewModel.totalResidents ?? 0);
  setText(elements.power, attackViewModel.powerLabel ?? attackViewModel.attackPower ?? 0);
  setText(elements.scenario, attackViewModel.scenarioLabel || "Neznámý");
  setText(elements.duration, attackViewModel.durationLabel || "");
  setText(elements.note, attackViewModel.note || "");
  setDisabled(elements.confirmButton, !attackViewModel.canConfirm);

  bindButtonCallback(elements.confirmButton, "AttackPanelFinalConfirm", callbacks.onConfirmAttack, () => attackViewModel);
  return Boolean(Object.keys(elements).length);
}

export function openAttackPanel(targetDistrict = null, options = {}) {
  const popup = options.popup || options.elements?.popup || targetDistrict?.popup || null;
  if (!popup) {
    return false;
  }

  openOverlay(popup, { type: "modal", ariaModal: true });
  popup.hidden = false;
  return true;
}

export function closeAttackPanel(options = {}) {
  const popup = options.popup || options.elements?.popup || null;
  if (!popup) {
    return false;
  }

  popup.hidden = true;
  closeOverlay(popup);
  return true;
}
