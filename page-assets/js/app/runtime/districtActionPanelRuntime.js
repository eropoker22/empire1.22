import {
  canRenderAttackConfirmationPanel,
  canRenderOccupyConfirmationPanel,
  canRenderRobberyConfirmationPanel,
  canRenderSpyConfirmationPanel,
  canRenderTrapConfirmationPanel,
  renderPreparedAttackConfirmationPanel,
  renderPreparedOccupyConfirmationPanel,
  renderPreparedRobberyConfirmationPanel,
  renderPreparedSpyConfirmationPanel,
  renderPreparedTrapConfirmationPanel
} from "../ui/districtActionConfirmationPanel.js";
import {
  createAttackSetupViewModel,
  createDefenseSetupViewModel,
  createRobberySetupViewModel,
  renderAttackSetupPanel,
  renderDefenseSetupPanel,
  renderRobberySetupPanel
} from "../ui/districtActionSetupPanel.js";

function isHtmlInputElement(element) {
  return Boolean(element && typeof element === "object" && "value" in element);
}

function isHtmlSelectElement(element) {
  return Boolean(element && typeof element === "object" && "value" in element && typeof element.replaceChildren === "function");
}

function setElementDisabled(element, disabled) {
  if (element && "disabled" in element) {
    element.disabled = Boolean(disabled);
  }
}

function setElementText(element, value) {
  if (element) {
    element.textContent = String(value ?? "");
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

function getWeaponInputId(input, datasetKey) {
  return String(input?.dataset?.[datasetKey] || "").trim();
}

function normalizePowerResult(result) {
  if (result && typeof result === "object") {
    const totalPower = Number(result.totalPower ?? result.power ?? 0) || 0;
    const bonusPowerLabel = String(result.bonusPowerLabel || "").trim();
    return {
      totalPower,
      basePower: Number(result.basePower ?? totalPower) || 0,
      bonusPower: Number(result.bonusPower || 0) || 0,
      bonusPowerLabel,
      powerLabel: bonusPowerLabel ? `${formatPanelPower(totalPower)} (${bonusPowerLabel})` : formatPanelPower(totalPower)
    };
  }
  const totalPower = Number(result || 0) || 0;
  return {
    totalPower,
    basePower: totalPower,
    bonusPower: 0,
    bonusPowerLabel: "",
    powerLabel: formatPanelPower(totalPower)
  };
}

function formatPanelPower(value = 0) {
  const rounded = Math.round(Number(value || 0) * 10) / 10;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace(/0+$/u, "").replace(/\.$/u, "");
}

export function createDistrictActionPanelRuntime(deps = {}) {
  const elements = deps.elements || {};
  const state = {
    pendingAttackContext: null,
    pendingRobberyDistrict: null
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
  const getRobberyCooldownView = typeof deps.getRobberyCooldownView === "function"
    ? deps.getRobberyCooldownView
    : () => ({ effectiveCooldownMs: deps.robberyCooldownMs, label: "" });
  const getOccupyCooldownView = typeof deps.getOccupyCooldownView === "function"
    ? deps.getOccupyCooldownView
    : () => ({ effectiveCooldownMs: deps.occupyCooldownMs, label: "" });

  const getAvailableAttackPopulation = () => {
    const rawValue = elements.gangMembersValue?.textContent || "0";
    return Number.parseInt(rawValue.replace(/[^\d]/g, ""), 10) || 0;
  };
  const getAttackSetupWeapons = typeof deps.getAttackSetupWeapons === "function"
    ? deps.getAttackSetupWeapons
    : () => deps.attackSetupWeapons || {};
  const getAttackWeaponLabels = typeof deps.getAttackWeaponLabels === "function"
    ? deps.getAttackWeaponLabels
    : () => deps.attackWeaponLabels || {};

  const getAvailableSpies = () => {
    if (typeof deps.getResolvedSpyState !== "function") {
      return 0;
    }

    return Math.max(0, Number(deps.getResolvedSpyState()?.available || 0));
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

  const hasScoutReportForDistrict = (districtId) => {
    const normalizedDistrictId = Number(districtId);
    if (!normalizedDistrictId || typeof deps.getResolvedSpyIntel !== "function") {
      return false;
    }

    const spyIntel = deps.getResolvedSpyIntel() || {};
    return [
      spyIntel.occupiableDistrictIds,
      spyIntel.revealedTypeDistrictIds,
      spyIntel.revealedDefenseDistrictIds
    ].some((districtIds) => Array.isArray(districtIds) && districtIds.map(Number).includes(normalizedDistrictId));
  };

  const createRobberyPreviewForDistrict = (district, sentMembers = 0) => (
    typeof deps.createRobberySetupPreview === "function"
      ? deps.createRobberySetupPreview({
          districtType: district?.districtType,
          districtId: district?.id,
          sentMembers,
          hasScoutReport: hasScoutReportForDistrict(district?.id)
        })
      : null
  );

  const formatRobberyHeatEstimate = (preview, deployedMembers = 0) => {
    const safeMembers = Math.max(0, Math.floor(Number(deployedMembers) || 0));
    if (safeMembers <= 0) {
      return "0";
    }

    return preview?.heatLabel || "0";
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
    const attackSetupWeapons = getAttackSetupWeapons();

    for (const input of elements.attackWeaponInputs || []) {
      const weaponId = getWeaponInputId(input, "attackWeaponInput");

      if (!weaponId || !attackSetupWeapons[weaponId]) {
        continue;
      }

      const amount = Math.max(0, Number.parseInt(input.value || "0", 10) || 0);

      if (amount > 0) {
        selectedLoadout[weaponId] = amount;
      }
    }

    const attackPowerResult = deps.calculateAttackDeployment(selectedLoadout);
    const { totalResidents = 0 } = attackPowerResult || {};
    const powerView = normalizePowerResult(attackPowerResult);
    const totalPower = powerView.totalPower;
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
      powerLabel: powerView.powerLabel,
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
    setElementValidationState(elements.attackStatus, canConfirm ? "" : "error");

    return { totalResidents, totalPower, canConfirm, bonusPowerLabel: powerView.bonusPowerLabel, powerLabel: powerView.powerLabel };
  };

  const getPreparedAttackContext = (district) => {
    if (!district) {
      return null;
    }

    const interactionState = getInteractionState();
    const sourceDistrictId = isHtmlSelectElement(elements.attackSourceSelect) ? elements.attackSourceSelect.value : "";
    const { totalResidents, totalPower, canConfirm, bonusPowerLabel, powerLabel } = renderAttackSummary();
    const worldState = deps.getResolvedWorldState();
    const baseDefensePower = worldState.districtDefenseById?.[district.id]
      ?? deps.estimateDistrictDefense({
        districtType: district.districtType,
        isOccupied: deps.getDistrictOwnerLabel(district, interactionState) !== "Neobsazeno",
        districtId: district.id
      });
    const boostContext = deps.getPlayerAttackBoostContext({
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
      selectedWeapons.push(`${getAttackWeaponLabels()[weaponId] || weaponId} x${amount}`);
    }

    return {
      sourceDistrictId,
      totalResidents,
      totalPower,
      bonusPowerLabel,
      powerLabel,
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
    const remainingMembers = Math.max(0, availableMembers - deployedMembers);
    elements.robberyMemberInput.value = String(deployedMembers);
    elements.robberyAvailableMembers.textContent = String(remainingMembers);

    const hasSourceDistrict = Boolean(elements.robberySourceSelect.value);
    const canConfirm = hasSourceDistrict && deployedMembers > 0;
    const preview = createRobberyPreviewForDistrict(state.pendingRobberyDistrict, deployedMembers);

    elements.robberyStatus.textContent = !hasSourceDistrict
      ? "Chybí sousední district"
      : deployedMembers <= 0
        ? "Vyber členy gangu"
        : "Připraveno";
    setElementValidationState(elements.robberyStatus, canConfirm ? "" : "error");

    if (preview) {
      setElementText(elements.robberyZone, preview.zoneLabel);
      setElementText(elements.robberyRecommendation, `${preview.recommendationLabel} členů`);
      setElementText(elements.robberyRiskLevel, `${preview.previewRiskLabel || preview.riskLabel} · ${preview.previewSuccessChanceLabel || preview.successChanceLabel}`);
      setElementText(elements.robberyLootPreview, preview.previewLootLabel || "Nejistý");
      setElementText(elements.robberyTrapPreview, preview.previewTrapHintLabel || "Neznámá");
      setElementText(elements.robberyScoutReport, preview.scoutReportLabel || "Bez scout reportu");
      setElementText(elements.robberyHeatEstimate, formatRobberyHeatEstimate(preview, deployedMembers));
      setElementText(elements.robberyRiskDescription, preview.previewDescription || preview.riskDescription);
    } else if (deployedMembers <= 0) {
      setElementText(elements.robberyHeatEstimate, "0");
    }

    setElementDisabled(elements.robberyConfirmButton, !canConfirm);

    return { deployedMembers, canConfirm, preview };
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

    const powerView = normalizePowerResult(deps.calculateTotalDefensePower({ loadout: selectedLoadout, residents }));
    const totalPower = powerView.totalPower;
    elements.defenseEstimatedPower.textContent = powerView.powerLabel;
    elements.defenseStatus.textContent = totalPower > 0 ? "Připraveno" : "Bez obrany";
    setElementDisabled(elements.defenseConfirmButton, false);

    return { residents, totalPower, canConfirm: true, bonusPowerLabel: powerView.bonusPowerLabel, powerLabel: powerView.powerLabel };
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

    renderAttackSetupPanel(createAttackSetupViewModel({
      district,
      adjacentOwnedDistrictIds,
      weaponInventory: ownedInventory,
      weaponStats: getAttackSetupWeapons(),
      atmosphereMeta
    }), elements, {
      renderAttackPanel: deps.renderAttackPanel
    });

    renderAttackSummary();
  };

  const populateAttackConfirmPopup = (district, preparedContext = null) => {
    if (!canRenderAttackConfirmationPanel({ district, elements })) {
      return;
    }

    const interactionState = getInteractionState();
    const context = preparedContext || state.pendingAttackContext || getPreparedAttackContext(district);
    const atmosphereMeta = getDistrictAtmosphereMeta(district, interactionState);

    state.pendingAttackContext = context;
    renderPreparedAttackConfirmationPanel({
      district,
      context,
      atmosphereMeta,
      attackCooldownMs: deps.attackCooldownMs
    }, elements);
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
    state.pendingRobberyDistrict = district;

    renderRobberySetupPanel(createRobberySetupViewModel({
      district,
      adjacentOwnedDistrictIds,
      availableMembers: getAvailableAttackPopulation(),
      robberyPreview: createRobberyPreviewForDistrict(district, 0),
      atmosphereMeta
    }), elements);
    renderRobberySummary();
  };

  const populateRobberyConfirmPopup = (district) => {
    if (!canRenderRobberyConfirmationPanel({ district, elements })) {
      return;
    }

    const atmosphereMeta = getDistrictAtmosphereMeta(district, getInteractionState());
    const { deployedMembers, canConfirm } = renderRobberySummary();
    const sourceDistrictId = isHtmlSelectElement(elements.robberySourceSelect) ? elements.robberySourceSelect.value : "";
    const cooldownView = getRobberyCooldownView();

    renderPreparedRobberyConfirmationPanel({
      district,
      sourceDistrictId,
      deployedMembers,
      canConfirm,
      robberyCooldownMs: cooldownView.effectiveCooldownMs || deps.robberyCooldownMs,
      robberyCooldownLabel: cooldownView.label || "",
      atmosphereMeta
    }, elements);
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

    renderDefenseSetupPanel(createDefenseSetupViewModel({
      district,
      weaponInventory: ownedInventory,
      currentDefense,
      atmosphereMeta
    }), elements);
    renderDefenseSummary();
  };

  const populateTrapConfirmPopup = (district) => {
    if (!canRenderTrapConfirmationPanel({ district, elements })) {
      return;
    }

    const atmosphereMeta = getDistrictAtmosphereMeta(district, getInteractionState());
    const currentTrapDistrictId = deps.getCurrentPlayerTrapDistrictId();
    const trapMoveCooldownSeconds = deps.getCurrentPlayerTrapMoveCooldownSeconds();

    renderPreparedTrapConfirmationPanel({
      district,
      currentTrapDistrictId,
      trapMoveCooldownSeconds,
      atmosphereMeta
    }, elements);
  };

  const populateSpyConfirmPopup = (district) => {
    if (!canRenderSpyConfirmationPanel({ district, elements })) {
      return;
    }

    const interactionState = getInteractionState();
    const atmosphereMeta = getDistrictAtmosphereMeta(district, interactionState);
    const adjacentOwnedDistrictIds = getAdjacentOwnedDistrictIds(district);
    const spyState = deps.getResolvedSpyState();

    renderPreparedSpyConfirmationPanel({
      district,
      adjacentOwnedDistrictIds,
      spyState,
      spyCooldownMs: deps.spyCooldownMs,
      atmosphereMeta
    }, elements);
  };

  const populateOccupyConfirmPopup = (district) => {
    if (!canRenderOccupyConfirmationPanel({ district, elements })) {
      return;
    }

    const interactionState = getInteractionState();
    const atmosphereMeta = getDistrictAtmosphereMeta(district, interactionState);
    const adjacentOwnedDistrictIds = getAdjacentOwnedDistrictIds(district);
    const ownedDistrictCount = getCurrentPlayerOwnedDistrictIds(interactionState).size;
    const spyIntel = deps.getResolvedSpyIntel();
    const canOccupyAfterSpy = spyIntel.occupiableDistrictIds.includes(Number(district.id));
    const cooldownView = getOccupyCooldownView();

    renderPreparedOccupyConfirmationPanel({
      district,
      adjacentOwnedDistrictIds,
      canOccupyAfterSpy,
      ownedDistrictCount,
      availablePopulation: getAvailableAttackPopulation(),
      occupyCooldownMs: cooldownView.effectiveCooldownMs || deps.occupyCooldownMs,
      occupyCooldownLabel: cooldownView.label || "",
      atmosphereMeta
    }, elements);
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
