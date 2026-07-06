import { renderAttackConfirmPanel } from "./attackPanel.js";
import { renderSpyPanel } from "./spyPanel.js";

function setElementText(element, value) {
  if (element) {
    element.textContent = String(value ?? "");
  }
}

function setElementDisabled(element, disabled) {
  if (element && "disabled" in element) {
    element.disabled = Boolean(disabled);
  }
}

function setElementValidationState(element, state = "") {
  if (!element?.dataset) {
    return;
  }

  if (state) {
    element.dataset.validationState = state;
    return;
  }

  delete element.dataset.validationState;
}

function clearElementValidationStates(...elements) {
  for (const element of elements) {
    setElementValidationState(element);
  }
}

function formatActionDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return seconds > 0 ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${minutes}m`;
}

function formatActionCountdownClock(totalSeconds = 0) {
  const safeSeconds = Math.max(0, Math.ceil(Number(totalSeconds || 0)));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function resolveOccupyPopulationCostForOwnedCount(ownedDistrictCount = 0) {
  const count = Math.max(0, Math.floor(Number(ownedDistrictCount) || 0));
  if (count <= 1) return 50;
  if (count === 2) return 250;
  return 550;
}

function applyDistrictAtmosphere({
  card,
  imageElement,
  labelElement,
  atmosphereMeta = {}
} = {}) {
  if (card?.dataset) {
    card.dataset.districtType = atmosphereMeta.typeKey || "unknown";
  }

  if (imageElement && "src" in imageElement) {
    imageElement.src = atmosphereMeta.imagePath || "";
    imageElement.alt = `${atmosphereMeta.label || "Neznámá"} – atmosféra města`;
  }

  setElementText(labelElement, atmosphereMeta.label || "");
}

function hasRequiredConfirmationElements(elements = {}, requiredKeys = []) {
  return requiredKeys.every((key) => Boolean(elements[key]));
}

const ATTACK_CONFIRMATION_REQUIRED_KEYS = [
  "attackConfirmTitle",
  "attackConfirmSource",
  "attackConfirmMembers",
  "attackConfirmPower",
  "attackConfirmScenario",
  "attackConfirmDuration",
  "attackConfirmNote"
];

const ROBBERY_CONFIRMATION_REQUIRED_KEYS = [
  "robberyConfirmTitle",
  "robberyConfirmSource",
  "robberyConfirmMembers",
  "robberyConfirmDuration",
  "robberyConfirmNote"
];

const TRAP_CONFIRMATION_REQUIRED_KEYS = [
  "trapConfirmTitle",
  "trapConfirmCooldown",
  "trapConfirmNote"
];

const SPY_CONFIRMATION_REQUIRED_KEYS = [
  "spyConfirmTitle",
  "spyConfirmSource",
  "spyConfirmAvailable",
  "spyConfirmDuration",
  "spyConfirmNote"
];

const OCCUPY_CONFIRMATION_REQUIRED_KEYS = [
  "occupyConfirmTitle",
  "occupyConfirmSource",
  "occupyConfirmCondition",
  "occupyConfirmCost",
  "occupyConfirmDuration",
  "occupyConfirmNote"
];

function canRenderPreparedConfirmationPanel({ district, elements, requiredKeys } = {}) {
  return Boolean(district) && hasRequiredConfirmationElements(elements, requiredKeys);
}

export function createDistrictActionConfirmationPanelElements(elements = {}) {
  return {
    attackAvailablePopulation: elements.attackAvailablePopulation,
    attackConfirmButton: elements.attackConfirmButton,
    attackConfirmCard: elements.attackConfirmCard,
    attackConfirmDuration: elements.attackConfirmDuration,
    attackConfirmFinalButton: elements.attackConfirmFinalButton,
    attackConfirmMembers: elements.attackConfirmMembers,
    attackConfirmNote: elements.attackConfirmNote,
    attackConfirmPopup: elements.attackConfirmPopup,
    attackConfirmPower: elements.attackConfirmPower,
    attackConfirmScenario: elements.attackConfirmScenario,
    attackConfirmSource: elements.attackConfirmSource,
    attackConfirmTitle: elements.attackConfirmTitle,
    attackEstimatedPower: elements.attackEstimatedPower,
    attackOwnedElements: elements.attackOwnedElements,
    attackRequiredPopulation: elements.attackRequiredPopulation,
    attackSetupAtmosphereImage: elements.attackSetupAtmosphereImage,
    attackSetupAtmosphereLabel: elements.attackSetupAtmosphereLabel,
    attackSetupCard: elements.attackSetupCard,
    attackSetupPopup: elements.attackSetupPopup,
    attackSourceSelect: elements.attackSourceSelect,
    attackStatus: elements.attackStatus,
    attackTargetTitle: elements.attackTargetTitle,
    attackWeaponInputs: elements.attackWeaponInputs,
    defenseConfirmButton: elements.defenseConfirmButton,
    defenseEstimatedPower: elements.defenseEstimatedPower,
    defenseOwnedElements: elements.defenseOwnedElements,
    defenseResidentsInput: elements.defenseResidentsInput,
    defenseSetupAtmosphereImage: elements.defenseSetupAtmosphereImage,
    defenseSetupAtmosphereLabel: elements.defenseSetupAtmosphereLabel,
    defenseSetupCard: elements.defenseSetupCard,
    defenseSetupPopup: elements.defenseSetupPopup,
    defenseStatus: elements.defenseStatus,
    defenseTargetTitle: elements.defenseTargetTitle,
    defenseWeaponInputs: elements.defenseWeaponInputs,
    gangMembersValue: elements.gangMembersValue,
    occupyConfirmButton: elements.occupyConfirmButton,
    occupyConfirmCondition: elements.occupyConfirmCondition,
    occupyConfirmCost: elements.occupyConfirmCost,
    occupyConfirmDuration: elements.occupyConfirmDuration,
    occupyConfirmNote: elements.occupyConfirmNote,
    occupyConfirmSource: elements.occupyConfirmSource,
    occupyConfirmTitle: elements.occupyConfirmTitle,
    occupyConfirmAtmosphereImage: elements.occupyConfirmAtmosphereImage,
    occupyConfirmAtmosphereLabel: elements.occupyConfirmAtmosphereLabel,
    occupyConfirmCard: elements.occupyConfirmCard,
    robberyAvailableMembers: elements.robberyAvailableMembers,
    robberyConfirmButton: elements.robberyConfirmButton,
    robberyConfirmDuration: elements.robberyConfirmDuration,
    robberyConfirmFinalButton: elements.robberyConfirmFinalButton,
    robberyConfirmMembers: elements.robberyConfirmMembers,
    robberyConfirmNote: elements.robberyConfirmNote,
    robberyConfirmSource: elements.robberyConfirmSource,
    robberyConfirmTitle: elements.robberyConfirmTitle,
    robberyConfirmAtmosphereImage: elements.robberyConfirmAtmosphereImage,
    robberyConfirmAtmosphereLabel: elements.robberyConfirmAtmosphereLabel,
    robberyConfirmCard: elements.robberyConfirmCard,
    robberyMemberInput: elements.robberyMemberInput,
    robberyZone: elements.robberyZone,
    robberyRecommendation: elements.robberyRecommendation,
    robberyRiskLevel: elements.robberyRiskLevel,
    robberyLootPreview: elements.robberyLootPreview,
    robberyTrapPreview: elements.robberyTrapPreview,
    robberyScoutReport: elements.robberyScoutReport,
    robberyHeatEstimate: elements.robberyHeatEstimate,
    robberyRiskDescription: elements.robberyRiskDescription,
    robberySetupAtmosphereImage: elements.robberySetupAtmosphereImage,
    robberySetupAtmosphereLabel: elements.robberySetupAtmosphereLabel,
    robberySetupCard: elements.robberySetupCard,
    robberySetupPopup: elements.robberySetupPopup,
    robberySourceSelect: elements.robberySourceSelect,
    robberyStatus: elements.robberyStatus,
    robberyTargetTitle: elements.robberyTargetTitle,
    spyConfirmAvailable: elements.spyConfirmAvailable,
    spyConfirmButton: elements.spyConfirmButton,
    spyConfirmCard: elements.spyConfirmCard,
    spyConfirmDuration: elements.spyConfirmDuration,
    spyConfirmAtmosphereImage: elements.spyConfirmAtmosphereImage,
    spyConfirmAtmosphereLabel: elements.spyConfirmAtmosphereLabel,
    spyConfirmNote: elements.spyConfirmNote,
    spyConfirmPopup: elements.spyConfirmPopup,
    spyConfirmSource: elements.spyConfirmSource,
    spyConfirmTitle: elements.spyConfirmTitle,
    trapConfirmAtmosphereImage: elements.trapConfirmAtmosphereImage,
    trapConfirmAtmosphereLabel: elements.trapConfirmAtmosphereLabel,
    trapConfirmButton: elements.trapConfirmButton,
    trapConfirmCard: elements.trapConfirmCard,
    trapConfirmCooldown: elements.trapConfirmCooldown,
    trapConfirmNote: elements.trapConfirmNote,
    trapConfirmTitle: elements.trapConfirmTitle
  };
}

export function createAttackConfirmationViewModel({
  district,
  context,
  atmosphereMeta = {},
  attackCooldownMs = 0
} = {}) {
  const scenarioLabel = context?.hasTrapDefense ? "Toxická past" : (context?.resolvedScenario?.label || "Neznámý");
  const cooldownMs = Number(context?.boostContext?.cooldownMs || attackCooldownMs || 0);
  const note = !context?.sourceDistrictId
    ? "Útok vyžaduje sousední vlastní district."
    : !context?.canConfirm
      ? "Nejdřív nastav validní loadout a dostatek obyvatel pro útok."
      : context?.hasTrapDefense
        ? `Cíl je krytý toxickou pastí. Útočná výzbroj: ${context.selectedWeaponsLabel || "bez výzbroje"}.`
        : `Výzbroj: ${context?.selectedWeaponsLabel || "bez výzbroje"}.${context?.boostContext?.summaryLabel ? ` ${context.boostContext.summaryLabel}.` : ""}`;

  return {
    targetDistrictId: district?.id,
    sourceLabel: context?.sourceDistrictId ? `District ${context.sourceDistrictId}` : "Žádný soused",
    totalResidents: context?.totalResidents ?? 0,
    attackPower: context?.boostContext?.effectiveAttackPower ?? context?.totalPower ?? 0,
    scenarioLabel,
    durationLabel: formatActionDuration(cooldownMs),
    note,
    canConfirm: Boolean(context?.canConfirm),
    atmosphereMeta
  };
}

export function renderAttackConfirmationPanel(viewModel = {}, elements = {}) {
  const rendered = renderAttackConfirmPanel(viewModel, {}, {
    elements: {
      popup: elements.attackConfirmPopup,
      card: elements.attackConfirmCard,
      imageElement: elements.attackConfirmAtmosphereImage,
      labelElement: elements.attackConfirmAtmosphereLabel,
      title: elements.attackConfirmTitle,
      source: elements.attackConfirmSource,
      members: elements.attackConfirmMembers,
      power: elements.attackConfirmPower,
      scenario: elements.attackConfirmScenario,
      duration: elements.attackConfirmDuration,
      note: elements.attackConfirmNote,
      confirmButton: elements.attackConfirmFinalButton
    }
  });

  clearElementValidationStates(elements.attackConfirmSource, elements.attackConfirmMembers, elements.attackConfirmPower);

  if (!viewModel.canConfirm) {
    if (!viewModel.sourceLabel || viewModel.sourceLabel === "Žádný soused") {
      setElementValidationState(elements.attackConfirmSource, "error");
    } else if (Number(viewModel.totalResidents || 0) <= 0) {
      setElementValidationState(elements.attackConfirmMembers, "error");
    } else {
      setElementValidationState(elements.attackConfirmPower, "error");
    }
  }

  return rendered;
}

export function canRenderAttackConfirmationPanel({ district, elements = {} } = {}) {
  return canRenderPreparedConfirmationPanel({
    district,
    elements,
    requiredKeys: ATTACK_CONFIRMATION_REQUIRED_KEYS
  });
}

export function renderPreparedAttackConfirmationPanel(data = {}, elements = {}) {
  if (!canRenderAttackConfirmationPanel({ district: data.district, elements })) {
    return false;
  }

  renderAttackConfirmationPanel(createAttackConfirmationViewModel(data), elements);
  return true;
}

export function createRobberyConfirmationViewModel({
  district,
  sourceDistrictId = "",
  deployedMembers = 0,
  canConfirm = false,
  robberyCooldownMs = 0,
  atmosphereMeta = {}
} = {}) {
  return {
    targetDistrictId: district?.id,
    sourceLabel: sourceDistrictId ? `District ${sourceDistrictId}` : "Žádný soused",
    membersLabel: String(deployedMembers),
    durationLabel: formatActionDuration(robberyCooldownMs),
    note: !sourceDistrictId
      ? "Vykrást district vyžaduje sousední vlastní district."
      : deployedMembers <= 0
        ? "Nejdřív nastav počet nasazených členů gangu."
        : "Vykrást district cílí jen na prázdný sousední district. Neobsazuje území, pouze získává loot z města.",
    canConfirm,
    atmosphereMeta
  };
}

export function renderRobberyConfirmationPanel(viewModel = {}, elements = {}) {
  applyDistrictAtmosphere({
    card: elements.robberyConfirmCard,
    imageElement: elements.robberyConfirmAtmosphereImage,
    labelElement: elements.robberyConfirmAtmosphereLabel,
    atmosphereMeta: viewModel.atmosphereMeta
  });

  setElementText(elements.robberyConfirmTitle, `District ${viewModel.targetDistrictId ?? ""}`);
  setElementText(elements.robberyConfirmSource, viewModel.sourceLabel || "Žádný soused");
  setElementText(elements.robberyConfirmMembers, viewModel.membersLabel ?? "0");
  setElementText(elements.robberyConfirmDuration, viewModel.durationLabel || "");
  setElementText(elements.robberyConfirmNote, viewModel.note || "");
  setElementDisabled(elements.robberyConfirmFinalButton, !viewModel.canConfirm);
  clearElementValidationStates(elements.robberyConfirmSource, elements.robberyConfirmMembers);

  if (!viewModel.canConfirm) {
    if (!viewModel.sourceLabel || viewModel.sourceLabel === "Žádný soused") {
      setElementValidationState(elements.robberyConfirmSource, "error");
    } else {
      setElementValidationState(elements.robberyConfirmMembers, "error");
    }
  }

  return true;
}

export function canRenderRobberyConfirmationPanel({ district, elements = {} } = {}) {
  return canRenderPreparedConfirmationPanel({
    district,
    elements,
    requiredKeys: ROBBERY_CONFIRMATION_REQUIRED_KEYS
  });
}

export function renderPreparedRobberyConfirmationPanel(data = {}, elements = {}) {
  if (!canRenderRobberyConfirmationPanel({ district: data.district, elements })) {
    return false;
  }

  renderRobberyConfirmationPanel(createRobberyConfirmationViewModel(data), elements);
  return true;
}

export function createTrapConfirmationViewModel({
  district,
  currentTrapDistrictId = null,
  trapMoveCooldownSeconds = 0,
  atmosphereMeta = {}
} = {}) {
  const isMovingTrap = Boolean(currentTrapDistrictId && currentTrapDistrictId !== district?.id);
  const isSameDistrict = Number(currentTrapDistrictId) === Number(district?.id);

  return {
    targetDistrictId: district?.id,
    cooldownLabel: trapMoveCooldownSeconds > 0 ? formatActionCountdownClock(trapMoveCooldownSeconds) : "Připraveno",
    note: isSameDistrict
      ? "Toxická past už je aktivní v tomto districtu."
      : isMovingTrap
        ? `Přesune aktivní toxickou past z District ${currentTrapDistrictId} sem. Po přesunu se znovu rozjede toxický kouř.`
        : "Nastraží toxickou past do vybraného distriktu. Útočník v ní ztratí všechny nasazené lidi i výzbroj.",
    confirmLabel: isMovingTrap ? "Přesunout past" : "Nastražit past",
    canConfirm: !(isSameDistrict || (isMovingTrap && trapMoveCooldownSeconds > 0)),
    atmosphereMeta
  };
}

export function renderTrapConfirmationPanel(viewModel = {}, elements = {}) {
  applyDistrictAtmosphere({
    card: elements.trapConfirmCard,
    imageElement: elements.trapConfirmAtmosphereImage,
    labelElement: elements.trapConfirmAtmosphereLabel,
    atmosphereMeta: viewModel.atmosphereMeta
  });

  setElementText(elements.trapConfirmTitle, `District ${viewModel.targetDistrictId ?? ""}`);
  setElementText(elements.trapConfirmCooldown, viewModel.cooldownLabel || "");
  setElementText(elements.trapConfirmNote, viewModel.note || "");

  if (elements.trapConfirmButton) {
    elements.trapConfirmButton.textContent = viewModel.confirmLabel || "Nastražit past";
    setElementDisabled(elements.trapConfirmButton, !viewModel.canConfirm);
  }

  return true;
}

export function canRenderTrapConfirmationPanel({ district, elements = {} } = {}) {
  return canRenderPreparedConfirmationPanel({
    district,
    elements,
    requiredKeys: TRAP_CONFIRMATION_REQUIRED_KEYS
  });
}

export function renderPreparedTrapConfirmationPanel(data = {}, elements = {}) {
  if (!canRenderTrapConfirmationPanel({ district: data.district, elements })) {
    return false;
  }

  renderTrapConfirmationPanel(createTrapConfirmationViewModel(data), elements);
  return true;
}

export function createSpyConfirmationViewModel({
  district,
  adjacentOwnedDistrictIds = [],
  spyState = {},
  spyCooldownMs = 0,
  atmosphereMeta = {}
} = {}) {
  const hasSourceDistrict = adjacentOwnedDistrictIds.length > 0;
  const availableSpies = Number(spyState.available || 0);
  const canConfirm = hasSourceDistrict && availableSpies > 0;
  const note = !hasSourceDistrict
    ? "Špehování vyžaduje sousední vlastní district."
    : availableSpies <= 0
      ? "Nemáš dostupného špeha. Bez špeha akci nespustíš."
      : "Částečný úspěch odhalí typ distriktu. Úspěch odhalí i obranu a odemkne akci Obsadit.";

  return {
    targetDistrictId: district?.id,
    sourceLabel: hasSourceDistrict ? `District ${adjacentOwnedDistrictIds[0]}` : "Žádný soused",
    availableSpies,
    durationLabel: formatActionDuration(spyCooldownMs),
    note,
    canConfirm,
    confirmLabel: "Vyslat špeha",
    atmosphereMeta
  };
}

export function renderSpyConfirmationPanel(viewModel = {}, elements = {}) {
  const rendered = renderSpyPanel(viewModel, {}, {
    elements: {
      popup: elements.spyConfirmPopup,
      card: elements.spyConfirmCard,
      imageElement: elements.spyConfirmAtmosphereImage,
      labelElement: elements.spyConfirmAtmosphereLabel,
      title: elements.spyConfirmTitle,
      source: elements.spyConfirmSource,
      available: elements.spyConfirmAvailable,
      duration: elements.spyConfirmDuration,
      note: elements.spyConfirmNote,
      confirmButton: elements.spyConfirmButton
    }
  });

  clearElementValidationStates(elements.spyConfirmSource, elements.spyConfirmAvailable);

  if (!viewModel.canConfirm) {
    if (!viewModel.sourceLabel || viewModel.sourceLabel === "Žádný soused") {
      setElementValidationState(elements.spyConfirmSource, "error");
    } else {
      setElementValidationState(elements.spyConfirmAvailable, "error");
    }
  }

  return rendered;
}

export function canRenderSpyConfirmationPanel({ district, elements = {} } = {}) {
  return canRenderPreparedConfirmationPanel({
    district,
    elements,
    requiredKeys: SPY_CONFIRMATION_REQUIRED_KEYS
  });
}

export function renderPreparedSpyConfirmationPanel(data = {}, elements = {}) {
  if (!canRenderSpyConfirmationPanel({ district: data.district, elements })) {
    return false;
  }

  renderSpyConfirmationPanel(createSpyConfirmationViewModel(data), elements);
  return true;
}

export function createOccupyConfirmationViewModel({
  district,
  adjacentOwnedDistrictIds = [],
  canOccupyAfterSpy = false,
  ownedDistrictCount = 0,
  availablePopulation = 0,
  occupyCooldownMs = 12 * 60 * 1000,
  atmosphereMeta = {}
} = {}) {
  const hasSourceDistrict = adjacentOwnedDistrictIds.length > 0;
  const populationCost = resolveOccupyPopulationCostForOwnedCount(ownedDistrictCount);
  const hasEnoughPopulation = Math.max(0, Math.floor(Number(availablePopulation) || 0)) >= populationCost;

  return {
    targetDistrictId: district?.id,
    sourceLabel: hasSourceDistrict ? `District ${adjacentOwnedDistrictIds[0]}` : "Žádný soused",
    conditionLabel: canOccupyAfterSpy ? "Špehování potvrzeno" : "Chybí špehování",
    costLabel: `${populationCost} populace`,
    populationCost,
    durationLabel: formatActionDuration(occupyCooldownMs),
    note: !hasSourceDistrict
      ? "Obsazení vyžaduje sousední vlastní district."
      : !canOccupyAfterSpy
        ? "Nejdřív musí proběhnout úspěšné špehování. Teprve pak lze district obsadit."
        : !hasEnoughPopulation
          ? `Obsazení vyžaduje ${populationCost} populace. Aktuálně máš ${Math.max(0, Math.floor(Number(availablePopulation) || 0))}.`
        : `Po potvrzení se spustí ${formatActionDuration(occupyCooldownMs)} obsazování. District bliká tvojí barvou a po doběhnutí přejde pod tebe.`,
    canConfirm: hasSourceDistrict && canOccupyAfterSpy && hasEnoughPopulation,
    confirmLabel: "Spustit obsazení",
    atmosphereMeta
  };
}

export function renderOccupyConfirmationPanel(viewModel = {}, elements = {}) {
  applyDistrictAtmosphere({
    card: elements.occupyConfirmCard,
    imageElement: elements.occupyConfirmAtmosphereImage,
    labelElement: elements.occupyConfirmAtmosphereLabel,
    atmosphereMeta: viewModel.atmosphereMeta
  });

  setElementText(elements.occupyConfirmTitle, `District ${viewModel.targetDistrictId ?? ""}`);
  setElementText(elements.occupyConfirmSource, viewModel.sourceLabel || "Žádný soused");
  setElementText(elements.occupyConfirmCondition, viewModel.conditionLabel || "");
  setElementText(elements.occupyConfirmCost, viewModel.costLabel || "");
  setElementText(elements.occupyConfirmDuration, viewModel.durationLabel || "");
  setElementText(elements.occupyConfirmNote, viewModel.note || "");
  clearElementValidationStates(elements.occupyConfirmSource, elements.occupyConfirmCondition, elements.occupyConfirmCost);

  if (!viewModel.canConfirm) {
    if (!viewModel.sourceLabel || viewModel.sourceLabel === "Žádný soused") {
      setElementValidationState(elements.occupyConfirmSource, "error");
    } else if (viewModel.conditionLabel !== "Špehování potvrzeno") {
      setElementValidationState(elements.occupyConfirmCondition, "error");
    } else {
      setElementValidationState(elements.occupyConfirmCost, "error");
    }
  }

  if (elements.occupyConfirmButton) {
    setElementDisabled(elements.occupyConfirmButton, !viewModel.canConfirm);
    elements.occupyConfirmButton.textContent = viewModel.confirmLabel || "Spustit obsazení";
  }

  return true;
}

export function canRenderOccupyConfirmationPanel({ district, elements = {} } = {}) {
  return canRenderPreparedConfirmationPanel({
    district,
    elements,
    requiredKeys: OCCUPY_CONFIRMATION_REQUIRED_KEYS
  });
}

export function renderPreparedOccupyConfirmationPanel(data = {}, elements = {}) {
  if (!canRenderOccupyConfirmationPanel({ district: data.district, elements })) {
    return false;
  }

  renderOccupyConfirmationPanel(createOccupyConfirmationViewModel(data), elements);
  return true;
}
