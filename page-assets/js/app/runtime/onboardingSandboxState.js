export const ONBOARDING_SANDBOX_MODE = "onboarding";
export const ONBOARDING_HOME_DISTRICT_ID = 1;
export const ONBOARDING_SPY_CAPACITY = 1;

function safeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function createZeroAmountMap(...sources) {
  return Object.fromEntries(
    sources.flatMap((source) => Object.keys(safeObject(source))).map((key) => [key, 0])
  );
}

export function createOnboardingSandboxSession(sourceSession = {}, defaults = {}) {
  const source = safeObject(sourceSession);
  const sourceInventory = safeObject(source.inventory);
  const registration = source.registration && typeof source.registration === "object"
    ? {
        ...source.registration,
        preferredStartDistrictId: ONBOARDING_HOME_DISTRICT_ID,
        startDistrictId: ONBOARDING_HOME_DISTRICT_ID
      }
    : source.registration || null;

  return {
    ...source,
    registration,
    inventory: {
      ...sourceInventory,
      weapons: createZeroAmountMap(defaults.weaponInventory, sourceInventory.weapons),
      materials: createZeroAmountMap(defaults.materialInventory, sourceInventory.materials),
      drugs: createZeroAmountMap(defaults.drugInventory, sourceInventory.drugs),
      factorySupplies: createZeroAmountMap(sourceInventory.factorySupplies)
    },
    economy: {
      cleanMoney: 0,
      dirtyMoney: 0
    },
    gang: {
      ...safeObject(source.gang),
      members: 0,
      influence: 0,
      heat: 0,
      alliance: null,
      allianceId: null,
      activeAllianceId: null,
      policeRaidProtectionUntil: 0,
      autoPoliceNextActionAt: 0,
      heatJournal: [],
      dirtyHeatReductionTimestamps: []
    },
    allianceBoard: {
      maxAllianceSize: Math.max(1, Number(source.allianceBoard?.maxAllianceSize || 4) || 4),
      currentPlayerId: String(source.allianceBoard?.currentPlayerId || source.registration?.playerId || "1"),
      activeAlliance: null,
      allianceBadgesByPlayerId: {},
      publicAlliances: [],
      incomingInvites: [],
      eligibleInviteTargets: [],
      canCreateAlliance: false,
      createDisabledReason: "ONBOARDING_NO_ALLIANCE"
    },
    missions: {
      attackOrders: [],
      occupyOrders: [],
      robberyOrders: [],
      spy: {
        available: ONBOARDING_SPY_CAPACITY,
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
      buildings: {},
      streetDealers: { slots: [] }
    },
    playerBoosts: null,
    streetNewsFeed: [],
    world: {
      ownedDistrictIds: [ONBOARDING_HOME_DISTRICT_ID],
      phaseState: {
        ...safeObject(source.world?.phaseState),
        gamePhase: "live"
      },
      destroyedDistrictIds: [],
      districtOwnerById: {},
      ownerByDistrictId: {},
      districtDefenseById: {},
      districtDefenseLoadoutById: {},
      districtDefenseResidentsById: {},
      districtTrapById: {},
      districtGossipById: {},
      districtPoliceActionById: {},
      devOnlyScenarioDestroyedDistrictId: null
    }
  };
}
