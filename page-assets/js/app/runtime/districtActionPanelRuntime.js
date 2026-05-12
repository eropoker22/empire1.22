import {
  createAttackConfirmationViewModel,
  createOccupyConfirmationViewModel,
  createRobberyConfirmationViewModel,
  createSpyConfirmationViewModel,
  createTrapConfirmationViewModel,
  renderAttackConfirmationPanel,
  renderOccupyConfirmationPanel,
  renderRobberyConfirmationPanel,
  renderSpyConfirmationPanel,
  renderTrapConfirmationPanel
} from "../ui/districtActionConfirmationPanel.js";

function isHtmlInputElement(element) {
  return Boolean(element && typeof element === "object" && "value" in element);
}

function isHtmlSelectElement(element) {
  return Boolean(element && typeof element === "object" && "value" in element && typeof element.replaceChildren === "function");
}

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

function createOption(selectElement, value, text) {
  const ownerDocument = selectElement?.ownerDocument || (typeof document !== "undefined" ? document : null);
  if (!ownerDocument || typeof ownerDocument.createElement !== "function") {
    return null;
  }

  const option = ownerDocument.createElement("option");
  option.value = String(value ?? "");
  option.textContent = String(text ?? "");
  return option;
}

function renderSourceSelect(selectElement, sourceDistrictIds = []) {
  if (!isHtmlSelectElement(selectElement)) {
    return;
  }

  const safeSourceIds = Array.isArray(sourceDistrictIds)
    ? sourceDistrictIds.map((sourceDistrictId) => Number(sourceDistrictId)).filter(Boolean)
    : [];
  const placeholderOption = createOption(
    selectElement,
    "",
    safeSourceIds.length > 0 ? "Vyber district" : "Žádný sousední district"
  );

  selectElement.replaceChildren();
  if (placeholderOption) {
    selectElement.append(placeholderOption);
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

  setElementDisabled(selectElement, safeSourceIds.length === 0);
}

function applyDistrictAtmosphere({
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
    imageElement.src = atmosphereMeta.imagePath || "";
    imageElement.alt = `${atmosphereMeta.label || "Neznámá"} – atmosféra města`;
  }

  setElementText(labelElement, atmosphereMeta.label || "");
  setElementText(moodElement, atmosphereMeta.mood || "");
}

function getWeaponInputId(input, datasetKey) {
  return String(input?.dataset?.[datasetKey] || "").trim();
}

export function createDistrictActionPanelRuntime(deps = {}) {
  const elements = deps.elements || {};
  const state = {
    pendingAttackContext: null
  };

  const clamp = typeof deps.clamp === "function"
    ? deps.clamp
    : (value, min, max) => Math.min(Math.max(value, min), max);
  const getGeometry = typeof deps.getGeometry === "function" ? deps.getGeometry : () => null;
  const getInteractionState = typeof deps.getInteractionState === "function" ? deps.getInteractionState : () => ({});
  const getCurrentPlayerOwnedDistrictIds = typeof deps.getCurrentPlayerOwnedDistrictIds === "function"
    ? deps.getCurrentPlayerOwnedDistrictIds
    : () => new Set();
  const getAdjacentDistrictIdsFromGeometry = typeof deps.getAdjacentDistrictIdsFromGeometry === "function"
    ? deps.getAdjacentDistrictIdsFromGeometry
    : () => [];
  const getDistrictAtmosphereMeta = typeof deps.getDistrictAtmosphereMeta === "function"
    ? deps.getDistrictAtmosphereMeta
    : () => ({});

  const getAvailableAttackPopulation = () => {
    const rawValue = elements.gangMembersValue?.textContent || "0";
    return Number.parseInt(rawValue.replace(/[^\d]/g, ""), 10) || 0;
  };

  const getAdjacentOwnedDistrictIds = (district) => {
    if (!district) {
      return [];
    }

    const interactionState = getInteractionState();
    const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
    return getAdjacentDistrictIdsFromGeometry(getGeometry(), district.id)
      .filter((districtId) => currentPlayerOwnedDistrictIds.has(districtId));
  };

  const renderAttackSummary = () => {
    if (
      !elements.attackRequiredPopulation ||
      !elements.attackEstimatedPower ||
      !elements.attackStatus ||
      !elements.attackSourceSelect
    ) {
      return { totalResidents: 0, totalPower: 0, canConfirm: false };
    }

    const selectedLoadout = {};

    for (const input of elements.attackWeaponInputs || []) {
      const weaponId = getWeaponInputId(input, "attackWeaponInput");

      if (!weaponId || !deps.attackSetupWeapons?.[weaponId]) {
        continue;
      }

      const amount = Math.max(0, Number.parseInt(input.value || "0", 10) || 0);

      if (amount > 0) {
        selectedLoadout[weaponId] = amount;
      }
    }

    const { totalResidents, totalPower } = deps.calculateAttackDeployment(selectedLoadout);
    const availablePopulation = getAvailableAttackPopulation();
    const { canConfirm, status } = deps.validateAttackSelection({
      sourceDistrictId: elements.attackSourceSelect.value,
      totalResidents,
      totalPower,
      availablePopulation
    });

    deps.renderAttackProgress({
      availablePopulation,
      totalResidents,
      totalPower,
      status,
      canConfirm
    }, {
      elements: {
        availablePopulation: elements.attackAvailablePopulation,
        requiredPopulation: elements.attackRequiredPopulation,
        estimatedPower: elements.attackEstimatedPower,
        status: elements.attackStatus,
        confirmButton: elements.attackConfirmButton
      }
    });

    return { totalResidents, totalPower, canConfirm };
  };

  const getPreparedAttackContext = (district) => {
    if (!district) {
      return null;
    }

    const interactionState = getInteractionState();
    const sourceDistrictId = isHtmlSelectElement(elements.attackSourceSelect) ? elements.attackSourceSelect.value : "";
    const { totalResidents, totalPower, canConfirm } = renderAttackSummary();
    const worldState = deps.getResolvedWorldState();
    const baseDefensePower = worldState.districtDefenseById?.[district.id]
      ?? deps.estimateDistrictDefense({
        districtType: district.districtType,
        isOccupied: deps.getDistrictOwnerLabel(district, interactionState) !== "Neobsazeno",
        districtId: district.id
      });
    const boostContext = deps.getFactoryAttackBoostContext({
      attackPower: totalPower,
      defensePower: baseDefensePower
    });
    const hasTrapDefense = Boolean(worldState.districtTrapById?.[district.id]?.isArmed);
    const resolvedScenario = deps.resolveAttackOutcome({
      attackPower: boostContext.effectiveAttackPower,
      defensePower: boostContext.effectiveDefensePower
    });
    const attackLoadout = {};
    const selectedWeapons = [];

    for (const input of elements.attackWeaponInputs || []) {
      const weaponId = getWeaponInputId(input, "attackWeaponInput");
      const amount = Number.parseInt(input.value || "0", 10) || 0;

      if (!weaponId || amount <= 0) {
        continue;
      }

      attackLoadout[weaponId] = amount;
      selectedWeapons.push(`${deps.attackWeaponLabels?.[weaponId] || weaponId} x${amount}`);
    }

    return {
      sourceDistrictId,
      totalResidents,
      totalPower,
      canConfirm,
      attackLoadout,
      selectedWeaponsLabel: selectedWeapons.join(", "),
      baseDefensePower,
      boostContext,
      hasTrapDefense,
      resolvedScenario
    };
  };

  const renderRobberySummary = () => {
    if (
      !elements.robberyStatus ||
      !elements.robberySourceSelect ||
      !elements.robberyAvailableMembers ||
      !isHtmlInputElement(elements.robberyMemberInput)
    ) {
      return { deployedMembers: 0, canConfirm: false };
    }

    const availableMembers = getAvailableAttackPopulation();
    const deployedMembers = clamp(Number.parseInt(elements.robberyMemberInput.value || "0", 10) || 0, 0, availableMembers);
    elements.robberyMemberInput.value = String(deployedMembers);
    elements.robberyAvailableMembers.textContent = String(availableMembers);

    const hasSourceDistrict = Boolean(elements.robberySourceSelect.value);
    const canConfirm = hasSourceDistrict && deployedMembers > 0;

    elements.robberyStatus.textContent = !hasSourceDistrict
      ? "Chybí sousední district"
      : deployedMembers <= 0
        ? "Vyber členy gangu"
        : "Připraveno";

    setElementDisabled(elements.robberyConfirmButton, !canConfirm);

    return { deployedMembers, canConfirm };
  };

  const renderDefenseSummary = () => {
    if (
      !elements.defenseStatus ||
      !elements.defenseEstimatedPower ||
      !isHtmlInputElement(elements.defenseResidentsInput)
    ) {
      return { residents: 0, totalPower: 0, canConfirm: false };
    }

    const selectedLoadout = {};

    for (const input of elements.defenseWeaponInputs || []) {
      const weaponId = getWeaponInputId(input, "defenseWeaponInput");

      if (!weaponId) {
        continue;
      }

      const maxInventory = Number.parseInt(input.max || "0", 10) || 0;
      const amount = clamp(Number.parseInt(input.value || "0", 10) || 0, 0, maxInventory);
      input.value = String(amount);

      if (amount > 0) {
        selectedLoadout[weaponId] = amount;
      }
    }

    const residents = Math.max(0, Number.parseInt(elements.defenseResidentsInput.value || "0", 10) || 0);
    elements.defenseResidentsInput.value = String(residents);

    const totalPower = deps.calculateTotalDefensePower({ loadout: selectedLoadout, residents });
    elements.defenseEstimatedPower.textContent = String(totalPower);
    elements.defenseStatus.textContent = totalPower > 0 ? "Připraveno" : "Bez obrany";
    setElementDisabled(elements.defenseConfirmButton, false);

    return { residents, totalPower, canConfirm: true };
  };

  const populateAttackSetupPopup = (district) => {
    if (
      !elements.attackSetupPopup ||
      !elements.attackTargetTitle ||
      !elements.attackSourceSelect ||
      !elements.attackAvailablePopulation ||
      !elements.attackRequiredPopulation ||
      !elements.attackEstimatedPower ||
      !elements.attackStatus
    ) {
      return;
    }

    state.pendingAttackContext = null;

    const interactionState = getInteractionState();
    const ownedInventory = deps.getResolvedWeaponInventory();
    const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);
    const adjacentOwnedDistrictIds = getAdjacentDistrictIdsFromGeometry(getGeometry(), district.id)
      .filter((districtId) => currentPlayerOwnedDistrictIds.has(districtId));
    const atmosphereMeta = getDistrictAtmosphereMeta(district, interactionState);

    deps.renderAttackPanel({
      targetDistrictId: district.id,
      sourceDistrictIds: adjacentOwnedDistrictIds,
      weaponInventory: ownedInventory,
      atmosphereMeta
    }, {}, {
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

    renderAttackSummary();
  };

  const populateAttackConfirmPopup = (district, preparedContext = null) => {
    if (
      !district ||
      !elements.attackConfirmTitle ||
      !elements.attackConfirmSource ||
      !elements.attackConfirmMembers ||
      !elements.attackConfirmPower ||
      !elements.attackConfirmScenario ||
      !elements.attackConfirmDuration ||
      !elements.attackConfirmNote
    ) {
      return;
    }

    const interactionState = getInteractionState();
    const context = preparedContext || state.pendingAttackContext || getPreparedAttackContext(district);
    const atmosphereMeta = getDistrictAtmosphereMeta(district, interactionState);

    state.pendingAttackContext = context;
    renderAttackConfirmationPanel(createAttackConfirmationViewModel({
      district,
      context,
      atmosphereMeta,
      attackCooldownMs: deps.attackCooldownMs
    }), elements);
  };

  const populateRobberySetupPopup = (district) => {
    if (
      !elements.robberySetupPopup ||
      !elements.robberyTargetTitle ||
      !isHtmlSelectElement(elements.robberySourceSelect) ||
      !elements.robberyAvailableMembers ||
      !isHtmlInputElement(elements.robberyMemberInput) ||
      !elements.robberyStatus
    ) {
      return;
    }

    const adjacentOwnedDistrictIds = getAdjacentOwnedDistrictIds(district);
    const atmosphereMeta = getDistrictAtmosphereMeta(district, getInteractionState());

    applyDistrictAtmosphere({
      card: elements.robberySetupCard,
      imageElement: elements.robberySetupAtmosphereImage,
      labelElement: elements.robberySetupAtmosphereLabel,
      atmosphereMeta
    });

    elements.robberyTargetTitle.textContent = `District ${district.id}`;
    renderSourceSelect(elements.robberySourceSelect, adjacentOwnedDistrictIds);
    elements.robberyMemberInput.value = "0";
    elements.robberyMemberInput.max = String(getAvailableAttackPopulation());
    renderRobberySummary();
  };

  const populateRobberyConfirmPopup = (district) => {
    if (
      !district ||
      !elements.robberyConfirmTitle ||
      !elements.robberyConfirmSource ||
      !elements.robberyConfirmMembers ||
      !elements.robberyConfirmDuration ||
      !elements.robberyConfirmNote
    ) {
      return;
    }

    const atmosphereMeta = getDistrictAtmosphereMeta(district, getInteractionState());
    const { deployedMembers, canConfirm } = renderRobberySummary();
    const sourceDistrictId = isHtmlSelectElement(elements.robberySourceSelect) ? elements.robberySourceSelect.value : "";

    renderRobberyConfirmationPanel(createRobberyConfirmationViewModel({
      district,
      sourceDistrictId,
      deployedMembers,
      canConfirm,
      robberyCooldownMs: deps.robberyCooldownMs,
      atmosphereMeta
    }), elements);
  };

  const populateDefenseSetupPopup = (district) => {
    if (
      !elements.defenseSetupPopup ||
      !elements.defenseTargetTitle ||
      !isHtmlInputElement(elements.defenseResidentsInput) ||
      !elements.defenseStatus ||
      !elements.defenseEstimatedPower
    ) {
      return;
    }

    const ownedInventory = deps.getResolvedWeaponInventory();
    const currentDefense = deps.getDistrictDefenseState(district.id);
    const atmosphereMeta = getDistrictAtmosphereMeta(district, getInteractionState());

    applyDistrictAtmosphere({
      card: elements.defenseSetupCard,
      imageElement: elements.defenseSetupAtmosphereImage,
      labelElement: elements.defenseSetupAtmosphereLabel,
      atmosphereMeta
    });

    elements.defenseTargetTitle.textContent = `District ${district.id}`;

    for (const ownedElement of elements.defenseOwnedElements || []) {
      const weaponId = getWeaponInputId(ownedElement, "defenseOwned");

      if (!weaponId) {
        continue;
      }

      const currentAmount = currentDefense.loadout[weaponId] ?? 0;
      ownedElement.textContent = String((ownedInventory[weaponId] ?? 0) + currentAmount);
    }

    for (const input of elements.defenseWeaponInputs || []) {
      const weaponId = getWeaponInputId(input, "defenseWeaponInput");
      const currentAmount = weaponId ? currentDefense.loadout[weaponId] ?? 0 : 0;
      const availableAmount = weaponId ? (ownedInventory[weaponId] ?? 0) + currentAmount : 0;
      input.max = String(availableAmount);
      input.value = String(currentAmount);
      setElementDisabled(input, availableAmount <= 0 && currentAmount <= 0);
    }

    elements.defenseResidentsInput.value = String(currentDefense.residents);
    renderDefenseSummary();
  };

  const populateTrapConfirmPopup = (district) => {
    if (!district || !elements.trapConfirmTitle || !elements.trapConfirmCooldown || !elements.trapConfirmNote) {
      return;
    }

    const atmosphereMeta = getDistrictAtmosphereMeta(district, getInteractionState());
    const currentTrapDistrictId = deps.getCurrentPlayerTrapDistrictId();
    const trapMoveCooldownSeconds = deps.getCurrentPlayerTrapMoveCooldownSeconds();

    renderTrapConfirmationPanel(createTrapConfirmationViewModel({
      district,
      currentTrapDistrictId,
      trapMoveCooldownSeconds,
      atmosphereMeta
    }), elements);
  };

  const populateSpyConfirmPopup = (district) => {
    if (
      !district ||
      !elements.spyConfirmTitle ||
      !elements.spyConfirmSource ||
      !elements.spyConfirmAvailable ||
      !elements.spyConfirmDuration ||
      !elements.spyConfirmNote
    ) {
      return;
    }

    const interactionState = getInteractionState();
    const atmosphereMeta = getDistrictAtmosphereMeta(district, interactionState);
    const adjacentOwnedDistrictIds = getAdjacentOwnedDistrictIds(district);
    const spyState = deps.getResolvedSpyState();

    renderSpyConfirmationPanel(createSpyConfirmationViewModel({
      district,
      adjacentOwnedDistrictIds,
      spyState,
      spyCooldownMs: deps.spyCooldownMs,
      atmosphereMeta
    }), elements);
  };

  const populateOccupyConfirmPopup = (district) => {
    if (
      !district ||
      !elements.occupyConfirmTitle ||
      !elements.occupyConfirmSource ||
      !elements.occupyConfirmCondition ||
      !elements.occupyConfirmDuration ||
      !elements.occupyConfirmNote
    ) {
      return;
    }

    const atmosphereMeta = getDistrictAtmosphereMeta(district, getInteractionState());
    const adjacentOwnedDistrictIds = getAdjacentOwnedDistrictIds(district);
    const spyIntel = deps.getResolvedSpyIntel();
    const canOccupyAfterSpy = spyIntel.occupiableDistrictIds.includes(Number(district.id));

    renderOccupyConfirmationPanel(createOccupyConfirmationViewModel({
      district,
      adjacentOwnedDistrictIds,
      canOccupyAfterSpy,
      atmosphereMeta
    }), elements);
  };

  return {
    clearPendingAttackContext() {
      state.pendingAttackContext = null;
    },
    getPendingAttackContext() {
      return state.pendingAttackContext;
    },
    setPendingAttackContext(context) {
      state.pendingAttackContext = context || null;
    },
    getAvailableAttackPopulation,
    getAdjacentOwnedDistrictIds,
    getPreparedAttackContext,
    renderAttackSummary,
    renderRobberySummary,
    renderDefenseSummary,
    populateAttackSetupPopup,
    populateAttackConfirmPopup,
    populateRobberySetupPopup,
    populateRobberyConfirmPopup,
    populateDefenseSetupPopup,
    populateTrapConfirmPopup,
    populateSpyConfirmPopup,
    populateOccupyConfirmPopup
  };
}
