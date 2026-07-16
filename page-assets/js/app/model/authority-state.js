import { MAX_SPIES, DEFAULT_GANG_MEMBERS } from "../../../../packages/game-config/src/legacy-page/combat-config.js";
import {
  DEFAULT_DRUG_INVENTORY,
  FACTORY_RECIPES,
  FACTORY_RESOURCE_KEYS,
  FACTORY_SLOT_CONFIG,
  FACTORY_SLOT_STORAGE_CAP,
  DEFAULT_MATERIAL_INVENTORY,
  DEFAULT_WEAPON_INVENTORY,
  getMarketPriceKey,
  MARKET_PRICE_REFRESH_MS,
  MARKET_TAB_CONFIG
} from "../../../../packages/game-config/src/legacy-page/economy-config.js";
import {
  loadState,
  saveState
} from "../persistence/legacyStorage.js";
import {
  createEmptyLocalPlayerBoostState,
  normalizeLocalPlayerBoostState
} from "../runtime/localPlayerBoostState.js";

// Browser preview-state bridge for the legacy static frontend.
// Server-fed sessions take precedence; localStorage writes are ignored when server
// authority is present.

const DEFAULT_MARKET_SERVER_ID = "preview-server";
const DEFAULT_PREVIEW_ECONOMY = Object.freeze({
  cleanMoney: 25000,
  dirtyMoney: 300
});
const DEFAULT_PREVIEW_GANG = Object.freeze({
  influence: 0,
  heat: 0
});
const DEFAULT_CITY_MINUTES = 5 * 60 + 55;

function normalizeMarketServerId(serverId) {
  const normalizedServerId = String(serverId || "").trim();
  return normalizedServerId || DEFAULT_MARKET_SERVER_ID;
}

function createDefaultMarketState(serverId = DEFAULT_MARKET_SERVER_ID) {
  const items = {};
  const normalizedServerId = normalizeMarketServerId(serverId);

  for (const [tabId, tabConfig] of Object.entries(MARKET_TAB_CONFIG)) {
    for (const item of tabConfig.items) {
      items[getMarketPriceKey(tabId, item.itemId)] = {
        price: item.price,
        previousPrice: item.price
      };
    }
  }

  return {
    serverId: normalizedServerId,
    nextRefreshAt: new Date(Date.now() + MARKET_PRICE_REFRESH_MS).toISOString(),
    items,
    transactions: []
  };
}

function normalizeMarketStatePayload(marketState, fallbackServerId = DEFAULT_MARKET_SERVER_ID) {
  if (!marketState?.items || !marketState?.nextRefreshAt) {
    return null;
  }

  const serverId = normalizeMarketServerId(marketState.serverId || fallbackServerId);
  return {
    ...marketState,
    serverId
  };
}

function normalizeMarketStateMap(marketByServerId) {
  if (!marketByServerId || typeof marketByServerId !== "object") {
    return {};
  }

  return Object.entries(marketByServerId).reduce((accumulator, [serverId, marketState]) => {
    const normalizedMarketState = normalizeMarketStatePayload(marketState, serverId);

    if (normalizedMarketState) {
      accumulator[normalizedMarketState.serverId] = normalizedMarketState;
    }

    return accumulator;
  }, {});
}

function createDefaultFactoryResources() {
  return FACTORY_RESOURCE_KEYS.reduce((accumulator, key) => {
    accumulator[key] = 0;
    return accumulator;
  }, {});
}

function getLegacyFactorySupplyPayload(materials = {}) {
  return {
    metalParts: Math.max(0, Math.floor(Number(materials?.["metal-parts"] || 0))),
    techCore: Math.max(0, Math.floor(Number(materials?.["tech-core"] || 0))),
    combatModule: 0
  };
}

function createDefaultFactorySlots(now = Date.now()) {
  return FACTORY_SLOT_CONFIG.map((slot) => ({
    id: slot.id,
    resourceKey: slot.resourceKey,
    mode: slot.mode,
    isProducing: true,
    producedAmount: 0,
    productionRemainder: 0,
    slotCap: FACTORY_SLOT_STORAGE_CAP,
    lastTick: now
  }));
}

function createDefaultFactoryState(now = Date.now()) {
  return {
    level: 1,
    resources: createDefaultFactoryResources(),
    slots: createDefaultFactorySlots(now),
    updatedAt: now
  };
}

function normalizeFactoryState(value) {
  const source = value && typeof value === "object" ? value : {};
  const { boosts: _legacyBoosts, ...factory } = source;
  return {
    ...createDefaultFactoryState(),
    ...factory,
    resources: {
      ...createDefaultFactoryResources(),
      ...(factory.resources || {})
    },
    slots: Array.isArray(factory.slots)
      ? factory.slots
      : createDefaultFactorySlots()
  };
}

function createDefaultProductionBuildingsState() {
  return {
    pharmacy: {
      level: 1
    },
    druglab: {
      level: 1
    },
    armory: {
      level: 1
    }
  };
}

const FACTORY_CANONICAL_RESOURCE_BY_LEGACY_KEY = Object.freeze({
  metalParts: "metal-parts",
  techCore: "tech-core",
  combatModule: "combat-module"
});

function distributeFactoryReservation(total, queuedAmount) {
  const safeTotal = Math.max(0, Math.floor(Number(total || 0)));
  const count = Math.max(0, Math.floor(Number(queuedAmount || 0)));
  if (count === 0) return [];
  return Array.from({ length: count }, (_, index) => Math.floor(safeTotal / count) + (index < safeTotal % count ? 1 : 0));
}

function migrateLegacyFactoryJobs(session, now = Date.now()) {
  const jobs = session?.production?.jobs && typeof session.production.jobs === "object"
    ? { ...session.production.jobs }
    : {};
  const factory = normalizeFactoryState(session?.production?.factory);
  for (const slotConfig of FACTORY_SLOT_CONFIG) {
    const jobId = `factory:${slotConfig.recipeId}`;
    if (jobs[jobId]) continue;
    const slot = factory.slots.find((candidate) =>
      String(candidate?.recipeId || "") === String(slotConfig.recipeId)
      || String(candidate?.id || "") === String(slotConfig.id));
    if (!slot) continue;
    const queuedAmount = Math.max(0, Math.floor(Number(slot.queuedAmount || 0)));
    const producedAmount = Math.max(0, Math.floor(Number(slot.producedAmount || factory.resources?.[slotConfig.resourceKey] || 0)));
    if (queuedAmount === 0 && producedAmount === 0) continue;
    const recipe = FACTORY_RECIPES[slotConfig.recipeId] || {};
    const durationMs = Math.max(1, Math.floor(Number(recipe.durationMs || 1_000)));
    const cleanReservations = distributeFactoryReservation(slot.reservedCleanCash, queuedAmount);
    const inputReservations = Object.fromEntries(Object.entries(slot.reservedInputs || {}).map(([legacyKey, total]) => [
      FACTORY_CANONICAL_RESOURCE_BY_LEGACY_KEY[legacyKey] || legacyKey,
      distributeFactoryReservation(total, queuedAmount)
    ]));
    const reservationUnits = Array.from({ length: queuedAmount }, (_, index) => ({
      cleanMoney: cleanReservations[index] || 0,
      inputs: Object.fromEntries(Object.entries(inputReservations).map(([resourceKey, values]) => [resourceKey, values[index] || 0]))
    }));
    const progress = Math.min(0.999999, Math.max(0, Number(slot.productionRemainder || 0)));
    const activeWorkRemainingMs = queuedAmount > 0 ? Math.max(1, Math.ceil(durationMs * (1 - progress))) : null;
    const lastProgressAtMs = queuedAmount > 0 ? Math.max(0, Number(slot.lastTick || now)) : null;
    jobs[jobId] = {
      version: 2,
      recipeId: slotConfig.recipeId,
      queuedAmount,
      producedAmount,
      quantity: queuedAmount,
      unitDurationMs: durationMs,
      durationMs,
      localOutputCap: Math.max(1, Number(recipe.localOutputCap || slot.slotCap || 1)),
      queueCapacity: Math.max(1, Number(recipe.queueCap || slot.queueCap || 1)),
      reservationUnits,
      inputs: Object.fromEntries(Object.entries(inputReservations).map(([resourceKey, values]) => [
        resourceKey,
        values.reduce((sum, amount) => sum + amount, 0)
      ])),
      cleanMoneyCost: cleanReservations.reduce((sum, amount) => sum + amount, 0),
      isProducing: queuedAmount > 0 && slot.isProducing !== false,
      productionSpeedMultiplier: 1,
      productionSpeedExpiresAtMs: null,
      activeWorkRemainingMs,
      lastProgressAtMs,
      readyAtMs: activeWorkRemainingMs && lastProgressAtMs !== null ? lastProgressAtMs + activeWorkRemainingMs : null,
      readyAt: activeWorkRemainingMs && lastProgressAtMs !== null ? new Date(lastProgressAtMs + activeWorkRemainingMs).toISOString() : null,
      status: queuedAmount > 0 ? slot.isProducing === false ? "waiting" : "running" : producedAmount > 0 ? "ready" : "idle",
      output: {
        ...(recipe.output || {}),
        itemId: slotConfig.canonicalResourceKey || FACTORY_CANONICAL_RESOURCE_BY_LEGACY_KEY[slotConfig.resourceKey],
        amount: producedAmount
      }
    };
  }
  return jobs;
}

export function createDefaultPreviewSession(_factionId = "mafian") {
  const market = createDefaultMarketState();

  return {
    registration: null,
    inventory: {
      weapons: { ...DEFAULT_WEAPON_INVENTORY },
      materials: {
        ...DEFAULT_MATERIAL_INVENTORY,
        "metal-parts": 0,
        "tech-core": 0,
        "combat-module": 0
      },
      drugs: { ...DEFAULT_DRUG_INVENTORY }
    },
    economy: {
      cleanMoney: DEFAULT_PREVIEW_ECONOMY.cleanMoney,
      dirtyMoney: DEFAULT_PREVIEW_ECONOMY.dirtyMoney
    },
    gang: {
      members: DEFAULT_GANG_MEMBERS,
      influence: DEFAULT_PREVIEW_GANG.influence,
      heat: DEFAULT_PREVIEW_GANG.heat,
      policeRaidProtectionUntil: 0,
      autoPoliceNextActionAt: 0,
      heatJournal: [],
      dirtyHeatReductionTimestamps: [],
      lastHeatDecayAt: new Date().toISOString()
    },
    missions: {
      attackOrders: [],
      occupyOrders: [],
      robberyOrders: [],
      spy: {
        available: MAX_SPIES,
        missions: []
      },
      spyIntel: {
        occupiableDistrictIds: [],
        revealedTypeDistrictIds: [],
        revealedDefenseDistrictIds: []
      }
    },
    production: {
      jobs: {},
      streetDealers: {
        slots: []
      },
      buildings: createDefaultProductionBuildingsState()
    },
    playerBoosts: createEmptyLocalPlayerBoostState(),
    world: {
      ownedDistrictIds: [],
      phaseState: {
        mapPhase: "night",
        gamePhase: "live",
        cityMinutes: DEFAULT_CITY_MINUTES,
        cityDayIndex: 0
      },
      destroyedDistrictIds: [],
      districtDefenseById: {},
      districtDefenseLoadoutById: {},
      districtDefenseResidentsById: {},
      districtTrapById: {},
      districtGossipById: {},
      districtPoliceActionById: {}
    },
    market,
    marketByServerId: {
      [market.serverId]: market
    }
  };
}

function normalizePreviewSession(session) {
  const base = createDefaultPreviewSession(session?.registration?.factionId);
  const legacyFactorySupplies = getLegacyFactorySupplyPayload(session?.inventory?.materials);
  const mergedMaterials = { ...base.inventory.materials, ...(session?.inventory?.materials || {}) };
  const mergedFactorySupplies = {
    ...base.inventory.factorySupplies,
    ...(session?.inventory?.factorySupplies || {})
  };

  mergedFactorySupplies.metalParts = Math.max(
    Number(mergedFactorySupplies.metalParts || 0),
    Number(legacyFactorySupplies.metalParts || 0)
  );
  mergedFactorySupplies.techCore = Math.max(
    Number(mergedFactorySupplies.techCore || 0),
    Number(legacyFactorySupplies.techCore || 0)
  );
  mergedMaterials["metal-parts"] = Math.max(Number(mergedMaterials["metal-parts"] || 0), Number(mergedFactorySupplies.metalParts || 0));
  mergedMaterials["tech-core"] = Math.max(Number(mergedMaterials["tech-core"] || 0), Number(mergedFactorySupplies.techCore || 0));
  mergedMaterials["combat-module"] = Math.max(Number(mergedMaterials["combat-module"] || 0), Number(mergedFactorySupplies.combatModule || 0));
  const marketServerId = normalizeMarketServerId(session?.registration?.serverId);
  const legacyMarketState = normalizeMarketStatePayload(session?.market, marketServerId) || createDefaultMarketState(marketServerId);
  const marketByServerId = {
    ...normalizeMarketStateMap(session?.marketByServerId),
    [legacyMarketState.serverId]: legacyMarketState
  };

  if (!marketByServerId[marketServerId]) {
    marketByServerId[marketServerId] = createDefaultMarketState(marketServerId);
  }

  const activeMarketState = marketByServerId[marketServerId];

  return {
    ...base,
    ...session,
    registration: normalizePreviewRegistration(session?.registration),
    inventory: {
      ...base.inventory,
      ...(session?.inventory || {}),
      weapons: { ...base.inventory.weapons, ...(session?.inventory?.weapons || {}) },
      materials: mergedMaterials,
      drugs: { ...base.inventory.drugs, ...(session?.inventory?.drugs || {}) },
      factorySupplies: undefined
    },
    economy: { ...base.economy, ...(session?.economy || {}) },
    gang: {
      ...base.gang,
      ...(session?.gang || {}),
      members: Number.parseInt(String(session?.gang?.members ?? base.gang.members), 10) || base.gang.members,
      influence: Math.max(0, Number.parseInt(String(session?.gang?.influence ?? base.gang.influence), 10) || 0),
      heat: Math.max(0, Number.parseInt(String(session?.gang?.heat ?? base.gang.heat), 10) || 0),
      policeRaidProtectionUntil: Math.max(0, Number(session?.gang?.policeRaidProtectionUntil || 0) || 0),
      autoPoliceNextActionAt: Math.max(0, Number(session?.gang?.autoPoliceNextActionAt || 0) || 0),
      heatJournal: Array.isArray(session?.gang?.heatJournal)
        ? session.gang.heatJournal.filter((entry) => entry && typeof entry === "object")
        : [],
      dirtyHeatReductionTimestamps: Array.isArray(session?.gang?.dirtyHeatReductionTimestamps)
        ? session.gang.dirtyHeatReductionTimestamps.map((entry) => Number(entry)).filter(Number.isFinite)
        : [],
      lastHeatDecayAt: typeof session?.gang?.lastHeatDecayAt === "string" && session.gang.lastHeatDecayAt
        ? session.gang.lastHeatDecayAt
        : base.gang.lastHeatDecayAt
    },
    playerBoosts: normalizeLocalPlayerBoostState(session?.playerBoosts),
    missions: {
      ...base.missions,
      ...(session?.missions || {}),
      attackOrders: Array.isArray(session?.missions?.attackOrders) ? session.missions.attackOrders : [],
      occupyOrders: Array.isArray(session?.missions?.occupyOrders) ? session.missions.occupyOrders : [],
      robberyOrders: Array.isArray(session?.missions?.robberyOrders) ? session.missions.robberyOrders : [],
      spy: {
        ...base.missions.spy,
        ...(session?.missions?.spy || {}),
        missions: Array.isArray(session?.missions?.spy?.missions) ? session.missions.spy.missions : []
      },
      spyIntel: {
        ...base.missions.spyIntel,
        ...(session?.missions?.spyIntel || {}),
        occupiableDistrictIds: Array.isArray(session?.missions?.spyIntel?.occupiableDistrictIds)
          ? session.missions.spyIntel.occupiableDistrictIds
          : [],
        revealedTypeDistrictIds: Array.isArray(session?.missions?.spyIntel?.revealedTypeDistrictIds)
          ? session.missions.spyIntel.revealedTypeDistrictIds
          : [],
        revealedDefenseDistrictIds: Array.isArray(session?.missions?.spyIntel?.revealedDefenseDistrictIds)
          ? session.missions.spyIntel.revealedDefenseDistrictIds
          : []
      }
    },
    production: {
      ...base.production,
      ...(session?.production || {}),
      jobs: migrateLegacyFactoryJobs(session),
      streetDealers: {
        slots: Array.isArray(session?.production?.streetDealers?.slots)
          ? session.production.streetDealers.slots
          : []
      },
      buildings: session?.production?.buildings && typeof session.production.buildings === "object"
        ? {
            ...createDefaultProductionBuildingsState(),
            ...session.production.buildings
          }
        : createDefaultProductionBuildingsState(),
      factory: undefined
    },
    world: {
      ...(base.world || {}),
      ...(session?.world || {}),
      ownedDistrictIds: Array.isArray(session?.world?.ownedDistrictIds) ? session.world.ownedDistrictIds : [],
      phaseState: session?.world?.phaseState && typeof session.world.phaseState === "object"
        ? {
            ...base.world.phaseState,
            ...session.world.phaseState
          }
        : { ...base.world.phaseState },
      destroyedDistrictIds: Array.isArray(session?.world?.destroyedDistrictIds) ? session.world.destroyedDistrictIds : [],
      districtDefenseById: session?.world?.districtDefenseById && typeof session.world.districtDefenseById === "object"
        ? session.world.districtDefenseById
        : {},
      districtDefenseLoadoutById: session?.world?.districtDefenseLoadoutById && typeof session.world.districtDefenseLoadoutById === "object"
        ? session.world.districtDefenseLoadoutById
        : {},
      districtDefenseResidentsById: session?.world?.districtDefenseResidentsById && typeof session.world.districtDefenseResidentsById === "object"
        ? session.world.districtDefenseResidentsById
        : {},
      districtTrapById: session?.world?.districtTrapById && typeof session.world.districtTrapById === "object"
        ? session.world.districtTrapById
        : {},
      districtGossipById: session?.world?.districtGossipById && typeof session.world.districtGossipById === "object"
        ? session.world.districtGossipById
        : {},
      districtPoliceActionById: session?.world?.districtPoliceActionById && typeof session.world.districtPoliceActionById === "object"
        ? session.world.districtPoliceActionById
        : {}
    },
    market: activeMarketState,
    marketByServerId
  };
}

function normalizePreviewRegistration(registration) {
  if (!registration || typeof registration !== "object") {
    return null;
  }

  const { password, ...safeRegistration } = registration;
  return safeRegistration;
}

export function hasServerAuthority() {
  return Boolean(window.empireStreetsServerState?.session || window.empireStreetsServerSession);
}

export function getStoredPreviewSession() {
  const storedSession = loadState(null, null);
  if (!storedSession) {
    return createDefaultPreviewSession();
  }

  return normalizePreviewSession(storedSession);
}

export function setStoredPreviewSession(session) {
  if (hasServerAuthority()) {
    return;
  }

  saveState(null, null, normalizePreviewSession(session));
}

export function updateStoredPreviewSession(updater) {
  const currentSession = getStoredPreviewSession();
  const nextSession = normalizePreviewSession(updater(currentSession));
  setStoredPreviewSession(nextSession);
  return nextSession;
}

export function getAuthoritySession() {
  const serverSession = window.empireStreetsServerState?.session || window.empireStreetsServerSession;

  if (serverSession && typeof serverSession === "object") {
    return normalizePreviewSession(serverSession);
  }

  return getStoredPreviewSession();
}
