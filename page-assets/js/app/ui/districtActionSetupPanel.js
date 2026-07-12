import { renderAttackPanel } from "./attackPanel.js";

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

  if (safeSourceIds.length === 1 || (safeSourceIds.length > 0 && selectElement.hasAttribute?.("data-auto-select-first-source"))) {
    selectElement.value = String(safeSourceIds[0]);
  }

  setDisabled(selectElement, safeSourceIds.length === 0);
}

function applyPanelAtmosphere({
  card,
  imageElement,
  labelElement,
  moodElement,
  atmosphereMeta = {}
} = {}) {
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
  setText(moodElement, atmosphereMeta.mood || "");
}

function getWeaponIdFromElement(element, datasetKey) {
  return String(element?.dataset?.[datasetKey] || "").trim();
}

function getDefenseWeaponState(viewModel, weaponId) {
  const currentAmount = Number(viewModel.currentLoadout?.[weaponId] ?? 0) || 0;
  const availableAmount = (Number(viewModel.weaponInventory?.[weaponId] ?? 0) || 0) + currentAmount;

  return {
    ownedLabel: String(availableAmount),
    inputValue: String(currentAmount),
    inputMax: String(availableAmount),
    inputDisabled: availableAmount <= 0 && currentAmount <= 0
  };
}

function formatRobberyHeatEstimateLabel(preview, memberInputValue = "0") {
  const deployedMembers = Math.max(0, Math.floor(Number(memberInputValue) || 0));
  if (deployedMembers <= 0) {
    return "0";
  }

  return preview?.heatLabel || "0";
}

export function createAttackSetupViewModel({
  district,
  adjacentOwnedDistrictIds = [],
  weaponInventory = {},
  weaponStats = {},
  atmosphereMeta = {}
} = {}) {
  return {
    targetDistrictId: district?.id,
    sourceDistrictIds: adjacentOwnedDistrictIds,
    weaponInventory,
    weaponStats,
    atmosphereMeta
  };
}

export function renderAttackSetupPanel(viewModel = {}, elements = {}, options = {}) {
  const renderPanel = typeof options.renderAttackPanel === "function"
    ? options.renderAttackPanel
    : renderAttackPanel;

  return renderPanel(viewModel, {}, {
    elements: {
      popup: elements.attackSetupPopup,
      card: elements.attackSetupCard,
      imageElement: elements.attackSetupAtmosphereImage,
      labelElement: elements.attackSetupAtmosphereLabel,
      title: elements.attackTargetTitle,
      sourceSelect: elements.attackSourceSelect,
      availablePopulation: elements.attackAvailablePopulation,
      requiredPopulation: elements.attackRequiredPopulation,
      estimatedPower: elements.attackEstimatedPower,
      status: elements.attackStatus,
      ownedElements: elements.attackOwnedElements,
      weaponInputs: elements.attackWeaponInputs,
      confirmButton: elements.attackConfirmButton
    }
  });
}

export function createRobberySetupViewModel({
  district,
  adjacentOwnedDistrictIds = [],
  availableMembers = 0,
  robberyPreview = null,
  atmosphereMeta = {}
} = {}) {
  return {
    targetDistrictId: district?.id,
    sourceDistrictIds: adjacentOwnedDistrictIds,
    memberInputValue: "0",
    memberInputMax: String(availableMembers),
    availableMembersLabel: String(Math.max(0, Number(availableMembers) || 0)),
    robberyPreview,
    atmosphereMeta
  };
}

export function renderRobberySetupPanel(viewModel = {}, elements = {}) {
  applyPanelAtmosphere({
    card: elements.robberySetupCard,
    imageElement: elements.robberySetupAtmosphereImage,
    labelElement: elements.robberySetupAtmosphereLabel,
    atmosphereMeta: viewModel.atmosphereMeta
  });

  setText(elements.robberyTargetTitle, `District ${viewModel.targetDistrictId ?? ""}`);
  setText(elements.robberyAvailableMembers, viewModel.availableMembersLabel ?? "0");
  renderSourceSelect(elements.robberySourceSelect, viewModel.sourceDistrictIds);

  if (elements.robberyMemberInput) {
    elements.robberyMemberInput.value = viewModel.memberInputValue ?? "0";
    elements.robberyMemberInput.max = viewModel.memberInputMax ?? "0";
  }

  const preview = viewModel.robberyPreview;
  if (preview) {
    setText(elements.robberyZone, preview.zoneLabel);
    setText(elements.robberyRecommendation, `${preview.recommendationLabel} členů`);
    setText(elements.robberyRiskLevel, `${preview.previewRiskLabel || preview.riskLabel} · ${preview.previewSuccessChanceLabel || preview.successChanceLabel}`);
    setText(elements.robberyLootPreview, preview.previewLootLabel || "Nejistý");
    setText(elements.robberyTrapPreview, preview.previewTrapHintLabel || "Neznámá");
    setText(elements.robberyScoutReport, preview.scoutReportLabel || "Bez scout reportu");
    setText(elements.robberyHeatEstimate, formatRobberyHeatEstimateLabel(preview, viewModel.memberInputValue));
    setText(elements.robberyRiskDescription, preview.previewDescription || preview.riskDescription);
  }

  return true;
}

export function createDefenseSetupViewModel({
  district,
  weaponInventory = {},
  currentDefense = {},
  atmosphereMeta = {}
} = {}) {
  return {
    targetDistrictId: district?.id,
    weaponInventory,
    currentLoadout: currentDefense.loadout || {},
    residentsLabel: String(currentDefense.residents ?? 0),
    atmosphereMeta
  };
}

export function renderDefenseSetupPanel(viewModel = {}, elements = {}) {
  applyPanelAtmosphere({
    card: elements.defenseSetupCard,
    imageElement: elements.defenseSetupAtmosphereImage,
    labelElement: elements.defenseSetupAtmosphereLabel,
    atmosphereMeta: viewModel.atmosphereMeta
  });

  setText(elements.defenseTargetTitle, `District ${viewModel.targetDistrictId ?? ""}`);

  for (const ownedElement of elements.defenseOwnedElements || []) {
    const weaponId = getWeaponIdFromElement(ownedElement, "defenseOwned");
    if (weaponId) {
      ownedElement.textContent = getDefenseWeaponState(viewModel, weaponId).ownedLabel;
    }
  }

  for (const input of elements.defenseWeaponInputs || []) {
    const weaponId = getWeaponIdFromElement(input, "defenseWeaponInput");
    const weaponState = getDefenseWeaponState(viewModel, weaponId);
    input.max = weaponState.inputMax;
    input.value = weaponState.inputValue;
    setDisabled(input, weaponState.inputDisabled);
  }

  if (elements.defenseResidentsInput) {
    elements.defenseResidentsInput.value = viewModel.residentsLabel ?? "0";
  }

  return true;
}
