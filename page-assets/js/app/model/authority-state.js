import { MAX_SPIES, DEFAULT_GANG_MEMBERS } from "../../../../packages/game-config/src/legacy-page/combat-config.js";
import {
  DEFAULT_DRUG_INVENTORY,
  FACTORY_RESOURCE_KEYS,
  FACTORY_SLOT_CONFIG,
  FACTORY_SLOT_STORAGE_CAP,
  DEFAULT_MATERIAL_INVENTORY,
  DEFAULT_WEAPON_INVENTORY,
  getMarketPriceKey,
  MARKET_PRICE_REFRESH_MS,
  MARKET_TAB_CONFIG
} from "../../../../packages/game-config/src/legacy-page/economy-config.js";
import { FACTION_CATALOG } from "../../../../packages/game-config/src/legacy-page/faction-config.js";

// Browser preview-state bridge for the legacy static frontend.
// Server-fed sessions take precedence; localStorage writes are ignored when server
// authority is present.

const SESSION_STORAGE_KEY = "empireStreets.session.v1";
const DEFAULT_MARKET_SERVER_ID = "preview-server";

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
    boosts: {
      active: null
    },
    updatedAt: now
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

export function createDefaultPreviewSession(factionId = "mafian") {
  const faction = FACTION_CATALOG[factionId] || FACTION_CATALOG.mafian;
  const market = createDefaultMarketState();

  return {
    registration: null,
    inventory: {
      weapons: { ...DEFAULT_WEAPON_INVENTORY },
      materials: { ...DEFAULT_MATERIAL_INVENTORY },
      drugs: { ...DEFAULT_DRUG_INVENTORY },
      factorySupplies: createDefaultFactoryResources()
    },
    economy: {
      cleanMoney: faction.startingPackage.cleanMoney,
      dirtyMoney: faction.startingPackage.dirtyMoney
    },
    gang: {
      members: DEFAULT_GANG_MEMBERS,
      influence: faction.startingPackage.influence,
      heat: faction.startingPackage.heat,
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
      factory: createDefaultFactoryState(),
      buildings: createDefaultProductionBuildingsState()
    },
    world: {
      ownedDistrictIds: [],
      phaseState: {
        mapPhase: "night",
        gamePhase: "live",
        cityMinutes: 22 * 60 + 14
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
  mergedMaterials["metal-parts"] = 0;
  mergedMaterials["tech-core"] = 0;
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
      factorySupplies: mergedFactorySupplies
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
      jobs: session?.production?.jobs && typeof session.production.jobs === "object" ? session.production.jobs : {},
      buildings: session?.production?.buildings && typeof session.production.buildings === "object"
        ? {
            ...createDefaultProductionBuildingsState(),
            ...session.production.buildings
          }
        : createDefaultProductionBuildingsState(),
      factory: session?.production?.factory && typeof session.production.factory === "object"
        ? {
            ...createDefaultFactoryState(),
            ...session.production.factory,
            resources: {
              ...createDefaultFactoryResources(),
              ...(session.production.factory.resources || {})
            },
            boosts: session.production.factory.boosts && typeof session.production.factory.boosts === "object"
              ? {
                  active: session.production.factory.boosts.active || null
                }
              : {
                  active: null
                },
            slots: Array.isArray(session.production.factory.slots)
              ? session.production.factory.slots
              : createDefaultFactorySlots()
          }
        : createDefaultFactoryState()
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
  try {
    const rawValue = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return rawValue ? normalizePreviewSession(JSON.parse(rawValue)) : createDefaultPreviewSession();
  } catch {
    return createDefaultPreviewSession();
  }
}

export function setStoredPreviewSession(session) {
  if (hasServerAuthority()) {
    return;
  }

  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(normalizePreviewSession(session)));
  } catch {
    // Preview mode only.
  }
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
