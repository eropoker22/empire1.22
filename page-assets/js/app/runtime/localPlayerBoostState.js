import { PLAYER_BOOST_CONFIG } from "../../../../packages/game-config/src/legacy-page/gameplay-config.generated.js";

const BOOST_STATE_VERSION = 1;
const BOOST_IDS = Object.freeze(["ghost-network", "industrial-overdrive", "tactical-grid"]);
const RESOURCE_LABELS = Object.freeze({
  "ghost-serum": "Ghost Serum",
  "pulse-shot": "Pulse Shot",
  "overdrive-x": "Overdrive X",
  "combat-module": "Combat Module"
});

export function createEmptyLocalPlayerBoostState() {
  return {
    version: BOOST_STATE_VERSION,
    active: null,
    cooldownUntilMsByBoostId: {},
    processedCommandIds: [],
    consumedCombatIds: [],
    lifecycleMessages: []
  };
}

export function normalizeLocalPlayerBoostState(value) {
  const raw = value && typeof value === "object" ? value : {};
  const active = normalizeActive(raw.active);
  const cooldownUntilMsByBoostId = {};
  for (const boostId of BOOST_IDS) {
    const deadline = Number(raw.cooldownUntilMsByBoostId?.[boostId]);
    if (Number.isFinite(deadline) && deadline > 0) cooldownUntilMsByBoostId[boostId] = deadline;
  }
  return {
    version: BOOST_STATE_VERSION,
    active,
    cooldownUntilMsByBoostId,
    processedCommandIds: normalizeStringList(raw.processedCommandIds, 24),
    consumedCombatIds: normalizeStringList(raw.consumedCombatIds, 24),
    lifecycleMessages: Array.isArray(raw.lifecycleMessages)
      ? raw.lifecycleMessages.filter((entry) => entry && typeof entry === "object").slice(-20)
      : []
  };
}

export function migrateLegacyFactoryBoostState(session) {
  const current = session && typeof session === "object" ? session : {};
  const factory = current.production?.factory;
  const hasLegacyFactoryBoostState = Boolean(
    factory
    && typeof factory === "object"
    && Object.prototype.hasOwnProperty.call(factory, "boosts")
  );
  const normalizedBoosts = normalizeLocalPlayerBoostState(current.playerBoosts);
  const alreadyMigrated = Number(current.playerBoosts?.version || 0) >= BOOST_STATE_VERSION;
  if (!hasLegacyFactoryBoostState && alreadyMigrated) {
    return { session: { ...current, playerBoosts: normalizedBoosts }, migrated: false };
  }
  const { boosts: _legacyBoosts, ...nextFactory } = factory || {};
  return {
    migrated: hasLegacyFactoryBoostState,
    session: {
      ...current,
      playerBoosts: normalizedBoosts,
      production: factory ? {
        ...current.production,
        factory: Object.keys(nextFactory).length > 0 ? nextFactory : undefined
      } : current.production
    }
  };
}

export function synchronizeLocalPlayerBoostSession(session, now = Date.now(), options = {}) {
  const migrated = migrateLegacyFactoryBoostState(session);
  let nextSession = migrated.session;
  const boostState = normalizeLocalPlayerBoostState(nextSession.playerBoosts);
  const active = boostState.active;
  if (!active || active.expiresAtMs > now) {
    return { session: { ...nextSession, playerBoosts: boostState }, expired: null, migrated: migrated.migrated };
  }
  if (active.boostId === "industrial-overdrive" && typeof options.applyProductionBoundary === "function") {
    nextSession = options.applyProductionBoundary(nextSession, {
      boundaryMs: active.expiresAtMs,
      speedMultiplier: 1,
      speedExpiresAtMs: null
    }) || nextSession;
  }
  const message = active.boostId === "tactical-grid"
    ? "Tactical Grid expiroval bez použití."
    : active.boostId === "industrial-overdrive"
      ? "Industrial Overdrive skončil."
      : "Ghost Network vypršel.";
  const nextBoostState = appendLifecycleMessage({ ...boostState, active: null }, {
    id: `expired:${active.boostId}:${active.activatedAtMs}`,
    type: "expired",
    boostId: active.boostId,
    message,
    atMs: active.expiresAtMs
  });
  return {
    session: { ...nextSession, playerBoosts: nextBoostState },
    expired: { boostId: active.boostId, message },
    migrated: migrated.migrated
  };
}

export function activateLocalPlayerBoost(session, boostId, options = {}) {
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const commandId = String(options.commandId || "").trim();
  const synchronized = synchronizeLocalPlayerBoostSession(session, now, options);
  let nextSession = synchronized.session;
  const boostState = normalizeLocalPlayerBoostState(nextSession.playerBoosts);
  const definition = PLAYER_BOOST_CONFIG[boostId];
  if (!definition) return failure(nextSession, "boost_unknown");
  if (commandId && boostState.processedCommandIds.includes(commandId)) {
    return { ok: true, replayed: true, session: nextSession, boostId };
  }
  if (boostState.active && boostState.active.expiresAtMs > now) {
    return failure(nextSession, "boost_already_active");
  }
  if (Number(boostState.cooldownUntilMsByBoostId[boostId] || 0) > now) {
    return failure(nextSession, "boost_on_cooldown");
  }
  if (readCleanCash(nextSession) < definition.cleanCashCost) {
    return failure(nextSession, "boost_missing_clean_cash");
  }
  if (Object.entries(definition.inputCosts).some(([resourceKey, amount]) => readResource(nextSession, resourceKey) < amount)) {
    return failure(nextSession, "boost_missing_resources");
  }
  const expiresAtMs = now + definition.durationMs;
  const cooldownUntilMs = now + definition.cooldownMs;
  if (boostId === "industrial-overdrive" && typeof options.applyProductionBoundary === "function") {
    nextSession = options.applyProductionBoundary(nextSession, {
      boundaryMs: now,
      speedMultiplier: Number(definition.effect.productionSpeedMultiplier || 1),
      speedExpiresAtMs: expiresAtMs
    }) || nextSession;
  }
  nextSession = writeCleanCash(nextSession, readCleanCash(nextSession) - definition.cleanCashCost);
  for (const [resourceKey, amount] of Object.entries(definition.inputCosts)) {
    nextSession = writeResource(nextSession, resourceKey, readResource(nextSession, resourceKey) - amount);
  }
  const message = boostId === "tactical-grid"
    ? "Tactical Grid byl nabitý."
    : `${definition.label} byl aktivován.`;
  const nextBoostState = appendLifecycleMessage({
    ...boostState,
    active: {
      boostId,
      activatedAtMs: now,
      expiresAtMs,
      status: definition.consumptionMode === "next-valid-pvp-combat" ? "armed" : "timed",
      effectSnapshot: { ...definition.effect }
    },
    cooldownUntilMsByBoostId: {
      ...boostState.cooldownUntilMsByBoostId,
      [boostId]: cooldownUntilMs
    },
    processedCommandIds: commandId
      ? [...boostState.processedCommandIds, commandId].slice(-24)
      : boostState.processedCommandIds
  }, {
    id: `activated:${boostId}:${now}`,
    type: "activated",
    boostId,
    message,
    atMs: now
  });
  return {
    ok: true,
    replayed: false,
    session: { ...nextSession, playerBoosts: nextBoostState },
    boostId,
    message,
    expiresAtMs,
    cooldownUntilMs
  };
}

export function consumeLocalTacticalGrid(session, options = {}) {
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const combatId = String(options.combatId || "").trim();
  const role = options.role === "defender" ? "defender" : "attacker";
  const synchronized = synchronizeLocalPlayerBoostSession(session, now, options);
  const boostState = normalizeLocalPlayerBoostState(synchronized.session.playerBoosts);
  if (combatId && boostState.consumedCombatIds.includes(combatId)) {
    return { consumed: false, replayed: true, multiplier: 1, session: synchronized.session };
  }
  const active = boostState.active;
  if (active?.boostId !== "tactical-grid" || active.status !== "armed" || active.expiresAtMs <= now) {
    return { consumed: false, replayed: false, multiplier: 1, session: synchronized.session };
  }
  const multiplier = positiveMultiplier(active.effectSnapshot.combatPowerMultiplier, 1);
  const bonusPct = Math.round((multiplier - 1) * 100);
  const message = role === "defender"
    ? `Tactical Grid byl spotřebován při obraně: +${bonusPct} % bojové síly.`
    : `Tactical Grid byl spotřebován při útoku: +${bonusPct} % bojové síly.`;
  const nextBoostState = appendLifecycleMessage({
    ...boostState,
    active: null,
    consumedCombatIds: combatId
      ? [...boostState.consumedCombatIds, combatId].slice(-24)
      : boostState.consumedCombatIds
  }, {
    id: `consumed:${active.activatedAtMs}:${combatId || now}:${role}`,
    type: "consumed",
    boostId: active.boostId,
    message,
    atMs: now
  });
  return {
    consumed: true,
    replayed: false,
    multiplier,
    message,
    session: { ...synchronized.session, playerBoosts: nextBoostState }
  };
}

export function getLocalSpyBoostSnapshot(session, now = Date.now()) {
  const active = normalizeLocalPlayerBoostState(session?.playerBoosts).active;
  if (active?.boostId !== "ghost-network" || active.expiresAtMs <= now) return null;
  return {
    boostId: active.boostId,
    activatedAtMs: active.activatedAtMs,
    spyDurationMultiplier: positiveMultiplier(active.effectSnapshot.spyDurationMultiplier, 1),
    criticalFailureChanceMultiplier: positiveMultiplier(active.effectSnapshot.criticalFailureChanceMultiplier, 1),
    extraIntelBlocksOnSuccess: Math.max(0, Math.floor(Number(active.effectSnapshot.extraIntelBlocksOnSuccess || 0)))
  };
}

export function getLocalProductionBoostSnapshot(session, now = Date.now()) {
  const active = normalizeLocalPlayerBoostState(session?.playerBoosts).active;
  if (active?.boostId !== "industrial-overdrive" || active.expiresAtMs <= now) {
    return { multiplier: 1, expiresAtMs: null };
  }
  return {
    multiplier: positiveMultiplier(active.effectSnapshot.productionSpeedMultiplier, 1),
    expiresAtMs: active.expiresAtMs
  };
}

export function getLocalTacticalGridSnapshot(session, now = Date.now()) {
  const active = normalizeLocalPlayerBoostState(session?.playerBoosts).active;
  if (active?.boostId !== "tactical-grid" || active.status !== "armed" || active.expiresAtMs <= now) return null;
  return {
    boostId: active.boostId,
    multiplier: positiveMultiplier(active.effectSnapshot.combatPowerMultiplier, 1),
    expiresAtMs: active.expiresAtMs
  };
}

export function createLocalPlayerBoostView(session, now = Date.now()) {
  const boostState = normalizeLocalPlayerBoostState(session?.playerBoosts);
  const activeState = boostState.active && boostState.active.expiresAtMs > now ? boostState.active : null;
  const active = activeState ? {
    boostId: activeState.boostId,
    label: PLAYER_BOOST_CONFIG[activeState.boostId].label,
    category: PLAYER_BOOST_CONFIG[activeState.boostId].category,
    status: activeState.status,
    activatedAtMs: activeState.activatedAtMs,
    expiresAtMs: activeState.expiresAtMs,
    remainingMs: Math.max(0, activeState.expiresAtMs - now),
    effectSummary: PLAYER_BOOST_CONFIG[activeState.boostId].shortEffect,
    uiAccent: PLAYER_BOOST_CONFIG[activeState.boostId].uiAccent
  } : null;
  const cards = BOOST_IDS.map((boostId) => {
    const definition = PLAYER_BOOST_CONFIG[boostId];
    const costs = Object.entries(definition.inputCosts).map(([resourceKey, required]) => {
      const stored = readResource(session, resourceKey);
      return {
        resourceKey,
        label: RESOURCE_LABELS[resourceKey] || resourceKey,
        required,
        stored,
        enough: stored >= required,
        missingAmount: Math.max(0, required - stored)
      };
    });
    const playerCleanCash = readCleanCash(session);
    const cooldownEndsAtMs = Number(boostState.cooldownUntilMsByBoostId[boostId] || 0) > now
      ? Number(boostState.cooldownUntilMsByBoostId[boostId])
      : null;
    const cooldownRemainingMs = Math.max(0, Number(cooldownEndsAtMs || 0) - now);
    const activeRemainingMs = Math.max(0, Number(active?.expiresAtMs || 0) - now);
    const isActive = active?.boostId === boostId;
    const isArmed = isActive && active.status === "armed";
    const isBlockedByActiveBoost = Boolean(active && !isActive);
    const hasEnoughCleanCash = playerCleanCash >= definition.cleanCashCost;
    const hasEnoughMaterials = costs.every((cost) => cost.enough);
    let disabledReason = null;
    if (isActive) disabledReason = isArmed ? "boost_armed" : "boost_active";
    else if (cooldownRemainingMs > 0 && (!isBlockedByActiveBoost || cooldownRemainingMs >= activeRemainingMs)) disabledReason = "boost_on_cooldown";
    else if (isBlockedByActiveBoost) disabledReason = "boost_already_active";
    else if (!hasEnoughCleanCash) disabledReason = "boost_missing_clean_cash";
    else if (!hasEnoughMaterials) disabledReason = "boost_missing_resources";
    return {
      boostId,
      label: definition.label,
      category: definition.category,
      description: definition.description,
      shortEffect: definition.shortEffect,
      costs,
      cleanCashCost: definition.cleanCashCost,
      playerCleanCash,
      hasEnoughCleanCash,
      durationMs: definition.durationMs,
      cooldownMs: definition.cooldownMs,
      cooldownEndsAtMs,
      cooldownRemainingMs,
      activeEndsAtMs: isActive ? active.expiresAtMs : null,
      isActive,
      isArmed,
      isBlockedByActiveBoost,
      canActivate: disabledReason === null,
      disabledReason,
      uiAccent: definition.uiAccent,
      iconKey: definition.iconKey
    };
  });
  return { active, cards, lifecycleMessages: boostState.lifecycleMessages };
}

function readCleanCash(session) {
  return Math.max(0, Math.floor(Number(session?.economy?.cleanMoney || 0)));
}

function writeCleanCash(session, amount) {
  return {
    ...session,
    economy: { ...(session.economy || {}), cleanMoney: Math.max(0, Math.floor(Number(amount || 0))) }
  };
}

function readResource(session, resourceKey) {
  if (resourceKey === "combat-module") {
    return Math.max(0, Math.floor(Number(
      session?.inventory?.materials?.["combat-module"]
      ?? session?.inventory?.factorySupplies?.combatModule
      ?? 0
    )));
  }
  return Math.max(0, Math.floor(Number(session?.inventory?.drugs?.[resourceKey] || 0)));
}

function writeResource(session, resourceKey, amount) {
  const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
  if (resourceKey === "combat-module") {
    return {
      ...session,
      inventory: {
        ...(session.inventory || {}),
        materials: { ...(session.inventory?.materials || {}), "combat-module": safeAmount },
        factorySupplies: undefined
      }
    };
  }
  return {
    ...session,
    inventory: {
      ...(session.inventory || {}),
      drugs: { ...(session.inventory?.drugs || {}), [resourceKey]: safeAmount }
    }
  };
}

function appendLifecycleMessage(state, entry) {
  if (state.lifecycleMessages.some((message) => message.id === entry.id)) return state;
  return { ...state, lifecycleMessages: [...state.lifecycleMessages, entry].slice(-20) };
}

function normalizeActive(value) {
  if (!value || typeof value !== "object" || !BOOST_IDS.includes(value.boostId)) return null;
  const activatedAtMs = Number(value.activatedAtMs);
  const expiresAtMs = Number(value.expiresAtMs);
  if (!Number.isFinite(activatedAtMs) || !Number.isFinite(expiresAtMs) || expiresAtMs <= activatedAtMs) return null;
  return {
    boostId: value.boostId,
    activatedAtMs,
    expiresAtMs,
    status: value.status === "armed" ? "armed" : "timed",
    effectSnapshot: value.effectSnapshot && typeof value.effectSnapshot === "object" ? { ...value.effectSnapshot } : {}
  };
}

function normalizeStringList(value, limit) {
  return Array.isArray(value) ? value.map(String).filter(Boolean).slice(-limit) : [];
}

function positiveMultiplier(value, fallback) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback;
}

function failure(session, code) {
  return { ok: false, code, session };
}
