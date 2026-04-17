(function () {
  "use strict";

  const STORAGE_KEY = "empire_bounties_system_v1";
  const BOUNTY_COOLDOWN_MS = 30 * 60 * 1000;
  const EXPIRE_INTERVAL_MS = 15000;

  const BOUNTY_TYPES = Object.freeze({
    CAPTURE_DISTRICT: "capture_district",
    DESTROY_DISTRICT: "destroy_district"
  });

  const BOUNTY_DURATIONS = Object.freeze([6, 12, 24]);
  const MIN_BOUNTY_CASH = 5000;
  const MOBILE_BOUNTY_MEDIA_QUERY = "(max-width: 720px)";
  const DRUG_UNIT_VALUE = 350;
  const MATERIAL_UNIT_VALUE = 275;
  const NO_ALLIANCE_KEYS = new Set(["", "zadna", "žádná", "bez aliance", "none"]);

  const DRUG_TYPES = Object.freeze([
    { key: "neonDust", label: "Neon Dust" },
    { key: "pulseShot", label: "Pulse Shot" },
    { key: "velvetSmoke", label: "Velvet Smoke" },
    { key: "ghostSerum", label: "Ghost Serum" },
    { key: "overdriveX", label: "Overdrive X" }
  ]);

  const MATERIAL_TYPES = Object.freeze([
    { key: "metalParts", label: "Metal Parts" },
    { key: "techCore", label: "Tech Core" },
    { key: "combatModule", label: "Combat Module" }
  ]);

  const state = {
    bootstrapped: false,
    timerId: null,
    modalTimerId: null,
    successTimerId: null,
    modalReady: false,
    selectedTargetId: "",
    bounties: []
  };

  function clampWholeNumber(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
  }

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function normalizeAllianceKey(value) {
    const normalized = normalizeText(value);
    return NO_ALLIANCE_KEYS.has(normalized) ? "" : normalized;
  }

  function nowMs() {
    return Date.now();
  }

  function isGuestBlackoutScenarioActive() {
    if (window.Empire.token) return false;
    const activeScenarioKey = String(window.Empire.UI?.getActivePlayerScenarioKey?.() || "").trim().toLowerCase();
    if (activeScenarioKey === "index-war") return true;
    return Boolean(window.Empire.UI?.isScenarioVisionEnabled?.());
  }

  function applyGuestBlackoutMarketCleanCashDelta(delta) {
    if (!isGuestBlackoutScenarioActive()) return null;
    try {
      const raw = localStorage.getItem("empire_local_market_state");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const balances = parsed.balances && typeof parsed.balances === "object" ? parsed.balances : null;
      if (!balances) return null;
      const currentClean = clampWholeNumber(balances.cleanMoney || 0);
      const nextClean = Math.max(0, currentClean + Math.trunc(Number(delta) || 0));
      const applied = nextClean - currentClean;
      balances.cleanMoney = nextClean;
      balances.dirtyMoney = clampWholeNumber(balances.dirtyMoney || 0);
      balances.money = balances.cleanMoney + balances.dirtyMoney;
      localStorage.setItem("empire_local_market_state", JSON.stringify(parsed));
      return applied;
    } catch {
      return null;
    }
  }

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function getDistricts() {
    return Array.isArray(window.Empire?.districts) ? window.Empire.districts : [];
  }

  function getUi() {
    return window.Empire?.UI || null;
  }

  function getMap() {
    return window.Empire?.Map || null;
  }

  function getCurrentPlayerProfile() {
    return window.Empire?.player && typeof window.Empire.player === "object"
      ? window.Empire.player
      : {};
  }

  function getCurrentPlayerName() {
    const profile = getCurrentPlayerProfile();
    return String(
      profile.username
      || profile.owner
      || localStorage.getItem("empire_guest_username")
      || "Ty"
    ).trim() || "Ty";
  }

  function getCurrentPlayerId() {
    const profile = getCurrentPlayerProfile();
    return String(
      profile.id
      || profile.playerId
      || profile.player_id
      || profile.username
      || profile.owner
      || localStorage.getItem("empire_guest_username")
      || "guest-player"
    ).trim() || "guest-player";
  }

  function getCurrentAllianceName() {
    const profile = getCurrentPlayerProfile();
    const fromProfile = String(profile.alliance || "").trim();
    if (fromProfile) return fromProfile;
    const fromDom = String(document.getElementById("profile-alliance")?.textContent || "").trim();
    return fromDom || "Bez aliance";
  }

  function getOwnerName(district) {
    return String(
      district?.ownerNick
      || district?.owner_username
      || district?.ownerUsername
      || district?.owner
      || ""
    ).trim();
  }

  function getOwnerAlliance(district) {
    return String(
      district?.ownerAllianceName
      || district?.owner_alliance_name
      || "Bez aliance"
    ).trim() || "Bez aliance";
  }

  function formatMoney(value) {
    return `$${clampWholeNumber(value).toLocaleString("cs-CZ")}`;
  }

  function formatRelativeTime(timestamp) {
    const safe = Number(timestamp || 0);
    if (!Number.isFinite(safe) || safe <= 0) return "Aktivní na mapě";
    const diff = Math.max(0, nowMs() - safe);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Právě teď";
    if (minutes < 60) return `Před ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Před ${hours} h`;
    return `Před ${Math.floor(hours / 24)} dny`;
  }

  function formatDurationHours(hours) {
    return `${clampWholeNumber(hours)}h`;
  }

  function formatCountdown(msRemaining) {
    const safe = Math.max(0, Math.floor(Number(msRemaining || 0)));
    const totalSeconds = Math.floor(safe / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return `${hh}h ${mm}m ${ss}s`;
  }

  function formatBountyTypeLabel(type) {
    switch (String(type || "").trim()) {
      case BOUNTY_TYPES.DESTROY_DISTRICT:
        return "Za destrukci nového bytu";
      default:
        return "Za obsazení districtu";
    }
  }

  function resolveThreatMeta(districtCount) {
    const count = clampWholeNumber(districtCount);
    if (count >= 18) return { label: "EXTREME", tone: "extreme" };
    if (count >= 10) return { label: "HIGH", tone: "high" };
    if (count >= 5) return { label: "MEDIUM", tone: "medium" };
    return { label: "LOW", tone: "low" };
  }

  function calculateBountyTotalValue(rewardCash, rewardDrugs, rewardMaterials) {
    return clampWholeNumber(rewardCash)
      + clampWholeNumber(rewardDrugs) * DRUG_UNIT_VALUE
      + clampWholeNumber(rewardMaterials) * MATERIAL_UNIT_VALUE;
  }

  function isHuntModeActive(totalValue) {
    return false;
  }

  function parseMoneyFromDom(id) {
    const text = String(document.getElementById(id)?.textContent || "0");
    const parsed = Number(text.replace(/[^\d-]/g, "") || 0);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
  }

  function getEconomySnapshot() {
    const profile = getCurrentPlayerProfile();
    const uiSnapshot = getUi()?.getEconomySnapshot?.() || {};
    const cleanMoney = Math.max(
      clampWholeNumber(uiSnapshot.cleanMoney ?? uiSnapshot.clean_cash ?? uiSnapshot.cash ?? 0),
      parseMoneyFromDom("stat-clean-money"),
      clampWholeNumber(profile?.cleanMoney ?? profile?.clean_money ?? 0)
    );
    const dirtyMoney = Math.max(
      clampWholeNumber(uiSnapshot.dirtyMoney ?? uiSnapshot.dirty_cash ?? uiSnapshot.dirtyCash ?? 0),
      parseMoneyFromDom("stat-dirty-money"),
      clampWholeNumber(profile?.dirtyMoney ?? profile?.dirty_money ?? 0)
    );
    const normalized = {
      ...uiSnapshot,
      cleanMoney,
      dirtyMoney,
      balance: cleanMoney + dirtyMoney
    };
    if (!normalized.drugInventory || typeof normalized.drugInventory !== "object") {
      normalized.drugInventory = {};
    }
    DRUG_TYPES.forEach((item) => {
      const current = clampWholeNumber(
        normalized[item.key]
        ?? normalized.drugInventory[item.key]
        ?? profile?.[item.key]
        ?? 0
      );
      normalized[item.key] = current;
      normalized.drugInventory[item.key] = current;
    });
    MATERIAL_TYPES.forEach((item) => {
      normalized[item.key] = clampWholeNumber(normalized[item.key] ?? profile?.[item.key] ?? 0);
    });
    normalized.drugs = DRUG_TYPES.reduce((sum, item) => sum + clampWholeNumber(normalized.drugInventory[item.key] ?? normalized[item.key] ?? 0), 0);
    normalized.materials = MATERIAL_TYPES.reduce((sum, item) => sum + clampWholeNumber(normalized[item.key] || 0), 0);
    return normalized || {
      cleanMoney: 0,
      dirtyMoney: 0,
      materials: 0,
      drugs: 0,
      drugInventory: {}
    };
  }

  function getDrugAvailability(snapshot = getEconomySnapshot()) {
    const inventory = snapshot?.drugInventory && typeof snapshot.drugInventory === "object"
      ? snapshot.drugInventory
      : {};
    return DRUG_TYPES.reduce((acc, item) => {
      acc[item.key] = clampWholeNumber(snapshot?.[item.key] ?? inventory[item.key] ?? 0);
      return acc;
    }, {});
  }

  function getMaterialAvailability(snapshot = getEconomySnapshot()) {
    return MATERIAL_TYPES.reduce((acc, item) => {
      acc[item.key] = clampWholeNumber(snapshot?.[item.key] ?? 0);
      return acc;
    }, {});
  }

  function applyEconomyRewardDelta(delta) {
    const ui = getUi();
    if (!ui?.updateEconomy) {
      return { ok: false, error: "Chybí ekonomický modul." };
    }

    const snapshot = getEconomySnapshot();
    const cashDelta = Math.trunc(Number(delta?.cash || 0));
    const drugType = String(delta?.drugType || "").trim();
    const drugDelta = Math.trunc(Number(delta?.drugAmount || 0));
    const materialType = String(delta?.materialType || "").trim();
    const materialDelta = Math.trunc(Number(delta?.materialAmount || 0));

    const next = {
      ...snapshot,
      drugInventory: snapshot?.drugInventory && typeof snapshot.drugInventory === "object"
        ? { ...snapshot.drugInventory }
        : {}
    };

    const currentCleanMoney = clampWholeNumber(next.cleanMoney || 0);
    if (cashDelta < 0 && currentCleanMoney < Math.abs(cashDelta)) {
      return { ok: false, error: "Nedostatek clean cash." };
    }
    next.cleanMoney = Math.max(0, currentCleanMoney + cashDelta);
    next.money = next.cleanMoney + clampWholeNumber(next.dirtyMoney || 0);
    next.balance = next.money;

    if (drugType && drugDelta !== 0) {
      const currentDrug = clampWholeNumber(next.drugInventory[drugType] ?? next[drugType] ?? 0);
      const afterDrug = currentDrug + drugDelta;
      if (afterDrug < 0) {
        return { ok: false, error: `Nedostatek drogy ${drugType}.` };
      }
      next.drugInventory[drugType] = afterDrug;
      next[drugType] = afterDrug;
    }

    if (materialType && materialDelta !== 0) {
      const currentMaterial = clampWholeNumber(next[materialType] || 0);
      const afterMaterial = currentMaterial + materialDelta;
      if (afterMaterial < 0) {
        return { ok: false, error: `Nedostatek materiálu ${materialType}.` };
      }
      next[materialType] = afterMaterial;
    }

    next.drugs = DRUG_TYPES.reduce((sum, item) => sum + clampWholeNumber(next.drugInventory[item.key] ?? next[item.key] ?? 0), 0);
    next.materials = MATERIAL_TYPES.reduce((sum, item) => sum + clampWholeNumber(next[item.key] || 0), 0);

    ui.updateEconomy(next);
    return { ok: true };
  }

  function spendCleanCashImmediately(amount) {
    const safeAmount = clampWholeNumber(amount);
    if (safeAmount <= 0) return { ok: true };
    const ui = getUi();
    if (ui?.trySpendCleanCash) {
      const result = ui.trySpendCleanCash(safeAmount);
      if (result?.ok) {
        if (isGuestBlackoutScenarioActive()) {
          const applied = applyGuestBlackoutMarketCleanCashDelta(-safeAmount);
          if (applied != null && Math.abs(applied) < safeAmount) {
            ui.addCleanCash?.(safeAmount);
            if (applied < 0) applyGuestBlackoutMarketCleanCashDelta(-applied);
            return { ok: false, error: "Nedostatek clean cash." };
          }
        }
        return { ok: true };
      }
      return { ok: false, error: "Nedostatek clean cash." };
    }
    return applyEconomyRewardDelta({
      cash: -safeAmount,
      drugType: "",
      drugAmount: 0,
      materialType: "",
      materialAmount: 0
    });
  }

  function refundCleanCash(amount) {
    const safeAmount = clampWholeNumber(amount);
    if (safeAmount <= 0) return { ok: true };
    const ui = getUi();
    if (ui?.addCleanCash) {
      ui.addCleanCash(safeAmount);
      if (isGuestBlackoutScenarioActive()) {
        applyGuestBlackoutMarketCleanCashDelta(safeAmount);
      }
      return { ok: true };
    }
    return applyEconomyRewardDelta({
      cash: safeAmount,
      drugType: "",
      drugAmount: 0,
      materialType: "",
      materialAmount: 0
    });
  }

  function summarizeRewardParts(parts) {
    return parts.filter(Boolean).join(", ");
  }

  function summarizeLocalPayout(payout) {
    const drugLabel = DRUG_TYPES.find((item) => item.key === payout?.drugType)?.label || "Drogy";
    const materialLabel = MATERIAL_TYPES.find((item) => item.key === payout?.materialType)?.label || "Materiály";
    return summarizeRewardParts([
      clampWholeNumber(payout?.cash) > 0 ? formatMoney(payout.cash) : "",
      clampWholeNumber(payout?.drugs) > 0 ? `${clampWholeNumber(payout.drugs)}x ${drugLabel}` : "",
      clampWholeNumber(payout?.materials) > 0 ? `${clampWholeNumber(payout.materials)}x ${materialLabel}` : ""
    ]);
  }

  function normalizeStoredBounty(entry) {
    if (!entry || typeof entry !== "object") return null;
    const rewardCash = clampWholeNumber(entry.rewardCash);
    const rewardDrugs = clampWholeNumber(entry.rewardDrugs);
    const rewardMaterials = clampWholeNumber(entry.rewardMaterials);
    const totalValue = clampWholeNumber(entry.totalValue || calculateBountyTotalValue(rewardCash, rewardDrugs, rewardMaterials));
    return {
      id: String(entry.id || createId("bounty")).trim(),
      targetPlayerId: String(entry.targetPlayerId || "").trim(),
      targetName: String(entry.targetName || "").trim(),
      targetAllianceTag: String(entry.targetAllianceTag || "Bez aliance").trim() || "Bez aliance",
      issuerPlayerId: String(entry.issuerPlayerId || "").trim(),
      issuerName: String(entry.issuerName || "").trim(),
      isAnonymous: Boolean(entry.isAnonymous),
      rewardCash,
      rewardDrugs,
      rewardMaterials,
      rewardDrugType: String(entry.rewardDrugType || DRUG_TYPES[0].key).trim(),
      rewardMaterialType: String(entry.rewardMaterialType || MATERIAL_TYPES[0].key).trim(),
      totalValue,
      bountyType: Object.values(BOUNTY_TYPES).includes(entry.bountyType) ? entry.bountyType : BOUNTY_TYPES.CAPTURE_DISTRICT,
      createdAt: Number(entry.createdAt || nowMs()),
      expiresAt: Number(entry.expiresAt || (nowMs() + 12 * 60 * 60 * 1000)),
      status: ["active", "expired", "completed"].includes(entry.status) ? entry.status : "active",
      contributors: Array.isArray(entry.contributors) ? entry.contributors.map((contributor) => ({
        playerId: String(contributor?.playerId || "").trim(),
        contributionDamage: Math.max(0, Number(contributor?.contributionDamage || 0)),
        contributionScore: Math.max(0, Number(contributor?.contributionScore || 0))
      })).filter((contributor) => contributor.playerId) : [],
      claimedBy: entry.claimedBy ? String(entry.claimedBy).trim() : null,
      districtId: entry?.districtId == null || String(entry?.districtId).trim() === ""
        ? null
        : String(entry.districtId).trim(),
      districtName: String(entry?.districtName || "").trim() || null,
      huntModeActive: false
    };
  }

  function readStoredBounties() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeStoredBounty).filter(Boolean);
    } catch {
      return [];
    }
  }

  function persistBounties() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.bounties));
  }

  function isServerBacked() {
    return Boolean(window.Empire?.token && window.Empire?.API?.getBounties);
  }

  function setBounties(nextBounties) {
    state.bounties = (Array.isArray(nextBounties) ? nextBounties : []).map(normalizeStoredBounty).filter(Boolean);
    if (!isServerBacked()) {
      persistBounties();
    }
    applyBountyVisualsToMap();
    renderIfModalOpen();
  }

  function normalizeRemoteBounty(entry) {
    return normalizeStoredBounty({
      id: entry?.id,
      targetPlayerId: normalizeText(entry?.targetName || entry?.targetPlayerId || ""),
      targetName: entry?.targetName,
      targetAllianceTag: entry?.targetAllianceTag,
      issuerPlayerId: entry?.issuerPlayerId,
      issuerName: entry?.issuerName,
      isAnonymous: entry?.isAnonymous,
      rewardCash: entry?.rewardCash,
      rewardDrugs: entry?.rewardDrugs,
      rewardMaterials: entry?.rewardMaterials,
      rewardDrugType: entry?.rewardDrugType,
      rewardMaterialType: entry?.rewardMaterialType,
      totalValue: entry?.totalValue,
      bountyType: entry?.bountyType,
      createdAt: entry?.createdAt,
      expiresAt: entry?.expiresAt,
      status: entry?.status,
      contributors: entry?.contributors,
      claimedBy: entry?.claimedBy,
      districtId: entry?.districtId ?? entry?.targetDistrictId ?? null,
      districtName: entry?.districtName ?? null,
      huntModeActive: false
    });
  }

  async function refreshEconomyFromServer() {
    if (!window.Empire?.token || !window.Empire?.API?.getEconomy) return;
    const economy = await window.Empire.API.getEconomy();
    if (economy && typeof economy === "object" && !economy.error) {
      getUi()?.updateEconomy?.(economy);
    }
  }

  async function syncBountiesFromServer() {
    if (!isServerBacked()) return state.bounties;
    const response = await window.Empire.API.getBounties();
    if (response?.error) return state.bounties;
    const nextBounties = Array.isArray(response?.bounties) ? response.bounties.map(normalizeRemoteBounty).filter(Boolean) : [];
    setBounties(nextBounties);
    return state.bounties;
  }

  function getActiveBounties() {
    expireBounties();
    return state.bounties.filter((entry) => entry.status === "active");
  }

  function getActiveBountiesForPlayer(playerId) {
    const safePlayerId = normalizeText(playerId);
    if (!safePlayerId) return [];
    return getActiveBounties().filter((entry) => normalizeText(entry.targetPlayerId) === safePlayerId);
  }

  function collectTargetPlayers() {
    const districts = getDistricts();
    const currentPlayerNameKey = normalizeText(getCurrentPlayerName());
    const currentProfile = getCurrentPlayerProfile();
    const currentPlayerIdKey = String(currentProfile?.id || currentProfile?.playerId || currentProfile?.player_id || "").trim();
    const currentAllianceKey = normalizeAllianceKey(getCurrentAllianceName());
    const ownNameKeys = new Set([
      currentPlayerNameKey,
      normalizeText(currentProfile?.username),
      normalizeText(currentProfile?.owner)
    ].filter(Boolean));
    districts.forEach((district) => {
      const ownerPlayerId = String(district?.ownerPlayerId || district?.owner_player_id || "").trim();
      if (currentPlayerIdKey && ownerPlayerId && ownerPlayerId === currentPlayerIdKey) {
        ownNameKeys.add(normalizeText(getOwnerName(district)));
      }
    });
    if (typeof getUi()?.collectBountyEligiblePlayers === "function") {
      const viaUi = getUi().collectBountyEligiblePlayers()
        .map((entry) => ({
          id: normalizeText(entry?.name),
          name: String(entry?.name || "").trim(),
          allianceTag: String(entry?.allianceName || "Bez aliance").trim() || "Bez aliance",
          districtCount: clampWholeNumber(entry?.districtCount || 0),
          lastActivityAt: 0,
          avatarLabel: String(entry?.name || "?").slice(0, 2).toUpperCase() || "?",
          avatarUrl: String(entry?.avatar || "").trim()
        }))
        .filter((entry) => entry.id && !ownNameKeys.has(entry.id))
        .filter((entry) => {
          const allianceKey = normalizeAllianceKey(entry.allianceTag);
          return !(currentAllianceKey && allianceKey && allianceKey === currentAllianceKey);
        })
        .sort((a, b) => b.districtCount - a.districtCount || a.name.localeCompare(b.name, "cs"));
      if (viaUi.length) return viaUi;
    }

    const byPlayer = new Map();

    districts.forEach((district) => {
      const ownerName = getOwnerName(district);
      const ownerKey = normalizeText(ownerName);
      if (!ownerName || !ownerKey) return;
      if (ownNameKeys.has(ownerKey)) return;
      const ownerPlayerId = String(district?.ownerPlayerId || district?.owner_player_id || "").trim();
      if (currentPlayerIdKey && ownerPlayerId && ownerPlayerId === currentPlayerIdKey) return;

      const ownerAlliance = getOwnerAlliance(district);
      const ownerAllianceKey = normalizeAllianceKey(ownerAlliance);
      if (currentAllianceKey && ownerAllianceKey && ownerAllianceKey === currentAllianceKey) return;

      const existing = byPlayer.get(ownerKey) || {
        id: ownerKey,
        name: ownerName,
        allianceTag: ownerAlliance || "Bez aliance",
        districtCount: 0,
        lastActivityAt: 0,
        avatarLabel: String(ownerName || "?").slice(0, 2).toUpperCase() || "?",
        avatarUrl: String(district?.ownerAvatar || district?.owner_avatar || "").trim()
      };

      existing.districtCount += 1;
      existing.name = existing.name || ownerName;
      if (!existing.allianceTag || existing.allianceTag === "Bez aliance") {
        existing.allianceTag = ownerAlliance || "Bez aliance";
      }
      if (!existing.avatarUrl) {
        existing.avatarUrl = String(district?.ownerAvatar || district?.owner_avatar || "").trim();
      }
      byPlayer.set(ownerKey, existing);
    });

    let result = Array.from(byPlayer.values())
      .sort((a, b) => b.districtCount - a.districtCount || a.name.localeCompare(b.name, "cs"));

    if (!result.length) {
      const activeScenario = String(localStorage.getItem("empire_active_player_scenario") || "").trim().toLowerCase();
      if (activeScenario.includes("blackout")) {
        result = [{
          id: normalizeText("Mariah"),
          name: "Mariah",
          allianceTag: "Bez aliance",
          districtCount: 1,
          lastActivityAt: 0,
          avatarLabel: "MA",
          avatarUrl: ""
        }];
      }
    }

    return result;
  }

  function getTargetDistricts(targetPlayerId) {
    const targetKey = normalizeText(targetPlayerId);
    if (!targetKey) return [];
    return getDistricts()
      .filter((district) => normalizeText(getOwnerName(district)) === targetKey)
      .map((district) => ({
        id: district.id,
        name: String(district?.name || `District #${district?.id ?? "-"}`).trim()
      }));
  }

  function validateBountyPayload(payload) {
    const targetId = String(payload?.targetPlayerId || "").trim();
    const issuerId = String(payload?.issuerPlayerId || "").trim();
    const currentPlayerNameKey = normalizeText(getCurrentPlayerName());
    const rewardCash = clampWholeNumber(payload?.rewardCash);
    const rewardDrugs = 0;
    const rewardMaterials = 0;
    const rewardDrugType = String(payload?.rewardDrugType || "").trim();
    const rewardMaterialType = String(payload?.rewardMaterialType || "").trim();
    const targetDistrictIdRaw = payload?.targetDistrictId;
    const durationHours = clampWholeNumber(payload?.durationHours);
    const bountyType = String(payload?.bountyType || "").trim();
    const targetDistrictId =
      targetDistrictIdRaw == null || String(targetDistrictIdRaw).trim() === ""
        ? null
        : String(targetDistrictIdRaw).trim();
    const totalValue = rewardCash;
    const players = collectTargetPlayers();
    const target = players.find((player) => player.id === targetId) || null;
    const duplicate = state.bounties.find((entry) =>
      entry.issuerPlayerId === issuerId
      && entry.targetPlayerId === targetId
      && entry.bountyType === bountyType
      && String(entry?.districtId || "") === String(targetDistrictId || "")
      && nowMs() - Number(entry.createdAt || 0) < BOUNTY_COOLDOWN_MS
    );

    if (!issuerId) return { ok: false, error: "Chybí issuer hráče." };
    if (!target) return { ok: false, error: "Target neexistuje nebo není dostupný." };
    if (issuerId === targetId || targetId === currentPlayerNameKey) return { ok: false, error: "Na sebe bounty vypsat nejde." };
    if (!BOUNTY_DURATIONS.includes(durationHours)) return { ok: false, error: "Povolené trvání je jen 6h, 12h nebo 24h." };
    if (!Object.values(BOUNTY_TYPES).includes(bountyType)) return { ok: false, error: "Neplatný typ bounty." };
    if (rewardCash < MIN_BOUNTY_CASH) return { ok: false, error: `Minimální bounty je ${formatMoney(MIN_BOUNTY_CASH)} clean cash.` };
    if (duplicate) return { ok: false, error: "Na stejný target máš cooldown 30 minut." };
    if (targetDistrictId) {
      const allowedDistrict = getTargetDistricts(targetId).some((district) => String(district.id) === targetDistrictId);
      if (!allowedDistrict) return { ok: false, error: "Vybraný district nepatří target hráči." };
    }

    const snapshot = getEconomySnapshot();
    const cleanCash = clampWholeNumber(snapshot.cleanMoney || 0);
    const drugAvailability = getDrugAvailability(snapshot);
    const materialAvailability = getMaterialAvailability(snapshot);

    if (cleanCash < rewardCash) return { ok: false, error: "Nedostatek clean cash." };
    if (rewardDrugs > clampWholeNumber(drugAvailability[rewardDrugType] || 0)) return { ok: false, error: "Nedostatek zvolené drogy." };
    if (rewardMaterials > clampWholeNumber(materialAvailability[rewardMaterialType] || 0)) return { ok: false, error: "Nedostatek zvoleného materiálu." };

    return {
      ok: true,
      target,
      rewardCash,
      rewardDrugs,
      rewardMaterials,
      rewardDrugType,
      rewardMaterialType,
      targetDistrictId,
      totalValue,
      bountyType,
      durationHours
    };
  }

  function pushFeedMessage(text) {
    const safeText = String(text || "").trim();
    if (!safeText) return;
    getUi()?.pushEvent?.(safeText);
  }

  async function createBounty(payload) {
    const validation = validateBountyPayload(payload);
    if (!validation.ok) return validation;

    const spendResult = spendCleanCashImmediately(validation.rewardCash);
    if (!spendResult.ok) return spendResult;

    if (isServerBacked()) {
      const response = await window.Empire.API.createBounty({
        targetUsername: validation.target.name,
        targetDistrictId: validation.targetDistrictId,
        rewardCash: validation.rewardCash,
        rewardDrugs: validation.rewardDrugs,
        rewardMaterials: validation.rewardMaterials,
        rewardDrugType: validation.rewardDrugType,
        rewardMaterialType: validation.rewardMaterialType,
        bountyType: validation.bountyType,
        isAnonymous: Boolean(payload.isAnonymous),
        durationHours: validation.durationHours
      });
      if (response?.error) {
        refundCleanCash(validation.rewardCash);
        return { ok: false, error: response.error };
      }
      const nextBounties = Array.isArray(response?.bounties) ? response.bounties.map(normalizeRemoteBounty).filter(Boolean) : [];
      setBounties(nextBounties);
      pushFeedMessage(
        Boolean(payload.isAnonymous)
          ? `Na hráče ${validation.target.name} byla vypsána odměna.`
          : `${String(payload.issuerName || getCurrentPlayerName()).trim() || "Neznámý hráč"} vypsal odměnu na hráče ${validation.target.name}.`
      );
      return { ok: true };
    }

    const bounty = normalizeStoredBounty({
      id: createId("bounty"),
      targetPlayerId: validation.target.id,
      targetName: validation.target.name,
      targetAllianceTag: validation.target.allianceTag,
      districtId: validation.targetDistrictId,
      districtName: validation.targetDistrictId
        ? (getTargetDistricts(validation.target.id).find((district) => String(district.id) === String(validation.targetDistrictId))?.name || null)
        : null,
      issuerPlayerId: String(payload.issuerPlayerId || "").trim(),
      issuerName: String(payload.issuerName || "").trim(),
      isAnonymous: Boolean(payload.isAnonymous),
      rewardCash: validation.rewardCash,
      rewardDrugs: validation.rewardDrugs,
      rewardMaterials: validation.rewardMaterials,
      rewardDrugType: validation.rewardDrugType,
      rewardMaterialType: validation.rewardMaterialType,
      totalValue: validation.totalValue,
      bountyType: validation.bountyType,
      createdAt: nowMs(),
      expiresAt: nowMs() + validation.durationHours * 60 * 60 * 1000,
      status: "active",
      contributors: [],
      claimedBy: null,
      huntModeActive: false
    });

    setBounties([bounty, ...state.bounties]);

    pushFeedMessage(
      bounty.isAnonymous
        ? `Na hráče ${bounty.targetName} byla vypsána odměna.`
        : `${bounty.issuerName || "Neznámý hráč"} vypsal odměnu na hráče ${bounty.targetName}.`
    );
    pushFeedMessage(`Target ${bounty.targetName}: Někdo tě označil jako cíl.`);

    return { ok: true, bounty };
  }

  function distributeByRatio(totalAmount, recipientEntries, valueKey) {
    const amount = clampWholeNumber(totalAmount);
    const safeEntries = (Array.isArray(recipientEntries) ? recipientEntries : [])
      .map((entry) => ({
        playerId: String(entry?.playerId || "").trim(),
        value: Math.max(0, Number(entry?.[valueKey] || 0))
      }))
      .filter((entry) => entry.playerId && entry.value > 0);

    if (amount <= 0 || !safeEntries.length) return [];

    const totalWeight = safeEntries.reduce((sum, entry) => sum + entry.value, 0);
    if (totalWeight <= 0) return [];

    let allocated = 0;
    const payouts = safeEntries.map((entry) => {
      const nextAmount = Math.floor((amount * entry.value) / totalWeight);
      allocated += nextAmount;
      return { playerId: entry.playerId, amount: nextAmount };
    });

    let remainder = amount - allocated;
    let index = 0;
    while (remainder > 0 && payouts.length) {
      payouts[index % payouts.length].amount += 1;
      remainder -= 1;
      index += 1;
    }

    return payouts.filter((entry) => entry.amount > 0);
  }

  function distributeCashReward(totalCash, recipientEntries, valueKey) {
    return distributeByRatio(totalCash, recipientEntries, valueKey);
  }

  function distributeDrugsReward(totalDrugs, recipientEntries, valueKey) {
    return distributeByRatio(totalDrugs, recipientEntries, valueKey);
  }

  function distributeMaterialsReward(totalMaterials, recipientEntries, valueKey) {
    return distributeByRatio(totalMaterials, recipientEntries, valueKey);
  }

  function registerBountyContribution(bountyId, attackerId, contributionValue) {
    const bounty = state.bounties.find((entry) => entry.id === bountyId && entry.status === "active");
    if (!bounty) return null;

    const playerId = String(attackerId || "").trim();
    const safeContribution = Math.max(0, Number(contributionValue || 0));
    if (!playerId || safeContribution <= 0) return bounty;

    const existing = Array.isArray(bounty.contributors)
      ? bounty.contributors.find((entry) => entry.playerId === playerId)
      : null;

    if (existing) {
      existing.contributionDamage = Math.max(0, Number(existing.contributionDamage || 0) + safeContribution);
      existing.contributionScore = Math.max(0, Number(existing.contributionScore || 0) + safeContribution);
    } else {
      bounty.contributors.push({
        playerId,
        contributionDamage: safeContribution,
        contributionScore: safeContribution
      });
    }

    persistBounties();
    return bounty;
  }

  function isLocalPlayer(playerId) {
    const safe = String(playerId || "").trim();
    if (!safe) return false;
    const normalized = normalizeText(safe);
    return normalized === normalizeText(getCurrentPlayerId()) || normalized === normalizeText(getCurrentPlayerName());
  }

  function buildCaptureDistributions(bounty, claimerId, contributors) {
    const claimerShareCash = Math.floor(bounty.rewardCash * 0.5);
    const claimerShareDrugs = Math.floor(bounty.rewardDrugs * 0.5);
    const claimerShareMaterials = Math.floor(bounty.rewardMaterials * 0.5);
    const others = contributors.filter((entry) => entry.playerId !== claimerId);

    if (!others.length) {
      return {
        cash: [{ playerId: claimerId, amount: bounty.rewardCash }],
        drugs: [{ playerId: claimerId, amount: bounty.rewardDrugs }],
        materials: [{ playerId: claimerId, amount: bounty.rewardMaterials }]
      };
    }

    return {
      cash: [{ playerId: claimerId, amount: claimerShareCash }].concat(
        distributeCashReward(bounty.rewardCash - claimerShareCash, others, "contributionScore")
      ),
      drugs: [{ playerId: claimerId, amount: claimerShareDrugs }].concat(
        distributeDrugsReward(bounty.rewardDrugs - claimerShareDrugs, others, "contributionScore")
      ),
      materials: [{ playerId: claimerId, amount: claimerShareMaterials }].concat(
        distributeMaterialsReward(bounty.rewardMaterials - claimerShareMaterials, others, "contributionScore")
      )
    };
  }

  function completeBounty(bountyId, claimedByPlayerId) {
    const bounty = state.bounties.find((entry) => entry.id === bountyId && entry.status === "active");
    if (!bounty) return { ok: false, error: "Bounty neexistuje." };

    const claimerId = String(claimedByPlayerId || getCurrentPlayerId()).trim() || getCurrentPlayerId();
    const contributors = Array.isArray(bounty.contributors) ? bounty.contributors.map((entry) => ({ ...entry })) : [];
    if (!contributors.find((entry) => entry.playerId === claimerId)) {
      contributors.push({ playerId: claimerId, contributionDamage: 1, contributionScore: 1 });
    }

    let cashDistributions = [];
    let drugDistributions = [];
    let materialDistributions = [];

    if (bounty.bountyType === BOUNTY_TYPES.CAPTURE_DISTRICT) {
      const split = buildCaptureDistributions(bounty, claimerId, contributors);
      cashDistributions = split.cash;
      drugDistributions = split.drugs;
      materialDistributions = split.materials;
    } else {
      cashDistributions = distributeCashReward(bounty.rewardCash, contributors, "contributionScore");
      drugDistributions = distributeDrugsReward(bounty.rewardDrugs, contributors, "contributionScore");
      materialDistributions = distributeMaterialsReward(bounty.rewardMaterials, contributors, "contributionScore");
    }

    const localPayout = { cash: 0, drugs: 0, materials: 0, drugType: bounty.rewardDrugType, materialType: bounty.rewardMaterialType };
    cashDistributions.forEach((entry) => {
      if (isLocalPlayer(entry.playerId)) localPayout.cash += clampWholeNumber(entry.amount);
    });
    drugDistributions.forEach((entry) => {
      if (isLocalPlayer(entry.playerId)) localPayout.drugs += clampWholeNumber(entry.amount);
    });
    materialDistributions.forEach((entry) => {
      if (isLocalPlayer(entry.playerId)) localPayout.materials += clampWholeNumber(entry.amount);
    });

    const rewardResult = applyEconomyRewardDelta({
      cash: localPayout.cash,
      drugType: bounty.rewardDrugType,
      drugAmount: localPayout.drugs,
      materialType: bounty.rewardMaterialType,
      materialAmount: localPayout.materials
    });
    if (!rewardResult.ok) return rewardResult;

    bounty.status = "completed";
    bounty.claimedBy = claimerId;
    persistBounties();
    applyBountyVisualsToMap();

    const payoutSummary = summarizeLocalPayout(localPayout);
    pushFeedMessage(`Odměna za hráče ${bounty.targetName} byla vyplacena.${payoutSummary ? ` Získáno: ${payoutSummary}.` : ""}`);

    return {
      ok: true,
      bounty,
      localPayout,
      payoutSummary
    };
  }

  function expireBounties() {
    const currentTime = nowMs();
    let changed = false;
    state.bounties.forEach((entry) => {
      if (entry.status === "active" && Number(entry.expiresAt || 0) <= currentTime) {
        entry.status = "expired";
        const shouldRefundLocalIssuer = isLocalPlayer(entry.issuerPlayerId);
        if (shouldRefundLocalIssuer && clampWholeNumber(entry.rewardCash) > 0) {
          refundCleanCash(entry.rewardCash);
          pushFeedMessage(`Bounty na hráče ${entry.targetName || "target"} expirovala. Vráceno ${formatMoney(entry.rewardCash)}.`);
        }
        changed = true;
      }
    });
    if (changed) {
      setBounties(state.bounties);
    }
  }

  function applyBountyVisualsToMap() {
    const map = getMap();
    if (!map?.setBountyDistrictMarkers) return;

    const activeBounties = getActiveBounties();
    if (!activeBounties.length) {
      map.setBountyDistrictMarkers([]);
      return;
    }

    const markersByDistrict = new Map();
    const addMarker = (districtId, targetName) => {
      const districtKey = String(districtId ?? "").trim();
      if (!districtKey) return;
      if (!markersByDistrict.has(districtKey)) {
        markersByDistrict.set(districtKey, {
          districtId,
          count: 0,
          targetName: String(targetName || "").trim(),
          huntModeActive: false
        });
      }
      markersByDistrict.get(districtKey).count += 1;
    };

    activeBounties.forEach((entry) => {
      if (entry?.districtId != null && String(entry.districtId).trim() !== "") {
        addMarker(entry.districtId, entry.targetName);
        return;
      }
      const targetKey = normalizeText(entry?.targetPlayerId || "");
      getDistricts().forEach((district) => {
        const ownerKey = normalizeText(getOwnerName(district));
        if (ownerKey && ownerKey === targetKey) {
          addMarker(district.id, entry.targetName);
        }
      });
    });

    const markers = Array.from(markersByDistrict.values()).map((marker) => ({
      ...marker,
      count: Math.max(1, clampWholeNumber(marker.count))
    }));

    map.setBountyDistrictMarkers(markers);
  }

  function resolveBountyAfterAttack(attackResult) {
    const targetPlayerId = normalizeText(attackResult?.targetPlayerId || attackResult?.previousOwnerName || "");
    if (!targetPlayerId) return { completed: [] };

    const districtId = attackResult?.districtId;
    const active = getActiveBountiesForPlayer(targetPlayerId).filter((entry) => {
      if (entry?.districtId == null || String(entry.districtId).trim() === "") return true;
      return String(entry.districtId) === String(districtId);
    });
    if (!active.length) return { completed: [] };

    const attackerId = String(attackResult?.attackerId || getCurrentPlayerId()).trim() || getCurrentPlayerId();
    const defenderLossPct = Math.max(0, Number(attackResult?.defenderLossPct || 0));
    const outcomeKey = String(attackResult?.outcomeKey || "").trim().toLowerCase();
    const captureSuccess = Boolean(attackResult?.capturedDistrict) || outcomeKey === "total_success";
    const districtDestroyed = Boolean(attackResult?.districtDestroyed) || outcomeKey === "catastrophe";
    const completed = [];

    active.forEach((bounty) => {
      const contributionValue = Math.max(1, defenderLossPct || 1);
      if (bounty.bountyType === BOUNTY_TYPES.CAPTURE_DISTRICT && captureSuccess) {
        registerBountyContribution(bounty.id, attackerId, contributionValue);
        const result = completeBounty(bounty.id, attackerId);
        if (result.ok) completed.push(result);
        return;
      }
      if (bounty.bountyType === BOUNTY_TYPES.DESTROY_DISTRICT && districtDestroyed) {
        registerBountyContribution(bounty.id, attackerId, contributionValue);
        const result = completeBounty(bounty.id, attackerId);
        if (result.ok) completed.push(result);
      }
    });

    return { completed };
  }

  async function claimMatchingBountiesForOccupation(district, previousOwnerName) {
    if (isServerBacked()) {
      const targetUsername = String(previousOwnerName || getOwnerName(district) || "").trim();
      if (!targetUsername) return { claimedEntries: [], rewardSummary: "" };
      const response = await window.Empire.API.claimBounties({
        targetUsername,
        districtId: district?.id || null
      });
      if (response?.error) return { claimedEntries: [], rewardSummary: "" };
      const nextBounties = Array.isArray(response?.bounties) ? response.bounties.map(normalizeRemoteBounty).filter(Boolean) : [];
      setBounties(nextBounties);
      await refreshEconomyFromServer();
      const claimedEntries = Array.isArray(response?.claimed) ? response.claimed : [];
      const rewardSummary = summarizeRewardParts(
        claimedEntries.map((entry) => summarizeLocalPayout(entry?.payout || {}))
      );
      if (rewardSummary) {
        pushFeedMessage(`Bounty vyplacena: ${rewardSummary}.`);
      }
      return { claimedEntries, rewardSummary };
    }

    const targetPlayerId = normalizeText(previousOwnerName || getOwnerName(district));
    if (!targetPlayerId) return { claimedEntries: [], rewardSummary: "" };

    const active = getActiveBountiesForPlayer(targetPlayerId)
      .filter((entry) => entry.bountyType === BOUNTY_TYPES.CAPTURE_DISTRICT)
      .filter((entry) => {
        if (entry?.districtId == null || String(entry.districtId).trim() === "") return true;
        return String(entry.districtId) === String(district?.id);
      });
    if (!active.length) return { claimedEntries: [], rewardSummary: "" };

    const attackerId = getCurrentPlayerId();
    const claimedEntries = [];
    const summaries = [];

    active.forEach((bounty) => {
      registerBountyContribution(bounty.id, attackerId, 100);
      const result = completeBounty(bounty.id, attackerId);
      if (!result.ok) return;
      claimedEntries.push(result.bounty);
      if (result.payoutSummary) summaries.push(result.payoutSummary);
    });

    return {
      claimedEntries,
      rewardSummary: summarizeRewardParts(summaries)
    };
  }

  function getModalElements() {
    return {
      root: document.getElementById("empire-bounty-modal"),
      targetSelect: document.getElementById("empire-bounty-target"),
      targetDistrictRow: document.getElementById("empire-bounty-target-district-row"),
      targetDistrictSelect: document.getElementById("empire-bounty-target-district"),
      targetAvatar: document.getElementById("empire-bounty-target-avatar"),
      targetAvatarImage: document.getElementById("empire-bounty-target-avatar-img"),
      targetAvatarFallback: document.getElementById("empire-bounty-target-avatar-fallback"),
      targetName: document.getElementById("empire-bounty-target-name"),
      targetAlliance: document.getElementById("empire-bounty-target-alliance"),
      targetDistricts: document.getElementById("empire-bounty-target-districts"),
      targetActivity: document.getElementById("empire-bounty-target-activity"),
      rewardCash: document.getElementById("empire-bounty-cash"),
      rewardCashDec: document.getElementById("empire-bounty-cash-dec"),
      rewardCashInc: document.getElementById("empire-bounty-cash-inc"),
      rewardCashHave: document.getElementById("empire-bounty-cash-have"),
      totalValue: document.getElementById("empire-bounty-total"),
      previewTarget: document.getElementById("empire-bounty-preview-target"),
      previewValue: document.getElementById("empire-bounty-preview-value"),
      previewType: document.getElementById("empire-bounty-preview-type"),
      previewDuration: document.getElementById("empire-bounty-preview-duration"),
      previewAuthor: document.getElementById("empire-bounty-preview-author"),
      activeTableWrap: document.getElementById("empire-bounty-table-wrap"),
      activeTableBody: document.getElementById("empire-bounty-table-body"),
      error: document.getElementById("empire-bounty-error"),
      cancel: document.getElementById("empire-bounty-cancel"),
      submit: document.getElementById("empire-bounty-submit"),
      anonymous: document.getElementById("empire-bounty-anonymous")
    };
  }

  function ensureModal() {
    if (state.modalReady && document.getElementById("empire-bounty-modal")) return;

    const modal = document.createElement("div");
    modal.id = "empire-bounty-modal";
    modal.className = "empire-bounty-modal hidden";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="empire-bounty-modal__backdrop" data-bounty-close="1"></div>
      <div class="empire-bounty-modal__panel" role="dialog" aria-modal="true" aria-labelledby="empire-bounty-title">
        <div class="empire-bounty-modal__header">
          <div>
            <div class="empire-bounty-modal__eyebrow">BOUNTY SYSTEM</div>
            <h3 id="empire-bounty-title">VYPSAT ODMĚNU</h3>
            <p>Označ hráče a vystav ho celému městu.</p>
          </div>
          <button class="empire-bounty-modal__close" type="button" aria-label="Zavřít" data-bounty-close="1">✕</button>
        </div>
        <div class="empire-bounty-modal__body">
          <div class="empire-bounty-modal__main">
            <section class="empire-bounty-card empire-bounty-card--target">
              <div class="empire-bounty-card__header">
                <div class="empire-bounty-card__title">Target</div>
                <select id="empire-bounty-target" class="empire-bounty-select"></select>
              </div>
              <label id="empire-bounty-target-district-row" class="empire-bounty-resource-row">
                <span class="empire-bounty-resource-row__head"><strong>Cíl districtu (volitelné)</strong></span>
                <select id="empire-bounty-target-district" class="empire-bounty-select">
                  <option value="">Všechny districty targeta</option>
                </select>
              </label>
              <div class="empire-bounty-target-card">
                <button id="empire-bounty-target-avatar" class="empire-bounty-target-card__avatar" type="button" aria-label="Zobrazit avatar targeta">
                  <img id="empire-bounty-target-avatar-img" class="empire-bounty-target-card__avatar-img hidden" alt="Avatar target hráče" />
                  <span id="empire-bounty-target-avatar-fallback" class="empire-bounty-target-card__avatar-fallback">?</span>
                </button>
                <div class="empire-bounty-target-card__body">
                  <div class="empire-bounty-target-card__top">
                    <strong id="empire-bounty-target-name">Žádný target</strong>
                  </div>
                  <div id="empire-bounty-target-alliance" class="empire-bounty-target-card__meta">Bez aliance</div>
                  <div id="empire-bounty-target-districts" class="empire-bounty-target-card__meta">Districtů: 0</div>
                  <div id="empire-bounty-target-activity" class="empire-bounty-target-card__meta">Poslední aktivita: -</div>
                </div>
              </div>
            </section>

            <section class="empire-bounty-card">
              <div class="empire-bounty-card__header">
                <div class="empire-bounty-card__title">Nastavení odměny</div>
                <div id="empire-bounty-total" class="empire-bounty-total">${formatMoney(0)}</div>
              </div>
              <div class="empire-bounty-resources">
                <label class="empire-bounty-resource-row">
                  <span class="empire-bounty-resource-row__head"><strong>Clean cash</strong></span>
                  <div class="empire-bounty-cash-stepper">
                    <button id="empire-bounty-cash-dec" class="empire-bounty-step-btn" type="button" aria-label="Snížit částku">−</button>
                    <input id="empire-bounty-cash" class="empire-bounty-input empire-bounty-input--cash" type="number" min="${MIN_BOUNTY_CASH}" step="100" value="${MIN_BOUNTY_CASH}" />
                    <button id="empire-bounty-cash-inc" class="empire-bounty-step-btn" type="button" aria-label="Zvýšit částku">+</button>
                  </div>
                  <span id="empire-bounty-cash-have" class="empire-bounty-resource-row__have">Máš: ${formatMoney(0)}</span>
                </label>
              </div>
            </section>

            <section class="empire-bounty-card empire-bounty-card--split">
              <div>
                <div class="empire-bounty-card__title empire-bounty-card__title--spaced">Typ bounty</div>
                <div class="empire-bounty-choice-grid">
                  <label class="empire-bounty-choice-card">
                    <input type="radio" name="empire-bounty-type" value="${BOUNTY_TYPES.CAPTURE_DISTRICT}" checked />
                    <span>Za obsazení districtu</span>
                  </label>
                  <label class="empire-bounty-choice-card">
                    <input type="radio" name="empire-bounty-type" value="${BOUNTY_TYPES.DESTROY_DISTRICT}" />
                    <span>Za destrukci nového bytu</span>
                  </label>
                </div>
              </div>
              <div>
                <div class="empire-bounty-card__title empire-bounty-card__title--spaced">Doba trvání</div>
                <div class="empire-bounty-duration-grid">
                  ${BOUNTY_DURATIONS.map((duration, index) => `
                    <label class="empire-bounty-segmented__item">
                      <input type="radio" name="empire-bounty-duration" value="${duration}" ${index === 1 ? "checked" : ""} />
                      <span>${duration}h</span>
                    </label>
                  `).join("")}
                  <label class="empire-bounty-toggle empire-bounty-toggle--inline">
                    <input id="empire-bounty-anonymous" type="checkbox" checked />
                    <span>
                      <strong>Anonymní odměna</strong>
                    </span>
                  </label>
                </div>
              </div>
            </section>
          </div>

          <aside class="empire-bounty-modal__side">
            <section class="empire-bounty-card empire-bounty-preview">
              <div class="empire-bounty-preview__eyebrow">HOT TARGET</div>
              <div id="empire-bounty-preview-target" class="empire-bounty-preview__name">Žádný target</div>
              <div id="empire-bounty-preview-value" class="empire-bounty-preview__value">${formatMoney(0)}</div>
              <div class="empire-bounty-preview__meta">
                <div><span>Typ bounty</span><strong id="empire-bounty-preview-type">Za obsazení districtu</strong></div>
                <div><span>Trvání</span><strong id="empire-bounty-preview-duration">12h</strong></div>
                <div><span>Autor</span><strong id="empire-bounty-preview-author">Anonymní</strong></div>
              </div>
            </section>

            <section class="empire-bounty-card empire-bounty-list">
              <div class="empire-bounty-card__title empire-bounty-card__title--spaced">Aktivní bounty</div>
              <div id="empire-bounty-table-wrap" class="empire-bounty-table-wrap">
                <table class="empire-bounty-table">
                  <thead>
                    <tr>
                      <th>Target</th>
                      <th>Issuer</th>
                      <th>District</th>
                      <th>Odměna</th>
                      <th>Typ</th>
                      <th>Zbývá</th>
                    </tr>
                  </thead>
                  <tbody id="empire-bounty-table-body">
                    <tr><td colspan="6">Žádné aktivní bounty.</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            <div id="empire-bounty-error" class="empire-bounty-error"></div>

            <div class="empire-bounty-actions">
              <button id="empire-bounty-cancel" class="btn btn--ghost" type="button">Zrušit</button>
              <button id="empire-bounty-submit" class="btn btn--danger empire-bounty-submit" type="button">VYPSAT ODMĚNU</button>
            </div>
          </aside>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    bindModalEvents();
    state.modalReady = true;
  }

  function getSelectedBountyType() {
    return String(document.querySelector('input[name="empire-bounty-type"]:checked')?.value || BOUNTY_TYPES.CAPTURE_DISTRICT).trim();
  }

  function getSelectedDurationHours() {
    return clampWholeNumber(document.querySelector('input[name="empire-bounty-duration"]:checked')?.value || 12);
  }

  function resetModalForm() {
    const elements = getModalElements();
    if (elements.rewardCash) elements.rewardCash.value = String(MIN_BOUNTY_CASH);
    if (elements.targetDistrictSelect) elements.targetDistrictSelect.value = "";
    if (elements.anonymous) elements.anonymous.checked = true;
    const defaultType = document.querySelector('input[name="empire-bounty-type"][value="capture_district"]');
    if (defaultType) defaultType.checked = true;
    const defaultDuration = document.querySelector('input[name="empire-bounty-duration"][value="12"]');
    if (defaultDuration) defaultDuration.checked = true;
    if (elements.error) elements.error.textContent = "";
  }

  function setModalScrollLock(locked) {
    const body = document.body;
    const html = document.documentElement;
    if (!body || !html) return;

    const isMobile = typeof window.matchMedia === "function"
      ? window.matchMedia(MOBILE_BOUNTY_MEDIA_QUERY).matches
      : false;

    if (!isMobile) {
      body.classList.remove("mobile-bounty-modal-open");
      html.classList.remove("mobile-bounty-modal-open");
      return;
    }

    body.classList.toggle("mobile-bounty-modal-open", Boolean(locked));
    html.classList.toggle("mobile-bounty-modal-open", Boolean(locked));
  }

  function closeModal() {
    setModalScrollLock(false);
    const root = document.getElementById("empire-bounty-modal");
    if (!root) return;
    root.classList.add("hidden");
    root.setAttribute("aria-hidden", "true");
    resetModalForm();
    state.selectedTargetId = "";
  }

  function ensureSuccessModal() {
    let root = document.getElementById("empire-bounty-success");
    if (root) return root;
    root = document.createElement("div");
    root.id = "empire-bounty-success";
    root.className = "empire-bounty-success hidden";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
      <div class="empire-bounty-success__card">
        <div class="empire-bounty-success__title">ODMĚNA ÚSPĚŠNĚ VYPSÁNA</div>
        <div id="empire-bounty-success-target" class="empire-bounty-success__target">Target: -</div>
        <div id="empire-bounty-success-value" class="empire-bounty-success__value">${formatMoney(0)}</div>
      </div>
    `;
    document.body.appendChild(root);
    root.addEventListener("click", () => {
      root.classList.add("hidden");
      root.setAttribute("aria-hidden", "true");
    });
    return root;
  }

  function ensureAvatarPreview() {
    let root = document.getElementById("empire-bounty-avatar-preview");
    if (root) return root;
    root = document.createElement("div");
    root.id = "empire-bounty-avatar-preview";
    root.className = "empire-bounty-avatar-preview hidden";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
      <div class="empire-bounty-avatar-preview__backdrop" data-bounty-avatar-close="1"></div>
      <div class="empire-bounty-avatar-preview__panel">
        <button class="empire-bounty-avatar-preview__close" type="button" aria-label="Zavřít náhled" data-bounty-avatar-close="1">✕</button>
        <img id="empire-bounty-avatar-preview-img" class="empire-bounty-avatar-preview__img" alt="Avatar hráče" />
      </div>
    `;
    root.addEventListener("click", (event) => {
      const closeTrigger = event.target instanceof Element ? event.target.closest("[data-bounty-avatar-close='1']") : null;
      if (!closeTrigger) return;
      root.classList.add("hidden");
      root.setAttribute("aria-hidden", "true");
    });
    document.body.appendChild(root);
    return root;
  }

  function openAvatarPreview() {
    const elements = getModalElements();
    const imageSrc = String(elements.targetAvatarImage?.getAttribute("src") || "").trim();
    if (!imageSrc) return;
    const root = ensureAvatarPreview();
    const image = document.getElementById("empire-bounty-avatar-preview-img");
    if (!image) return;
    image.src = imageSrc;
    root.classList.remove("hidden");
    root.setAttribute("aria-hidden", "false");
  }

  function showSuccessModal(targetName, rewardCash) {
    const root = ensureSuccessModal();
    const targetEl = document.getElementById("empire-bounty-success-target");
    const valueEl = document.getElementById("empire-bounty-success-value");
    if (targetEl) targetEl.textContent = `Target: ${String(targetName || "-").trim() || "-"}`;
    if (valueEl) valueEl.textContent = formatMoney(rewardCash);
    root.classList.remove("hidden");
    root.setAttribute("aria-hidden", "false");
    if (state.successTimerId) window.clearTimeout(state.successTimerId);
    state.successTimerId = window.setTimeout(() => {
      root.classList.add("hidden");
      root.setAttribute("aria-hidden", "true");
    }, 2200);
  }

  function openModal(targetId = "") {
    ensureModal();
    const root = document.getElementById("empire-bounty-modal");
    if (!root) return;
    state.selectedTargetId = String(targetId || state.selectedTargetId || "").trim();
    syncModal();
    root.classList.remove("hidden");
    root.setAttribute("aria-hidden", "false");
    setModalScrollLock(true);
  }

  function bindModalEvents() {
    const root = document.getElementById("empire-bounty-modal");
    if (!root || root.dataset.bound === "1") return;
    root.dataset.bound = "1";
    const mobileMedia = typeof window.matchMedia === "function"
      ? window.matchMedia(MOBILE_BOUNTY_MEDIA_QUERY)
      : null;

    root.addEventListener("click", (event) => {
      const closeTrigger = event.target instanceof Element ? event.target.closest("[data-bounty-close='1']") : null;
      if (closeTrigger) {
        closeModal();
      }
    });

    const elements = getModalElements();
    elements.cancel?.addEventListener("click", closeModal);
    elements.submit?.addEventListener("click", handleCreateBounty);
    elements.targetAvatar?.addEventListener("click", openAvatarPreview);
    elements.targetSelect?.addEventListener("change", () => {
      state.selectedTargetId = String(elements.targetSelect.value || "").trim();
      syncModal();
    });
    elements.targetDistrictSelect?.addEventListener("change", syncModal);

    [elements.rewardCash].forEach((input) => {
      input?.addEventListener("input", syncModal);
    });
    [elements.anonymous].forEach((input) => {
      input?.addEventListener("change", syncModal);
    });

    document.querySelectorAll('input[name="empire-bounty-type"], input[name="empire-bounty-duration"]').forEach((input) => {
      input.addEventListener("change", syncModal);
    });

    const stepCash = (delta) => {
      if (!elements.rewardCash) return;
      const current = clampWholeNumber(elements.rewardCash.value || MIN_BOUNTY_CASH);
      const maxCash = clampWholeNumber(getEconomySnapshot().cleanMoney || 0);
      const next = Math.min(Math.max(current + delta, MIN_BOUNTY_CASH), Math.max(maxCash, MIN_BOUNTY_CASH));
      elements.rewardCash.value = String(next);
      syncModal();
    };
    elements.rewardCashDec?.addEventListener("click", () => stepCash(-100));
    elements.rewardCashInc?.addEventListener("click", () => stepCash(100));

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        const preview = document.getElementById("empire-bounty-avatar-preview");
        if (preview && !preview.classList.contains("hidden")) {
          preview.classList.add("hidden");
          preview.setAttribute("aria-hidden", "true");
        }
      }
      if (event.key === "Escape" && !root.classList.contains("hidden")) {
        closeModal();
      }
    });

    const handleViewportChange = () => {
      setModalScrollLock(!root.classList.contains("hidden"));
    };
    if (mobileMedia) {
      if (typeof mobileMedia.addEventListener === "function") {
        mobileMedia.addEventListener("change", handleViewportChange);
      } else if (typeof mobileMedia.addListener === "function") {
        mobileMedia.addListener(handleViewportChange);
      }
    }
  }

  function renderIfModalOpen() {
    const root = document.getElementById("empire-bounty-modal");
    if (root && !root.classList.contains("hidden")) {
      syncModal();
    }
  }

  function syncModal() {
    ensureModal();
    const elements = getModalElements();
    const players = collectTargetPlayers();
    const selectedTargetId = state.selectedTargetId && players.some((player) => player.id === state.selectedTargetId)
      ? state.selectedTargetId
      : (players[0]?.id || "");
    state.selectedTargetId = selectedTargetId;

    if (elements.targetSelect) {
      elements.targetSelect.innerHTML = players.length
        ? players.map((player) => `<option value="${player.id}" ${player.id === selectedTargetId ? "selected" : ""}>${player.name}</option>`).join("")
        : '<option value="">Žádný nepřítel na mapě</option>';
    }

    const selectedTarget = players.find((player) => player.id === selectedTargetId) || null;
    const selectedBountyType = getSelectedBountyType();
    const isCaptureBounty = selectedBountyType === BOUNTY_TYPES.CAPTURE_DISTRICT;
    const targetDistricts = selectedTarget ? getTargetDistricts(selectedTarget.id) : [];
    if (elements.targetDistrictRow) {
      elements.targetDistrictRow.classList.toggle("hidden", !isCaptureBounty);
    }
    if (elements.targetDistrictSelect) {
      const currentDistrictValue = String(elements.targetDistrictSelect.value || "").trim();
      const options = ['<option value="">Všechny districty targeta</option>'].concat(
        targetDistricts.map((district) => `<option value="${String(district.id)}">${district.name}</option>`)
      );
      elements.targetDistrictSelect.innerHTML = options.join("");
      const hasCurrent = targetDistricts.some((district) => String(district.id) === currentDistrictValue);
      elements.targetDistrictSelect.value = isCaptureBounty && hasCurrent ? currentDistrictValue : "";
      elements.targetDistrictSelect.disabled = !isCaptureBounty;
    }
    const snapshot = getEconomySnapshot();

    const maxCash = clampWholeNumber(snapshot.cleanMoney || 0);

    if (elements.rewardCash) {
      elements.rewardCash.max = String(maxCash);
      const nextCash = clampWholeNumber(elements.rewardCash.value || MIN_BOUNTY_CASH);
      const bounded = Math.min(Math.max(nextCash, MIN_BOUNTY_CASH), Math.max(maxCash, 0));
      elements.rewardCash.value = String(bounded);
    }

    const rewardCash = clampWholeNumber(elements.rewardCash?.value);
    const totalValue = rewardCash;

    const avatarLabel = String(selectedTarget?.avatarLabel || "?").slice(0, 2).toUpperCase() || "?";
    const avatarUrl = String(selectedTarget?.avatarUrl || "").trim();
    if (elements.targetAvatarFallback) {
      elements.targetAvatarFallback.textContent = avatarLabel;
      elements.targetAvatarFallback.classList.toggle("hidden", Boolean(avatarUrl));
    }
    if (elements.targetAvatarImage) {
      if (avatarUrl) {
        elements.targetAvatarImage.src = avatarUrl;
        elements.targetAvatarImage.classList.remove("hidden");
      } else {
        elements.targetAvatarImage.removeAttribute("src");
        elements.targetAvatarImage.classList.add("hidden");
      }
    }
    if (elements.targetName) elements.targetName.textContent = selectedTarget?.name || "Žádný target";
    if (elements.targetAlliance) elements.targetAlliance.textContent = selectedTarget?.allianceTag || "Bez aliance";
    if (elements.targetDistricts) elements.targetDistricts.textContent = `Districtů: ${clampWholeNumber(selectedTarget?.districtCount)}`;
    if (elements.targetActivity) elements.targetActivity.textContent = `Poslední aktivita: ${formatRelativeTime(selectedTarget?.lastActivityAt)}`;
    if (elements.rewardCashHave) elements.rewardCashHave.textContent = `Máš: ${formatMoney(maxCash)}`;

    if (elements.totalValue) elements.totalValue.textContent = formatMoney(totalValue);
    if (elements.previewTarget) elements.previewTarget.textContent = selectedTarget?.name || "Žádný target";
    if (elements.previewValue) elements.previewValue.textContent = formatMoney(totalValue);
    if (elements.previewType) elements.previewType.textContent = formatBountyTypeLabel(selectedBountyType);
    if (elements.previewDuration) elements.previewDuration.textContent = formatDurationHours(getSelectedDurationHours());
    if (elements.previewAuthor) elements.previewAuthor.textContent = elements.anonymous?.checked ? "Anonymní" : getCurrentPlayerName();
    if (elements.activeTableBody) {
      const visibleBounties = getActiveBounties();
      if (elements.activeTableWrap) {
        elements.activeTableWrap.classList.toggle("is-scrollable", visibleBounties.length > 3);
      }
      elements.activeTableBody.innerHTML = visibleBounties.length
        ? visibleBounties.map((entry) => {
          const issuerLabel = entry?.isAnonymous ? "Anonymní" : (String(entry?.issuerName || "").trim() || "Veřejná");
          const districtLabel = entry?.districtName || (entry?.districtId != null && String(entry.districtId).trim() !== "" ? `#${entry.districtId}` : "Všechny");
          const expiresAtMs = Number(entry?.expiresAt || 0);
          const remaining = expiresAtMs > 0 ? formatCountdown(expiresAtMs - nowMs()) : "-";
          const rewardLabel = clampWholeNumber(entry?.rewardCash) > 0 ? formatMoney(entry.rewardCash) : "-";
          return `<tr>
            <td>${entry?.targetName || "-"}</td>
            <td>${issuerLabel}</td>
            <td>${districtLabel}</td>
            <td>${rewardLabel}</td>
            <td>${formatBountyTypeLabel(entry?.bountyType)}</td>
            <td>${remaining}</td>
          </tr>`;
        }).join("")
        : '<tr><td colspan="6">Žádné aktivní bounty.</td></tr>';
    }

    if (elements.submit) {
      const canAfford = rewardCash >= MIN_BOUNTY_CASH && rewardCash <= maxCash;
      elements.submit.disabled = !selectedTarget || !canAfford;
    }
  }

  async function handleCreateBounty() {
    const elements = getModalElements();
    const bountyType = getSelectedBountyType();
    const selectedTarget = collectTargetPlayers().find((entry) => entry.id === state.selectedTargetId) || null;
    const rewardCash = clampWholeNumber(elements.rewardCash?.value);
    const targetDistrictId = bountyType === BOUNTY_TYPES.CAPTURE_DISTRICT
      ? (String(elements.targetDistrictSelect?.value || "").trim() || null)
      : null;
    const result = await createBounty({
      targetPlayerId: state.selectedTargetId,
      targetDistrictId,
      issuerPlayerId: getCurrentPlayerId(),
      issuerName: getCurrentPlayerName(),
      isAnonymous: Boolean(elements.anonymous?.checked),
      rewardCash,
      rewardDrugs: 0,
      rewardMaterials: 0,
      rewardDrugType: DRUG_TYPES[0].key,
      rewardMaterialType: MATERIAL_TYPES[0].key,
      bountyType,
      durationHours: getSelectedDurationHours()
    });

    if (!result.ok) {
      if (elements.error) elements.error.textContent = String(result.error || "Bounty se nepodařilo vytvořit.");
      return;
    }

    if (elements.error) elements.error.textContent = "";
    closeModal();
    showSuccessModal(selectedTarget?.name || "Target", rewardCash);
  }

  async function handleAttackResolved(event) {
    const detail = event?.detail || {};
    if (isServerBacked()) {
      const targetUsername = String(detail?.previousOwnerName || detail?.details?.previousOwnerName || "").trim();
      if (!targetUsername) return;
      const response = await window.Empire.API.resolveBounties({
        targetUsername,
        districtId: detail?.districtId || detail?.details?.districtId || null,
        resolutionType: "attack",
        contributionValue: Number(detail?.details?.defenderLossPct || 0),
        attackSucceeded:
          String(detail?.outcomeKey || detail?.details?.outcomeKey || "").trim().toLowerCase() === "total_success"
          || String(detail?.outcomeKey || detail?.details?.outcomeKey || "").trim().toLowerCase() === "pyrrhic_victory",
        capturedDistrict: String(detail?.details?.districtStateValue || "").trim().toLowerCase() === "obsazený",
        districtDestroyed:
          Boolean(detail?.details?.districtDestroyed)
          || String(detail?.outcomeKey || detail?.details?.outcomeKey || "").trim().toLowerCase() === "catastrophe"
      });
      if (!response?.error) {
        const nextBounties = Array.isArray(response?.bounties) ? response.bounties.map(normalizeRemoteBounty).filter(Boolean) : [];
        setBounties(nextBounties);
        await refreshEconomyFromServer();
        const rewardSummary = summarizeRewardParts(
          (Array.isArray(response?.claimed) ? response.claimed : []).map((entry) => summarizeLocalPayout(entry?.payout || {}))
        );
        if (rewardSummary) {
          pushFeedMessage(`Bounty vyplacena: ${rewardSummary}.`);
        }
      }
      return;
    }

    const result = resolveBountyAfterAttack({
      attackerId: getCurrentPlayerId(),
      targetPlayerId: detail?.previousOwnerName || detail?.details?.previousOwnerName || "",
      previousOwnerName: detail?.previousOwnerName || detail?.details?.previousOwnerName || "",
      districtId: detail?.districtId || detail?.details?.districtId || null,
      outcomeKey: detail?.outcomeKey || detail?.details?.outcomeKey || "",
      defenderLossPct: Number(detail?.details?.defenderLossPct || 0),
      capturedDistrict: String(detail?.details?.districtStateValue || "").trim().toLowerCase() === "obsazený",
      districtDestroyed:
        Boolean(detail?.details?.districtDestroyed)
        || String(detail?.outcomeKey || detail?.details?.outcomeKey || "").trim().toLowerCase() === "catastrophe"
    });
    if (result.completed?.length) {
      applyBountyVisualsToMap();
    }
  }

  function bindGlobalEvents() {
    if (document.body?.dataset?.bountyBound === "1") return;
    if (document.body) document.body.dataset.bountyBound = "1";

    document.addEventListener("empire:open-bounty-modal", () => openModal());
    document.addEventListener("empire:attack-resolved", handleAttackResolved);
    document.addEventListener("click", (event) => {
      const trigger = event.target instanceof Element ? event.target.closest("#city-events-target-btn") : null;
      if (!trigger || event.defaultPrevented) return;
      event.preventDefault();
      openModal();
    }, true);
  }

  function bootstrap() {
    if (state.bootstrapped) return;
    state.bootstrapped = true;
    localStorage.removeItem(STORAGE_KEY);
    setBounties([]);
    expireBounties();
    ensureModal();
    bindGlobalEvents();
    applyBountyVisualsToMap();
    window.Empire.openBountyModalShortcut = openModal;
    window.Empire.Bounty = {
      bootstrap,
      openModal,
      closeModal,
      createBounty,
      calculateBountyTotalValue,
      isHuntModeActive,
      getActiveBountiesForPlayer,
      applyBountyVisualsToMap,
      registerBountyContribution,
      resolveBountyAfterAttack,
      completeBounty,
      expireBounties,
      claimMatchingBountiesForOccupation,
      distributeCashReward,
      distributeDrugsReward,
      distributeMaterialsReward,
      BOUNTY_TYPES
    };

    if (state.timerId) window.clearInterval(state.timerId);
    state.timerId = window.setInterval(() => {
      expireBounties();
      applyBountyVisualsToMap();
    }, EXPIRE_INTERVAL_MS);

    if (state.modalTimerId) window.clearInterval(state.modalTimerId);
    state.modalTimerId = window.setInterval(() => {
      renderIfModalOpen();
    }, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
