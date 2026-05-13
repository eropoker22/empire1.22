export type HeistStyleId = "stealth" | "balanced" | "all_in";
export type HeistOutcome = "clean_success" | "success" | "detected" | "failed" | "trap_triggered";
export type HeistModeId = "free" | "war";

type AnyRecord = Record<string, any>;

export interface HeistLoot {
  cleanCash: number;
  dirtyCash: number;
  resources: Record<string, number>;
  rareLoot: RareHeistLoot | null;
}

export interface RareHeistLoot {
  type: "resource" | "info_token";
  itemId: string;
  amount: number;
}

export interface ActiveDistrictHeist {
  id: string;
  attackerPlayerId: string;
  targetPlayerId: string;
  targetDistrictId: string;
  style: HeistStyleId;
  gangMembersSent: number;
  startedAt: number;
  resolvesAt: number;
  status: "active";
  detectionChanceSnapshot: number;
  expectedLootPreview: HeistLoot;
  detectionRoll?: number;
  lossRoll?: number;
  lootRoll?: number;
  rareLootRoll?: number;
}

export interface PlayerHeistState {
  activeHeists: ActiveDistrictHeist[];
  cooldowns: {
    globalUntil: number;
    targetUntilByDistrictId: Record<string, number>;
  };
  stats: {
    started: number;
    succeeded: number;
    detected: number;
    failed: number;
    totalLootCash: number;
    totalLootResources: number;
    totalGangLost: number;
  };
}

export interface HeistStartResult {
  success: boolean;
  reason?: string;
  message: string;
  nextState?: AnyRecord;
  heistId?: string;
  targetDistrictId?: string;
  style?: HeistStyleId;
  gangMembersSent?: number;
  resolvesAt?: number;
  durationSeconds?: number;
  detectionChancePreview?: number;
  cooldownRemainingSeconds?: number;
}

export interface HeistResolveResult {
  success: boolean;
  resolved: boolean;
  outcome?: HeistOutcome;
  reason?: string;
  message: string;
  nextState?: AnyRecord;
  heistId?: string;
  targetDistrictId?: string;
  style?: HeistStyleId;
  gangLost?: number;
  gangReturned?: number;
  loot?: HeistLoot;
}

const HEIST_ACTION_LABEL = "Vykrást hráče";
const HEIST_ACTION_DESCRIPTION = "Heist cílí na district vlastněný jiným hráčem. Krade část jeho peněz a surovin, ale nepřebírá vlastnictví districtu.";

export const heistConfig = Object.freeze({
  id: "district_heist",
  cooldowns: Object.freeze({
    globalFreeSeconds: 180,
    sameTargetFreeSeconds: 300
  }),
  styles: Object.freeze({
    stealth: Object.freeze({
      name: "Tichý heist",
      durationSeconds: 90,
      minGangMembers: 5,
      maxGangMembers: 35,
      baseDetectionChance: 0.18,
      lootMultiplier: 0.65,
      unitLossMultiplierIfDetected: 0.35,
      heatOnStart: 1,
      heatOnSuccess: 1,
      heatOnDetected: 4,
      policeSuspicionOnDetected: 4
    }),
    balanced: Object.freeze({
      name: "Vyvážený heist",
      durationSeconds: 150,
      minGangMembers: 10,
      maxGangMembers: 70,
      baseDetectionChance: 0.3,
      lootMultiplier: 1,
      unitLossMultiplierIfDetected: 0.5,
      heatOnStart: 2,
      heatOnSuccess: 3,
      heatOnDetected: 7,
      policeSuspicionOnDetected: 7
    }),
    all_in: Object.freeze({
      name: "Tvrdý heist",
      durationSeconds: 180,
      minGangMembers: 25,
      maxGangMembers: 120,
      baseDetectionChance: 0.46,
      lootMultiplier: 1.45,
      unitLossMultiplierIfDetected: 0.7,
      heatOnStart: 3,
      heatOnSuccess: 5,
      heatOnDetected: 12,
      policeSuspicionOnDetected: 12
    })
  } satisfies Record<HeistStyleId, AnyRecord>),
  districtTypeModifiers: Object.freeze({
    commercial: Object.freeze({
      detectionModifier: 0.08,
      cashLootModifier: 1.25,
      resourceLootModifier: 0.75
    }),
    industrial: Object.freeze({
      detectionModifier: 0.04,
      cashLootModifier: 0.65,
      resourceLootModifier: 1.35
    }),
    residential: Object.freeze({
      detectionModifier: 0.02,
      cashLootModifier: 0.45,
      resourceLootModifier: 0.55
    }),
    park: Object.freeze({
      detectionModifier: -0.08,
      cashLootModifier: 0.75,
      resourceLootModifier: 1.05
    }),
    downtown: Object.freeze({
      detectionModifier: 0.14,
      cashLootModifier: 1.5,
      resourceLootModifier: 1
    })
  }),
  lootRules: Object.freeze({
    maxCashPercent: 0.12,
    maxResourcePercent: 0.1,
    minLootFloor: 1,
    rareLootChance: 0.06
  }),
  detection: Object.freeze({
    unitCountDetectionScale: 0.002,
    defenderSecurityScale: 0.01,
    policePresenceScale: 0.01,
    clampMin: 0.05,
    clampMax: 0.9
  }),
  modeMultipliers: Object.freeze({
    free: Object.freeze({
      durationMultiplier: 1,
      heatMultiplier: 1,
      lootMultiplier: 1,
      cooldownMultiplier: 1
    }),
    war: Object.freeze({
      durationMultiplier: 6,
      heatMultiplier: 1.2,
      lootMultiplier: 1,
      cooldownMultiplier: 6
    })
  } satisfies Record<HeistModeId, AnyRecord>)
});

const RESOURCE_KEYS = ["metalParts", "techCore", "chemicals", "biomass"] as const;
const CASH_KEY_ALIASES = ["cleanCash", "cleanMoney", "cash"];
const DIRTY_CASH_KEY_ALIASES = ["dirtyCash", "dirtyMoney", "dirty-cash"];
const HEIST_ZONE_DIFFICULTY: Record<string, number> = Object.freeze({
  park: 8,
  residential: 12,
  industrial: 18,
  commercial: 24,
  downtown: 38
});
const HEIST_STYLE_RECOMMENDATION_MULTIPLIER: Record<HeistStyleId, number> = Object.freeze({
  stealth: 0.7,
  balanced: 1,
  all_in: 1.35
});
const RESOURCE_KEY_ALIASES: Record<string, string[]> = {
  metalParts: ["metalParts", "metal-parts"],
  techCore: ["techCore", "tech-core"],
  chemicals: ["chemicals"],
  biomass: ["biomass"]
};

const createEmptyLoot = (): HeistLoot => ({
  cleanCash: 0,
  dirtyCash: 0,
  resources: {
    metalParts: 0,
    techCore: 0,
    chemicals: 0,
    biomass: 0
  },
  rareLoot: null
});

const createHeistState = (): PlayerHeistState => ({
  activeHeists: [],
  cooldowns: {
    globalUntil: 0,
    targetUntilByDistrictId: {}
  },
  stats: {
    started: 0,
    succeeded: 0,
    detected: 0,
    failed: 0,
    totalLootCash: 0,
    totalLootResources: 0,
    totalGangLost: 0
  }
});

export const initializeHeistState = <T extends object>(playerState: T): T & { heists: PlayerHeistState } => {
  const player = playerState as T & { heists?: Partial<PlayerHeistState> };
  const existing = player.heists;
  const defaults = createHeistState();

  player.heists = {
    activeHeists: Array.isArray(existing?.activeHeists) ? existing.activeHeists.filter(isActiveHeist) : [],
    cooldowns: {
      globalUntil: safeTimestamp(existing?.cooldowns?.globalUntil),
      targetUntilByDistrictId: sanitizeTimestampRecord(existing?.cooldowns?.targetUntilByDistrictId)
    },
    stats: {
      started: safeInteger(existing?.stats?.started),
      succeeded: safeInteger(existing?.stats?.succeeded),
      detected: safeInteger(existing?.stats?.detected),
      failed: safeInteger(existing?.stats?.failed),
      totalLootCash: safeInteger(existing?.stats?.totalLootCash),
      totalLootResources: safeInteger(existing?.stats?.totalLootResources),
      totalGangLost: safeInteger(existing?.stats?.totalGangLost)
    }
  };

  player.heists.stats = {
    ...defaults.stats,
    ...player.heists.stats
  };

  return player as T & { heists: PlayerHeistState };
};

export const getPlayerHeistState = (gameState: AnyRecord, playerId: string): PlayerHeistState => {
  const player = findPlayer(gameState, playerId);
  if (!player) {
    return createHeistState();
  }

  return initializeHeistState(player).heists;
};

export const startDistrictHeist = (
  gameState: AnyRecord,
  attackerPlayerId: string,
  targetDistrictId: string,
  style: HeistStyleId,
  gangMembersSent: number
): HeistStartResult => {
  const now = Date.now();
  const nextState = cloneGameState(gameState);
  const attacker = findPlayer(nextState, attackerPlayerId);
  if (!attacker) {
    return failStart("ATTACKER_NOT_FOUND", "Útočník neexistuje.");
  }

  const district = findDistrict(nextState, targetDistrictId);
  if (!district) {
    return failStart("TARGET_DISTRICT_NOT_FOUND", "Cílový district neexistuje.");
  }

  const targetPlayerId = getDistrictOwnerId(district);
  if (!targetPlayerId) {
    return failStart("TARGET_HAS_NO_OWNER", "District nemá vlastníka.");
  }

  if (targetPlayerId === attackerPlayerId) {
    return failStart("CANNOT_HEIST_OWN_DISTRICT", "Vykrást hráče nejde spustit na vlastním districtu.");
  }

  const styleConfig = heistConfig.styles[style];
  if (!styleConfig) {
    return failStart("UNKNOWN_STYLE", "Neznámý styl akce Vykrást hráče.");
  }

  const sent = sanitizeGangMembers(gangMembersSent);
  if (sent <= 0 || !Number.isFinite(Number(gangMembersSent))) {
    return failStart("INVALID_GANG_MEMBERS", "Počet členů gangu musí být platné číslo.");
  }

  if (sent < styleConfig.minGangMembers || sent > styleConfig.maxGangMembers) {
    return failStart("GANG_MEMBERS_OUT_OF_RANGE", `Pro tento styl pošli ${styleConfig.minGangMembers}-${styleConfig.maxGangMembers} členů gangu.`);
  }

  const availableGangMembers = getAvailableGangMembers(attacker);
  if (availableGangMembers < sent) {
    return failStart("NOT_ENOUGH_GANG_MEMBERS", "Nemáš dost členů gangu.");
  }

  const heistState = initializeHeistState(attacker).heists;
  const globalRemainingSeconds = getRemainingSeconds(heistState.cooldowns.globalUntil, now);
  if (globalRemainingSeconds > 0) {
    return failStart("COOLDOWN_ACTIVE", "Gang se musí stáhnout. Další akce Vykrást hráče zatím nejde spustit.", {
      cooldownRemainingSeconds: globalRemainingSeconds
    });
  }

  const targetRemainingSeconds = getRemainingSeconds(heistState.cooldowns.targetUntilByDistrictId[targetDistrictId], now);
  if (targetRemainingSeconds > 0) {
    return failStart("TARGET_COOLDOWN_ACTIVE", "Tenhle district je po heistu moc horký. Zkus jiný cíl nebo počkej.", {
      cooldownRemainingSeconds: targetRemainingSeconds
    });
  }

  if (isDistrictInPoliceLockdown(district, now)) {
    return failStart("DISTRICT_POLICE_LOCKDOWN", "District je pod policejním lockdownem.");
  }

  if (isDistrictHeistImmune(district, now)) {
    return failStart("DISTRICT_HEIST_IMMUNE", "District je dočasně chráněný proti akci Vykrást hráče.");
  }

  const mode = resolveGameMode(nextState);
  const durationSeconds = Math.ceil(styleConfig.durationSeconds * getModeMultipliers(mode).durationMultiplier);
  const heistId = createHeistId(now, attackerPlayerId, targetDistrictId);
  const previewHeist: ActiveDistrictHeist = {
    id: heistId,
    attackerPlayerId,
    targetPlayerId,
    targetDistrictId,
    style,
    gangMembersSent: sent,
    startedAt: now,
    resolvesAt: now + durationSeconds * 1000,
    status: "active",
    detectionChanceSnapshot: 0,
    expectedLootPreview: createEmptyLoot()
  };
  const detectionChancePreview = calculateHeistDetectionChance(nextState, previewHeist);
  const activeHeist: ActiveDistrictHeist = {
    ...previewHeist,
    detectionChanceSnapshot: detectionChancePreview,
    expectedLootPreview: calculateHeistLoot(nextState, { ...previewHeist, lootRoll: 0.5, rareLootRoll: 1 }, "success")
  };

  reserveGangMembers(attacker, sent, "district_heist");
  heistState.activeHeists.push(activeHeist);
  heistState.stats.started += 1;

  addHeatToPlayer(nextState, attackerPlayerId, scaleHeat(styleConfig.heatOnStart, mode), "heist_start");
  appendGameLog(nextState, "heist", "Vykrást hráče začalo. Gang míří na cizí cash/resources bez převzetí districtu.", {
    heistId,
    attackerPlayerId,
    targetPlayerId,
    targetDistrictId,
    style,
    gangMembersSent: sent
  });
  addRumor(nextState, `Někde v ${normalizeDistrictType(getDistrictType(district))} zóně cizí gang připravuje heist proti vlastněnému districtu.`, {
    type: "heist",
    targetPlayerId,
    districtId: targetDistrictId,
    truth: 0.4,
    spread: 0.35,
    source: "system"
  });

  return {
    success: true,
    nextState,
    heistId,
    targetDistrictId,
    style,
    gangMembersSent: sent,
    resolvesAt: activeHeist.resolvesAt,
    durationSeconds,
    detectionChancePreview,
    message: "Vykrást hráče začalo. Gang míří na cizí cash/resources bez převzetí districtu."
  };
};

export const calculateHeistDetectionChance = (gameState: AnyRecord, heist: ActiveDistrictHeist): number => {
  const styleConfig = heistConfig.styles[heist.style] ?? heistConfig.styles.balanced;
  const district = findDistrict(gameState, heist.targetDistrictId);
  const attacker = findPlayer(gameState, heist.attackerPlayerId);
  const target = findPlayer(gameState, heist.targetPlayerId);
  const districtType = normalizeDistrictType(getDistrictType(district));
  const districtModifier = getDistrictTypeModifier(districtType);
  const defenderSecurity = getDefenderSecurity(gameState, district);
  const policePresence = getPolicePresence(gameState, district, target);
  const attackerStealthBonus = getAttackerStealthBonus(attacker);
  const rawChance =
    styleConfig.baseDetectionChance
    + districtModifier.detectionModifier
    + sanitizeGangMembers(heist.gangMembersSent) * heistConfig.detection.unitCountDetectionScale
    + defenderSecurity * heistConfig.detection.defenderSecurityScale
    + policePresence * heistConfig.detection.policePresenceScale
    - attackerStealthBonus;

  return roundRatio(clamp(rawChance, heistConfig.detection.clampMin, heistConfig.detection.clampMax));
};

export const calculateHeistLoot = (
  gameState: AnyRecord,
  heist: ActiveDistrictHeist,
  outcome: HeistOutcome
): HeistLoot => {
  if (outcome === "failed" || outcome === "trap_triggered") {
    return createEmptyLoot();
  }

  const district = findDistrict(gameState, heist.targetDistrictId);
  const target = findPlayer(gameState, heist.targetPlayerId);
  const mode = resolveGameMode(gameState);
  const styleConfig = heistConfig.styles[heist.style] ?? heistConfig.styles.balanced;
  const districtType = normalizeDistrictType(getDistrictType(district));
  const districtModifier = getDistrictTypeModifier(districtType);
  const modeMultiplier = getModeMultipliers(mode).lootMultiplier;
  const outcomeMultiplier = getOutcomeLootMultiplier(outcome, heist.lootRoll);
  const loot = createEmptyLoot();
  const containers = collectLootContainers(gameState, target, district);

  loot.cleanCash = calculateLootAmount(
    getTotalBalance(containers, CASH_KEY_ALIASES),
    heistConfig.lootRules.maxCashPercent,
    styleConfig.lootMultiplier * districtModifier.cashLootModifier * outcomeMultiplier * modeMultiplier
  );
  loot.dirtyCash = calculateLootAmount(
    getTotalBalance(containers, DIRTY_CASH_KEY_ALIASES),
    heistConfig.lootRules.maxCashPercent,
    styleConfig.lootMultiplier * districtModifier.cashLootModifier * outcomeMultiplier * modeMultiplier
  );

  for (const key of RESOURCE_KEYS) {
    loot.resources[key] = calculateLootAmount(
      getTotalBalance(containers, RESOURCE_KEY_ALIASES[key]),
      heistConfig.lootRules.maxResourcePercent,
      styleConfig.lootMultiplier * districtModifier.resourceLootModifier * outcomeMultiplier * modeMultiplier
    );
  }

  loot.rareLoot = rollRareLoot(heist, outcome);
  return sanitizeLoot(loot);
};

export const resolveDistrictHeist = (
  gameState: AnyRecord,
  heistId: string,
  now = Date.now()
): HeistResolveResult => {
  const nextState = cloneGameState(gameState);
  const located = findActiveHeist(nextState, heistId);
  if (!located) {
    return {
      success: false,
      resolved: false,
      reason: "HEIST_NOT_FOUND",
      message: "Akce Vykrást hráče nebyla nalezena."
    };
  }

  const { heist, attacker, heistState } = located;
  if (now < heist.resolvesAt) {
    return {
      success: false,
      resolved: false,
      reason: "HEIST_NOT_READY",
      message: "Akce Vykrást hráče pořád běží.",
      nextState
    };
  }

  const district = findDistrict(nextState, heist.targetDistrictId);
  const target = findPlayer(nextState, heist.targetPlayerId);
  const mode = resolveGameMode(nextState);
  const styleConfig = heistConfig.styles[heist.style] ?? heistConfig.styles.balanced;
  const outcome = hasActiveTrap(nextState, district) ? "trap_triggered" : rollHeistOutcome(nextState, heist);
  const gangLost = calculateGangLoss(heist, outcome);
  const gangReturned = Math.max(0, sanitizeGangMembers(heist.gangMembersSent) - gangLost);
  const loot = calculateHeistLoot(nextState, heist, outcome);

  applyHeistLoot(nextState, target, district, attacker, loot);
  releaseGangMembers(attacker, gangReturned, "district_heist");
  consumeReservedGangMembers(attacker, gangLost, "district_heist_loss");
  appendRecoveryEntryToAnyPlayer(attacker, "gang-members", gangLost, outcome === "trap_triggered" ? "trap" : "robbery", now);
  removeActiveHeist(heistState, heist.id);
  applyResolveCooldowns(heistState, heist.targetDistrictId, outcome, mode, now);
  updateHeistStats(heistState, outcome, loot, gangLost);
  applyOutcomeHeatAndPolice(nextState, heist.attackerPlayerId, styleConfig, outcome, mode);

  appendResolveLogs(nextState, heist, outcome, loot, gangLost, gangReturned);
  appendOutcomeRumor(nextState, heist, outcome);

  if (outcome === "detected" || outcome === "failed" || outcome === "trap_triggered") {
    notifyPoliceOfHeist(nextState, {
      heistId: heist.id,
      attackerPlayerId: heist.attackerPlayerId,
      targetPlayerId: heist.targetPlayerId,
      districtId: heist.targetDistrictId,
      outcome,
      gangLost,
      heat: styleConfig.heatOnDetected
    });
  }

  return {
    success: outcome !== "failed" && outcome !== "trap_triggered",
    resolved: true,
    nextState,
    heistId: heist.id,
    targetDistrictId: heist.targetDistrictId,
    style: heist.style,
    outcome,
    gangLost,
    gangReturned,
    loot,
    message: getOutcomeMessage(outcome)
  };
};

export const tickHeists = (
  gameState: AnyRecord,
  now = Date.now()
): { nextState: AnyRecord; results: HeistResolveResult[] } => {
  let nextState = cloneGameState(gameState);
  const dueIds = collectActiveHeists(nextState)
    .filter((heist) => now >= heist.resolvesAt)
    .map((heist) => heist.id);
  const results: HeistResolveResult[] = [];

  for (const heistId of dueIds) {
    const result = resolveDistrictHeist(nextState, heistId, now);
    results.push(result);
    if (result.nextState) {
      nextState = result.nextState;
    }
  }

  return { nextState, results };
};

export const getHeistViewModel = (
  gameState: AnyRecord,
  attackerPlayerId: string,
  targetDistrictId: string
): AnyRecord => {
  const now = Date.now();
  const attacker = findPlayer(gameState, attackerPlayerId);
  const district = findDistrict(gameState, targetDistrictId);
  const targetOwnerId = district ? getDistrictOwnerId(district) : null;
  const mode = resolveGameMode(gameState);
  const heistState = attacker ? getPlayerHeistState(gameState, attackerPlayerId) : createHeistState();
  const availableGangMembers = attacker ? getAvailableGangMembers(attacker) : 0;
  const scoutReport = getScoutReportForDistrict(gameState, attackerPlayerId, targetDistrictId);
  const reasonsBlocked: string[] = [];

  if (!attacker) {
    reasonsBlocked.push("Útočník neexistuje");
  }
  if (!district) {
    reasonsBlocked.push("District neexistuje");
  }
  if (!targetOwnerId) {
    reasonsBlocked.push("District nemá vlastníka");
  }
  if (targetOwnerId === attackerPlayerId) {
    reasonsBlocked.push("Vykrást hráče nejde spustit na vlastním districtu");
  }
  if (getRemainingSeconds(heistState.cooldowns.globalUntil, now) > 0) {
    reasonsBlocked.push("Globální cooldown je aktivní");
  }
  if (getRemainingSeconds(heistState.cooldowns.targetUntilByDistrictId[targetDistrictId], now) > 0) {
    reasonsBlocked.push("Cooldown cílového districtu je aktivní");
  }
  if (district && isDistrictInPoliceLockdown(district, now)) {
    reasonsBlocked.push("District je pod policejním lockdownem");
  }
  if (district && isDistrictHeistImmune(district, now)) {
    reasonsBlocked.push("District je chráněný proti akci Vykrást hráče");
  }

  const styles = (Object.keys(heistConfig.styles) as HeistStyleId[]).map((styleId) => {
    const styleConfig = heistConfig.styles[styleId];
    const recommendedMembers = calculateRecommendedHeistMembers(gameState, {
      district,
      target: targetOwnerId ? findPlayer(gameState, targetOwnerId) : null,
      style: styleId
    });
    const previewGangMembers = clamp(
      Math.max(styleConfig.minGangMembers, Math.min(availableGangMembers || recommendedMembers.safe, recommendedMembers.safe)),
      styleConfig.minGangMembers,
      styleConfig.maxGangMembers
    );
    const previewHeist: ActiveDistrictHeist = {
      id: `preview:${styleId}`,
      attackerPlayerId,
      targetPlayerId: targetOwnerId ?? "",
      targetDistrictId,
      style: styleId,
      gangMembersSent: previewGangMembers,
      startedAt: now,
      resolvesAt: now + styleConfig.durationSeconds * 1000,
      status: "active",
      detectionChanceSnapshot: 0,
      expectedLootPreview: createEmptyLoot()
    };
    const detectionChancePreview = calculateHeistDetectionChance(gameState, previewHeist);
    const lootPreview = calculateHeistLoot(gameState, { ...previewHeist, lootRoll: 0.5, rareLootRoll: 1 }, "success");
    const warnings = buildStyleWarnings(district, styleId, detectionChancePreview, availableGangMembers, styleConfig.minGangMembers);
    const heatPreview = scaleHeat(styleConfig.heatOnStart, mode);

    return {
      id: styleId,
      name: styleConfig.name,
      durationSeconds: Math.ceil(styleConfig.durationSeconds * getModeMultipliers(mode).durationMultiplier),
      minGangMembers: styleConfig.minGangMembers,
      maxGangMembers: styleConfig.maxGangMembers,
      recommendedMembers,
      detectionChancePreview,
      lootPreview,
      heatPreview,
      riskPreview: buildHeistRiskPreview({
        detectionChance: detectionChancePreview,
        lootPreview,
        styleConfig,
        sentMembers: previewGangMembers,
        heatPreview,
        scoutReport
      }),
      canUse: reasonsBlocked.length === 0 && availableGangMembers >= styleConfig.minGangMembers,
      warnings
    };
  });

  return {
    actionLabel: HEIST_ACTION_LABEL,
    description: HEIST_ACTION_DESCRIPTION,
    canStart: reasonsBlocked.length === 0,
    reasonsBlocked,
    targetDistrictId,
    districtType: normalizeDistrictType(getDistrictType(district)),
    targetOwnerId,
    availableGangMembers,
    scoutReport,
    styles,
    cooldowns: {
      globalRemainingSeconds: getRemainingSeconds(heistState.cooldowns.globalUntil, now),
      targetRemainingSeconds: getRemainingSeconds(heistState.cooldowns.targetUntilByDistrictId[targetDistrictId], now)
    },
    activeHeists: heistState.activeHeists.filter((heist) => heist.status === "active")
  };
};

const failStart = (
  reason: string,
  message: string,
  extra: Partial<HeistStartResult> = {}
): HeistStartResult => ({
  success: false,
  reason,
  message,
  ...extra
});

const cloneGameState = <T extends AnyRecord>(state: T): T => {
  const next: AnyRecord = { ...state };
  cloneRecordMap(next, state, "playersById", cloneEntity);
  cloneRecordMap(next, state, "districtsById", cloneEntity);
  cloneRecordMap(next, state, "buildingsById", cloneEntity);
  cloneRecordMap(next, state, "resourceStatesById", cloneResourceState);
  cloneRecordMap(next, state, "policeStatesById", cloneEntity);
  cloneRecordMap(next, state, "eventsById", cloneEntity);
  cloneRecordMap(next, state, "trapsById", cloneEntity);

  if (Array.isArray(state.players)) {
    next.players = state.players.map(cloneEntity);
  }
  if (Array.isArray(state.districts)) {
    next.districts = state.districts.map(cloneEntity);
  }
  if (Array.isArray(state.eventLog)) {
    next.eventLog = state.eventLog.map(cloneEntity);
  }
  if (Array.isArray(state.rumors)) {
    next.rumors = state.rumors.map(cloneEntity);
  }
  if (state.root && typeof state.root === "object") {
    next.root = {
      ...state.root,
      eventIds: Array.isArray(state.root.eventIds) ? [...state.root.eventIds] : state.root.eventIds
    };
  }

  return next as T;
};

const cloneRecordMap = (
  next: AnyRecord,
  state: AnyRecord,
  key: string,
  cloneValue: (value: AnyRecord) => AnyRecord
): void => {
  const record = state[key];
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return;
  }

  next[key] = Object.fromEntries(
    Object.entries(record).map(([entryKey, value]) => [
      entryKey,
      value && typeof value === "object" ? cloneValue(value as AnyRecord) : value
    ])
  );
};

const cloneEntity = <T extends AnyRecord>(entity: T): T => {
  const next: AnyRecord = { ...entity };
  if (entity.heists) {
    next.heists = cloneHeistState(entity.heists);
  }
  if (entity.resources && typeof entity.resources === "object") {
    next.resources = { ...entity.resources };
  }
  if (entity.gang && typeof entity.gang === "object") {
    next.gang = { ...entity.gang };
  }
  if (entity.police && typeof entity.police === "object") {
    next.police = { ...entity.police };
  }
  if (entity.defenseLoadout && typeof entity.defenseLoadout === "object") {
    next.defenseLoadout = { ...entity.defenseLoadout };
  }
  if (Array.isArray(entity.buildingIds)) {
    next.buildingIds = [...entity.buildingIds];
  }
  if (Array.isArray(entity.traps)) {
    next.traps = entity.traps.map(cloneEntity);
  }
  return next as T;
};

const cloneResourceState = <T extends AnyRecord>(resourceState: T): T => ({
  ...resourceState,
  balances: resourceState.balances && typeof resourceState.balances === "object"
    ? { ...resourceState.balances }
    : resourceState.balances
});

const cloneHeistState = (state: Partial<PlayerHeistState>): PlayerHeistState => ({
  activeHeists: Array.isArray(state.activeHeists) ? state.activeHeists.map((heist) => ({ ...heist, expectedLootPreview: cloneLoot(heist.expectedLootPreview) })) : [],
  cooldowns: {
    globalUntil: safeTimestamp(state.cooldowns?.globalUntil),
    targetUntilByDistrictId: sanitizeTimestampRecord(state.cooldowns?.targetUntilByDistrictId)
  },
  stats: {
    ...createHeistState().stats,
    ...(state.stats ?? {})
  }
});

const cloneLoot = (loot: HeistLoot | undefined): HeistLoot => {
  if (!loot) {
    return createEmptyLoot();
  }

  return {
    cleanCash: safeInteger(loot.cleanCash),
    dirtyCash: safeInteger(loot.dirtyCash),
    resources: { ...createEmptyLoot().resources, ...(loot.resources ?? {}) },
    rareLoot: loot.rareLoot ? { ...loot.rareLoot } : null
  };
};

const findPlayer = (gameState: AnyRecord, playerId: string): AnyRecord | null => {
  if (!playerId) {
    return null;
  }
  const direct = gameState.playersById?.[playerId] ?? gameState.players?.find?.((player: AnyRecord) => player?.id === playerId);
  if (direct) {
    return direct;
  }
  const objectPlayers = gameState.players && !Array.isArray(gameState.players) ? gameState.players : null;
  return objectPlayers?.[playerId] ?? null;
};

const findDistrict = (gameState: AnyRecord, districtId: string): AnyRecord | null => {
  if (!districtId) {
    return null;
  }
  const direct = gameState.districtsById?.[districtId] ?? gameState.districts?.find?.((district: AnyRecord) => district?.id === districtId);
  if (direct) {
    return direct;
  }
  const objectDistricts = gameState.districts && !Array.isArray(gameState.districts) ? gameState.districts : null;
  return objectDistricts?.[districtId] ?? null;
};

const getDistrictOwnerId = (district: AnyRecord | null): string | null =>
  String(district?.ownerPlayerId ?? district?.ownerId ?? district?.playerId ?? "").trim() || null;

const getDistrictType = (district: AnyRecord | null): string =>
  String(district?.districtType ?? district?.type ?? district?.zone ?? "commercial");

const normalizeDistrictType = (districtType: string): string => {
  const normalized = String(districtType || "commercial").toLowerCase().trim();
  if (normalized === "economy" || normalized === "business") {
    return "commercial";
  }
  if (normalized === "resident" || normalized === "housing") {
    return "residential";
  }
  return heistConfig.districtTypeModifiers[normalized as keyof typeof heistConfig.districtTypeModifiers]
    ? normalized
    : "commercial";
};

const getDistrictTypeModifier = (districtType: string) =>
  heistConfig.districtTypeModifiers[normalizeDistrictType(districtType) as keyof typeof heistConfig.districtTypeModifiers]
  ?? heistConfig.districtTypeModifiers.commercial;

const resolveGameMode = (gameState: AnyRecord): HeistModeId => {
  const mode = String(gameState.mode ?? gameState.serverInstance?.mode ?? gameState.root?.mode ?? "free").toLowerCase();
  return mode === "war" ? "war" : "free";
};

const getModeMultipliers = (mode: HeistModeId) =>
  heistConfig.modeMultipliers[mode] ?? heistConfig.modeMultipliers.free;

const scaleHeat = (amount: number, mode: HeistModeId): number =>
  Math.ceil(Math.max(0, Number(amount) || 0) * getModeMultipliers(mode).heatMultiplier);

const calculateRecommendedHeistMembers = (
  gameState: AnyRecord,
  {
    district,
    target,
    style
  }: {
    district: AnyRecord | null;
    target: AnyRecord | null;
    style: HeistStyleId;
  }
): { min: number; max: number; safe: number } => {
  const styleConfig = heistConfig.styles[style] ?? heistConfig.styles.balanced;
  const resistance = calculateTargetHeistResistance(gameState, district, target);
  const baseRecommended = clamp(
    Math.ceil(resistance * (HEIST_STYLE_RECOMMENDATION_MULTIPLIER[style] ?? 1)),
    styleConfig.minGangMembers,
    styleConfig.maxGangMembers
  );

  return {
    min: clamp(Math.ceil(baseRecommended * 0.85), styleConfig.minGangMembers, styleConfig.maxGangMembers),
    max: clamp(Math.ceil(baseRecommended * 1.15), styleConfig.minGangMembers, styleConfig.maxGangMembers),
    safe: clamp(Math.ceil(baseRecommended * 1.3), styleConfig.minGangMembers, styleConfig.maxGangMembers)
  };
};

const calculateTargetHeistResistance = (
  gameState: AnyRecord,
  district: AnyRecord | null,
  target: AnyRecord | null
): number => {
  const districtType = normalizeDistrictType(getDistrictType(district));
  const districtSecurity = getDefenderSecurity(gameState, district);
  const policePresence = getPolicePresence(gameState, district, target);
  const districtValueScore = calculateDistrictValueScore(gameState, district, target);
  const zoneDifficulty = HEIST_ZONE_DIFFICULTY[districtType] ?? HEIST_ZONE_DIFFICULTY.commercial;

  return Math.max(
    0,
    districtSecurity * 1.3
    + policePresence * 1.1
    + districtValueScore * 0.25
    + zoneDifficulty
  );
};

const calculateDistrictValueScore = (
  gameState: AnyRecord,
  district: AnyRecord | null,
  target: AnyRecord | null
): number => {
  const containers = collectLootContainers(gameState, target, district);
  const cashTotal =
    getTotalBalance(containers, CASH_KEY_ALIASES)
    + getTotalBalance(containers, DIRTY_CASH_KEY_ALIASES);
  const weightedResources =
    getTotalBalance(containers, RESOURCE_KEY_ALIASES.metalParts) * 3
    + getTotalBalance(containers, RESOURCE_KEY_ALIASES.techCore) * 8
    + getTotalBalance(containers, RESOURCE_KEY_ALIASES.chemicals) * 2
    + getTotalBalance(containers, RESOURCE_KEY_ALIASES.biomass) * 2;

  return Math.sqrt(Math.max(0, cashTotal)) / 8
    + Math.sqrt(Math.max(0, weightedResources)) / 5;
};

const getScoutReportForDistrict = (
  gameState: AnyRecord,
  playerId: string,
  targetDistrictId: string
): AnyRecord => {
  const report = findScoutReportForDistrict(gameState, playerId, targetDistrictId);
  const active = Boolean(report);
  const trapDetected = Boolean(report?.trapDetected || report?.payload?.trapDetected);

  return {
    active,
    label: active ? "Scout report aktivní" : "Bez scout reportu",
    riskLabel: active ? "Přesnější odhad" : "Neznámé / Odhad",
    lootLabel: active ? "Přesnější odhad" : "Nejistý",
    trapHintLabel: active
      ? (trapDetected ? "Past hlášena scout reportem" : "Past nepotvrzena")
      : "Neznámá",
    trapDetected,
    reportId: report?.reportId ?? report?.id ?? report?.payload?.reportId ?? null
  };
};

const findScoutReportForDistrict = (
  gameState: AnyRecord,
  playerId: string,
  targetDistrictId: string
): AnyRecord | null => {
  const candidates = [
    ...recordValues(gameState.notificationsById),
    ...recordValues(gameState.reportsById),
    ...arrayValues(gameState.notifications),
    ...arrayValues(gameState.reports),
    ...arrayValues(gameState.conflictReports)
  ];

  return candidates.find((candidate) => isMatchingScoutReport(candidate, playerId, targetDistrictId)) ?? null;
};

const recordValues = (record: unknown): AnyRecord[] => (
  record && typeof record === "object" && !Array.isArray(record)
    ? Object.values(record as Record<string, unknown>).filter((entry): entry is AnyRecord => Boolean(entry && typeof entry === "object"))
    : []
);

const arrayValues = (value: unknown): AnyRecord[] => (
  Array.isArray(value)
    ? value.filter((entry): entry is AnyRecord => Boolean(entry && typeof entry === "object"))
    : []
);

const isMatchingScoutReport = (candidate: AnyRecord, playerId: string, targetDistrictId: string): boolean => {
  const payload = candidate.payload && typeof candidate.payload === "object" ? candidate.payload : candidate;
  const category = String(candidate.category || payload.category || "").trim();
  const reportType = String(payload.reportType || "").trim();
  const actionType = String(payload.actionType || "").trim();
  const isSpyReport = category === "report.spy" || reportType === "spy" || actionType === "spy-district";
  const reportTargetId = String(payload.targetDistrictId || candidate.targetDistrictId || "").trim();
  const reportPlayerId = String(payload.playerId || candidate.playerId || candidate.recipientId || "").trim();
  const result = String(payload.result || candidate.result || "").trim();
  const isUsefulReport = result === "success" || result === "partial" || result === "succeeded" || result === "ok" || result === "";

  return isSpyReport
    && reportTargetId === targetDistrictId
    && (!reportPlayerId || reportPlayerId === playerId)
    && isUsefulReport;
};

const buildHeistRiskPreview = ({
  detectionChance,
  lootPreview,
  styleConfig,
  sentMembers,
  heatPreview,
  scoutReport
}: {
  detectionChance: number;
  lootPreview: HeistLoot;
  styleConfig: AnyRecord;
  sentMembers: number;
  heatPreview: number;
  scoutReport?: AnyRecord;
}): {
  detectionRiskLabel: "low" | "medium" | "high" | "extreme";
  lootPreviewLabel: "low" | "medium" | "high" | "jackpot";
  lossRiskLabel: "low" | "medium" | "high" | "brutal";
  heatPreviewLabel: "low" | "medium" | "high" | "extreme";
  scoutReportActive: boolean;
  scoutReportLabel: string;
  detectionRiskDisplayLabel: string;
  lootPreviewDisplayLabel: string;
  trapHintLabel: string;
} => {
  const detectionRiskLabel = labelDetectionRisk(detectionChance);
  const lootPreviewLabel = labelLootPreview(lootPreview);
  const lossRiskLabel = labelLossRisk(sentMembers, styleConfig);
  const heatPreviewLabel = labelHeatPreview(heatPreview);
  const scoutReportActive = Boolean(scoutReport?.active);

  return {
    detectionRiskLabel,
    lootPreviewLabel,
    lossRiskLabel,
    heatPreviewLabel,
    scoutReportActive,
    scoutReportLabel: scoutReportActive ? "Scout report aktivní" : "Bez scout reportu",
    detectionRiskDisplayLabel: scoutReportActive ? detectionRiskLabel : "Neznámé / Odhad",
    lootPreviewDisplayLabel: scoutReportActive ? lootPreviewLabel : "Nejistý",
    trapHintLabel: scoutReportActive ? String(scoutReport?.trapHintLabel || "Past nepotvrzena") : "Neznámá"
  };
};

const labelDetectionRisk = (detectionChance: number): "low" | "medium" | "high" | "extreme" => {
  if (detectionChance < 0.2) return "low";
  if (detectionChance < 0.4) return "medium";
  if (detectionChance < 0.65) return "high";
  return "extreme";
};

const labelLootPreview = (loot: HeistLoot): "low" | "medium" | "high" | "jackpot" => {
  const resourceTotal = Object.values(loot.resources).reduce((total, amount) => total + safeInteger(amount), 0);
  const weightedLoot =
    safeInteger(loot.cleanCash)
    + safeInteger(loot.dirtyCash)
    + resourceTotal * 8
    + (loot.rareLoot ? safeInteger(loot.rareLoot.amount) * 35 : 0);

  if (weightedLoot < 20) return "low";
  if (weightedLoot < 80) return "medium";
  if (weightedLoot < 180) return "high";
  return "jackpot";
};

const labelLossRisk = (sentMembers: number, styleConfig: AnyRecord): "low" | "medium" | "high" | "brutal" => {
  const estimatedDetectedLoss = sanitizeGangMembers(sentMembers)
    * safeNumber(styleConfig.unitLossMultiplierIfDetected)
    * 0.85;

  if (estimatedDetectedLoss < 4) return "low";
  if (estimatedDetectedLoss < 15) return "medium";
  if (estimatedDetectedLoss < 40) return "high";
  return "brutal";
};

const labelHeatPreview = (heatPreview: number): "low" | "medium" | "high" | "extreme" => {
  if (heatPreview <= 1) return "low";
  if (heatPreview <= 3) return "medium";
  if (heatPreview <= 7) return "high";
  return "extreme";
};

const getAvailableGangMembers = (player: AnyRecord): number => {
  const directAvailable = pickFirstFinite(player, ["availableGangMembers", "availableMembers", "gangMembers", "members", "population"]);
  if (directAvailable !== null) {
    return safeInteger(directAvailable);
  }
  const gangAvailable = pickFirstFinite(player.gang, ["availableMembers", "availableGangMembers", "members", "gangMembers", "population"]);
  if (gangAvailable !== null) {
    return safeInteger(gangAvailable);
  }
  const total = getTotalGangMembers(player);
  const reserved = safeInteger(player.reservedGangMembers ?? player.gang?.reservedMembers ?? player.gang?.reservedGangMembers);
  return Math.max(0, total - reserved);
};

const getTotalGangMembers = (player: AnyRecord): number => {
  const value = pickFirstFinite(player, ["gangMembers", "members", "population"]);
  if (value !== null) {
    return safeInteger(value);
  }
  const gangValue = pickFirstFinite(player.gang, ["members", "gangMembers", "population"]);
  return safeInteger(gangValue ?? 0);
};

export const reserveGangMembers = (playerState: AnyRecord, amount: number, reason = "district_heist"): number => {
  const safeAmount = Math.min(getAvailableGangMembers(playerState), sanitizeGangMembers(amount));
  if (safeAmount <= 0) {
    return 0;
  }

  if (hasFiniteKey(playerState, "availableGangMembers")) {
    playerState.availableGangMembers = Math.max(0, safeInteger(playerState.availableGangMembers) - safeAmount);
  } else if (hasFiniteKey(playerState, "gangMembers")) {
    playerState.gangMembers = Math.max(0, safeInteger(playerState.gangMembers) - safeAmount);
  } else if (hasFiniteKey(playerState, "members")) {
    playerState.members = Math.max(0, safeInteger(playerState.members) - safeAmount);
  } else if (hasFiniteKey(playerState, "population")) {
    playerState.population = Math.max(0, safeInteger(playerState.population) - safeAmount);
  } else if (playerState.gang && typeof playerState.gang === "object") {
    const key = hasFiniteKey(playerState.gang, "availableMembers")
      ? "availableMembers"
      : hasFiniteKey(playerState.gang, "members")
        ? "members"
        : "gangMembers";
    playerState.gang[key] = Math.max(0, safeInteger(playerState.gang[key]) - safeAmount);
  } else {
    playerState.gangMembers = 0;
  }

  playerState.reservedGangMembers = safeInteger(playerState.reservedGangMembers) + safeAmount;
  playerState.gangReservationLog = [
    ...(Array.isArray(playerState.gangReservationLog) ? playerState.gangReservationLog : []),
    { reason, amount: safeAmount, type: "reserve" }
  ];
  return safeAmount;
};

export const releaseGangMembers = (playerState: AnyRecord, amount: number, reason = "district_heist"): number => {
  const safeAmount = sanitizeGangMembers(amount);
  const reservedBefore = safeInteger(playerState.reservedGangMembers ?? playerState.gang?.reservedMembers ?? playerState.gang?.reservedGangMembers);
  const releaseAmount = Math.min(safeAmount, reservedBefore || safeAmount);
  if (releaseAmount <= 0) {
    return 0;
  }

  if (hasFiniteKey(playerState, "availableGangMembers")) {
    playerState.availableGangMembers = safeInteger(playerState.availableGangMembers) + releaseAmount;
  } else if (hasFiniteKey(playerState, "gangMembers")) {
    playerState.gangMembers = safeInteger(playerState.gangMembers) + releaseAmount;
  } else if (hasFiniteKey(playerState, "members")) {
    playerState.members = safeInteger(playerState.members) + releaseAmount;
  } else if (hasFiniteKey(playerState, "population")) {
    playerState.population = safeInteger(playerState.population) + releaseAmount;
  } else if (playerState.gang && typeof playerState.gang === "object") {
    const key = hasFiniteKey(playerState.gang, "availableMembers")
      ? "availableMembers"
      : hasFiniteKey(playerState.gang, "members")
        ? "members"
        : "gangMembers";
    playerState.gang[key] = safeInteger(playerState.gang[key]) + releaseAmount;
  } else {
    playerState.gangMembers = releaseAmount;
  }

  playerState.reservedGangMembers = Math.max(0, reservedBefore - releaseAmount);
  playerState.gangReservationLog = [
    ...(Array.isArray(playerState.gangReservationLog) ? playerState.gangReservationLog : []),
    { reason, amount: releaseAmount, type: "release" }
  ];
  return releaseAmount;
};

const consumeReservedGangMembers = (playerState: AnyRecord, amount: number, reason: string): number => {
  const safeAmount = sanitizeGangMembers(amount);
  if (safeAmount <= 0) {
    return 0;
  }

  const reservedBefore = safeInteger(playerState.reservedGangMembers ?? playerState.gang?.reservedMembers ?? playerState.gang?.reservedGangMembers);
  const consumed = Math.min(safeAmount, reservedBefore);
  playerState.reservedGangMembers = Math.max(0, reservedBefore - consumed);
  if (playerState.gang && typeof playerState.gang === "object") {
    if (hasFiniteKey(playerState.gang, "reservedMembers")) {
      playerState.gang.reservedMembers = Math.max(0, safeInteger(playerState.gang.reservedMembers) - consumed);
    }
    if (hasFiniteKey(playerState.gang, "reservedGangMembers")) {
      playerState.gang.reservedGangMembers = Math.max(0, safeInteger(playerState.gang.reservedGangMembers) - consumed);
    }
  }
  playerState.gangReservationLog = [
    ...(Array.isArray(playerState.gangReservationLog) ? playerState.gangReservationLog : []),
    { reason, amount: consumed, type: "consume" }
  ];
  return consumed;
};

const appendRecoveryEntryToAnyPlayer = (
  playerState: AnyRecord,
  itemType: string,
  amount: number,
  source: string,
  now: number
): void => {
  const safeAmount = sanitizeGangMembers(amount);
  if (safeAmount <= 0 || !itemType) {
    return;
  }

  const existing = Array.isArray(playerState.recoveryPool) ? playerState.recoveryPool : [];
  playerState.recoveryPool = [
    ...existing,
    {
      id: `heist-recovery:${now}:${itemType}:${existing.length}`,
      itemType,
      amount: safeAmount,
      lostAt: new Date(now).toISOString(),
      source
    }
  ];
};

const getDefenderSecurity = (gameState: AnyRecord, district: AnyRecord | null): number => {
  if (!district) {
    return 0;
  }

  const directSecurity = pickFirstFinite(district, ["security", "defenderSecurity", "securityLevel"]);
  const defenseLoadoutSecurity = sumRecordNumbers(district.defenseLoadout);
  const buildingSecurity = Array.isArray(district.buildingIds)
    ? district.buildingIds.reduce((total: number, buildingId: string) => {
      const building = gameState.buildingsById?.[buildingId];
      return total + safeNumber(pickFirstFinite(building, ["security", "defense", "level"], 0));
    }, 0)
    : 0;

  return Math.max(0, safeNumber(directSecurity ?? 0) + defenseLoadoutSecurity + buildingSecurity);
};

const getPolicePresence = (gameState: AnyRecord, district: AnyRecord | null, target: AnyRecord | null): number => {
  const districtHeat = pickFirstFinite(district, ["heat", "policePresence", "policeFocus"], 0);
  const playerPoliceState = target?.policeStateId ? gameState.policeStatesById?.[target.policeStateId] : null;
  const targetPolice = safeNumber(pickFirstFinite(target, ["policeSuspicion", "heat"], 0))
    + safeNumber(pickFirstFinite(target?.police, ["suspicion", "heat"], 0))
    + safeNumber(pickFirstFinite(playerPoliceState, ["heat", "wantedLevel"], 0));
  return Math.max(0, safeNumber(districtHeat) + safeNumber(targetPolice));
};

const getAttackerStealthBonus = (attacker: AnyRecord | null): number => {
  if (!attacker) {
    return 0;
  }

  const direct = pickFirstFinite(attacker, ["heistStealthBonus", "stealthBonus"], 0);
  const modifier = pickFirstFinite(attacker.modifiers, ["heistStealthBonus", "stealthBonus"], 0);
  const faction = pickFirstFinite(attacker.faction, ["heistStealthBonus", "stealthBonus"], 0);
  const effects = Array.isArray(attacker.activeEffects)
    ? attacker.activeEffects.reduce((total: number, effect: AnyRecord) => {
      if (effect?.type === "heist_stealth_bonus" || effect?.type === "heist_detection_reduction") {
        return total + safeNumber(effect.value);
      }
      return total;
    }, 0)
    : 0;

  return Math.max(0, safeNumber(direct) + safeNumber(modifier) + safeNumber(faction) + effects);
};

const hasActiveTrap = (gameState: AnyRecord, district: AnyRecord | null): boolean => {
  if (!district) {
    return false;
  }
  if (district.hasActiveTrap || district.activeTrap || district.trap?.active || district.trap?.status === "active") {
    return true;
  }
  if (Array.isArray(district.traps) && district.traps.some((trap: AnyRecord) => trap?.active || trap?.status === "active")) {
    return true;
  }
  if (gameState.trapsById && typeof gameState.trapsById === "object") {
    return Object.values(gameState.trapsById).some((trap: any) => trap?.districtId === district.id && trap?.status === "active");
  }
  const trapByDistrict = gameState.districtTrapById?.[district.id] ?? gameState.trapsByDistrictId?.[district.id];
  return Boolean(trapByDistrict?.active || trapByDistrict?.status === "active" || trapByDistrict?.isArmed);
};

const isDistrictInPoliceLockdown = (district: AnyRecord, now: number): boolean =>
  Boolean(
    district.policeLockdown
    || district.status === "police_lockdown"
    || district.status === "locked"
    || safeTimestamp(district.lockdownUntil) > now
    || safeTimestamp(district.policeLockdownUntil) > now
  );

const isDistrictHeistImmune = (district: AnyRecord, now: number): boolean =>
  Boolean(
    district.heistImmune
    || district.immuneToHeists
    || district.status === "heist_immune"
    || safeTimestamp(district.heistImmuneUntil) > now
  );

const rollHeistOutcome = (gameState: AnyRecord, heist: ActiveDistrictHeist): HeistOutcome => {
  const detectionChance = heist.detectionChanceSnapshot || calculateHeistDetectionChance(gameState, heist);
  const roll = clamp(Number.isFinite(heist.detectionRoll) ? Number(heist.detectionRoll) : Math.random(), 0, 1);

  if (roll < detectionChance * 0.35) {
    return "failed";
  }
  if (roll < detectionChance) {
    return "detected";
  }
  if (roll > Math.min(0.98, detectionChance + 0.35)) {
    return "clean_success";
  }
  return "success";
};

const getOutcomeLootMultiplier = (outcome: HeistOutcome, lootRoll?: number): number => {
  const roll = clamp(Number.isFinite(lootRoll) ? Number(lootRoll) : Math.random(), 0, 1);
  switch (outcome) {
    case "clean_success":
      return 1;
    case "success":
      return 0.65 + roll * 0.2;
    case "detected":
      return 0.2 + roll * 0.25;
    case "failed":
    case "trap_triggered":
      return 0;
  }
};

const calculateGangLoss = (heist: ActiveDistrictHeist, outcome: HeistOutcome): number => {
  const sent = sanitizeGangMembers(heist.gangMembersSent);
  const roll = clamp(Number.isFinite(heist.lossRoll) ? Number(heist.lossRoll) : Math.random(), 0, 1);
  const styleConfig = heistConfig.styles[heist.style] ?? heistConfig.styles.balanced;
  let lossPercent = 0;

  switch (outcome) {
    case "clean_success":
      lossPercent = roll * 0.05;
      break;
    case "success":
      lossPercent = 0.05 + roll * 0.1;
      break;
    case "detected":
      lossPercent = styleConfig.unitLossMultiplierIfDetected * (0.65 + roll * 0.35);
      break;
    case "failed":
      lossPercent = 0.35 + roll * 0.45;
      break;
    case "trap_triggered":
      return sent;
  }

  return clamp(Math.floor(sent * lossPercent), outcome === "clean_success" ? 0 : 1, sent);
};

const calculateLootAmount = (available: number, capPercent: number, multiplier: number): number => {
  const safeAvailable = safeInteger(available);
  if (safeAvailable <= 0 || multiplier <= 0) {
    return 0;
  }

  const amount = Math.floor(safeAvailable * capPercent * multiplier);
  const floored = amount <= 0 ? heistConfig.lootRules.minLootFloor : amount;
  return Math.min(safeAvailable, Math.max(0, floored));
};

const collectLootContainers = (
  gameState: AnyRecord,
  target: AnyRecord | null,
  district: AnyRecord | null
): AnyRecord[] => {
  const containers = new Set<AnyRecord>();
  addContainer(containers, target);
  addContainer(containers, target?.resources);
  if (target?.resourceStateId) {
    addContainer(containers, gameState.resourceStatesById?.[target.resourceStateId]?.balances);
  }
  addContainer(containers, district);
  addContainer(containers, district?.resources);
  const districtResourceState = findResourceState(gameState, "district", district?.id);
  addContainer(containers, districtResourceState?.balances);

  return [...containers];
};

const collectAttackerLootContainers = (gameState: AnyRecord, attacker: AnyRecord | null): AnyRecord[] => {
  const containers = new Set<AnyRecord>();
  addContainer(containers, attacker);
  addContainer(containers, attacker?.resources);
  if (attacker?.resourceStateId) {
    addContainer(containers, gameState.resourceStatesById?.[attacker.resourceStateId]?.balances);
  }
  const playerResourceState = findResourceState(gameState, "player", attacker?.id);
  addContainer(containers, playerResourceState?.balances);
  return [...containers];
};

const addContainer = (containers: Set<AnyRecord>, value: unknown): void => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    containers.add(value as AnyRecord);
  }
};

const findResourceState = (gameState: AnyRecord, ownerType: string, ownerId: string | undefined): AnyRecord | null => {
  if (!ownerId || !gameState.resourceStatesById) {
    return null;
  }
  return Object.values(gameState.resourceStatesById).find((resourceState: any) =>
    resourceState?.ownerType === ownerType && resourceState?.ownerId === ownerId
  ) as AnyRecord | null ?? null;
};

const applyHeistLoot = (
  gameState: AnyRecord,
  target: AnyRecord | null,
  district: AnyRecord | null,
  attacker: AnyRecord | null,
  loot: HeistLoot
): void => {
  const sourceContainers = collectLootContainers(gameState, target, district);
  const targetContainers = collectAttackerLootContainers(gameState, attacker);

  transferBalance(sourceContainers, targetContainers, CASH_KEY_ALIASES, loot.cleanCash);
  transferBalance(sourceContainers, targetContainers, DIRTY_CASH_KEY_ALIASES, loot.dirtyCash);
  for (const key of RESOURCE_KEYS) {
    transferBalance(sourceContainers, targetContainers, RESOURCE_KEY_ALIASES[key], loot.resources[key]);
  }

  if (loot.rareLoot) {
    creditBalance(targetContainers, [loot.rareLoot.itemId], loot.rareLoot.amount);
  }
};

const transferBalance = (
  sourceContainers: AnyRecord[],
  targetContainers: AnyRecord[],
  keyAliases: string[],
  amount: number
): void => {
  const debited = debitBalance(sourceContainers, keyAliases, amount);
  creditBalance(targetContainers, keyAliases, debited);
};

const debitBalance = (containers: AnyRecord[], keyAliases: string[], amount: number): number => {
  let remaining = safeInteger(amount);
  let debited = 0;
  if (remaining <= 0) {
    return 0;
  }

  for (const container of containers) {
    const key = resolveExistingKey(container, keyAliases);
    if (!key) {
      continue;
    }
    const available = safeInteger(container[key]);
    const take = Math.min(available, remaining);
    container[key] = Math.max(0, available - take);
    remaining -= take;
    debited += take;
    if (remaining <= 0) {
      break;
    }
  }

  return debited;
};

const creditBalance = (containers: AnyRecord[], keyAliases: string[], amount: number): void => {
  const safeAmount = safeInteger(amount);
  if (safeAmount <= 0) {
    return;
  }
  const container = containers[0];
  if (!container) {
    return;
  }
  const key = resolveExistingKey(container, keyAliases) ?? keyAliases[0];
  container[key] = safeInteger(container[key]) + safeAmount;
};

const getTotalBalance = (containers: AnyRecord[], keyAliases: string[]): number =>
  containers.reduce((total, container) => {
    const key = resolveExistingKey(container, keyAliases);
    return total + (key ? safeInteger(container[key]) : 0);
  }, 0);

const resolveExistingKey = (container: AnyRecord, keyAliases: string[]): string | null =>
  keyAliases.find((key) => Object.prototype.hasOwnProperty.call(container, key)) ?? null;

const rollRareLoot = (heist: ActiveDistrictHeist, outcome: HeistOutcome): RareHeistLoot | null => {
  const chance = outcome === "clean_success"
    ? heistConfig.lootRules.rareLootChance
    : outcome === "success"
      ? heistConfig.lootRules.rareLootChance / 2
      : 0;
  const roll = clamp(Number.isFinite(heist.rareLootRoll) ? Number(heist.rareLootRoll) : Math.random(), 0, 1);

  if (roll > chance) {
    return null;
  }

  return {
    type: "resource",
    itemId: "techCore",
    amount: 1
  };
};

const sanitizeLoot = (loot: HeistLoot): HeistLoot => ({
  cleanCash: safeInteger(loot.cleanCash),
  dirtyCash: safeInteger(loot.dirtyCash),
  resources: Object.fromEntries(
    RESOURCE_KEYS.map((key) => [key, safeInteger(loot.resources[key])])
  ),
  rareLoot: loot.rareLoot && safeInteger(loot.rareLoot.amount) > 0
    ? { ...loot.rareLoot, amount: safeInteger(loot.rareLoot.amount) }
    : null
});

const applyResolveCooldowns = (
  heistState: PlayerHeistState,
  targetDistrictId: string,
  outcome: HeistOutcome,
  mode: HeistModeId,
  now: number
): void => {
  const multiplier = getModeMultipliers(mode).cooldownMultiplier;
  const globalMs = heistConfig.cooldowns.globalFreeSeconds * multiplier * 1000;
  const sameTargetMs = heistConfig.cooldowns.sameTargetFreeSeconds * multiplier * 1000;
  const trapTargetMs = 420 * multiplier * 1000;

  heistState.cooldowns.globalUntil = Math.max(heistState.cooldowns.globalUntil, now + globalMs);
  heistState.cooldowns.targetUntilByDistrictId[targetDistrictId] = Math.max(
    heistState.cooldowns.targetUntilByDistrictId[targetDistrictId] ?? 0,
    now + (outcome === "trap_triggered" ? Math.max(sameTargetMs, trapTargetMs) : sameTargetMs)
  );
};

const updateHeistStats = (
  heistState: PlayerHeistState,
  outcome: HeistOutcome,
  loot: HeistLoot,
  gangLost: number
): void => {
  if (outcome === "clean_success" || outcome === "success") {
    heistState.stats.succeeded += 1;
  } else if (outcome === "detected") {
    heistState.stats.detected += 1;
  } else {
    heistState.stats.failed += 1;
  }

  heistState.stats.totalLootCash += safeInteger(loot.cleanCash) + safeInteger(loot.dirtyCash);
  heistState.stats.totalLootResources += Object.values(loot.resources).reduce((total, amount) => total + safeInteger(amount), 0);
  heistState.stats.totalGangLost += safeInteger(gangLost);
};

const applyOutcomeHeatAndPolice = (
  gameState: AnyRecord,
  attackerPlayerId: string,
  styleConfig: AnyRecord,
  outcome: HeistOutcome,
  mode: HeistModeId
): void => {
  if (outcome === "clean_success" || outcome === "success") {
    addHeatToPlayer(gameState, attackerPlayerId, scaleHeat(styleConfig.heatOnSuccess, mode), "heist_success");
    return;
  }

  const reason = outcome === "trap_triggered" ? "heist_trap_triggered" : outcome === "failed" ? "heist_failed" : "heist_detected";
  addHeatToPlayer(gameState, attackerPlayerId, scaleHeat(styleConfig.heatOnDetected, mode), reason);
  addPoliceSuspicionToPlayer(gameState, attackerPlayerId, scaleHeat(styleConfig.policeSuspicionOnDetected, mode), reason);
};

const addHeatToPlayer = (gameState: AnyRecord, playerId: string, amount: number, reason: string): void => {
  const player = findPlayer(gameState, playerId);
  const safeAmount = safeInteger(amount);
  if (!player || safeAmount <= 0) {
    return;
  }

  player.heat = safeInteger(player.heat) + safeAmount;
  player.heatLog = [...(Array.isArray(player.heatLog) ? player.heatLog : []), { reason, amount: safeAmount }];

  if (player.gang && typeof player.gang === "object") {
    player.gang.heat = safeInteger(player.gang.heat) + safeAmount;
  }

  if (player.policeStateId && gameState.policeStatesById) {
    const current = gameState.policeStatesById[player.policeStateId] ?? {
      id: player.policeStateId,
      ownerPlayerId: playerId,
      heat: 0,
      wantedLevel: 0,
      lastDecayTick: gameState.root?.tick ?? 0,
      activeFlags: [],
      version: 0
    };
    gameState.policeStatesById[player.policeStateId] = {
      ...current,
      heat: safeInteger(current.heat) + safeAmount,
      version: safeInteger(current.version) + 1
    };
  }

  if (gameState.heatByPlayerId && typeof gameState.heatByPlayerId === "object") {
    gameState.heatByPlayerId[playerId] = safeInteger(gameState.heatByPlayerId[playerId]) + safeAmount;
  }
};

const addPoliceSuspicionToPlayer = (gameState: AnyRecord, playerId: string, amount: number, reason: string): void => {
  const player = findPlayer(gameState, playerId);
  const safeAmount = safeInteger(amount);
  if (!player || safeAmount <= 0) {
    return;
  }

  player.policeSuspicion = safeInteger(player.policeSuspicion) + safeAmount;
  player.policeSuspicionLog = [
    ...(Array.isArray(player.policeSuspicionLog) ? player.policeSuspicionLog : []),
    { reason, amount: safeAmount }
  ];

  if (player.police && typeof player.police === "object") {
    player.police.suspicion = safeInteger(player.police.suspicion) + safeAmount;
  }

  if (gameState.policeSuspicionByPlayerId && typeof gameState.policeSuspicionByPlayerId === "object") {
    gameState.policeSuspicionByPlayerId[playerId] = safeInteger(gameState.policeSuspicionByPlayerId[playerId]) + safeAmount;
  }
};

const notifyPoliceOfHeist = (gameState: AnyRecord, payload: AnyRecord): void => {
  const handler = typeof gameState.notifyPoliceOfHeist === "function"
    ? gameState.notifyPoliceOfHeist
    : typeof gameState.policeAI?.notifyPoliceOfHeist === "function"
      ? gameState.policeAI.notifyPoliceOfHeist
      : null;

  if (handler) {
    try {
      handler(gameState, payload);
    } catch (error) {
      appendGameLog(gameState, "police", "Police AI hook pro akci Vykrást hráče selhal bezpečně.", {
        ...payload,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  } else {
    appendGameLog(gameState, "police", "Policie dostala hlášení o akci Vykrást hráče.", payload);
  }
};

const appendResolveLogs = (
  gameState: AnyRecord,
  heist: ActiveDistrictHeist,
  outcome: HeistOutcome,
  loot: HeistLoot,
  gangLost: number,
  gangReturned: number
): void => {
  appendGameLog(gameState, "heist", getOutcomeMessage(outcome), {
    heistId: heist.id,
    attackerPlayerId: heist.attackerPlayerId,
    targetPlayerId: heist.targetPlayerId,
    targetDistrictId: heist.targetDistrictId,
    outcome
  });

  const lootCash = safeInteger(loot.cleanCash) + safeInteger(loot.dirtyCash);
  const lootResources = Object.values(loot.resources).reduce((total, amount) => total + safeInteger(amount), 0);
  appendGameLog(gameState, "heist", `Vykrást hráče loot: cash ${lootCash}, resources ${lootResources}.`, {
    heistId: heist.id,
    loot
  });
  appendGameLog(gameState, "heist", `Ztráty gangu při akci Vykrást hráče: ${gangLost}. Návrat: ${gangReturned}.`, {
    heistId: heist.id,
    gangLost,
    gangReturned
  });
};

const appendOutcomeRumor = (gameState: AnyRecord, heist: ActiveDistrictHeist, outcome: HeistOutcome): void => {
  const rumor = getOutcomeRumor(outcome);
  addRumor(gameState, rumor.message, {
    type: "heist",
    targetPlayerId: heist.targetPlayerId,
    districtId: heist.targetDistrictId,
    truth: rumor.truth,
    spread: rumor.spread,
    source: "system"
  });
};

const addRumor = (gameState: AnyRecord, message: string, payload: AnyRecord): void => {
  const rumor = {
    id: `rumor:heist:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    message,
    payload,
    createdAt: Date.now()
  };

  if (Array.isArray(gameState.rumors)) {
    gameState.rumors.push(rumor);
    return;
  }

  appendGameLog(gameState, "rumor", message, payload);
};

const appendGameLog = (gameState: AnyRecord, type: string, message: string, payload: AnyRecord = {}): void => {
  const entry = {
    type,
    message,
    payload,
    createdAt: Date.now()
  };

  if (Array.isArray(gameState.eventLog)) {
    gameState.eventLog.push(entry);
  } else {
    gameState.eventLog = [entry];
  }

  if (gameState.eventsById && gameState.root) {
    const tick = safeInteger(gameState.root.tick);
    const eventIds = Array.isArray(gameState.root.eventIds) ? gameState.root.eventIds : [];
    const id = `event:heist:${tick}:${eventIds.length}:${Math.random().toString(36).slice(2, 8)}`;
    eventIds.push(id);
    gameState.root.eventIds = eventIds;
    gameState.eventsById[id] = {
      id,
      serverInstanceId: gameState.serverInstance?.id ?? "local",
      eventTypeId: type,
      status: "resolved",
      scope: "player",
      targetIds: [payload.attackerPlayerId, payload.targetPlayerId, payload.districtId, payload.targetDistrictId].filter(Boolean),
      startTick: tick,
      endTick: tick,
      payload: {
        message,
        ...payload
      },
      version: 1
    };
  }
};

const getOutcomeRumor = (outcome: HeistOutcome): { message: string; truth: number; spread: number } => {
  switch (outcome) {
    case "clean_success":
      return {
        message: "V ulicích se šeptá, že heist vytáhl cash/resources z cizího districtu bez převzetí území.",
        truth: 0.55,
        spread: 0.35
      };
    case "success":
      return {
        message: "Někdo při akci Vykrást hráče vybral zásoby cizího districtu, ale vlajka zůstala stejná.",
        truth: 0.65,
        spread: 0.45
      };
    case "detected":
      return {
        message: "Vykrást hráče se zvrtlo. Sirény byly slyšet až za hranicí districtu.",
        truth: 0.8,
        spread: 0.75
      };
    case "failed":
      return {
        message: "Vykrást hráče selhalo. Gang se vrátil prázdný a město si pamatuje jejich tváře.",
        truth: 0.75,
        spread: 0.65
      };
    case "trap_triggered":
      return {
        message: "Vykrást hráče narazilo na past. Do districtu vešli lidé, ven nevyšel nikdo.",
        truth: 0.9,
        spread: 0.9
      };
  }
};

const getOutcomeMessage = (outcome: HeistOutcome): string => {
  switch (outcome) {
    case "clean_success":
      return "Vykrást hráče proběhlo čistě. Gang ukradl část cash/resources a vlastník districtu se nemění.";
    case "success":
      return "Vykrást hráče uspělo, ale v ulicích zůstal chaos. District nepřebíráš.";
    case "detected":
      return "Vykrást hráče bylo odhaleno. Gang se stáhl s částí kořisti.";
    case "failed":
      return "Vykrást hráče selhalo. Gang se vrátil s těžkými ztrátami.";
    case "trap_triggered":
      return "Vykrást hráče narazilo na past. Nikdo se nevrátil.";
  }
};

const findActiveHeist = (
  gameState: AnyRecord,
  heistId: string
): { heist: ActiveDistrictHeist; attacker: AnyRecord; heistState: PlayerHeistState } | null => {
  const players = getAllPlayers(gameState);
  for (const player of players) {
    const heistState = initializeHeistState(player).heists;
    const heist = heistState.activeHeists.find((active) => active.id === heistId);
    if (heist) {
      return { heist, attacker: player, heistState };
    }
  }
  return null;
};

const collectActiveHeists = (gameState: AnyRecord): ActiveDistrictHeist[] =>
  getAllPlayers(gameState).flatMap((player) => initializeHeistState(player).heists.activeHeists);

const getAllPlayers = (gameState: AnyRecord): AnyRecord[] => {
  if (gameState.playersById && typeof gameState.playersById === "object") {
    return Object.values(gameState.playersById);
  }
  if (Array.isArray(gameState.players)) {
    return gameState.players;
  }
  if (gameState.players && typeof gameState.players === "object") {
    return Object.values(gameState.players);
  }
  return [];
};

const removeActiveHeist = (heistState: PlayerHeistState, heistId: string): void => {
  heistState.activeHeists = heistState.activeHeists.filter((heist) => heist.id !== heistId);
};

const buildStyleWarnings = (
  district: AnyRecord | null,
  styleId: HeistStyleId,
  detectionChance: number,
  availableGangMembers: number,
  minGangMembers: number
): string[] => {
  const warnings: string[] = [];
  const districtType = normalizeDistrictType(getDistrictType(district));
  if (detectionChance >= 0.55) {
    warnings.push("Vysoká šance odhalení");
  }
  if (districtType === "downtown") {
    warnings.push("Downtown má vysoký loot, ale tvrdou detekci");
  }
  if (districtType === "park" && styleId === "stealth") {
    warnings.push("Park je vhodný pro tichý heist");
  }
  if (district && hasActiveTrap({}, district)) {
    warnings.push("District může mít past");
  }
  if (availableGangMembers < minGangMembers) {
    warnings.push("Nemáš dost členů gangu");
  }
  return warnings;
};

const sanitizeTimestampRecord = (record: unknown): Record<string, number> => {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(record as Record<string, unknown>).map(([key, value]) => [key, safeTimestamp(value)])
  );
};

const sanitizeGangMembers = (value: unknown): number =>
  Math.max(0, Math.floor(Number(value) || 0));

const safeInteger = (value: unknown): number =>
  Math.max(0, Math.floor(Number(value) || 0));

const safeNumber = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const safeTimestamp = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const getRemainingSeconds = (until: number | undefined, now: number): number =>
  Math.max(0, Math.ceil((safeTimestamp(until) - now) / 1000));

const pickFirstFinite = (source: unknown, keys: string[], fallback: number | null = null): number | null => {
  if (!source || typeof source !== "object") {
    return fallback;
  }
  const record = source as AnyRecord;
  for (const key of keys) {
    const value = Number(record[key]);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return fallback;
};

const hasFiniteKey = (source: unknown, key: string): boolean =>
  Boolean(source && typeof source === "object" && Number.isFinite(Number((source as AnyRecord)[key])));

const sumRecordNumbers = (record: unknown): number => {
  if (!record || typeof record !== "object") {
    return 0;
  }
  return Object.values(record).reduce((total, value) => total + Math.max(0, Number(value) || 0), 0);
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const roundRatio = (value: number): number =>
  Math.round(value * 10000) / 10000;

const createHeistId = (now: number, attackerPlayerId: string, targetDistrictId: string): string =>
  `${heistConfig.id}:${now}:${attackerPlayerId}:${targetDistrictId}:${Math.random().toString(36).slice(2, 8)}`;

const isActiveHeist = (value: unknown): value is ActiveDistrictHeist => {
  const heist = value as Partial<ActiveDistrictHeist>;
  return Boolean(
    heist
    && typeof heist.id === "string"
    && typeof heist.attackerPlayerId === "string"
    && typeof heist.targetDistrictId === "string"
    && heist.status === "active"
  );
};
