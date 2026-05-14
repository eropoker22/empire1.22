
import { getAuthoritySession, updateStoredPreviewSession } from "./model/authority-state.js";
import {
  applyTopbarEconomy,
  CURRENT_PLAYER_ID,
  getLaunchPlayerAvatar,
  getLaunchPlayerColor,
  getLaunchPlayerName,
  renderSpyResourceState,
  START_PHASE_OWNER_BY_DISTRICT_ID
} from "./runtime.js";

const PAGE_SELECTOR = 'main[data-page="game"]';
const BOUNTY_STORAGE_KEY = "empireStreets.bounty.v1";
const BOUNTY_HUNT_MODE_THRESHOLD = 10_000;
const BOUNTY_MINIMUM_CASH = 5_000;
const BOUNTY_REFRESH_MS = 1_000;

const OBJECTIVE_LABELS = Object.freeze({
  "occupy-sector": "Za obsazení districtu",
  "successful-attack": "Za úspěšný útok",
  "destroy-units": "Za zničení obrany"
});

const ENEMY_ALLIANCE_NAMES = Object.freeze([
  "Chrome Pact",
  "Night Trace",
  "Ghost Circuit",
  "Red Signal",
  "Black Static",
  "Zero Saint"
]);

function qs(root, selector) {
  return root.querySelector(selector);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function formatMoney(amount) {
  return `${Math.max(0, Math.floor(Number(amount || 0))).toLocaleString("cs-CZ")}$`;
}

function formatBountyObjectiveLabel(objectiveType) {
  return OBJECTIVE_LABELS[String(objectiveType || "").trim()] || OBJECTIVE_LABELS["occupy-sector"];
}

function formatBountyRewardSummary(rewards = []) {
  return rewards
    .map((reward) => {
      if (!reward?.amount) {
        return "";
      }
      if (reward.key === "cash_bundle") {
        return formatMoney(reward.amount);
      }
      return `${reward.label} x${Math.max(0, Math.floor(Number(reward.amount || 0)))}`;
    })
    .filter(Boolean)
    .join(", ");
}

function formatBountyTargetLabel(entry) {
  if (entry?.targetDistrictId) {
    return `${String(entry?.targetName || "-").trim() || "-"} · District #${entry.targetDistrictId}`;
  }
  return String(entry?.targetName || "-").trim() || "-";
}

function readJson(key, fallback) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, payload) {
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Local UX only.
  }
}

function createDefaultBountyState() {
  return {
    entries: []
  };
}

function normalizeReward(rawReward) {
  const amount = Math.max(0, Math.floor(Number(rawReward?.amount || 0)));
  if (!amount) {
    return null;
  }

  return {
    key: String(rawReward?.key || "").trim(),
    label: String(rawReward?.label || rawReward?.key || "").trim(),
    amount
  };
}

function normalizeBountyEntry(rawEntry) {
  const rewards = (Array.isArray(rawEntry?.rewards) ? rawEntry.rewards : [])
    .map((reward) => normalizeReward(reward))
    .filter(Boolean);

  if (!rewards.length) {
    return null;
  }

  return {
    id: String(rawEntry?.id || `bounty:${Date.now()}:${Math.floor(Math.random() * 1_000_000)}`),
    targetOwnerId: Number(rawEntry?.targetOwnerId || 0) || null,
    targetName: String(rawEntry?.targetName || "").trim(),
    targetDistrictId: rawEntry?.targetDistrictId ? Number(rawEntry.targetDistrictId) : null,
    objectiveType: String(rawEntry?.objectiveType || "occupy-sector").trim() || "occupy-sector",
    isAnonymous: rawEntry?.isAnonymous !== false,
    durationHours: Math.max(1, Math.min(24, Math.floor(Number(rawEntry?.durationHours || 12)))),
    totalValue: Math.max(0, Math.floor(Number(rawEntry?.totalValue || 0))),
    createdBy: String(rawEntry?.createdBy || "Ty").trim() || "Ty",
    createdAt: Number(rawEntry?.createdAt || Date.now()),
    expiresAt: Number(rawEntry?.expiresAt || (Date.now() + 12 * 60 * 60 * 1000)),
    status: String(rawEntry?.status || "active").trim(),
    claimedAt: rawEntry?.claimedAt ? Number(rawEntry.claimedAt) : null,
    claimedBy: rawEntry?.claimedBy ? String(rawEntry.claimedBy).trim() : null,
    claimAction: rawEntry?.claimAction ? String(rawEntry.claimAction).trim() : null,
    rewards
  };
}

function normalizeBountyState(state) {
  return {
    entries: (Array.isArray(state?.entries) ? state.entries : [])
      .map((entry) => normalizeBountyEntry(entry))
      .filter(Boolean)
  };
}

function getStoredBountyState() {
  return normalizeBountyState(readJson(BOUNTY_STORAGE_KEY, createDefaultBountyState()));
}

function setStoredBountyState(state) {
  writeJson(BOUNTY_STORAGE_KEY, normalizeBountyState(state));
}

function updateStoredBountyState(updater) {
  const nextState = normalizeBountyState(updater(getStoredBountyState()));
  setStoredBountyState(nextState);
  return nextState;
}

function getCurrentIdentity() {
  return String(getAuthoritySession().registration?.identity || "Ty").trim() || "Ty";
}

function getAliveEnemyDistrictIdsForOwner(ownerId) {
  const session = getAuthoritySession();
  const destroyedDistrictIds = new Set(
    Array.isArray(session.world?.destroyedDistrictIds) ? session.world.destroyedDistrictIds.map(Number).filter(Boolean) : []
  );
  const currentPlayerDistrictIds = new Set(
    Array.isArray(session.world?.ownedDistrictIds) ? session.world.ownedDistrictIds.map(Number).filter(Boolean) : []
  );

  return Array.from(START_PHASE_OWNER_BY_DISTRICT_ID.entries())
    .filter(([, districtOwnerId]) => Number(districtOwnerId) === Number(ownerId))
    .map(([districtId]) => Number(districtId))
    .filter((districtId) => !destroyedDistrictIds.has(districtId) && !currentPlayerDistrictIds.has(districtId))
    .sort((left, right) => left - right);
}

function collectEligiblePlayers() {
  const uniqueOwnerIds = Array.from(new Set(Array.from(START_PHASE_OWNER_BY_DISTRICT_ID.values()).map(Number).filter(Boolean)));

  return uniqueOwnerIds
    .filter((ownerId) => ownerId !== CURRENT_PLAYER_ID)
    .map((ownerId) => {
      const districts = getAliveEnemyDistrictIdsForOwner(ownerId);
      return {
        ownerId,
        name: getLaunchPlayerName(ownerId),
        color: getLaunchPlayerColor(ownerId),
        avatar: getLaunchPlayerAvatar(ownerId),
        districtIds: districts,
        districtCount: districts.length,
        allianceName: ENEMY_ALLIANCE_NAMES[(ownerId - 1) % ENEMY_ALLIANCE_NAMES.length],
        lastActivityLabel: districts.length > 0 ? `District #${districts[0]} drží tlak` : "Mimo dohled"
      };
    });
}

function resolveThreatLevel(districtCount) {
  const safeCount = Math.max(0, Math.floor(Number(districtCount || 0)));
  if (safeCount >= 3) return { tone: "extreme", label: "Extreme threat" };
  if (safeCount >= 2) return { tone: "high", label: "High threat" };
  if (safeCount >= 1) return { tone: "medium", label: "Medium threat" };
  return { tone: "low", label: "Low threat" };
}

function getDrugInventory() {
  return {};
}

function getResourceAvailability() {
  const session = getAuthoritySession();
  return {
    cash: Math.max(0, Math.floor(Number(session.economy?.cleanMoney || 0))),
    ...getDrugInventory()
  };
}

function getRewardUnitValue(resourceKey) {
  if (resourceKey === "cash_bundle") {
    return 1;
  }

  return 0;
}

function updateSessionRewardAmount(rewardKey, amountDelta) {
  const delta = Math.floor(Number(amountDelta || 0));
  if (!delta) {
    return;
  }

  updateStoredPreviewSession((session) => {
    const nextSession = {
      ...session,
      economy: { ...(session.economy || {}) },
      inventory: {
        ...(session.inventory || {}),
        drugs: { ...(session.inventory?.drugs || {}) },
        factorySupplies: { ...(session.inventory?.factorySupplies || {}) }
      }
    };

    if (rewardKey === "cash_bundle") {
      nextSession.economy.cleanMoney = Math.max(0, Math.floor(Number(nextSession.economy.cleanMoney || 0) + delta));
      return nextSession;
    }

    return nextSession;
  });
}

function spendReward(rewardKey, amount) {
  const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
  if (!safeAmount) {
    return { ok: true };
  }

  const availability = getResourceAvailability();
  const current = Math.max(0, Math.floor(Number(availability[rewardKey === "cash_bundle" ? "cash" : rewardKey] || 0)));
  if (current < safeAmount) {
    return { ok: false };
  }

  updateSessionRewardAmount(rewardKey, -safeAmount);
  return { ok: true };
}

function restoreReward(rewardKey, amount) {
  updateSessionRewardAmount(rewardKey, Math.max(0, Math.floor(Number(amount || 0))));
}

function grantRewards(rewards = []) {
  for (const reward of rewards) {
    if (!reward?.key || !reward?.amount) {
      continue;
    }
    updateSessionRewardAmount(reward.key, reward.amount);
  }
}

function formatExpiryLabel(expiresAt) {
  const remainingMs = Math.max(0, Number(expiresAt || 0) - Date.now());
  if (remainingMs <= 0) {
    return "exp";
  }

  const remainingMinutes = Math.ceil(remainingMs / 60_000);
  if (remainingMinutes < 60) {
    return `${remainingMinutes}m`;
  }

  const remainingHours = Math.floor(remainingMinutes / 60);
  const restMinutes = remainingMinutes % 60;
  return restMinutes > 0 ? `${remainingHours}h ${restMinutes}m` : `${remainingHours}h`;
}

function isEntryActive(entry) {
  return String(entry?.status || "active").trim() === "active" && Number(entry?.expiresAt || 0) > Date.now();
}

function expireEntriesIfNeeded() {
  const now = Date.now();
  return updateStoredBountyState((state) => ({
    ...state,
    entries: state.entries.map((entry) => (
      String(entry?.status || "active").trim() === "active" && Number(entry?.expiresAt || 0) <= now
        ? {
            ...entry,
            status: "expired"
          }
        : entry
    ))
  }));
}

function resolveBountyTargetMatches(entry, detail) {
  const targetNameMatch = normalizeName(entry?.targetName) === normalizeName(detail?.targetOwnerName);
  if (!targetNameMatch) {
    return false;
  }

  if (!entry?.targetDistrictId) {
    return true;
  }

  return Number(entry.targetDistrictId) === Number(detail?.targetDistrictId || 0);
}

function resolveBountyClaimMatches(entry, detail) {
  if (!isEntryActive(entry) || !resolveBountyTargetMatches(entry, detail)) {
    return false;
  }

  if (entry.objectiveType === "occupy-sector") {
    return Boolean(detail?.capturesDistrict);
  }

  if (entry.objectiveType === "successful-attack") {
    return detail?.action === "attack" && Boolean(detail?.successfulAttack);
  }

  if (entry.objectiveType === "destroy-units") {
    return detail?.action === "attack" && Boolean(detail?.defenseReduced);
  }

  return false;
}

function publishBountyState() {
  const state = expireEntriesIfNeeded();

  window.empireStreetsBountyState = {
    getState: () => getStoredBountyState(),
    getDistrictMarkers: () => {
      const players = collectEligiblePlayers();
      const markerMap = new Map();

      for (const entry of (state.entries || []).filter((item) => isEntryActive(item))) {
        const targetPlayer = players.find((player) => Number(player.ownerId) === Number(entry.targetOwnerId));
        const districtIds = entry.targetDistrictId
          ? [Number(entry.targetDistrictId)]
          : (targetPlayer?.districtIds || []);

        for (const districtId of districtIds) {
          if (!districtId) {
            continue;
          }

          const current = markerMap.get(districtId);
          if (!current || Number(entry.totalValue || 0) > Number(current.totalValue || 0)) {
            markerMap.set(districtId, {
              label: entry.targetName,
              totalValue: Number(entry.totalValue || 0),
              color: targetPlayer?.color || "#fb7185"
            });
          }
        }
      }

      return markerMap;
    },
    openModal: () => {
      document.dispatchEvent(new CustomEvent("empire:open-bounty-modal"));
    }
  };

  window.dispatchEvent(new CustomEvent("empire:bounty-state-changed", { detail: state }));
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

function syncTopbar(root) {
  applyTopbarEconomy(root);
  renderSpyResourceState(root);
}

function initBountyRuntime() {
  const root = document.querySelector(PAGE_SELECTOR);
  if (!root) {
    return;
  }

  const modal = document.getElementById("bounty-modal");
  const backdrop = document.getElementById("bounty-modal-backdrop");
  const closeBtn = document.getElementById("bounty-modal-close");
  const cancelBtn = document.getElementById("bounty-modal-cancel");
  const confirmModal = document.getElementById("bounty-confirm-modal");
  const confirmBackdrop = document.getElementById("bounty-confirm-modal-backdrop");
  const confirmCloseBtn = document.getElementById("bounty-confirm-modal-close");
  const confirmCancelBtn = document.getElementById("bounty-confirm-modal-cancel");
  const confirmSubmitBtn = document.getElementById("bounty-confirm-modal-submit");
  const openButtons = Array.from(new Set(
    [
      ...document.querySelectorAll("[data-bounty-open-trigger]"),
      document.getElementById("map-bounty-open")
    ].filter(Boolean)
  ));
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
  const targetScopeInputs = Array.from(modal?.querySelectorAll('input[name="bounty-target-scope"]') || []);
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
    refreshTimerId: null
  };

  const getSelectedObjectiveType = () => {
    const selected = objectiveInputs.find((input) => input.checked);
    return String(selected?.value || "occupy-sector").trim() || "occupy-sector";
  };

  const getSelectedTargetScope = () => {
    const selected = targetScopeInputs.find((input) => input.checked);
    return String(selected?.value || "player").trim() || "player";
  };

  const getSelectedDurationHours = () => {
    const selected = durationInputs.find((input) => input.checked);
    return Math.max(1, Math.min(24, Math.floor(Number(selected?.value || 12))));
  };

  const getSelectedPlayer = () => collectEligiblePlayers().find((player) => String(player.ownerId) === String(targetSelect.value || "")) || null;

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

  const clampIntInput = (input, maxValue) => {
    const safeMax = Math.max(0, Math.floor(Number(maxValue || 0)));
    const nextValue = Math.min(safeMax, Math.max(0, Math.floor(Number(input?.value || 0))));
    input.max = String(safeMax);
    input.value = String(nextValue);
    return nextValue;
  };

  const setCashAmount = (amount) => {
    const cashMax = Math.max(0, Math.floor(Number(cashInput.max || 0)));
    const nextValue = Math.min(cashMax, Math.max(0, Math.floor(Number(amount || 0))));
    cashInput.value = String(nextValue);
    cashRange.value = String(nextValue);
    syncPreview();
  };

  const renderTargetOptions = () => {
    const players = collectEligiblePlayers();
    const previous = String(targetSelect.value || "").trim();
    targetSelect.innerHTML = players.length
      ? players.map((player) => `<option value="${escapeHtml(String(player.ownerId))}">${escapeHtml(`${player.name} • ${player.districtCount} districtů`)}</option>`).join("")
      : '<option value="">Žádný dostupný cíl</option>';

    if (players.some((player) => String(player.ownerId) === previous)) {
      targetSelect.value = previous;
    } else if (players[0]?.ownerId) {
      targetSelect.value = String(players[0].ownerId);
    }

    if (targetPicker) {
      targetPicker.innerHTML = players.length
        ? players.map((player) => `
            <button class="bounty-board__target-option" type="button" data-bounty-target-option="${escapeHtml(String(player.ownerId))}" aria-pressed="false">
              <span class="bounty-board__target-option-name">${escapeHtml(player.name)}</span>
              <span class="bounty-board__target-option-meta">${escapeHtml(`${player.districtCount} districtů`)}</span>
            </button>
          `).join("")
        : '<div class="bounty-board__target-empty">Žádný dostupný cíl</div>';
      syncTargetPickerSelection();
    }
  };

  const renderDistrictOptions = () => {
    const player = getSelectedPlayer();
    const previous = String(districtSelect.value || "").trim();
    const districts = Array.isArray(player?.districtIds) ? player.districtIds : [];

    districtSelect.innerHTML = [
      '<option value="">Jakýkoli district</option>',
      ...districts.map((districtId) => `<option value="${escapeHtml(String(districtId))}">#${escapeHtml(String(districtId))} • District ${escapeHtml(String(districtId))}</option>`)
    ].join("");

    if (districts.some((districtId) => String(districtId) === previous)) {
      districtSelect.value = previous;
    }
  };

  const renderResourceOptions = () => null;

  const syncInputs = () => {
    const availability = getResourceAvailability();
    const cashMax = Math.max(0, Math.floor(Number(availability.cash || 0)));
    const selectedCashValue = Math.max(Math.floor(Number(cashRange.value || 0)), Math.floor(Number(cashInput.value || 0)));
    const currentCashValue = cashMax >= BOUNTY_MINIMUM_CASH
      ? Math.min(cashMax, Math.max(BOUNTY_MINIMUM_CASH, selectedCashValue))
      : Math.min(cashMax, Math.max(0, selectedCashValue));

    cashRange.max = String(cashMax);
    cashInput.max = String(cashMax);
    cashRange.min = String(cashMax >= BOUNTY_MINIMUM_CASH ? BOUNTY_MINIMUM_CASH : 0);
    cashInput.min = String(cashMax >= BOUNTY_MINIMUM_CASH ? BOUNTY_MINIMUM_CASH : 0);
    cashRange.value = String(currentCashValue);
    cashInput.value = String(currentCashValue);

    cashAvailable.textContent = `Máš: ${formatMoney(cashMax)}`;
  };

  const syncTargetCard = () => {
    const player = getSelectedPlayer();

    if (!player) {
      targetName.textContent = "Nevybrán cíl";
      targetAlliance.textContent = "Aliance: Bez aliance";
      targetDistricts.textContent = "Districtů: 0";
      targetActivity.textContent = "Poslední aktivita: -";
      targetThreat.textContent = "Low threat";
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

    const threat = resolveThreatLevel(player.districtCount);
    targetName.textContent = player.name;
    targetAlliance.textContent = `Aliance: ${player.allianceName || "Bez aliance"}`;
    targetDistricts.textContent = `Districtů: ${player.districtCount}`;
    targetActivity.textContent = `Poslední aktivita: ${player.lastActivityLabel}`;
    targetThreat.textContent = threat.label;
    targetThreat.dataset.tone = threat.tone;
    targetAvatar.src = player.avatar || "";
    targetAvatar.classList.toggle("is-empty", !player.avatar);
    targetAvatarFallback.textContent = player.name.slice(0, 2).toUpperCase();
    if (targetStatus) {
      targetStatus.textContent = player.districtCount > 0
        ? `${player.name} drží ${player.districtCount} aktivních districtů.`
        : `${player.name} nemá dostupný district, bounty půjde jen na hráče.`;
      targetStatus.dataset.state = player.districtCount > 0 ? "ready" : "warning";
    }
    return player;
  };

  const collectRewards = () => {
    const rewards = [];
    const cashAmount = Math.max(0, Math.floor(Number(cashInput.value || cashRange.value || 0)));

    if (cashAmount > 0) {
      rewards.push({ key: "cash_bundle", label: "Clean cash", amount: cashAmount });
    }

    return rewards;
  };

  const syncPreview = () => {
    const player = syncTargetCard();
    const rewards = collectRewards();
    const cashReward = rewards.find((reward) => reward.key === "cash_bundle");
    const totalValue = rewards.reduce((sum, reward) => sum + (reward.amount * getRewardUnitValue(reward.key)), 0);
    const progressPct = Math.max(0, Math.min(100, Math.round((totalValue / BOUNTY_HUNT_MODE_THRESHOLD) * 100)));
    const scope = getSelectedTargetScope();
    const selectedDistrictId = scope === "district" && districtSelect.value
      ? Number(districtSelect.value)
      : null;
    const hasMinimumCash = Number(cashReward?.amount || 0) >= BOUNTY_MINIMUM_CASH;
    const activeEntries = getStoredBountyState().entries.filter((entry) => isEntryActive(entry));
    const totalEscrow = activeEntries.reduce((sum, entry) => sum + Math.max(0, Number(entry.totalValue || 0)), 0);

    previewTarget.textContent = player
      ? (selectedDistrictId ? `${player.name} · District #${selectedDistrictId}` : player.name)
      : "Nevybrán cíl";
    previewValue.textContent = formatMoney(totalValue);
    previewType.textContent = formatBountyObjectiveLabel(getSelectedObjectiveType());
    previewDuration.textContent = `${getSelectedDurationHours()}h`;
    previewAnonymous.textContent = anonymousInput.checked ? "Anonymní" : "Veřejná";
    if (previewSummary) {
      previewSummary.textContent = player
        ? `${formatBountyObjectiveLabel(getSelectedObjectiveType())} · ${selectedDistrictId ? `District #${selectedDistrictId}` : "celý hráč"} · escrow ${formatMoney(totalValue)}`
        : "Kontrakt čeká na target.";
    }
    if (escrowValue) {
      escrowValue.textContent = formatMoney(totalEscrow);
    }
    if (activeCount) {
      activeCount.textContent = String(activeEntries.length);
    }

    if (totalValue >= BOUNTY_HUNT_MODE_THRESHOLD) {
      huntState.textContent = "HUNT MODE AKTIVNÍ";
      huntState.dataset.mode = "active";
      huntFill.style.width = "100%";
      huntLabel.textContent = "Celé město dostalo důvod jít po cíli.";
    } else {
      huntState.textContent = "Hunt mode se plní";
      huntState.dataset.mode = "charging";
      huntFill.style.width = `${progressPct}%`;
      huntLabel.textContent = `Do HUNT MODE zbývá ${formatMoney(BOUNTY_HUNT_MODE_THRESHOLD - totalValue)}.`;
    }

    districtField.hidden = scope !== "district";
    districtSelect.disabled = scope !== "district";
    submitBtn.disabled = !player || rewards.length === 0 || !hasMinimumCash || (scope === "district" && !selectedDistrictId);
    const validationMessage = resolveValidationMessage({
      player,
      rewards,
      hasMinimumCash,
      selectedDistrictId,
      scope
    });
    if (formStatus) {
      formStatus.textContent = validationMessage.message;
      formStatus.dataset.state = validationMessage.state;
    }
    if (submitHint) {
      submitHint.textContent = validationMessage.message;
      submitHint.dataset.state = validationMessage.state;
    }

    return {
      player,
      rewards,
      totalValue,
      hasMinimumCash,
      selectedDistrictId
    };
  };

  const resolveValidationMessage = ({ player, rewards, hasMinimumCash, selectedDistrictId, scope }) => {
    if (!player) {
      return { state: "warning", message: "Vyber target pro bounty kontrakt." };
    }

    if (!rewards.length) {
      return { state: "warning", message: "Nastav clean cash escrow." };
    }

    if (!hasMinimumCash) {
      return { state: "danger", message: `Minimum escrow je ${formatMoney(BOUNTY_MINIMUM_CASH)} clean cash.` };
    }

    if (scope === "district" && !selectedDistrictId) {
      return { state: "warning", message: "Vyber konkrétní district pro district bounty." };
    }

    return { state: "ready", message: "Kontrakt je připravený k potvrzení." };
  };

  const renderBoard = () => {
    const activeEntries = getStoredBountyState().entries
      .filter((entry) => isEntryActive(entry))
      .sort((left, right) => Number(right.totalValue || 0) - Number(left.totalValue || 0))
      .slice(0, 10);

    boardBody.innerHTML = activeEntries.map((entry) => `
      <tr>
        <td>${escapeHtml(formatBountyTargetLabel(entry))}</td>
        <td>${escapeHtml(formatBountyObjectiveLabel(entry.objectiveType))}</td>
        <td>${escapeHtml(formatBountyRewardSummary(entry.rewards) || "-")}</td>
        <td>${escapeHtml(formatExpiryLabel(entry.expiresAt))}</td>
      </tr>
    `).join("");

    boardEmpty.hidden = activeEntries.length > 0;
  };

  const refreshView = () => {
    renderTargetOptions();
    renderDistrictOptions();
    renderResourceOptions();
    syncInputs();
    syncPreview();
    renderBoard();
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
    confirmTarget.textContent = preview.selectedDistrictId
      ? `${preview.player.name} · District #${preview.selectedDistrictId}`
      : preview.player.name;
    confirmType.textContent = formatBountyObjectiveLabel(getSelectedObjectiveType());
    confirmValue.textContent = formatMoney(preview.totalValue);
    confirmDuration.textContent = `${getSelectedDurationHours()}h`;
    confirmAnonymous.textContent = anonymousInput.checked ? "Anonymní" : "Veřejná";
    confirmModal.classList.remove("hidden");
    uiState.isConfirmOpen = true;
  };

  const closeConfirmModal = () => {
    confirmModal.classList.add("hidden");
    uiState.isConfirmOpen = false;
  };

  const confirmSubmit = () => {
    const preview = syncPreview();
    if (!preview.player) {
      pushBountyStatus(root, "Bounty", "Vyber cílového hráče pro bounty.", "Bez cíle nelze bounty vypsat");
      return;
    }

    if (!preview.rewards.length) {
      pushBountyStatus(root, "Bounty", "Bounty musí obsahovat alespoň jednu odměnu.", "Přidej clean cash");
      return;
    }

    if (!preview.hasMinimumCash) {
      pushBountyStatus(root, "Bounty", `Minimální bounty je ${formatMoney(BOUNTY_MINIMUM_CASH)} clean cash.`, "Navýš clean cash odměnu");
      return;
    }

    const spentRewards = [];
    for (const reward of preview.rewards) {
      const spendResult = spendReward(reward.key, reward.amount);
      if (!spendResult.ok) {
        spentRewards.forEach((entry) => restoreReward(entry.key, entry.amount));
        syncTopbar(root);
        syncInputs();
        syncPreview();
        pushBountyStatus(root, "Bounty", `Nedostatek zdroje pro bounty: ${reward.label}.`, "Odměna nebyla vypsána");
        return;
      }
      spentRewards.push(reward);
    }

    updateStoredBountyState((state) => ({
      ...state,
      entries: [
        {
          id: `bounty:${Date.now()}`,
          targetOwnerId: preview.player.ownerId,
          targetName: preview.player.name,
          targetDistrictId: preview.selectedDistrictId,
          objectiveType: getSelectedObjectiveType(),
          isAnonymous: Boolean(anonymousInput.checked),
          durationHours: getSelectedDurationHours(),
          totalValue: preview.totalValue,
          createdBy: anonymousInput.checked ? "Anonym" : getCurrentIdentity(),
          createdAt: Date.now(),
          expiresAt: Date.now() + (getSelectedDurationHours() * 60 * 60 * 1000),
          status: "active",
          rewards: preview.rewards
        },
        ...state.entries
      ].slice(0, 40)
    }));

    syncTopbar(root);
    refreshView();
    publishBountyState();
    closeConfirmModal();
    pushBountyStatus(
      root,
      "Bounty",
      preview.selectedDistrictId
        ? `Bounty vypsána na ${preview.player.name} za District ${preview.selectedDistrictId}.`
        : `Bounty vypsána na ${preview.player.name}.`,
      `${formatBountyObjectiveLabel(getSelectedObjectiveType())} · ${formatMoney(preview.totalValue)} · ${anonymousInput.checked ? "anonymní" : "veřejná"}`
    );
  };

  const handleSubmit = () => {
    const preview = syncPreview();
    if (!preview.player) {
      pushBountyStatus(root, "Bounty", "Vyber cílového hráče pro bounty.", "Bez cíle nelze bounty vypsat");
      return;
    }
    if (!preview.rewards.length) {
      pushBountyStatus(root, "Bounty", "Bounty musí obsahovat alespoň jednu odměnu.", "Přidej clean cash");
      return;
    }
    if (!preview.hasMinimumCash) {
      pushBountyStatus(root, "Bounty", `Minimální bounty je ${formatMoney(BOUNTY_MINIMUM_CASH)} clean cash.`, "Navýš clean cash odměnu");
      return;
    }
    if (!preview.selectedDistrictId && getSelectedTargetScope() === "district") {
      pushBountyStatus(root, "Bounty", "Vyber konkrétní district pro bounty.", "Bez districtu nelze tento typ cíle potvrdit");
      return;
    }
    confirmSubmit();
  };

  const resolveClaimedEntries = (detail) => {
    const nextClaimedEntries = [];

    updateStoredBountyState((state) => ({
      ...state,
      entries: state.entries.map((entry) => {
        if (!resolveBountyClaimMatches(entry, detail)) {
          return entry;
        }

        grantRewards(entry.rewards);
        nextClaimedEntries.push(entry);
        return {
          ...entry,
          status: "claimed",
          claimedAt: Date.now(),
          claimedBy: getCurrentIdentity(),
          claimAction: String(detail?.action || "").trim() || null
        };
      })
    }));

    if (nextClaimedEntries.length <= 0) {
      return;
    }

    syncTopbar(root);
    refreshView();
    publishBountyState();

    const claimedSummary = nextClaimedEntries
      .map((entry) => `${entry.targetName}${entry.targetDistrictId ? ` #${entry.targetDistrictId}` : ""}`)
      .join(", ");
    const rewardSummary = nextClaimedEntries
      .map((entry) => formatBountyRewardSummary(entry.rewards))
      .filter(Boolean)
      .join(" • ");

    pushBountyStatus(root, "Bounty claim", `Vyplacená bounty: ${claimedSummary}.`, rewardSummary || "Odměna připsána do skladu");
  };

  const onOpenTrigger = (event) => {
    if (event?.preventDefault) {
      event.preventDefault();
    }
    const now = Date.now();
    if (now - uiState.openLock < 220) {
      return;
    }
    uiState.openLock = now;
    openModal();
  };

  openButtons.forEach((button) => {
    button.addEventListener("click", onOpenTrigger);
  });
  document.addEventListener("empire:open-bounty-modal", onOpenTrigger);
  backdrop?.addEventListener("click", closeModal);
  closeBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);
  confirmBackdrop?.addEventListener("click", closeConfirmModal);
  confirmCloseBtn?.addEventListener("click", closeConfirmModal);
  confirmCancelBtn?.addEventListener("click", closeConfirmModal);

  targetSelect.addEventListener("change", () => {
    syncTargetPickerSelection();
    renderDistrictOptions();
    syncPreview();
  });
  targetPicker?.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-bounty-target-option]");
    if (!button) {
      return;
    }
    targetSelect.value = String(button.dataset.bountyTargetOption || "");
    syncTargetPickerSelection();
    renderDistrictOptions();
    syncPreview();
  });
  districtSelect.addEventListener("change", syncPreview);
  targetScopeInputs.forEach((input) => input.addEventListener("change", syncPreview));
  cashRange.addEventListener("input", () => {
    const nextValue = Math.floor(Number(cashRange.value || 0));
    cashInput.value = String(nextValue >= BOUNTY_MINIMUM_CASH ? nextValue : 0);
    syncPreview();
  });
  cashInput.addEventListener("input", () => {
    const nextValue = clampIntInput(cashInput, Number(cashInput.max || 0));
    cashRange.value = String(nextValue >= BOUNTY_MINIMUM_CASH ? nextValue : 0);
    syncPreview();
  });
  cashPresetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const preset = String(button.dataset.bountyCashPreset || "").trim();
      const cashMax = Math.max(0, Math.floor(Number(cashInput.max || 0)));
      if (preset === "max") {
        setCashAmount(cashMax);
        return;
      }

      setCashAmount(Number(preset || 0));
    });
  });
  anonymousInput.addEventListener("change", syncPreview);
  objectiveInputs.forEach((input) => input.addEventListener("change", syncPreview));
  durationInputs.forEach((input) => input.addEventListener("change", syncPreview));
  submitBtn.addEventListener("click", handleSubmit);
  confirmSubmitBtn.addEventListener("click", confirmSubmit);

  window.addEventListener("empire:bounty-action-resolved", (event) => {
    resolveClaimedEntries(event.detail || {});
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && uiState.isOpen) {
      closeModal();
    }
  });

  uiState.refreshTimerId = window.setInterval(() => {
    expireEntriesIfNeeded();
    publishBountyState();
    if (uiState.isOpen) {
      renderBoard();
      syncPreview();
    }
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
