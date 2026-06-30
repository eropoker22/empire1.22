import { submitServerBountyCommand } from "./runtime.js";

const PAGE_SELECTOR = 'main[data-page="game"]';
const BOUNTY_STORAGE_KEY = "empireStreets.bounty.v1";
const BOUNTY_MINIMUM_CASH = 5_000;
const BOUNTY_REFRESH_MS = 1_000;

const OBJECTIVE_COPY = Object.freeze({
  "attack-player": {
    label: "Útok na hráče",
    summary: "Odměna za úspěšný útok na jakýkoliv district tohoto hráče."
  },
  "attack-district": {
    label: "Útok na district",
    summary: "Odměna za úspěšný útok na vybraný district."
  },
  "destroy-player-district": {
    label: "Zničení districtu",
    summary: "Odměna za zničení některého districtu tohoto hráče."
  }
});

function qs(root, selector) {
  return root?.querySelector?.(selector) || null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMoney(amount) {
  return `${Math.max(0, Math.floor(Number(amount || 0))).toLocaleString("cs-CZ")}$`;
}

function formatDurationMs(ms) {
  const totalSeconds = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
  if (totalSeconds <= 0) {
    return "exp";
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes > 0 ? `${hours}h ${restMinutes}m` : `${hours}h`;
}

function formatObjectiveLabel(objectiveType) {
  return OBJECTIVE_COPY[objectiveType]?.label || OBJECTIVE_COPY["attack-player"].label;
}

function normalizeDistrictNumericId(districtId) {
  const match = String(districtId || "").match(/(\d+)$/u);
  return match ? Number(match[1]) : districtId;
}

function clearLegacyLocalBountyState() {
  try {
    window.localStorage?.removeItem?.(BOUNTY_STORAGE_KEY);
  } catch {
    // Deprecated local bounty state is ignored.
  }
}

function pushBountyStatus(root, state, summary, meta) {
  const stateEl = qs(root, "[data-building-action-state]");
  const summaryEl = qs(root, "[data-building-action-summary]");
  const metaEl = qs(root, "[data-building-action-meta]");

  if (stateEl) {
    stateEl.textContent = state;
    stateEl.classList.remove("building-action-status__state--idle");
  }
  if (summaryEl) {
    summaryEl.textContent = summary;
  }
  if (metaEl) {
    metaEl.textContent = meta;
  }
}

function createEmptyBountyReadModel() {
  return {
    minRewardCleanCash: BOUNTY_MINIMUM_CASH,
    durationOptionsHours: [1, 6, 12, 24],
    currentPlayerCleanCash: 0,
    eligibleTargets: [],
    activeBounties: [],
    recentBountyEvents: []
  };
}

function initBountyRuntime() {
  const root = document.querySelector(PAGE_SELECTOR);
  if (!root) {
    return;
  }

  clearLegacyLocalBountyState();

  const modal = document.getElementById("bounty-modal");
  const backdrop = document.getElementById("bounty-modal-backdrop");
  const closeBtn = document.getElementById("bounty-modal-close");
  const cancelBtn = document.getElementById("bounty-modal-cancel");
  const confirmModal = document.getElementById("bounty-confirm-modal");
  const confirmBackdrop = document.getElementById("bounty-confirm-modal-backdrop");
  const confirmCloseBtn = document.getElementById("bounty-confirm-modal-close");
  const confirmCancelBtn = document.getElementById("bounty-confirm-modal-cancel");
  const confirmSubmitBtn = document.getElementById("bounty-confirm-modal-submit");
  const openButtons = Array.from(new Set([
    ...document.querySelectorAll("[data-bounty-open-trigger]"),
    document.getElementById("map-bounty-open")
  ].filter(Boolean)));
  const targetSelect = document.getElementById("bounty-modal-target");
  const targetPicker = document.getElementById("bounty-target-picker");
  const districtSelect = document.getElementById("bounty-modal-district");
  const cashRange = document.getElementById("bounty-cash-range");
  const cashInput = document.getElementById("bounty-cash-input");
  const cashAvailable = document.getElementById("bounty-cash-available");
  const anonymousInput = document.getElementById("bounty-anonymous-input");
  const previewTarget = document.getElementById("bounty-preview-target");
  const previewValue = document.getElementById("bounty-preview-value");
  const previewType = document.getElementById("bounty-preview-type");
  const previewDuration = document.getElementById("bounty-preview-duration");
  const previewAnonymous = document.getElementById("bounty-preview-anonymous");
  const confirmTarget = document.getElementById("bounty-confirm-target");
  const confirmType = document.getElementById("bounty-confirm-type");
  const confirmValue = document.getElementById("bounty-confirm-value");
  const confirmDuration = document.getElementById("bounty-confirm-duration");
  const confirmAnonymous = document.getElementById("bounty-confirm-anonymous");
  const targetName = document.getElementById("bounty-target-name");
  const targetAlliance = document.getElementById("bounty-target-alliance");
  const targetDistricts = document.getElementById("bounty-target-districts");
  const targetActivity = document.getElementById("bounty-target-activity");
  const targetThreat = document.getElementById("bounty-target-threat");
  const targetAvatar = document.getElementById("bounty-target-avatar");
  const targetAvatarFallback = document.getElementById("bounty-target-avatar-fallback");
  const districtField = document.getElementById("bounty-district-field");
  const submitBtn = document.getElementById("bounty-modal-submit");
  const boardBody = document.getElementById("bounty-board-body");
  const boardEmpty = document.getElementById("bounty-board-empty");
  const huntState = document.getElementById("bounty-hunt-state");
  const huntFill = document.getElementById("bounty-hunt-progress-fill");
  const huntLabel = document.getElementById("bounty-hunt-progress-label");
  const targetStatus = document.getElementById("bounty-target-status");
  const formStatus = document.getElementById("bounty-form-status");
  const previewSummary = document.getElementById("bounty-preview-summary");
  const escrowValue = document.getElementById("bounty-escrow-value");
  const activeCount = document.getElementById("bounty-active-count");
  const submitHint = document.getElementById("bounty-submit-hint");
  const cashPresetButtons = Array.from(modal?.querySelectorAll("[data-bounty-cash-preset]") || []);
  const objectiveInputs = Array.from(modal?.querySelectorAll('input[name="bounty-objective"]') || []);
  const durationInputs = Array.from(modal?.querySelectorAll('input[name="bounty-duration"]') || []);

  if (
    !modal
    || !confirmModal
    || !targetSelect
    || !districtSelect
    || !cashRange
    || !cashInput
    || !anonymousInput
    || !submitBtn
    || !boardBody
    || !boardEmpty
    || !confirmTarget
    || !confirmType
    || !confirmValue
    || !confirmDuration
    || !confirmAnonymous
    || !confirmSubmitBtn
  ) {
    return;
  }

  const uiState = {
    isOpen: false,
    isConfirmOpen: false,
    openLock: 0,
    refreshTimerId: null,
    gameplaySlice: null,
    bounty: createEmptyBountyReadModel(),
    pendingPreview: null,
    isSubmitting: false
  };

  const getBountyReadModel = () => uiState.bounty || createEmptyBountyReadModel();
  const getTargets = () => Array.isArray(getBountyReadModel().eligibleTargets) ? getBountyReadModel().eligibleTargets : [];
  const getSelectedTarget = () => getTargets().find((target) => String(target.playerId) === String(targetSelect.value || "")) || null;
  const getSelectedObjectiveType = () => {
    const selected = objectiveInputs.find((input) => input.checked);
    return OBJECTIVE_COPY[String(selected?.value || "")] ? String(selected.value) : "attack-player";
  };
  const getSelectedDurationHours = () => {
    const selected = durationInputs.find((input) => input.checked);
    const value = Math.floor(Number(selected?.value || 6));
    const options = getBountyReadModel().durationOptionsHours || [1, 6, 12, 24];
    return options.includes(value) ? value : options[0] || 1;
  };

  const setStatusLine = (message, state = "idle") => {
    if (formStatus) {
      formStatus.textContent = message;
      formStatus.dataset.state = state;
    }
    if (submitHint) {
      submitHint.textContent = message;
      submitHint.dataset.state = state;
    }
  };

  const syncTargetPickerSelection = () => {
    if (!targetPicker) {
      return;
    }
    const selectedValue = String(targetSelect.value || "");
    for (const button of Array.from(targetPicker.querySelectorAll("[data-bounty-target-option]"))) {
      const isSelected = String(button.dataset.bountyTargetOption || "") === selectedValue;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    }
  };

  const renderTargetOptions = () => {
    const targets = getTargets();
    const previous = String(targetSelect.value || "").trim();
    targetSelect.innerHTML = targets.length
      ? targets.map((target) => {
          const disabled = target.canTarget ? "" : " disabled";
          const suffix = target.disabledReason ? ` · ${target.disabledReason}` : ` · ${target.activeDistrictCount} districtů`;
          return `<option value="${escapeHtml(target.playerId)}"${disabled}>${escapeHtml(`${target.name}${suffix}`)}</option>`;
        }).join("")
      : '<option value="">Server zatím neposlal cíle</option>';

    if (targets.some((target) => target.canTarget && String(target.playerId) === previous)) {
      targetSelect.value = previous;
    } else {
      const firstTarget = targets.find((target) => target.canTarget) || targets[0] || null;
      targetSelect.value = firstTarget?.playerId || "";
    }

    if (targetPicker) {
      targetPicker.innerHTML = targets.length
        ? targets.map((target) => `
            <button class="bounty-board__target-option${target.canTarget ? "" : " is-disabled"}" type="button" data-bounty-target-option="${escapeHtml(target.playerId)}" aria-pressed="false"${target.canTarget ? "" : " disabled"}>
              <span class="bounty-board__target-option-name">${escapeHtml(target.name)}</span>
              <span class="bounty-board__target-option-meta">${escapeHtml(target.disabledReason || `${target.activeDistrictCount} districtů`)}</span>
            </button>
          `).join("")
        : '<div class="bounty-board__target-empty">Server zatím neposlal dostupné cíle.</div>';
      syncTargetPickerSelection();
    }
  };

  const renderDistrictOptions = () => {
    const target = getSelectedTarget();
    const previous = String(districtSelect.value || "").trim();
    const districts = Array.isArray(target?.districts) ? target.districts : [];
    const objective = getSelectedObjectiveType();

    districtSelect.innerHTML = [
      objective === "attack-district"
        ? '<option value="">Vyber district</option>'
        : '<option value="">Jakýkoli district</option>',
      ...districts.map((district) => `<option value="${escapeHtml(district.districtId)}">${escapeHtml(`${district.name} · ${district.zone}`)}</option>`)
    ].join("");

    if (districts.some((district) => String(district.districtId) === previous)) {
      districtSelect.value = previous;
    } else if (objective === "attack-district" && districts[0]?.districtId) {
      districtSelect.value = districts[0].districtId;
    } else {
      districtSelect.value = "";
    }

    const needsDistrict = objective === "attack-district";
    districtField.hidden = !needsDistrict;
    districtSelect.disabled = !needsDistrict;
  };

  const syncInputs = () => {
    const bounty = getBountyReadModel();
    const cleanCash = Math.max(0, Math.floor(Number(bounty.currentPlayerCleanCash || 0)));
    const minReward = Math.max(BOUNTY_MINIMUM_CASH, Math.floor(Number(bounty.minRewardCleanCash || BOUNTY_MINIMUM_CASH)));
    const selectedValue = Math.max(Math.floor(Number(cashInput.value || 0)), Math.floor(Number(cashRange.value || 0)));
    const nextValue = cleanCash >= minReward
      ? Math.min(cleanCash, Math.max(minReward, selectedValue || minReward))
      : Math.min(cleanCash, selectedValue);

    cashRange.max = String(cleanCash);
    cashInput.max = String(cleanCash);
    cashRange.min = String(cleanCash >= minReward ? minReward : 0);
    cashInput.min = String(cleanCash >= minReward ? minReward : 0);
    cashRange.value = String(nextValue);
    cashInput.value = String(nextValue);
    cashAvailable.textContent = `Máš: ${formatMoney(cleanCash)}`;

    const options = Array.isArray(bounty.durationOptionsHours) ? bounty.durationOptionsHours : [1, 6, 12, 24];
    for (const input of durationInputs) {
      input.disabled = !options.includes(Math.floor(Number(input.value || 0)));
    }
  };

  const syncTargetCard = () => {
    const target = getSelectedTarget();
    if (!target) {
      targetName.textContent = "Nevybrán cíl";
      targetAlliance.textContent = "Aliance: -";
      targetDistricts.textContent = "Districtů: 0";
      targetActivity.textContent = "Server target list není dostupný.";
      targetThreat.textContent = "Offline";
      targetThreat.dataset.tone = "low";
      targetAvatar.src = "";
      targetAvatar.classList.add("is-empty");
      targetAvatarFallback.textContent = "??";
      if (targetStatus) {
        targetStatus.textContent = "Bez serverového cíle nelze bounty vypsat.";
        targetStatus.dataset.state = "warning";
      }
      return null;
    }

    const threatTone = target.activeDistrictCount >= 5 ? "extreme" : target.activeDistrictCount >= 3 ? "high" : target.activeDistrictCount >= 1 ? "medium" : "low";
    targetName.textContent = target.name;
    targetAlliance.textContent = `Aliance: ${target.allianceId || "Bez aliance"}`;
    targetDistricts.textContent = `Aktivní districty: ${target.activeDistrictCount}`;
    targetActivity.textContent = target.canTarget ? "Status: dostupný cíl" : `Status: ${target.disabledReason || "blokováno"}`;
    targetThreat.textContent = target.canTarget ? `${target.activeDistrictCount} DISTRICTS` : "BLOCKED";
    targetThreat.dataset.tone = target.canTarget ? threatTone : "low";
    targetAvatar.src = "";
    targetAvatar.classList.add("is-empty");
    targetAvatarFallback.textContent = target.name.slice(0, 2).toUpperCase();
    if (targetStatus) {
      targetStatus.textContent = target.canTarget
        ? `${target.name} má ${target.activeDistrictCount} aktivních districtů.`
        : target.disabledReason || "Cíl nejde označit.";
      targetStatus.dataset.state = target.canTarget ? "ready" : "danger";
    }
    return target;
  };

  const resolvePreview = () => {
    const target = syncTargetCard();
    const objectiveType = getSelectedObjectiveType();
    const selectedDistrictId = objectiveType === "attack-district" ? String(districtSelect.value || "") || null : null;
    const rewardCleanCash = Math.max(0, Math.floor(Number(cashInput.value || cashRange.value || 0)));
    const minReward = Math.max(BOUNTY_MINIMUM_CASH, Math.floor(Number(getBountyReadModel().minRewardCleanCash || BOUNTY_MINIMUM_CASH)));
    const selectedDistrict = selectedDistrictId
      ? target?.districts?.find((district) => district.districtId === selectedDistrictId) || null
      : null;
    const validation = resolveValidationMessage({ target, objectiveType, selectedDistrictId, rewardCleanCash, minReward });

    return {
      target,
      objectiveType,
      selectedDistrictId,
      selectedDistrict,
      rewardCleanCash,
      minReward,
      durationHours: getSelectedDurationHours(),
      isAnonymous: Boolean(anonymousInput.checked),
      validation
    };
  };

  const resolveValidationMessage = ({ target, objectiveType, selectedDistrictId, rewardCleanCash, minReward }) => {
    if (!target) {
      return { state: "warning", message: "Vyber cílového hráče ze serverového seznamu." };
    }
    if (!target.canTarget) {
      return { state: "danger", message: target.disabledReason || "Cíl teď nejde označit." };
    }
    if (rewardCleanCash < minReward) {
      return { state: "danger", message: `Minimum escrow je ${formatMoney(minReward)} clean cash.` };
    }
    if (rewardCleanCash > Math.max(0, Math.floor(Number(getBountyReadModel().currentPlayerCleanCash || 0)))) {
      return { state: "danger", message: "Nemáš dost clean cash pro escrow." };
    }
    if (objectiveType === "attack-district" && !selectedDistrictId) {
      return { state: "warning", message: "Vyber konkrétní district cílového hráče." };
    }
    return { state: "ready", message: "Kontrakt je připravený k potvrzení." };
  };

  const syncPreview = () => {
    const preview = resolvePreview();
    const districtLabel = preview.selectedDistrict?.name || (preview.selectedDistrictId ? preview.selectedDistrictId : "");
    previewTarget.textContent = preview.target
      ? (districtLabel ? `${preview.target.name} · ${districtLabel}` : preview.target.name)
      : "Nevybrán cíl";
    previewValue.textContent = formatMoney(preview.rewardCleanCash);
    previewType.textContent = formatObjectiveLabel(preview.objectiveType);
    previewDuration.textContent = `${preview.durationHours}h`;
    previewAnonymous.textContent = preview.isAnonymous ? "Anonymní" : "Veřejná";
    if (previewSummary) {
      previewSummary.textContent = preview.target
        ? OBJECTIVE_COPY[preview.objectiveType]?.summary || "Server bounty kontrakt."
        : "Kontrakt čeká na serverový cíl.";
    }
    submitBtn.disabled = preview.validation.state !== "ready" || uiState.isSubmitting;
    setStatusLine(preview.validation.message, preview.validation.state);
    return preview;
  };

  const renderBoard = () => {
    const entries = Array.isArray(getBountyReadModel().activeBounties) ? getBountyReadModel().activeBounties : [];
    const activeEntries = entries
      .sort((left, right) => Number(right.rewardCleanCash || 0) - Number(left.rewardCleanCash || 0))
      .slice(0, 20);
    const activeTotal = activeEntries
      .filter((entry) => entry.status === "active")
      .reduce((sum, entry) => sum + Math.max(0, Number(entry.rewardCleanCash || 0)), 0);

    boardBody.innerHTML = activeEntries.map((entry) => {
      const canCancel = Boolean(entry.canCancel);
      const districtLabel = entry.targetDistrictName || entry.targetDistrictId || "Jakýkoli";
      return `
        <tr data-bounty-row="${escapeHtml(entry.bountyId)}" data-bounty-status="${escapeHtml(entry.status)}">
          <td>${escapeHtml(entry.targetPlayerName || entry.targetPlayerId)}</td>
          <td>${escapeHtml(entry.objectiveLabel || formatObjectiveLabel(entry.objectiveType))}</td>
          <td>${escapeHtml(districtLabel)}</td>
          <td>${escapeHtml(formatMoney(entry.rewardCleanCash))}</td>
          <td>${escapeHtml(entry.createdByLabel || "-")}</td>
          <td>${escapeHtml(entry.status === "active" ? formatDurationMs(entry.remainingMs) : "-")}</td>
          <td>${escapeHtml(entry.status)}</td>
          <td><button type="button" class="bounty-board__row-action" data-bounty-cancel="${escapeHtml(entry.bountyId)}"${canCancel ? "" : " disabled"}>${canCancel ? "Zrušit" : "Mapa TODO"}</button></td>
        </tr>
      `;
    }).join("");

    boardEmpty.hidden = activeEntries.length > 0;
    if (escrowValue) {
      escrowValue.textContent = formatMoney(activeTotal);
    }
    if (activeCount) {
      activeCount.textContent = String(activeEntries.filter((entry) => entry.status === "active").length);
    }
    if (huntState && huntFill && huntLabel) {
      huntState.textContent = "SERVER ESCROW";
      huntState.dataset.mode = activeTotal >= 10_000 ? "active" : "charging";
      huntFill.style.width = `${Math.max(0, Math.min(100, Math.round((activeTotal / 10_000) * 100)))}%`;
      huntLabel.textContent = activeTotal > 0
        ? `Na serveru je zamčeno ${formatMoney(activeTotal)} v aktivních bounty.`
        : "Vypsaná bounty se po potvrzení zamkne serverově v escrow.";
    }
  };

  const refreshView = () => {
    renderTargetOptions();
    renderDistrictOptions();
    syncInputs();
    syncPreview();
    renderBoard();
    publishBountyState();
  };

  const openModal = () => {
    modal.classList.remove("hidden");
    uiState.isOpen = true;
    refreshView();
  };

  const closeModal = () => {
    modal.classList.add("hidden");
    uiState.isOpen = false;
  };

  const openConfirmModal = (preview) => {
    const districtLabel = preview.selectedDistrict?.name || preview.selectedDistrictId || "";
    confirmTarget.textContent = preview.target
      ? (districtLabel ? `${preview.target.name} · ${districtLabel}` : preview.target.name)
      : "Nevybrán cíl";
    confirmType.textContent = formatObjectiveLabel(preview.objectiveType);
    confirmValue.textContent = formatMoney(preview.rewardCleanCash);
    confirmDuration.textContent = `${preview.durationHours}h`;
    confirmAnonymous.textContent = preview.isAnonymous ? "Anonymní" : "Veřejná";
    uiState.pendingPreview = preview;
    confirmModal.classList.remove("hidden");
    uiState.isConfirmOpen = true;
  };

  const closeConfirmModal = () => {
    confirmModal.classList.add("hidden");
    uiState.isConfirmOpen = false;
    uiState.pendingPreview = null;
  };

  const handleSubmit = () => {
    const preview = syncPreview();
    if (preview.validation.state !== "ready") {
      pushBountyStatus(root, "Bounty", preview.validation.message, "Server bounty nebyla odeslána");
      return;
    }
    openConfirmModal(preview);
  };

  const confirmSubmit = async () => {
    const preview = syncPreview();
    if (preview.validation.state !== "ready") {
      setStatusLine(preview.validation.message, preview.validation.state);
      return;
    }
    uiState.isSubmitting = true;
    confirmSubmitBtn.disabled = true;
    setStatusLine("Posílám bounty na server...", "ready");

    try {
      const payload = {
        targetPlayerId: preview.target.playerId,
        objectiveType: preview.objectiveType,
        targetDistrictId: preview.objectiveType === "attack-district" ? preview.selectedDistrictId : null,
        rewardCleanCash: preview.rewardCleanCash,
        durationHours: preview.durationHours,
        isAnonymous: preview.isAnonymous
      };
      const response = await submitServerBountyCommand({ action: "create", payload });
      if (!response?.accepted) {
        const message = response?.errors?.[0]?.message || "Server bounty odmítl.";
        setStatusLine(message, "danger");
        pushBountyStatus(root, "Bounty odmítnuta", message, "Escrow se nezamklo");
        return;
      }
      closeConfirmModal();
      refreshFromResponse(response);
      pushBountyStatus(
        root,
        "Bounty",
        `Bounty vypsaná na ${preview.target.name}.`,
        `${formatObjectiveLabel(preview.objectiveType)} · ${formatMoney(preview.rewardCleanCash)} · server escrow`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bounty submit selhal.";
      setStatusLine(message, "danger");
      pushBountyStatus(root, "Bounty chyba", message, "Escrow se nezamklo");
    } finally {
      uiState.isSubmitting = false;
      confirmSubmitBtn.disabled = false;
      syncPreview();
    }
  };

  const handleCancelBounty = async (bountyId) => {
    const normalizedId = String(bountyId || "").trim();
    if (!normalizedId) {
      return;
    }
    pushBountyStatus(root, "Bounty", "Posílám zrušení bounty na server...", normalizedId);
    const response = await submitServerBountyCommand({
      action: "cancel",
      payload: { bountyId: normalizedId }
    });
    if (!response?.accepted) {
      pushBountyStatus(root, "Bounty odmítnuta", response?.errors?.[0]?.message || "Bounty nejde zrušit.", "Escrow se neměnil");
      return;
    }
    refreshFromResponse(response);
    pushBountyStatus(root, "Bounty zrušena", "Server vrátil escrow zadavateli.", normalizedId);
  };

  const refreshFromResponse = (response) => {
    if (response?.readModel) {
      uiState.gameplaySlice = response.readModel;
      uiState.bounty = response.readModel.bounty || createEmptyBountyReadModel();
      refreshView();
    }
  };

  const publishBountyState = () => {
    const bounty = getBountyReadModel();
    window.empireStreetsBountyState = {
      getState: () => bounty,
      getDistrictMarkers: () => {
        const markerMap = new Map();
        const targetsById = new Map(getTargets().map((target) => [target.playerId, target]));
        for (const entry of bounty.activeBounties || []) {
          if (entry.status !== "active") {
            continue;
          }
          const target = targetsById.get(entry.targetPlayerId);
          const districtIds = entry.targetDistrictId
            ? [entry.targetDistrictId]
            : (target?.districts || []).map((district) => district.districtId);
          for (const districtId of districtIds) {
            markerMap.set(normalizeDistrictNumericId(districtId), {
              label: entry.targetPlayerName,
              totalValue: Number(entry.rewardCleanCash || 0),
              color: "#fb7185"
            });
          }
        }
        return markerMap;
      },
      openModal: () => {
        document.dispatchEvent(new CustomEvent("empire:open-bounty-modal"));
      }
    };
    window.dispatchEvent(new CustomEvent("empire:bounty-state-changed", { detail: bounty }));
  };

  const onOpenTrigger = (event) => {
    event?.preventDefault?.();
    const now = Date.now();
    if (now - uiState.openLock < 220) {
      return;
    }
    uiState.openLock = now;
    openModal();
  };

  openButtons.forEach((button) => button.addEventListener("click", onOpenTrigger));
  document.addEventListener("empire:open-bounty-modal", onOpenTrigger);
  backdrop?.addEventListener("click", closeModal);
  closeBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);
  confirmBackdrop?.addEventListener("click", closeConfirmModal);
  confirmCloseBtn?.addEventListener("click", closeConfirmModal);
  confirmCancelBtn?.addEventListener("click", closeConfirmModal);
  confirmSubmitBtn.addEventListener("click", () => void confirmSubmit());
  submitBtn.addEventListener("click", handleSubmit);
  targetSelect.addEventListener("change", () => {
    syncTargetPickerSelection();
    renderDistrictOptions();
    syncPreview();
  });
  targetPicker?.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-bounty-target-option]");
    if (!button || button.disabled) {
      return;
    }
    targetSelect.value = String(button.dataset.bountyTargetOption || "");
    syncTargetPickerSelection();
    renderDistrictOptions();
    syncPreview();
  });
  districtSelect.addEventListener("change", syncPreview);
  cashRange.addEventListener("input", () => {
    cashInput.value = cashRange.value;
    syncPreview();
  });
  cashInput.addEventListener("input", () => {
    const max = Math.max(0, Math.floor(Number(cashInput.max || 0)));
    const value = Math.min(max, Math.max(0, Math.floor(Number(cashInput.value || 0))));
    cashInput.value = String(value);
    cashRange.value = String(value);
    syncPreview();
  });
  cashPresetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const preset = String(button.dataset.bountyCashPreset || "").trim();
      const max = Math.max(0, Math.floor(Number(cashInput.max || 0)));
      const nextValue = preset === "max" ? max : Math.max(0, Math.floor(Number(preset || 0)));
      cashInput.value = String(Math.min(max, nextValue));
      cashRange.value = cashInput.value;
      syncPreview();
    });
  });
  anonymousInput.addEventListener("change", syncPreview);
  objectiveInputs.forEach((input) => input.addEventListener("change", () => {
    renderDistrictOptions();
    syncPreview();
  }));
  durationInputs.forEach((input) => input.addEventListener("change", syncPreview));
  boardBody.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-bounty-cancel]");
    if (!button || button.disabled) {
      return;
    }
    void handleCancelBounty(button.dataset.bountyCancel);
  });

  window.addEventListener("empire:bounty-action-resolved", () => {
    pushBountyStatus(root, "Bounty", "Legacy bounty event ignorován.", "Claim řeší pouze server po skutečné akci");
  });
  document.addEventListener("empire:gameplay-slice-rendered", (event) => {
    uiState.gameplaySlice = event?.detail?.gameplaySlice || null;
    uiState.bounty = uiState.gameplaySlice?.bounty || createEmptyBountyReadModel();
    if (uiState.isOpen) {
      refreshView();
    } else {
      publishBountyState();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }
    if (uiState.isConfirmOpen) {
      closeConfirmModal();
      return;
    }
    if (uiState.isOpen) {
      closeModal();
    }
  });

  uiState.refreshTimerId = window.setInterval(() => {
    if (uiState.isOpen) {
      renderBoard();
      syncPreview();
    }
    publishBountyState();
  }, BOUNTY_REFRESH_MS);

  window.addEventListener("beforeunload", () => {
    if (uiState.refreshTimerId !== null) {
      window.clearInterval(uiState.refreshTimerId);
    }
  });

  window.Empire = window.Empire || {};
  window.Empire.openBountyModalShortcut = () => {
    document.dispatchEvent(new CustomEvent("empire:open-bounty-modal"));
  };

  closeModal();
  publishBountyState();
}

if (typeof document !== "undefined") {
  initBountyRuntime();
}
