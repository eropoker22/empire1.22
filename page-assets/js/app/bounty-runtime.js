import { submitServerBountyCommand } from "./runtime.js";

const PAGE_SELECTOR = 'main[data-page="game"]';
const BOUNTY_STORAGE_KEY = "empireStreets.bounty.v1";
const BOUNTY_MINIMUM_CASH = 5_000;
const BOUNTY_REFRESH_MS = 1_000;
const LOWKEYLAD_AVATAR_SRC = "../img/avatars/Mafia/grok_image_1773619750005.jpg";

const DEV_BOUNTY_TARGETS = Object.freeze([
  {
    playerId: "dev-bounty-lowkeylad",
    name: "LowKeyLad",
    avatarSrc: LOWKEYLAD_AVATAR_SRC,
    factionLabel: "Street Crew",
    allianceId: null,
    isAlly: false,
    isSelf: false,
    activeDistrictCount: 3,
    canTarget: true,
    disabledReason: null,
    districts: [
      { districtId: "district-7", name: "District 7", zone: "Residential", status: "active" },
      { districtId: "district-12", name: "District 12", zone: "Commercial", status: "active" },
      { districtId: "district-21", name: "District 21", zone: "Park", status: "active" }
    ]
  },
  {
    playerId: "dev-bounty-neonviktor",
    name: "NeonViktor",
    factionLabel: "Chrome Syndicate",
    allianceId: null,
    isAlly: false,
    isSelf: false,
    activeDistrictCount: 2,
    canTarget: true,
    disabledReason: null,
    districts: [
      { districtId: "district-4", name: "District 4", zone: "Industrial", status: "active" },
      { districtId: "district-18", name: "District 18", zone: "Downtown", status: "active" }
    ]
  },
  {
    playerId: "dev-bounty-sablequeen",
    name: "SableQueen",
    factionLabel: "Night Market",
    allianceId: null,
    isAlly: false,
    isSelf: false,
    activeDistrictCount: 4,
    canTarget: true,
    disabledReason: null,
    districts: [
      { districtId: "district-2", name: "District 2", zone: "Residential", status: "active" },
      { districtId: "district-9", name: "District 9", zone: "Commercial", status: "active" },
      { districtId: "district-16", name: "District 16", zone: "Industrial", status: "active" },
      { districtId: "district-24", name: "District 24", zone: "Park", status: "active" }
    ]
  }
]);

const OBJECTIVE_COPY = Object.freeze({
  "attack-player": {
    label: "Útok na hráče",
    summary: "Odměna za úspěšný útok na jakýkoliv district tohoto hráče.",
    serverObjectiveType: "attack-player",
    requiresDistrict: false
  },
  "attack-district": {
    label: "Obsadit district",
    summary: "Odměna za úspěšné obsazení vybraného districtu.",
    serverObjectiveType: "attack-district",
    requiresDistrict: true
  },
  "destroy-player-district": {
    label: "Zničit jakýkoli district",
    summary: "Odměna za zničení některého districtu tohoto hráče.",
    serverObjectiveType: "destroy-player-district",
    requiresDistrict: false
  },
  "destroy-selected-district": {
    label: "Zničit vybraný district",
    summary: "Odměna za zničení vybraného districtu.",
    serverObjectiveType: "destroy-player-district",
    requiresDistrict: true
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

function formatRewardValue(amount) {
  return `${Math.max(0, Math.floor(Number(amount || 0))).toLocaleString("cs-CZ")} $`;
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

function formatObjectiveIcon(objectiveType) {
  if (objectiveType === "attack-district") {
    return "♜";
  }
  if (objectiveType === "destroy-player-district") {
    return "✹";
  }
  if (objectiveType === "destroy-selected-district") {
    return "⌁";
  }
  return "⌖";
}

function formatBountyStatus(status) {
  if (status === "claimed") {
    return "Splněno";
  }
  if (status === "expired") {
    return "Vypršelo";
  }
  if (status === "cancelled") {
    return "Zrušeno";
  }
  return "Aktivní";
}

function formatBountyCreator(entry) {
  const rawLabel = String(entry?.createdByLabel || entry?.createdByPlayerName || entry?.createdByPlayerId || "").trim();
  if (entry?.isAnonymous || /^anonym/i.test(rawLabel)) {
    return "Anonymní";
  }
  return rawLabel || "—";
}

function getBountyTargetInitials(label) {
  const cleanLabel = String(label || "").trim();
  if (!cleanLabel || cleanLabel === "—") {
    return "??";
  }
  return cleanLabel.slice(0, 2).toUpperCase();
}

function resolveBountyAvatarSrc(entry, targets = []) {
  const directAvatar = String(entry?.avatarSrc || entry?.targetAvatarSrc || entry?.targetPlayerAvatarSrc || entry?.targetPlayerAvatarUrl || "").trim();
  if (directAvatar) {
    return directAvatar;
  }
  const targetId = String(entry?.targetPlayerId || "").trim();
  const targetName = String(entry?.targetPlayerName || "").trim();
  const target = targets.find((candidate) => {
    return String(candidate?.playerId || "") === targetId || String(candidate?.name || "") === targetName;
  });
  return String(target?.avatarSrc || target?.avatarUrl || "").trim();
}

function resolveObjectiveConfig(objectiveType) {
  return OBJECTIVE_COPY[objectiveType] || OBJECTIVE_COPY["attack-player"];
}

function normalizeDistrictNumericId(districtId) {
  const match = String(districtId || "").match(/(\d+)$/u);
  return match ? Number(match[1]) : districtId;
}

function normalizeDistrictIdList(values) {
  return Array.isArray(values)
    ? values
        .map((value) => normalizeDistrictNumericId(value))
        .filter((value) => value !== "" && value !== null && value !== undefined)
    : [];
}

function getBountySpyIntel() {
  if (typeof window === "undefined") {
    return {};
  }
  return window.empireStreetsPage?.spyIntel
    || window.empireStreetsPage?.session?.missions?.spyIntel
    || window.empireStreetsGameplaySliceReadModel?.spyIntel
    || {};
}

function isBountyDistrictTypeRevealed(districtId, spyIntel = getBountySpyIntel()) {
  const normalizedDistrictId = normalizeDistrictNumericId(districtId);
  return normalizeDistrictIdList(spyIntel?.revealedTypeDistrictIds)
    .some((revealedId) => String(revealedId) === String(normalizedDistrictId));
}

function formatBountyDistrictTypeLabel(district, spyIntel = getBountySpyIntel()) {
  if (!district || !isBountyDistrictTypeRevealed(district.districtId, spyIntel)) {
    return "";
  }
  return String(district.zone || "").trim();
}

function formatBountyDistrictOptionLabel(district, spyIntel = getBountySpyIntel()) {
  const districtName = String(district?.name || district?.districtId || "").trim();
  const typeLabel = formatBountyDistrictTypeLabel(district, spyIntel);
  return typeLabel ? `${districtName} · ${typeLabel}` : districtName;
}

function isDevOnlyBountyFallbackEnabled() {
  if (typeof window === "undefined") {
    return false;
  }
  const host = String(window.location?.hostname || "").toLowerCase();
  return !host || host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function withDevBountyTargets(readModel, localBounties = []) {
  const base = readModel || createEmptyBountyReadModel();
  const targets = Array.isArray(base.eligibleTargets) ? base.eligibleTargets : [];
  if (!isDevOnlyBountyFallbackEnabled()) {
    return base;
  }
  const activeBountiesById = new Map();
  for (const entry of [
    ...(Array.isArray(base.activeBounties) ? base.activeBounties : []),
    ...localBounties
  ]) {
    if (entry?.bountyId) {
      activeBountiesById.set(String(entry.bountyId), entry);
    }
  }
  return {
    ...base,
    minRewardCleanCash: Math.max(BOUNTY_MINIMUM_CASH, Number(base.minRewardCleanCash || 0)),
    currentPlayerCleanCash: Math.max(25_000, Number(base.currentPlayerCleanCash || 0)),
    durationOptionsHours: Array.isArray(base.durationOptionsHours) && base.durationOptionsHours.length
      ? base.durationOptionsHours
      : [1, 6, 12, 24],
    eligibleTargets: targets.length > 0
      ? targets
      : DEV_BOUNTY_TARGETS.map((target) => ({
          ...target,
          districts: target.districts.map((district) => ({ ...district }))
        })),
    activeBounties: Array.from(activeBountiesById.values()),
    isDevOnlyFallback: targets.length === 0 || Boolean(base.isDevOnlyFallback)
  };
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
  const districtPicker = document.getElementById("bounty-district-picker");
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
  const boardLoading = document.getElementById("bounty-board-loading");
  const huntState = document.getElementById("bounty-hunt-state");
  const huntFill = document.getElementById("bounty-hunt-progress-fill");
  const huntLabel = document.getElementById("bounty-hunt-progress-label");
  const targetStatus = document.getElementById("bounty-target-status");
  const formStatus = document.getElementById("bounty-form-status");
  const previewSummary = document.getElementById("bounty-preview-summary");
  const escrowValue = document.getElementById("bounty-escrow-value");
  const activeCount = document.getElementById("bounty-active-count");
  const activeCountBadges = Array.from(document.querySelectorAll("[data-bounty-active-count]"));
  const submitHint = document.getElementById("bounty-submit-hint");
  const cashPresetButtons = Array.from(modal?.querySelectorAll("[data-bounty-cash-preset]") || []);
  const objectiveInputs = Array.from(modal?.querySelectorAll('input[name="bounty-objective"]') || []);
  const durationInputs = Array.from(modal?.querySelectorAll('input[name="bounty-duration"]') || []);
  const tabButtons = Array.from(modal?.querySelectorAll("[data-bounty-tab]") || []);

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
    localDemoBounties: [],
    pendingPreview: null,
    isSubmitting: false,
    isBoardLoading: false,
    isTargetPickerOpen: false,
    isDistrictPickerOpen: false,
    activeTab: "create"
  };

  const syncFromGlobalReadModel = () => {
    const slice = window.empireStreetsGameplaySliceReadModel || null;
    if (!slice) {
      return false;
    }
    uiState.gameplaySlice = slice;
    uiState.bounty = withDevBountyTargets(slice.bounty || createEmptyBountyReadModel(), uiState.localDemoBounties);
    return true;
  };

  const getBountyReadModel = () => withDevBountyTargets(uiState.bounty || createEmptyBountyReadModel(), uiState.localDemoBounties);
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
    targetPicker.classList.toggle("is-open", uiState.isTargetPickerOpen);
    const selectedValue = String(targetSelect.value || "");
    for (const button of Array.from(targetPicker.querySelectorAll("[data-bounty-target-option]"))) {
      const isSelected = String(button.dataset.bountyTargetOption || "") === selectedValue;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    }
  };

  const syncDistrictPickerSelection = () => {
    if (!districtPicker) {
      return;
    }
    districtPicker.classList.toggle("is-open", uiState.isDistrictPickerOpen);
    const selectedValue = String(districtSelect.value || "");
    for (const button of Array.from(districtPicker.querySelectorAll("[data-bounty-district-option]"))) {
      const isSelected = String(button.dataset.bountyDistrictOption || "") === selectedValue;
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
      : '<option value="">Dev fallback nenašel cíle</option>';

    if (targets.some((target) => target.canTarget && String(target.playerId) === previous)) {
      targetSelect.value = previous;
    } else {
      const firstTarget = targets.find((target) => target.canTarget) || targets[0] || null;
      targetSelect.value = firstTarget?.playerId || "";
    }

    if (targetPicker) {
      const selectedTarget = targets.find((target) => String(target.playerId) === String(targetSelect.value || "")) || targets[0] || null;
      targetPicker.innerHTML = targets.length && selectedTarget
        ? `
            <button class="bounty-board__target-current" type="button" data-bounty-target-toggle aria-expanded="${uiState.isTargetPickerOpen ? "true" : "false"}">
              <span class="bounty-board__target-option-name">${escapeHtml(selectedTarget.name)}</span>
              <span class="bounty-board__target-option-meta">${escapeHtml(selectedTarget.disabledReason || `${selectedTarget.activeDistrictCount} districtů`)}</span>
            </button>
            <div class="bounty-board__target-menu" role="listbox" aria-label="Dostupné bounty cíle">
              ${targets.map((target) => `
                <button class="bounty-board__target-option${target.canTarget ? "" : " is-disabled"}" type="button" data-bounty-target-option="${escapeHtml(target.playerId)}" aria-pressed="false"${target.canTarget ? "" : " disabled"}>
                  <span class="bounty-board__target-option-name">${escapeHtml(target.name)}</span>
                  <span class="bounty-board__target-option-meta">${escapeHtml(target.disabledReason || `${target.activeDistrictCount} districtů`)}</span>
                </button>
              `).join("")}
            </div>
          `
        : '<div class="bounty-board__target-empty">Dev fallback zatím nenašel dostupné cíle.</div>';
      syncTargetPickerSelection();
    }
  };

  const renderDistrictOptions = () => {
    const target = getSelectedTarget();
    const previous = String(districtSelect.value || "").trim();
    const districts = Array.isArray(target?.districts) ? target.districts : [];
    const objective = getSelectedObjectiveType();
    const spyIntel = getBountySpyIntel();

    districtSelect.innerHTML = [
      resolveObjectiveConfig(objective).requiresDistrict
        ? '<option value="">Vyber district</option>'
        : '<option value="">Jakýkoli district</option>',
      ...districts.map((district) => `<option value="${escapeHtml(district.districtId)}">${escapeHtml(formatBountyDistrictOptionLabel(district, spyIntel))}</option>`)
    ].join("");

    if (districts.some((district) => String(district.districtId) === previous)) {
      districtSelect.value = previous;
    } else if (resolveObjectiveConfig(objective).requiresDistrict && districts[0]?.districtId) {
      districtSelect.value = districts[0].districtId;
    } else {
      districtSelect.value = "";
    }

    const needsDistrict = resolveObjectiveConfig(objective).requiresDistrict;
    districtField.hidden = !needsDistrict;
    districtSelect.disabled = !needsDistrict;
    uiState.isDistrictPickerOpen = needsDistrict ? uiState.isDistrictPickerOpen : false;
    if (districtPicker) {
      const selectedDistrict = districts.find((district) => String(district.districtId) === String(districtSelect.value || "")) || null;
      const selectedDistrictTypeLabel = formatBountyDistrictTypeLabel(selectedDistrict, spyIntel);
      districtPicker.innerHTML = needsDistrict && districts.length
        ? `
            <button class="bounty-board__district-current" type="button" data-bounty-district-toggle aria-expanded="${uiState.isDistrictPickerOpen ? "true" : "false"}">
              <span class="bounty-board__district-option-name">${escapeHtml(selectedDistrict?.name || "Vyber district")}</span>
              ${selectedDistrictTypeLabel ? `<span class="bounty-board__district-option-meta">${escapeHtml(selectedDistrictTypeLabel)}</span>` : ""}
            </button>
            <div class="bounty-board__district-menu" role="listbox" aria-label="Dostupné districty">
              ${districts.map((district) => {
                const districtTypeLabel = formatBountyDistrictTypeLabel(district, spyIntel);
                return `
                <button class="bounty-board__district-option" type="button" data-bounty-district-option="${escapeHtml(district.districtId)}" aria-pressed="false">
                  <span class="bounty-board__district-option-name">${escapeHtml(district.name)}</span>
                  ${districtTypeLabel ? `<span class="bounty-board__district-option-meta">${escapeHtml(districtTypeLabel)}</span>` : ""}
                </button>
              `;
              }).join("")}
            </div>
          `
        : "";
      syncDistrictPickerSelection();
    }
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
      targetActivity.textContent = "Dev target list není dostupný.";
      targetThreat.textContent = "Offline";
      targetThreat.dataset.tone = "low";
      targetAvatar.src = "";
      targetAvatar.classList.add("is-empty");
      targetAvatarFallback.textContent = "??";
      if (targetStatus) {
        targetStatus.textContent = "Bez cíle nelze bounty vypsat.";
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
    const avatarSrc = String(target.avatarSrc || target.avatarUrl || "").trim();
    targetAvatar.src = avatarSrc;
    targetAvatar.classList.toggle("is-empty", !avatarSrc);
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
    const selectedDistrictId = resolveObjectiveConfig(objectiveType).requiresDistrict ? String(districtSelect.value || "") || null : null;
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
      return { state: "warning", message: "Vyber cílového hráče." };
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
    if (resolveObjectiveConfig(objectiveType).requiresDistrict && !selectedDistrictId) {
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
        : "Kontrakt čeká na cíl.";
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
    const targets = getTargets();
    const activeTotal = activeEntries
      .filter((entry) => entry.status === "active")
      .reduce((sum, entry) => sum + Math.max(0, Number(entry.rewardCleanCash || 0)), 0);
    const liveCount = activeEntries.filter((entry) => entry.status === "active").length;

    if (boardLoading) {
      boardLoading.hidden = !uiState.isBoardLoading;
    }

    boardBody.innerHTML = activeEntries.map((entry) => {
      const canCancel = Boolean(entry.canCancel);
      const objectiveType = String(entry.objectiveType || "attack-player");
      const objectiveLabel = entry.objectiveLabel || formatObjectiveLabel(objectiveType);
      const objectiveIcon = formatObjectiveIcon(objectiveType);
      const targetLabel = entry.targetPlayerName || entry.targetDistrictName || entry.targetPlayerId || "Neznámý cíl";
      const targetAvatarSrc = resolveBountyAvatarSrc(entry, targets);
      const targetMeta = entry.targetDistrictName && entry.targetPlayerName ? entry.targetDistrictName : "Bounty cíl";
      const needsDistrict = objectiveType === "attack-district" || objectiveType === "destroy-selected-district";
      const districtLabel = needsDistrict ? (entry.targetDistrictName || entry.targetDistrictId || "—") : "—";
      const status = String(entry.status || "active");
      const statusLabel = formatBountyStatus(status);
      const creatorLabel = formatBountyCreator(entry);
      const isAnonymousCreator = creatorLabel === "Anonymní";
      const remainingLabel = status === "active" && entry.remainingMs ? formatDurationMs(entry.remainingMs) : "";
      return `
        <tr data-bounty-row="${escapeHtml(entry.bountyId)}" data-bounty-status="${escapeHtml(status)}">
          <td data-label="CÍL">
            <span class="bounty-board__target-cell">
              <span class="bounty-board__target-mini-avatar" aria-hidden="true">${targetAvatarSrc ? `<img src="${escapeHtml(targetAvatarSrc)}" alt="">` : escapeHtml(getBountyTargetInitials(targetLabel))}</span>
              <span class="bounty-board__target-mini-copy">
                <strong>${escapeHtml(targetLabel)}</strong>
                <small>${escapeHtml(targetMeta)}</small>
              </span>
            </span>
          </td>
          <td data-label="TYP">
            <span class="bounty-board__type-cell">
              <span class="bounty-board__type-icon" aria-hidden="true">${escapeHtml(objectiveIcon)}</span>
              <span>${escapeHtml(objectiveLabel)}</span>
            </span>
          </td>
          <td data-label="DISTRICT">${escapeHtml(districtLabel)}</td>
          <td data-label="ODMĚNA"><span class="bounty-board__reward-value">${escapeHtml(formatRewardValue(entry.rewardCleanCash))}</span></td>
          <td data-label="STATUS / VYPSAL">
            <span class="bounty-board__status-stack">
              <span class="bounty-board__status-chip" data-bounty-status-chip="${escapeHtml(status)}">${escapeHtml(statusLabel)}</span>
              <span class="bounty-board__creator-line">
                <span>${isAnonymousCreator ? '<span class="bounty-board__creator-mask" aria-hidden="true">◓</span>' : ""}${escapeHtml(creatorLabel)}</span>
                ${remainingLabel ? `<small>${escapeHtml(remainingLabel)}</small>` : ""}
              </span>
            </span>
            <button type="button" class="bounty-board__row-action" data-bounty-cancel="${escapeHtml(entry.bountyId)}"${canCancel ? "" : " disabled"}>${canCancel ? "Zrušit" : "Mapa"}</button>
          </td>
        </tr>
      `;
    }).join("");

    boardEmpty.hidden = activeEntries.length > 0;
    if (escrowValue) {
      escrowValue.textContent = formatMoney(activeTotal);
    }
    if (activeCount) {
      activeCount.textContent = String(liveCount);
    }
    for (const badge of activeCountBadges) {
      badge.textContent = String(liveCount);
    }
    if (huntState && huntFill && huntLabel) {
      huntState.textContent = getBountyReadModel().isDevOnlyFallback ? "DEV UI DEMO" : "SERVER ESCROW";
      huntState.dataset.mode = activeTotal >= 10_000 ? "active" : "charging";
      huntFill.style.width = `${Math.max(0, Math.min(100, Math.round((activeTotal / 10_000) * 100)))}%`;
      huntLabel.textContent = activeTotal > 0
        ? `${formatMoney(activeTotal)} je připraveno v aktivních bounty.`
        : (getBountyReadModel().isDevOnlyFallback
            ? "Dev režim ukazuje lokální bounty bez server escrow."
            : "Vypsaná bounty se po potvrzení zamkne serverově v escrow.");
    }
  };

  const syncTabs = () => {
    modal.dataset.bountyTab = uiState.activeTab;
    for (const button of tabButtons) {
      const isActive = String(button.dataset.bountyTab || "") === uiState.activeTab;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    }
  };

  const refreshView = () => {
    syncFromGlobalReadModel();
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
    syncTabs();
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

  const createDevLocalBounty = (preview) => {
    const now = Date.now();
    const targetDistrictName = preview.selectedDistrict?.name || (preview.selectedDistrictId ? preview.selectedDistrictId : null);
    return {
      bountyId: `dev-bounty-${now}`,
      targetPlayerId: preview.target.playerId,
      targetPlayerName: preview.target.name,
      targetAvatarSrc: preview.target.avatarSrc || preview.target.avatarUrl || null,
      targetDistrictId: preview.selectedDistrictId || null,
      targetDistrictName,
      objectiveType: preview.objectiveType,
      objectiveLabel: formatObjectiveLabel(preview.objectiveType),
      rewardCleanCash: preview.rewardCleanCash,
      createdByLabel: preview.isAnonymous ? "Anonymně" : "Ty",
      expiresAt: new Date(now + preview.durationHours * 60 * 60 * 1000).toISOString(),
      remainingMs: preview.durationHours * 60 * 60 * 1000,
      status: "active",
      isOwn: true,
      canCancel: true,
      cancelDisabledReason: null
    };
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
    setStatusLine(getBountyReadModel().isDevOnlyFallback ? "Zapisuju dev bounty lokálně..." : "Posílám bounty na server...", "ready");

    try {
      if (getBountyReadModel().isDevOnlyFallback) {
        uiState.localDemoBounties.unshift(createDevLocalBounty(preview));
        closeConfirmModal();
        refreshView();
        pushBountyStatus(
          root,
          "Bounty demo",
          `Dev bounty vypsaná na ${preview.target.name}.`,
          `${formatObjectiveLabel(preview.objectiveType)} · ${formatMoney(preview.rewardCleanCash)} · lokální UI demo`
        );
        return;
      }
      const payload = {
        targetPlayerId: preview.target.playerId,
        objectiveType: resolveObjectiveConfig(preview.objectiveType).serverObjectiveType,
        targetDistrictId: preview.selectedDistrictId || null,
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
    if (normalizedId.startsWith("dev-bounty-")) {
      uiState.isBoardLoading = true;
      renderBoard();
      uiState.localDemoBounties = uiState.localDemoBounties.filter((entry) => entry.bountyId !== normalizedId);
      uiState.bounty = {
        ...getBountyReadModel(),
        activeBounties: (getBountyReadModel().activeBounties || []).filter((entry) => entry.bountyId !== normalizedId)
      };
      uiState.isBoardLoading = false;
      refreshView();
      pushBountyStatus(root, "Bounty demo", "Dev bounty zrušena lokálně.", normalizedId);
      return;
    }
    pushBountyStatus(root, "Bounty", "Posílám zrušení bounty na server...", normalizedId);
    uiState.isBoardLoading = true;
    renderBoard();
    const response = await submitServerBountyCommand({
      action: "cancel",
      payload: { bountyId: normalizedId }
    });
    uiState.isBoardLoading = false;
    if (!response?.accepted) {
      renderBoard();
      pushBountyStatus(root, "Bounty odmítnuta", response?.errors?.[0]?.message || "Bounty nejde zrušit.", "Escrow se neměnil");
      return;
    }
    refreshFromResponse(response);
    pushBountyStatus(root, "Bounty zrušena", "Server vrátil escrow zadavateli.", normalizedId);
  };

  const refreshFromResponse = (response) => {
    if (response?.readModel) {
      uiState.gameplaySlice = response.readModel;
      uiState.bounty = withDevBountyTargets(response.readModel.bounty || createEmptyBountyReadModel(), uiState.localDemoBounties);
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
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextTab = String(button.dataset.bountyTab || "create");
      uiState.activeTab = nextTab === "active" ? "active" : "create";
      syncTabs();
    });
  });
  targetSelect.addEventListener("change", () => {
    uiState.isTargetPickerOpen = false;
    uiState.isDistrictPickerOpen = false;
    syncTargetPickerSelection();
    renderDistrictOptions();
    syncPreview();
  });
  targetPicker?.addEventListener("click", (event) => {
    const toggle = event.target?.closest?.("[data-bounty-target-toggle]");
    if (toggle) {
      uiState.isTargetPickerOpen = !uiState.isTargetPickerOpen;
      uiState.isDistrictPickerOpen = false;
      syncTargetPickerSelection();
      syncDistrictPickerSelection();
      return;
    }
    const button = event.target?.closest?.("[data-bounty-target-option]");
    if (!button || button.disabled) {
      return;
    }
    const nextValue = String(button.dataset.bountyTargetOption || "");
    targetSelect.value = nextValue;
    uiState.isTargetPickerOpen = false;
    uiState.isDistrictPickerOpen = false;
    syncTargetPickerSelection();
    renderDistrictOptions();
    syncPreview();
  });
  districtPicker?.addEventListener("click", (event) => {
    const toggle = event.target?.closest?.("[data-bounty-district-toggle]");
    if (toggle) {
      uiState.isDistrictPickerOpen = !uiState.isDistrictPickerOpen;
      uiState.isTargetPickerOpen = false;
      syncTargetPickerSelection();
      syncDistrictPickerSelection();
      return;
    }
    const button = event.target?.closest?.("[data-bounty-district-option]");
    if (!button || button.disabled) {
      return;
    }
    districtSelect.value = String(button.dataset.bountyDistrictOption || "");
    uiState.isDistrictPickerOpen = false;
    syncDistrictPickerSelection();
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
    uiState.isDistrictPickerOpen = false;
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
    uiState.bounty = withDevBountyTargets(uiState.gameplaySlice?.bounty || createEmptyBountyReadModel(), uiState.localDemoBounties);
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

  syncFromGlobalReadModel();
  closeModal();
  publishBountyState();
}

if (typeof document !== "undefined") {
  initBountyRuntime();
}
