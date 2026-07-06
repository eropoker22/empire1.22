import { getOnboardingTargetSelector as getRegistryTargetSelector } from "./onboardingStepRegistry.js";

const WIN_CONDITION_TEXT = "Přežít do Final Lockdownu a mít nejsilnější impérium. Území, budovy, zdroje i heat rozhodují skóre.";

function safeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeId(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }
  return raw.replace(/^district:/u, "") || null;
}

function normalizeNumberId(value) {
  const normalized = normalizeId(value);
  const numeric = Number.parseInt(String(normalized || ""), 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function resolvePlayerId(context = {}) {
  const registration = safeObject(context.registration);
  return String(
    context.playerId
    || registration.playerId
    || registration.identity
    || registration.gangName
    || "dev-player"
  ).trim() || "dev-player";
}

export function resolveOnboardingMode(context = {}) {
  const world = safeObject(context.world);
  const registration = safeObject(context.registration);
  const phase = safeObject(context.phase || world.phaseState);
  if (phase.gamePhase === "launch" || context.mode === "dev-only") {
    return "dev-only";
  }
  return String(registration.serverMode || context.mode || "dev-only").trim() || "dev-only";
}

function getOwnedDistrictIds(context = {}) {
  const world = safeObject(context.world);
  const districtState = safeObject(context.districtState);
  return asArray(world.ownedDistrictIds || districtState.ownedDistrictIds || context.ownedDistrictIds)
    .map(normalizeNumberId)
    .filter((districtId) => districtId !== null);
}

function getDistricts(context = {}) {
  const districtStateApi = context.districtStateApi || (typeof window !== "undefined" ? window.empireStreetsDistrictState : null);
  const fromApi = typeof districtStateApi?.getAllDistricts === "function" ? districtStateApi.getAllDistricts() : [];
  return asArray(context.districts || context.geometry?.districts || fromApi)
    .filter((district) => district && typeof district === "object");
}

function getDistrictId(district) {
  return normalizeNumberId(district?.id ?? district?.districtId);
}

function getAdjacentDistrictIds(district) {
  return asArray(district?.adjacentDistrictIds || district?.adjacentDistricts || district?.neighbors || district?.neighborDistrictIds)
    .map(normalizeNumberId)
    .filter((districtId) => districtId !== null);
}

function isDistrictOwnedByCurrentPlayer(district, ownedDistrictIds) {
  const districtId = getDistrictId(district);
  return districtId !== null && ownedDistrictIds.includes(districtId);
}

function isDestroyedDistrict(district, destroyedDistrictIds) {
  const districtId = getDistrictId(district);
  return district?.status === "destroyed" || (districtId !== null && destroyedDistrictIds.includes(districtId));
}

function resolveFirstOwnedDistrict(context, ownedDistrictIds, districts) {
  const explicit = normalizeNumberId(context.firstOwnedDistrictId);
  if (explicit !== null) {
    return explicit;
  }
  const district = districts.find((entry) => isDistrictOwnedByCurrentPlayer(entry, ownedDistrictIds));
  return getDistrictId(district) ?? ownedDistrictIds[0] ?? null;
}

function resolveSuggestedNeighbor(context, firstOwnedDistrictId, ownedDistrictIds, districts) {
  const explicit = normalizeNumberId(context.suggestedNeighborDistrictId);
  if (explicit !== null) {
    return explicit;
  }
  const world = safeObject(context.world);
  const destroyedDistrictIds = asArray(world.destroyedDistrictIds || context.destroyedDistrictIds)
    .map(normalizeNumberId)
    .filter((districtId) => districtId !== null);
  const firstOwnedDistrict = districts.find((district) => getDistrictId(district) === firstOwnedDistrictId);
  const adjacent = getAdjacentDistrictIds(firstOwnedDistrict);
  const adjacentCandidate = adjacent.find((districtId) => !ownedDistrictIds.includes(districtId) && !destroyedDistrictIds.includes(districtId));
  if (adjacentCandidate !== undefined) {
    return adjacentCandidate;
  }
  const fallback = districts.find((district) => {
    const districtId = getDistrictId(district);
    return districtId !== null
      && !ownedDistrictIds.includes(districtId)
      && !isDestroyedDistrict(district, destroyedDistrictIds);
  });
  return getDistrictId(fallback);
}

function resolveProduction(context, ownedDistrictIds, districts) {
  const production = safeObject(context.production);
  const districtStateApi = context.districtStateApi || (typeof window !== "undefined" ? window.empireStreetsDistrictState : null);
  const explicit = normalizeId(context.suggestedProductionBuildingId || production.suggestedBuildingId);
  if (explicit) {
    return { hasProductionBuilding: true, suggestedProductionBuildingId: explicit };
  }

  const jobs = asArray(production.jobs || production.slots || production.activeJobs);
  const readyJob = jobs.find((job) => job && (job.canCollect || Number(job.storedAmount || job.amount || 0) > 0));
  if (readyJob) {
    return {
      hasProductionBuilding: true,
      suggestedProductionBuildingId: normalizeId(readyJob.buildingId || readyJob.id || readyJob.slotId)
    };
  }

  const ownedDistrict = districts.find((district) => isDistrictOwnedByCurrentPlayer(district, ownedDistrictIds));
  const ownedDistrictId = getDistrictId(ownedDistrict) ?? ownedDistrictIds[0] ?? null;
  const apiProfile = ownedDistrictId !== null && typeof districtStateApi?.getDistrictBuildingProfile === "function"
    ? districtStateApi.getDistrictBuildingProfile(ownedDistrictId)
    : null;
  const buildings = asArray(ownedDistrict?.buildings || ownedDistrict?.buildingIds || ownedDistrict?.buildingProfile?.buildings || apiProfile?.buildings);
  const productionBuilding = buildings.find((building) => {
    if (typeof building === "string" || typeof building === "number") {
      return true;
    }
    const role = String([
      building?.role,
      building?.type,
      building?.buildingTypeId,
      building?.baseName,
      building?.displayName,
      building?.name
    ].filter(Boolean).join(" ")).toLowerCase();
    return /factory|tov[aá]rna|lab|laborato|production|produk|warehouse|sklad|recycling|recykl|dealer|school|škola|garage|gar[aá]ž/u.test(role);
  });

  return {
    hasProductionBuilding: Boolean(productionBuilding),
    suggestedProductionBuildingId: normalizeId(
      typeof productionBuilding === "object"
        ? productionBuilding.buildingId || productionBuilding.id || productionBuilding.name
        : productionBuilding
    )
  };
}

function hasActionButton(context, actionIds = []) {
  const root = context.root || (typeof document !== "undefined" ? document : null);
  if (!root?.querySelector) {
    return false;
  }
  return actionIds.some((actionId) => Boolean(root.querySelector(`[data-district-action-id="${actionId}"]:not(:disabled)`)));
}

function formatTicksShort(ticks) {
  const totalMinutes = Math.max(0, Math.ceil(Number(ticks || 0)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? (minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`) : `${totalMinutes}m`;
}

function formatScoreGap(value) {
  const safeValue = Math.max(0, Math.ceil(Number(value || 0)));
  if (safeValue >= 1000000) return `+${Math.round(safeValue / 100000) / 10}M`;
  if (safeValue >= 1000) return `+${Math.round(safeValue / 1000)}k`;
  return `+${safeValue}`;
}

function resolveFinalLockdown(context = {}) {
  const finalLockdown = safeObject(context.finalLockdown || context.player?.finalLockdown);
  const active = Boolean(finalLockdown.enabled && (finalLockdown.active || finalLockdown.status === "active"));
  const topRankCount = Math.max(1, Math.floor(Number(finalLockdown.topRankCount || 3)));
  const currentRank = Number(finalLockdown.currentPlayerRank);
  const leaderboardTop3 = asArray(finalLockdown.leaderboardTop3);
  const thresholdScore = Number(leaderboardTop3[Math.min(topRankCount, leaderboardTop3.length) - 1]?.score);
  const currentScore = Number(finalLockdown.currentPlayerFinalScore);
  const top3Gap = Number.isFinite(currentRank) && currentRank > 0 && currentRank <= topRankCount
    ? "drž pozici"
    : Number.isFinite(thresholdScore) && Number.isFinite(currentScore)
      ? formatScoreGap(Math.max(0, thresholdScore - currentScore + 1))
      : "-";

  return {
    available: Boolean(finalLockdown.enabled),
    active,
    status: finalLockdown.status || (active ? "active" : "inactive"),
    pausedByQuietHours: Boolean(finalLockdown.pausedByQuietHours),
    remainingLabel: finalLockdown.pausedByQuietHours
      ? "pauza do 06:00"
      : `${formatTicksShort(finalLockdown.remainingActiveTicks)} zbývá`,
    currentPlayerRank: Number.isFinite(currentRank) && currentRank > 0 ? currentRank : null,
    rankLabel: Number.isFinite(currentRank) && currentRank > 0 && currentRank <= topRankCount
      ? `Top ${topRankCount}`
      : Number.isFinite(currentRank) && currentRank > 0
        ? `#${currentRank}`
        : "-",
    topRankCount,
    top3Gap,
    currentPlayerFinalScore: Number.isFinite(currentScore) ? currentScore : null
  };
}

function resolveElimination(context = {}) {
  const elimination = safeObject(context.elimination || context.player?.elimination || context.gameplaySlice?.elimination);
  const currentPlayerStatus = String(
    elimination.currentPlayerStatus
    || elimination.playerStatus
    || context.currentPlayerStatus
    || context.playerStatus
    || "safe"
  ).trim() || "safe";

  const ticksUntilNext = Number(elimination.ticksUntilNextElimination);
  const nextEliminationLabel = elimination.eliminationsStopped
    ? "Eliminace skončily. Posledních 8 hráčů bojuje o město."
    : elimination.isQuietHoursNow
      ? "Eliminace jsou pozastavené do 06:00."
      : Number.isFinite(ticksUntilNext) && ticksUntilNext >= 0
        ? `za ${formatTicksShort(ticksUntilNext)}`
        : "čeká na serverový timer";
  const dangerZoneCount = asArray(elimination.dangerZone).length;
  const dangerZoneLabel = dangerZoneCount > 0
    ? `${dangerZoneCount} hráčů v danger zone`
    : "danger zone zatím bez dat";

  return {
    available: Boolean(elimination.enabled || context.eliminationAvailable),
    currentPlayerStatus,
    nextEliminationLabel,
    dangerZoneLabel,
    activePlayersRemaining: Number(elimination.activePlayersRemaining || 0) || null,
    maxPlayersPerServer: Number(context.maxPlayersPerServer || context.gameplaySlice?.server?.maxPlayersPerServer || 20) || 20,
    eliminationsStopped: Boolean(elimination.eliminationsStopped),
    isQuietHoursNow: Boolean(elimination.isQuietHoursNow),
    quietHoursResumeTick: Number.isFinite(Number(elimination.quietHoursResumeTick)) ? Number(elimination.quietHoursResumeTick) : null,
    deferredFromTick: Number.isFinite(Number(elimination.deferredFromTick)) ? Number(elimination.deferredFromTick) : null
  };
}

function resolvePlayerStatus(context = {}, elimination = {}) {
  const playerStatus = String(
    context.playerStatus
    || context.player?.status
    || context.player?.playerStatus
    || context.player?.elimination?.playerStatus
    || context.elimination?.playerStatus
    || ""
  ).trim();
  if (playerStatus) {
    return playerStatus;
  }
  return elimination.currentPlayerStatus === "defeated" ? "defeated" : "active";
}

function hasUiTarget(context, selector = "") {
  const root = context.root || (typeof document !== "undefined" ? document : null);
  return Boolean(selector && root?.querySelector?.(selector));
}

export function createOnboardingReadModel(context = {}) {
  const safeContext = safeObject(context);
  const playerId = resolvePlayerId(safeContext);
  const mode = resolveOnboardingMode(safeContext);
  const ownedDistrictIds = getOwnedDistrictIds(safeContext);
  const districts = getDistricts(safeContext);
  const firstOwnedDistrictId = resolveFirstOwnedDistrict(safeContext, ownedDistrictIds, districts);
  const suggestedNeighborDistrictId = firstOwnedDistrictId === null
    ? null
    : resolveSuggestedNeighbor(safeContext, firstOwnedDistrictId, ownedDistrictIds, districts);
  const production = resolveProduction(safeContext, ownedDistrictIds, districts);
  const elimination = resolveElimination(safeContext);
  const finalLockdown = resolveFinalLockdown(safeContext);
  const playerStatus = resolvePlayerStatus(safeContext, elimination);
  const heatAvailable = Boolean(
    safeContext.heatAvailable
    || safeContext.police
    || safeContext.gang?.heat !== undefined
    || safeContext.root?.querySelector?.("[data-gang-heat]")
  );

  return {
    playerId,
    mode,
    playerStatus,
    hasOwnedDistrict: firstOwnedDistrictId !== null,
    firstOwnedDistrictId: firstOwnedDistrictId === null ? null : String(firstOwnedDistrictId),
    hasNeighborDistricts: suggestedNeighborDistrictId !== null,
    suggestedNeighborDistrictId: suggestedNeighborDistrictId === null ? null : String(suggestedNeighborDistrictId),
    hasProductionBuilding: production.hasProductionBuilding,
    suggestedProductionBuildingId: production.suggestedProductionBuildingId,
    canSpy: Boolean(safeContext.canSpy || hasActionButton(safeContext, ["spy"])),
    canRob: Boolean(safeContext.canRob || hasActionButton(safeContext, ["rob", "heist"])),
    canAttack: Boolean(safeContext.canAttack || hasActionButton(safeContext, ["attack", "occupy"])),
    heatAvailable,
    dayNightAvailable: Boolean(safeContext.dayNight || safeContext.phase || safeContext.world?.phaseState || hasUiTarget(safeContext, ".map-phase-toolbar, [data-game-phase-toggle]")),
    eliminationAvailable: elimination.available,
    marketAvailable: Boolean(safeContext.market || hasUiTarget(safeContext, "[data-market-popup-open], [data-market-popup]")),
    allianceAvailable: Boolean(safeContext.alliance || hasUiTarget(safeContext, "[data-alliance-popup-open], #alliance-btn, [data-gang-alliance]")),
    cityFeedAvailable: Boolean(safeContext.cityFeed || hasUiTarget(safeContext, "[data-building-action-feed], [data-district-popup-gossip]")),
    currentPlayerStatus: elimination.currentPlayerStatus,
    elimination,
    finalLockdown,
    winConditionText: WIN_CONDITION_TEXT
  };
}

export function isOnboardingDefeated(readModel = {}) {
  return String(readModel.playerStatus || readModel.currentPlayerStatus || readModel.elimination?.currentPlayerStatus || "").trim() === "defeated";
}

export function getOnboardingTargetSelector(stepId, readModel = {}) {
  void readModel;
  return getRegistryTargetSelector(stepId);
}

export function resolveOnboardingStepState(step = {}, readModel = {}, root = null) {
  if (isOnboardingDefeated(readModel)) {
    return {
      status: "defeated",
      target: null,
      missingTarget: false,
      fallback: "Hráč je vyřazený z aktivní demo smyčky. Vrať se do lobby nebo začni novou session."
    };
  }

  const selector = step.targetSelector || getOnboardingTargetSelector(step.id, readModel);
  const rootTarget = selector && root?.querySelector ? root.querySelector(selector) : null;
  const ownerDocument = root?.ownerDocument || (typeof document !== "undefined" ? document : null);
  const target = rootTarget || (selector && ownerDocument?.querySelector ? ownerDocument.querySelector(selector) : null);
  const fallbackSource = step.fallbackBody ?? step.fallback;
  const fallback = typeof fallbackSource === "function" ? fallbackSource(readModel) : fallbackSource;
  const missingTarget = Boolean((selector && !target) || (!selector && fallback));

  return {
    status: target ? "ready" : (missingTarget ? "fallback" : "informational"),
    target,
    targetSelector: selector,
    missingTarget,
    fallbackTitle: target ? null : (step.fallbackTitle || "Cíl teď není dostupný."),
    fallback: target ? null : (fallback || "Tahle část UI teď není dostupná. Pokračuj dál, pravidla hry se nemění.")
  };
}
