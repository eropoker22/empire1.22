import {
  resolveServerDistrictBuilding,
  toCanonicalServerDistrictId
} from "./serverDistrictSelectionCoordinator.js";
import {
  ARCADE_BASE_AUDIT_RISK_PCT,
  ARCADE_BASE_LAUNDERING_CAPACITY,
  DISTRICT_BUILDING_DETAIL_PROFILES,
  DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES
} from "./buildingDetailData.js";
import { createBuildingDetailViewModel } from "./buildingDetailViewModel.js";
import {
  pickBuildingDetailPresentationViewModel,
  resolveBuildingPresentationDefinition
} from "./buildingPresentationContract.js";
import {
  formatDistrictBuildingCooldown,
  formatDistrictBuildingMoney
} from "./formatters.js";
import { createServerBuildingActionDefaultPayload } from "./buildingSpecialActionServerDefaults.js";

const normalizeName = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/gu, " ")
  .trim();

const findLocalPresentationBuilding = (localBuildings, serverBuilding) => {
  const canonicalPresentation = resolveBuildingPresentationDefinition(serverBuilding?.buildingTypeId);
  const serverNames = [
    serverBuilding?.buildingTypeId,
    serverBuilding?.label,
    serverBuilding?.displayName,
    serverBuilding?.variantName,
    canonicalPresentation?.baseName
  ].map(normalizeName).filter(Boolean);
  return localBuildings.find((building) => {
    const localNames = [
      building?.baseName,
      building?.displayName,
      building?.variantName
    ].map(normalizeName).filter(Boolean);
    return localNames.some((name) => serverNames.includes(name));
  }) || null;
};

const normalizeServerBuildingTypeId = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/gu, "-")
  .replace(/^-+|-+$/gu, "");

const resolveServerBuildingMechanicsType = (buildingTypeId) => {
  const normalizedTypeId = normalizeServerBuildingTypeId(buildingTypeId);
  return resolveBuildingPresentationDefinition(buildingTypeId)?.mechanicsType || normalizedTypeId;
};

const SERVER_ACTION_BUTTON_COST_TYPES = new Set([
  "casino",
  "power-plant",
  "recycling-center",
  "smuggling-tunnel"
]);

const normalizeStatLabel = (value) => normalizeName(value).replace(/\s+/gu, " ");

const createStatMap = (stats = []) => new Map(
  (Array.isArray(stats) ? stats : [])
    .filter((entry) => entry?.label)
    .map((entry) => [normalizeStatLabel(entry.label), String(entry.value ?? "").trim()])
);

const resolveServerStats = (building, panelBuilding) => (
  Array.isArray(panelBuilding?.stats) && panelBuilding.stats.length > 0
    ? panelBuilding.stats
    : Array.isArray(building?.stats)
      ? building.stats
      : []
);

const parseLastNumber = (value, fallback = 0) => {
  const matches = String(value ?? "")
    .replace(/,/gu, ".")
    .match(/-?\d+(?:\.\d+)?/gu);
  const parsed = Number(matches?.at?.(-1));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseFirstNumber = (value, fallback = 0) => {
  const match = String(value ?? "")
    .replace(/,/gu, ".")
    .match(/-?\d+(?:\.\d+)?/u);
  const parsed = Number(match?.[0]);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveProjectedNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return value !== null && value !== undefined && Number.isFinite(parsed)
    ? Math.max(0, parsed)
    : fallback;
};

const resolveProjectedMultiplier = (value, fallback = 1) => {
  const parsed = Number(value);
  return value !== null && value !== undefined && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : fallback;
};

export const createWarehouseStorageCompatibilityView = (storage) => {
  if (!storage?.warehouseSummary || !Array.isArray(storage.groups)) {
    return { capacity: null, usage: null, warnings: [] };
  }
  const groups = {};
  const byResource = {};
  const usageByResource = {};
  let hasNearCapacityItem = false;
  let hasFullItem = false;
  for (const group of storage.groups) {
    const groupId = String(group?.id || "");
    if (groupId) {
      groups[groupId] = resolveProjectedNumber(group?.currentCapacity, 0);
    }
    for (const item of Array.isArray(group?.items) ? group.items : []) {
      const resourceKey = String(item?.resourceKey || "");
      if (!resourceKey) continue;
      byResource[resourceKey] = resolveProjectedNumber(item?.maxAmount, 0);
      usageByResource[resourceKey] = resolveProjectedNumber(item?.currentAmount, 0);
      hasNearCapacityItem = hasNearCapacityItem || item?.isNearCapacity === true;
      hasFullItem = hasFullItem || item?.isFull === true || item?.isOverCapacity === true;
    }
  }
  const capacity = {
    groups,
    byResource,
    bulk: resolveProjectedNumber(groups.bulk, 0),
    tactical: resolveProjectedNumber(groups.tactical, 0),
    strategic: resolveProjectedNumber(groups.strategic, 0)
  };
  return {
    capacity,
    usage: { byResource: usageByResource, capacity },
    warnings: [
      hasNearCapacityItem && !hasFullItem ? "Některá položka v globálním SKLADU se blíží maximu." : "",
      hasFullItem ? "Některá položka v globálním SKLADU je plná." : "",
      hasNearCapacityItem || hasFullItem ? "Získej další Skladiště nebo spotřebuj konkrétní položku." : ""
    ].filter(Boolean)
  };
};

const resolveStatValue = (statMap, labels = [], fallback = "") => {
  for (const label of labels) {
    const value = statMap.get(normalizeStatLabel(label));
    if (value !== undefined) return value;
  }
  return fallback;
};

const resolveRate = (statMap, {
  hourlyLabels = [],
  minuteLabels = [],
  fallback = 0
} = {}) => {
  const hourlyValue = resolveStatValue(statMap, hourlyLabels, "");
  if (hourlyValue) return parseFirstNumber(hourlyValue, fallback);
  const minuteValue = resolveStatValue(statMap, minuteLabels, "");
  if (minuteValue) return parseFirstNumber(minuteValue, fallback) * 60;
  return fallback;
};

const resolveDailyRate = (statMap, {
  dailyLabels = [],
  minuteLabels = [],
  fallback = 0
} = {}) => {
  const dailyValue = resolveStatValue(statMap, dailyLabels, "");
  if (dailyValue) return parseFirstNumber(dailyValue, fallback);
  const minuteValue = resolveStatValue(statMap, minuteLabels, "");
  if (minuteValue) return parseFirstNumber(minuteValue, fallback) * 60 * 24;
  return fallback;
};

const formatDisplayNumber = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "0";
  return String(Number(numericValue.toFixed(2)));
};

const resolveDemoDetailProfile = ({ baseName, localBuilding, building, panelBuilding }) => {
  const canonicalPresentation = resolveBuildingPresentationDefinition(building?.buildingTypeId);
  const lookupKeys = [
    baseName,
    localBuilding?.baseName,
    building?.label,
    building?.buildingTypeId,
    panelBuilding?.typeLabel,
    canonicalPresentation?.baseName
  ].map(normalizeName).filter(Boolean);
  return lookupKeys
    .map((key) => DISTRICT_BUILDING_DETAIL_PROFILES[key])
    .find(Boolean)
    || null;
};

const createServerMechanicsInput = ({
  building,
  mechanicsPresentation,
  mechanicsType,
  ownedCount,
  passiveStats,
  storageSummary,
  stats
}) => {
  const statMap = createStatMap(stats);
  const projectedClinic = mechanicsPresentation?.clinic;
  const projectedExchange = mechanicsPresentation?.exchange;
  const projectedWarehouse = mechanicsPresentation?.warehouse;
  const serverStorageSummary = mechanicsType === "warehouse"
    && projectedWarehouse
    && storageSummary?.warehouseSummary
    && Array.isArray(storageSummary?.groups)
    ? storageSummary
    : null;
  const warehouseStorage = createWarehouseStorageCompatibilityView(serverStorageSummary);
  const resolvePassiveStat = (key, fallback) => {
    const value = passiveStats?.[key];
    const parsed = Number(value);
    return value !== null && value !== undefined && Number.isFinite(parsed)
      ? Math.max(0, parsed)
      : fallback;
  };
  const cleanHourly = resolvePassiveStat("cleanPerHour", resolveRate(statMap, {
    hourlyLabels: ["Clean / h", "Čisté / hod"],
    minuteLabels: ["Clean / min", "Čisté / min"]
  }));
  const dirtyHourly = resolvePassiveStat("dirtyPerHour", resolveRate(statMap, {
    hourlyLabels: ["Dirty / h", "Špinavé / hod"],
    minuteLabels: ["Dirty / min", "Špinavé / min"]
  }));
  const dailyHeat = resolvePassiveStat("heatPerDay", resolveDailyRate(statMap, {
    dailyLabels: ["Heat / day", "Heat / den"],
    minuteLabels: ["Heat / min"]
  }));
  const dailyInfluence = resolvePassiveStat("influencePerDay", resolveDailyRate(statMap, {
    dailyLabels: ["Influence / day", "Vliv / den"],
    minuteLabels: ["Influence / min", "Vliv / min"]
  }));
  const parsedOwnedCount = Number(ownedCount);
  const ownedBuildingCount = ownedCount !== null
    && ownedCount !== undefined
    && Number.isFinite(parsedOwnedCount)
    ? Math.max(0, Math.floor(parsedOwnedCount))
    : null;
  const authoritativeOwnedBuildingCount = mechanicsType === "warehouse"
    && Number.isFinite(Number(serverStorageSummary?.warehouseSummary?.ownedWarehouseCount))
    ? Math.max(0, Math.floor(Number(serverStorageSummary.warehouseSummary.ownedWarehouseCount)))
    : ownedBuildingCount;
  const networkBonus = (...labels) => {
    const value = parseLastNumber(resolveStatValue(statMap, labels, "0"), 0);
    return 1 + value / 100;
  };
  const recyclingSalvageRatePct = Math.max(0, parseLastNumber(
    resolveStatValue(statMap, ["Návrat itemů"], "0"),
    0
  ));
  const smugglingDealerSupplyBonusPct = Math.max(0, parseLastNumber(
    resolveStatValue(statMap, ["Podpora Pouličních dealerů"], "0"),
    0
  ));
  const garageCooldownReductionPct = Math.abs(parseLastNumber(
    resolveStatValue(statMap, ["Zkrácení čekání", "Cooldowny"], "0"),
    0
  ));
  const projectedPopulationBuffer = building?.presentation?.populationBuffer;
  const hasProjectedPopulationBuffer = projectedPopulationBuffer
    && Number.isFinite(Number(projectedPopulationBuffer.storedAmount))
    && Number.isFinite(Number(projectedPopulationBuffer.capacity))
    && Number.isFinite(Number(projectedPopulationBuffer.productionPerMinute))
    && Number.isFinite(Number(projectedPopulationBuffer.timeToFullMs));
  const localBuffer = resolveStatValue(statMap, [
    "Lokální zásobník",
    "Obyvatelé",
    "Populace"
  ], "0/0");
  const [statLocalBufferAmount, statLocalBufferCapacity] = String(localBuffer)
    .split("/")
    .map((value) => Math.max(0, parseLastNumber(value, 0)));
  const preciseLocalBufferAmount = hasProjectedPopulationBuffer
    ? Math.max(0, Number(projectedPopulationBuffer.storedAmount))
    : statLocalBufferAmount;
  const localBufferAmount = Math.floor(preciseLocalBufferAmount);
  const localBufferCapacity = hasProjectedPopulationBuffer
    ? Math.max(0, Number(projectedPopulationBuffer.capacity))
    : statLocalBufferCapacity;
  const localBufferUnit = mechanicsType === "school" ? " členů" : " obyvatel";
  const localBufferLabel = hasProjectedPopulationBuffer
    ? `${localBufferAmount}/${localBufferCapacity}${localBufferUnit}`
    : String(localBuffer);
  const count = Number.isFinite(authoritativeOwnedBuildingCount)
    ? authoritativeOwnedBuildingCount
    : mechanicsType === "arcade"
      ? 1
      : 0;
  const actionById = new Map(
    (Array.isArray(building?.actions) ? building.actions : [])
      .map((action) => [String(action?.actionId || ""), action])
      .filter(([actionId]) => Boolean(actionId))
  );
  const populationAction = actionById.get(
    mechanicsType === "convenience-store"
      ? "collect_convenience_store_population"
      : mechanicsType === "school"
        ? "collect_school_population"
      : "collect_population"
  );
  const hasManualCollect = mechanicsType === "apartment-block"
    || mechanicsType === "convenience-store"
    || mechanicsType === "school";
  const populationPerMinute = hasProjectedPopulationBuffer
    ? Math.max(0, Number(projectedPopulationBuffer.productionPerMinute))
    : parseFirstNumber(
        resolveStatValue(statMap, ["Populace / min", "Population / min"], "0"),
        0
      );
  const isLocalBufferFull = localBufferCapacity > 0 && localBufferAmount >= localBufferCapacity;
  const localBufferTimeToFullMs = hasProjectedPopulationBuffer
    ? Math.max(0, Number(projectedPopulationBuffer.timeToFullMs))
    : 0;

  return {
    mechanicsType,
    level: Math.max(1, Number(building?.level || 1)),
    maxLevel: Math.max(1, Number(building?.maxLevel || 1)),
    nextLevel: Number(building?.level || 1) < Number(building?.maxLevel || 1)
      ? Number(building?.level || 1) + 1
      : null,
    upgradeCostLabel: "",
    cleanHourly,
    dirtyHourly,
    dailyHeat,
    dailyInfluence,
    ownedBuildingCount: authoritativeOwnedBuildingCount,
    ownedApartmentBlocks: count,
    ownedArcades: count,
    ownedAutoSalons: count,
    ownedClinics: count,
    ownedConvenienceStores: count,
    ownedExchangeOffices: count,
    ownedFitnessClubs: count,
    ownedGarages: count,
    ownedPowerStations: count,
    ownedRecruitmentCenters: count,
    ownedRecyclingCenters: count,
    ownedRestaurants: count,
    ownedSchools: count,
    ownedShoppingMalls: count,
    ownedSmugglingTunnels: count,
    ownedWarehouses: serverStorageSummary?.warehouseSummary?.ownedWarehouseCount ?? count,
    hasManualCollect,
    canCollect: populationAction?.enabled === true,
    storedOutputLabel: localBufferLabel,
    effectsLabel: [
      cleanHourly > 0 ? `Clean cash +${formatDistrictBuildingMoney(cleanHourly)}/hod` : "",
      dirtyHourly > 0 ? `Dirty cash +${formatDistrictBuildingMoney(dirtyHourly)}/hod` : "",
      mechanicsType === "apartment-block" ? `Populace +${populationPerMinute.toFixed(2)}/min` : "",
      mechanicsType === "convenience-store" ? `Populace +${populationPerMinute.toFixed(2)}/min` : "",
      mechanicsType === "school" ? `Populace +${populationPerMinute.toFixed(2)}/min` : "",
      mechanicsType === "smuggling-tunnel" ? `Pouliční dealeři +${smugglingDealerSupplyBonusPct}% z pašovacích tunelů` : "",
      mechanicsType === "garage" ? `Cooldowny -${garageCooldownReductionPct}%` : "",
      mechanicsType === "apartment-block" && isLocalBufferFull
        ? "Plná kapacita · Bytový blok je plný. Obyvatelé čekají na vybrání."
        : "",
      mechanicsType === "convenience-store" && isLocalBufferFull
        ? "Plná kapacita · Večerka je plná. Obyvatelé čekají na vybrání."
        : "",
      mechanicsType === "school" && isLocalBufferFull
        ? "Plná kapacita · Škola má naplněnou lokální populační kapacitu."
        : "",
      ...warehouseStorage.warnings,
      dailyHeat > 0 ? `Heat +${formatDisplayNumber(dailyHeat)}/den` : "",
      dailyInfluence > 0 ? `Vliv +${formatDisplayNumber(dailyInfluence)}/den` : ""
    ].filter(Boolean).join(" · ") || "Žádné aktivní mechaniky.",
    actionCooldowns: { ...(building?.actionCooldowns || {}) },
    apartmentWholePopulation: localBufferAmount,
    apartmentStoredPopulation: localBufferAmount,
    apartmentCapacity: localBufferCapacity,
    apartmentPopulationPerMinute: populationPerMinute,
    apartmentIsFull: isLocalBufferFull,
    apartmentTimeToFullMs: localBufferTimeToFullMs,
    apartmentNetwork: {
      populationProductionMultiplier: networkBonus("Produkce bytů"),
      capacityMultiplier: networkBonus("Kapacita bytů")
    },
    schoolApartmentBoostActive: false,
    schoolApartmentBoostRemainingMs: 0,
    schoolApartmentBoostPct: 0,
    schoolWholeStudents: localBufferAmount,
    schoolStoredStudents: localBufferAmount,
    schoolCapacity: localBufferCapacity,
    schoolPopulationPerMinute: populationPerMinute,
    schoolIsFull: isLocalBufferFull,
    schoolTimeToFullMs: localBufferTimeToFullMs,
    schoolEveningCourseActive: false,
    schoolEveningCourseRemainingMs: 0,
    schoolNetwork: {
      populationProductionMultiplier: networkBonus("Produkce"),
      studentCapacityMultiplier: networkBonus("Kapacita"),
      incomeMultiplier: networkBonus("Income")
    },
    clinicRecoveryPool: projectedClinic?.recoveryPool
      ? {
          totalFreshAmount: resolveProjectedNumber(projectedClinic.recoveryPool.totalFreshAmount, 0),
          fresh: Array.isArray(projectedClinic.recoveryPool.fresh) ? projectedClinic.recoveryPool.fresh : []
        }
      : {
          totalFreshAmount: parseLastNumber(resolveStatValue(statMap, ["Recovery pool"], "0"), 0),
          fresh: []
        },
    clinicRecoveryRatePct: resolveProjectedNumber(
      projectedClinic?.recoveryRatePct,
      parseLastNumber(resolveStatValue(statMap, ["Recovery rate"], "0"), 0)
    ),
    clinicNetwork: {
      incomeMultiplier: resolveProjectedMultiplier(projectedClinic?.network?.incomeMultiplier, networkBonus("Income")),
      heatMultiplier: resolveProjectedMultiplier(projectedClinic?.network?.heatMultiplier, networkBonus("Heat sítě"))
    },
    garageSupport: {
      cooldownReductionPct: garageCooldownReductionPct
    },
    garageNetwork: {
      incomeMultiplier: networkBonus("Income"),
      heatMultiplier: 1
    },
    shoppingMallMarketDiscount: {
      discountPct: Math.abs(parseLastNumber(resolveStatValue(statMap, [
        "Běžný market",
        "Market sleva"
      ], "0"), 0)),
      feeReductionPct: Math.abs(parseLastNumber(resolveStatValue(statMap, [
        "Market poplatek",
        "Market fee"
      ], "0"), 0))
    },
    shoppingMallBlackMarketDiscount: {
      discountPct: Math.abs(parseLastNumber(resolveStatValue(statMap, [
        "Černý market",
        "Black market sleva"
      ], "0"), 0))
    },
    shoppingMallNetwork: {
      cleanIncomeMultiplier: networkBonus("Clean výnos"),
      dirtyIncomeMultiplier: networkBonus("Dirty výnos"),
      influenceMultiplier: networkBonus("Vliv"),
      heatMultiplier: 1
    },
    autoSalonSupport: {
      cooldownReductionPct: Math.abs(parseLastNumber(resolveStatValue(statMap, ["Zkrácení čekání", "Cooldown"], "0"), 0)),
      escapeChanceBonusPct: parseLastNumber(resolveStatValue(statMap, ["Šance úniku", "Únik"], "0"), 0),
      combinedGarageDealerMaxReductionPct: Math.abs(parseLastNumber(resolveStatValue(statMap, [
        "Cap garáž + autosalon",
        "Strop čekání"
      ], "0"), 0))
    },
    autoSalonNetwork: {
      cleanIncomeMultiplier: networkBonus("Clean výnos"),
      dirtyIncomeMultiplier: networkBonus("Dirty výnos"),
      heatMultiplier: 1
    },
    restaurantNetwork: {
      incomeMultiplier: networkBonus("Income"),
      influenceMultiplier: networkBonus("Vliv"),
      rumorMultiplier: networkBonus("Drby"),
      heatMultiplier: 1
    },
    fitnessClubNetwork: {
      incomeMultiplier: networkBonus("Income"),
      heatMultiplier: 1
    },
    fitnessClubSupport: {
      attackStrengthBonusPct: parseLastNumber(resolveStatValue(statMap, ["Síla útoku", "Útok"], "0"), 0),
      defenseStrengthBonusPct: parseLastNumber(resolveStatValue(statMap, ["Síla obrany", "Obrana"], "0"), 0),
      combinedRecruitmentFitnessAttackCapPct: parseLastNumber(resolveStatValue(statMap, ["Cap útoku"], "0"), 0),
      combinedRecruitmentFitnessDefenseCapPct: parseLastNumber(resolveStatValue(statMap, ["Cap obrany"], "0"), 0)
    },
    recruitmentCenterNetwork: {
      incomeMultiplier: networkBonus("Income"),
      heatMultiplier: 1
    },
    recruitmentCenterSupport: {
      populationProductionBonusPct: parseLastNumber(resolveStatValue(statMap, ["Produkce bytů", "Population"], "0"), 0),
      apartmentCapacityBonusPct: parseLastNumber(resolveStatValue(statMap, ["Kapacita bytů"], "0"), 0),
      attackWeaponStrengthBonusPct: parseLastNumber(resolveStatValue(statMap, ["Síla útočných zbraní"], "0"), 0),
      defenseItemStrengthBonusPct: parseLastNumber(resolveStatValue(statMap, ["Síla obranných itemů"], "0"), 0),
      cameraStrengthBonusPct: parseLastNumber(resolveStatValue(statMap, ["Kamery/alarmy", "Kamery"], "0"), 0)
    },
    casinoLaunderingCapacity: parseLastNumber(resolveStatValue(statMap, ["Kapacita praní"], "0"), 0),
    casinoLaunderingFeePct: parseLastNumber(resolveStatValue(statMap, ["Poplatek"], "9"), 9),
    exchangeLaunderingCapacity: resolveProjectedNumber(
      projectedExchange?.launderingCapacity,
      parseLastNumber(resolveStatValue(statMap, ["Kapacita praní"], "0"), 0)
    ),
    exchangeAuditRisk: projectedExchange?.auditRiskPct !== null
      && projectedExchange?.auditRiskPct !== undefined
      && Number.isFinite(Number(projectedExchange.auditRiskPct))
      ? `${resolveProjectedNumber(projectedExchange.auditRiskPct, 0)} %`
      : resolveStatValue(statMap, ["Audit risk"], "0 %"),
    exchangeNetwork: {
      incomeMultiplier: resolveProjectedMultiplier(projectedExchange?.network?.incomeMultiplier, networkBonus("Income")),
      launderingLimitMultiplier: resolveProjectedMultiplier(projectedExchange?.network?.launderingLimitMultiplier, networkBonus("Limit praní")),
      heatMultiplier: resolveProjectedMultiplier(projectedExchange?.network?.heatMultiplier, networkBonus("Heat sítě"))
    },
    powerStationNetwork: {
      infrastructureBonusPct: parseLastNumber(resolveStatValue(statMap, ["Infrastruktura"], "0"), 0),
      incomeMultiplier: networkBonus("Síťový income"),
      heatMultiplier: 1,
      cameraStrengthBonusPct: parseLastNumber(resolveStatValue(statMap, ["Kamery"], "0"), 0),
      alarmStrengthBonusPct: parseLastNumber(resolveStatValue(statMap, ["Alarm"], "0"), 0)
    },
    powerStationBackupActive: false,
    powerStationBackupRemainingMs: 0,
    recyclingSalvagePool: { totalFreshAmount: 0, fresh: [] },
    recyclingSalvageRatePct,
    recyclingCenterNetwork: {
      incomeMultiplier: networkBonus("Síťový income", "Income"),
      heatMultiplier: 1
    },
    convenienceStoreWholePopulation: localBufferAmount,
    convenienceStoreStoredPopulation: localBufferAmount,
    convenienceStoreCapacity: localBufferCapacity,
    convenienceStorePopulationPerMinute: populationPerMinute,
    convenienceStoreIsFull: isLocalBufferFull,
    convenienceStoreTimeToFullMs: localBufferTimeToFullMs,
    streetDealerSaleView: building?.actions?.find?.(
      (action) => String(action?.actionId || "") === "start_drug_sale"
    )?.dealerSale || null,
    smugglingDealerSupplyBonusPct,
    smugglingTunnelNetwork: {
      dirtyProductionMultiplier: networkBonus("Dirty bonus sítě", "Dirty tok"),
      heatMultiplier: networkBonus("Heat bonus sítě")
    },
    smugglingOpenChannelActive: false,
    smugglingOpenChannelRemainingMs: 0,
    arcadeNetwork: {
      incomeMultiplier: networkBonus("Income"),
      launderingLimitMultiplier: 1,
      heatMultiplier: 1
    },
    arcadeLaunderingCapacity: parseLastNumber(
      resolveStatValue(
        statMap,
        ["Kapacita praní"],
        mechanicsType === "arcade" ? String(ARCADE_BASE_LAUNDERING_CAPACITY) : "0"
      ),
      mechanicsType === "arcade" ? ARCADE_BASE_LAUNDERING_CAPACITY : 0
    ),
    arcadeAuditRisk: resolveStatValue(
      statMap,
      ["Audit risk"],
      mechanicsType === "arcade" ? `${ARCADE_BASE_AUDIT_RISK_PCT} %` : "0 %"
    ),
    serverStorageSummary,
    warehouseNetwork: {
      incomeMultiplier: resolveProjectedMultiplier(projectedWarehouse?.network?.incomeMultiplier, networkBonus("Income")),
      storageCapacityMultiplier: resolveProjectedMultiplier(
        serverStorageSummary?.warehouseSummary?.totalCapacityMultiplier,
        resolveProjectedMultiplier(projectedWarehouse?.network?.storageCapacityMultiplier, networkBonus("Kapacita"))
      ),
      heatMultiplier: resolveProjectedMultiplier(projectedWarehouse?.network?.heatMultiplier, networkBonus("Heat sítě"))
    },
    warehouseCapacity: warehouseStorage.capacity,
    warehouseUsage: warehouseStorage.usage,
    warehouseWarnings: warehouseStorage.warnings
  };
};

const mergeServerActionEntries = ({
  building,
  panelBuilding,
  hasPendingCommand
}) => {
  const mergedById = new Map();
  const addEntries = (entries, authoritative = false) => {
    for (const entry of Array.isArray(entries) ? entries : []) {
      const actionId = String(entry?.actionId || "");
      if (!actionId) continue;
      const previous = mergedById.get(actionId) || {};
      mergedById.set(actionId, {
        ...previous,
        ...entry,
        ...(authoritative ? {
          enabled: entry?.enabled !== false,
          disabled: hasPendingCommand || entry?.enabled === false,
          disabledReason: hasPendingCommand
            ? "Akce se zpracovává."
            : String(entry?.disabledReason || entry?.blockedReason || entry?.phaseBlockedReason || "").trim()
        } : {})
      });
    }
  };
  addEntries(panelBuilding?.specialActions);
  addEntries(panelBuilding?.actions);
  addEntries(building?.specialActions);
  addEntries(building?.actions, true);
  return Array.from(mergedById.values());
};

const resolveActionCostRecord = (entry) => [
  entry?.effectiveInputCost,
  entry?.inputCost,
  entry?.cost
].find((value) => value && typeof value === "object" && !Array.isArray(value)) || null;

const formatActionResourceAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0";
  return Number.isInteger(amount)
    ? String(amount)
    : amount.toFixed(2).replace(/\.?0+$/u, "");
};

const formatActionCostRecord = (value) => Object.entries(value || {})
  .filter(([, amount]) => Number(amount || 0) > 0)
  .map(([key, amount]) => {
    const normalizedKey = String(key || "").trim().toLowerCase();
    if (normalizedKey === "cash" || normalizedKey === "clean-cash") {
      return `${formatDistrictBuildingMoney(amount)} clean cash`;
    }
    if (normalizedKey === "dirty-cash" || normalizedKey === "dirty_cash") {
      return `${formatDistrictBuildingMoney(amount)} dirty cash`;
    }
    if (normalizedKey === "influence") {
      return `${formatActionResourceAmount(amount)} vliv`;
    }
    return `${key} x${formatActionResourceAmount(amount)}`;
  })
  .join(" + ");

const formatActionOutputRecord = (value) => Object.entries(value || {})
  .filter(([, amount]) => Number(amount || 0) !== 0)
  .map(([key, amount]) => `${key} ${Number(amount) > 0 ? "+" : ""}${amount}`)
  .join(" · ");

const resolveActionSummary = (entry, primaryKey, fallbackKey) => {
  const primary = entry?.[primaryKey];
  if (Array.isArray(primary)) {
    return primary.filter(Boolean).join(" · ");
  }
  return String(primary || entry?.[fallbackKey] || "").trim();
};

const createServerBuildingActionPresentation = ({
  demoAction,
  entry,
  index,
  buildingTypeId,
  tickRateMs
}) => {
  const cooldownTicks = Math.max(0, Number(entry?.cooldownRemainingTicks || 0));
  const cooldownRemainingMs = Math.max(
    0,
    Number(entry?.cooldownRemainingMs || 0) || cooldownTicks * Math.max(1, Number(tickRateMs || 1))
  );
  const mechanicsType = resolveServerBuildingMechanicsType(buildingTypeId);
  const projectedDisabledReason = String(
    entry
      ? entry?.disabledReason
    || entry?.blockedReason
    || entry?.phaseBlockedReason
    || ""
      : "Akce teď není dostupná."
  ).trim();
  const disabledReason = mechanicsType === "recycling-center"
    && String(entry?.actionId || demoAction?.actionId || "") === "extract_losses"
    && normalizeName(projectedDisabledReason) === "nemas zadne itemove ztraty k vytezeni"
    ? "Nemáš žádné ztráty k vytěžení."
    : projectedDisabledReason;
  const actionCostRecord = resolveActionCostRecord(entry);
  const projectedInputSummary = resolveActionSummary(entry, "inputSummary", "");
  const costSummary = actionCostRecord
    ? formatActionCostRecord(actionCostRecord)
    : projectedInputSummary === "Zdarma"
      ? ""
      : projectedInputSummary;
  const serverRewardSummary = resolveActionSummary(entry, "outputSummary", "effectSummary")
    || resolveActionSummary(entry, "expectedEffectSummary", "reportText")
    || formatActionOutputRecord(entry?.effectiveOutputGain || entry?.outputGain);
  const effectiveCooldownMs = Math.max(
    0,
    Number(entry?.effectiveCooldownMs || entry?.cooldownMs || 0)
  );
  const cooldownLabel = cooldownRemainingMs > 0
    ? `Zbývá ${formatDistrictBuildingCooldown(cooldownRemainingMs)}`
    : effectiveCooldownMs > 0
      ? `Čekání ${formatDistrictBuildingCooldown(effectiveCooldownMs)}`
      : String(demoAction?.cooldownLabel || "Připraveno");

  return {
    ...(demoAction || {}),
    index,
    actionId: String(entry?.actionId || demoAction?.actionId || ""),
    buildingTypeId: String(buildingTypeId || ""),
    title: String(demoAction?.title || entry?.label || entry?.actionId || "Akce"),
    buttonCostLabel: SERVER_ACTION_BUTTON_COST_TYPES.has(mechanicsType)
      ? costSummary || String(demoAction?.buttonCostLabel || "")
      : "",
    rewardSummary: String(demoAction?.rewardSummary || serverRewardSummary || ""),
    cooldownLabel,
    cooldownRemainingMs,
    disabled: !entry || entry?.disabled === true || entry?.enabled === false || Boolean(disabledReason),
    disabledReason,
    phaseLockLabel: String(demoAction?.phaseLockLabel || (entry?.phaseBlockedReason ? entry?.phaseBadgeLabel : "") || ""),
    requiresInput: Array.isArray(demoAction?.requiresInput) ? demoAction.requiresInput.slice() : [],
    serverAction: {
      description: String(entry?.description || demoAction?.description || ""),
      requiredInputs: Array.isArray(entry?.requiresInput) ? entry.requiresInput.slice() : [],
      riskSummary: Array.isArray(entry?.riskSummary) ? entry.riskSummary.slice() : []
    },
    dealerSale: entry?.dealerSale || demoAction?.dealerSale || null
  };
};

const formatServerDistrictLabel = ({ district, serverDistrictId } = {}) => {
  const localDistrictId = String(district?.id ?? "").trim();
  const canonicalDistrictId = localDistrictId
    || String(serverDistrictId || "").trim().replace(/^district:/u, "");
  return canonicalDistrictId ? `District ${canonicalDistrictId}` : "";
};

export const resolveSharedBuildingBackgroundImagePath = ({
  canonicalBackgroundImagePath,
  presentationBackgroundImagePath
} = {}) => {
  const canonicalPath = String(canonicalBackgroundImagePath || "").trim();
  if (canonicalPath) return canonicalPath;
  const presentationPath = String(presentationBackgroundImagePath || "").trim();
  return presentationPath || null;
};

const createServerRequiredInputDefaults = (actionId, requiredInputs) => {
  const canonicalDefaults = createServerBuildingActionDefaultPayload(actionId);
  const defaults = {};
  for (const input of requiredInputs) {
    const inputId = String(input?.id || "").trim();
    if (!inputId) continue;
    if (canonicalDefaults[inputId] !== undefined && canonicalDefaults[inputId] !== null) {
      defaults[inputId] = canonicalDefaults[inputId];
      continue;
    }
    if (input?.type === "select") {
      const option = (Array.isArray(input.options) ? input.options : [])
        .find((candidate) => !candidate?.disabled && String(candidate?.value ?? "").trim());
      if (option) defaults[inputId] = String(option.value);
      continue;
    }
    if (input?.type === "number" && Number.isFinite(Number(input?.min))) {
      defaults[inputId] = Number(input.min);
    }
  }
  return defaults;
};

export const createServerBuildingActionExecutionPresentation = ({
  action,
  context,
  request
} = {}) => {
  const requiredInputs = Array.isArray(action?.serverAction?.requiredInputs)
    ? action.serverAction.requiredInputs
    : Array.isArray(action?.requiresInput)
      ? action.requiresInput
      : [];
  const disabledReason = String(action?.disabledReason || "").trim();
  const inputValues = {
    ...createServerRequiredInputDefaults(action?.actionId, requiredInputs),
    ...(request?.inputs && typeof request.inputs === "object" ? request.inputs : {})
  };

  return {
    inputValues,
    confirmation: {
      titleLabel: String(action?.title || "Akce"),
      buildingLabel: String(context?.displayName || context?.buildingName || "Budova"),
      districtLabel: formatServerDistrictLabel(context),
      description: String(action?.serverAction?.description || ""),
      costSummary: String(action?.buttonCostLabel || "Bez přímé ceny"),
      rewardSummary: String(action?.rewardSummary || "Výsledek akce"),
      inputSummary: String(action?.inputSummary || "").trim()
        || requiredInputs.map((input) => input?.label).filter(Boolean).join(" · "),
      riskSummary: Array.isArray(action?.serverAction?.riskSummary)
        ? action.serverAction.riskSummary.join(" · ")
        : "",
      cooldownLabel: String(action?.cooldownLabel || ""),
      disabledReason,
      canConfirm: !disabledReason
    }
  };
};

const createServerPhaseState = (readModel, actions = []) => {
  const phase = String(
    readModel?.player?.dayNight?.phaseId
    || readModel?.dayNight?.phaseId
    || actions.find((entry) => entry?.currentPhase)?.currentPhase
    || ""
  ).trim().toLowerCase();
  return {
    gamePhase: "live",
    mapPhase: phase === "day" ? "day" : "night"
  };
};

const createServerEconomyState = (readModel) => {
  const player = readModel?.player || {};
  const balances = player.resourceBalances && typeof player.resourceBalances === "object"
    ? player.resourceBalances
    : player.economy?.resources && typeof player.economy.resources === "object"
      ? player.economy.resources
      : {};
  return {
    cleanMoney: Math.max(0, Number(player.economy?.cleanCash ?? balances.cash ?? balances["clean-cash"] ?? 0)),
    dirtyMoney: Math.max(0, Number(player.economy?.dirtyCash ?? balances["dirty-cash"] ?? 0)),
    materials: { ...balances }
  };
};

const createServerBuildingDetailView = ({
  building,
  district,
  localBuilding,
  localProfile,
  readModel,
  renderState
}) => {
  const panelBuilding = renderState?.districtPanel?.buildings?.find?.(
    (entry) => String(entry?.buildingId || "") === String(building?.buildingId || "")
  ) || building;
  const uniqueActions = mergeServerActionEntries({
    building,
    panelBuilding,
    hasPendingCommand: renderState?.districtPanel?.hasPendingCommand === true
  });
  const tickRateMs = Math.max(1, Number(readModel?.mode?.tickRateMs || 1));
  const slot = renderState?.districtPanel?.slots?.find?.(
    (entry) => String(entry?.buildingId || "") === String(building?.buildingId || "")
  ) || null;
  const canonicalPresentation = resolveBuildingPresentationDefinition(building?.buildingTypeId);
  const displayName = String(
    localBuilding?.displayName
    || building?.displayName
    || building?.variantName
    || panelBuilding?.label
    || building?.label
    || localBuilding?.baseName
    || canonicalPresentation?.baseName
    || "Budova"
  ).trim();
  const baseName = String(
    localBuilding?.baseName
    || canonicalPresentation?.baseName
    || panelBuilding?.typeLabel
    || building?.label
    || displayName
  ).trim();
  const demoDetailProfile = resolveDemoDetailProfile({
    baseName,
    localBuilding,
    building,
    panelBuilding
  });
  const status = String(building?.status || panelBuilding?.status || "").trim();
  const level = Math.max(1, Number(building?.level || panelBuilding?.level || 1));
  const mechanicsType = resolveServerBuildingMechanicsType(building?.buildingTypeId);
  const serverStats = resolveServerStats(building, panelBuilding);
  const mechanicsInput = createServerMechanicsInput({
    building: {
      ...building,
      actions: uniqueActions
    },
    mechanicsPresentation: building?.presentation?.mechanics
      || panelBuilding?.presentation?.mechanics
      || null,
    mechanicsType,
    ownedCount: building?.presentation?.ownedCount
      ?? panelBuilding?.presentation?.ownedCount
      ?? null,
    passiveStats: building?.presentation?.passive
      || panelBuilding?.presentation?.passive
      || null,
    storageSummary: readModel?.player?.storage || null,
    stats: serverStats
  });
  const actionProfiles = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES[normalizeName(baseName)] || [];
  const profile = demoDetailProfile || {
    role: String(panelBuilding?.role || ""),
    info: String(panelBuilding?.info || ""),
    actions: []
  };
  const phaseState = createServerPhaseState(readModel, uniqueActions);
  const districtId = Number(String(district?.districtId || "").replace(/^district:/u, ""));
  const sharedViewModel = createBuildingDetailViewModel({
    district: {
      id: Number.isFinite(districtId) ? districtId : null,
      districtType: String(district?.zone || "")
    },
    buildingName: baseName,
    displayName,
    profile,
    mechanics: mechanicsInput,
    detailEntry: {
      actionCooldowns: {},
      activeEffects: []
    },
    buildingProfile: localProfile || {
      typeKey: String(district?.zone || ""),
      tier: ""
    },
    buildingBackgroundPath: localBuilding?.imagePath || null,
    economyState: createServerEconomyState(readModel),
    playerHeat: Math.max(0, Number(
      readModel?.player?.police?.heat
      ?? readModel?.police?.heat
      ?? readModel?.player?.heat
      ?? readModel?.player?.policeHeat
      ?? 0
    )),
    actionProfiles,
    phaseState
  });
  const authoritativeActionsById = new Map(
    uniqueActions.map((entry) => [String(entry?.actionId || ""), entry])
  );
  const actions = (Array.isArray(sharedViewModel.actions) ? sharedViewModel.actions : []).map(
    (demoAction, index) => createServerBuildingActionPresentation({
      demoAction,
      entry: authoritativeActionsById.get(String(demoAction?.actionId || "")) || null,
      index,
      buildingTypeId: building?.buildingTypeId,
      tickRateMs
    })
  );
  const canUpgrade = Number(building?.maxLevel || mechanicsInput.maxLevel || 1) > 1;
  const isOwnedByPlayer = district?.isOwnedByPlayer === true
    || String(district?.ownerPlayerId || "") === String(readModel?.player?.playerId || "");
  const collectAction = uniqueActions.find((entry) => (
    entry?.actionId === "collect_population"
    || entry?.actionId === "collect_convenience_store_population"
    || entry?.actionId === "collect_school_population"
  )) || null;
  const collectActionPresentation = collectAction
    ? createServerBuildingActionPresentation({
        demoAction: null,
        entry: collectAction,
        index: uniqueActions.indexOf(collectAction),
        buildingTypeId: building?.buildingTypeId,
        tickRateMs
      })
    : null;
  const canonicalUpgradeTitle = String(sharedViewModel.upgrade?.title || "")
    .replace(/\s+za\s*$/u, "")
    .trim();

  return {
    serverInstanceId: String(readModel?.server?.serverInstanceId || readModel?.player?.instanceId || ""),
    serverDistrictId: String(district?.districtId || ""),
    buildingId: String(building?.buildingId || ""),
    buildingTypeId: String(building?.buildingTypeId || ""),
    baseName,
    displayName,
    viewModel: pickBuildingDetailPresentationViewModel(sharedViewModel, {
      districtId: String(district?.districtId || ""),
      buildingId: String(building?.buildingId || ""),
      buildingTypeId: String(building?.buildingTypeId || ""),
      actions,
      collect: collectAction ? {
        ...sharedViewModel.collect,
        actionId: String(collectAction.actionId || ""),
        action: collectActionPresentation,
        buildingTypeId: String(building?.buildingTypeId || ""),
        enabled: collectAction.enabled === true,
        title: String(collectAction.disabledReason || sharedViewModel.collect?.title || "")
      } : slot?.production ? {
        visible: true,
        enabled: slot.production.canCollect === true,
        title: String(
          slot.production.collectDisabledReason
          || slot.production.storageLabel
          || ""
        )
      } : sharedViewModel.collect,
      upgrade: {
        ...sharedViewModel.upgrade,
        visible: isOwnedByPlayer && status !== "destroyed" && canUpgrade,
        disabled: !canUpgrade || level >= Number(building?.maxLevel || 1),
        title: canUpgrade
          ? canonicalUpgradeTitle || `Upgrade na L${level + 1}`
          : "Budova nemá další level."
      }
    })
  };
};

export class LocalDemoBuildingPresentationAdapter {
  constructor({ resolveDistrictBuildingProfile } = {}) {
    this.resolveDistrictBuildingProfile = resolveDistrictBuildingProfile;
  }

  getDistrictPresentation(district) {
    const profile = this.resolveDistrictBuildingProfile?.(district) || null;
    return {
      canonicalDistrictId: toCanonicalServerDistrictId(district),
      destroyed: null,
      intelKnown: null,
      isOwnedByPlayer: null,
      profile
    };
  }
}

export function isServerBuildingCollectReady(presentation) {
  return presentation?.viewModel?.collect?.visible === true
    && presentation.viewModel.collect.enabled === true;
}

export class ServerBuildingPresentationAdapter {
  constructor({ getReadModel, resolveDistrictBuildingProfile } = {}) {
    this.getReadModel = getReadModel;
    this.resolveDistrictBuildingProfile = resolveDistrictBuildingProfile;
  }

  getDistrictPresentation(district) {
    const canonicalDistrictId = toCanonicalServerDistrictId(district);
    const readModel = this.getReadModel?.() || null;
    const serverDistrict = [readModel?.district, ...(readModel?.ownedDistricts || [])]
      .find((candidate) => String(candidate?.districtId || "") === canonicalDistrictId) || null;
    if (!canonicalDistrictId || !serverDistrict) {
      return {
        canonicalDistrictId,
        destroyed: false,
        intelKnown: false,
        isOwnedByPlayer: false,
        profile: null,
        readModel: null
      };
    }

    const scopedReadModel = { ...readModel, district: serverDistrict };
    const localProfile = this.resolveDistrictBuildingProfile?.(district) || null;
    const localBuildings = Array.isArray(localProfile?.buildings) ? localProfile.buildings : [];
    const serverBuildings = Array.isArray(serverDistrict.buildings) ? serverDistrict.buildings : [];
    const profile = {
      ...(localProfile || {
        districtId: Number(district?.id || 0),
        districtLabel: `District ${district?.id || ""}`,
        typeKey: serverDistrict.zone || district?.districtType || "",
        typeLabel: serverDistrict.zone || district?.districtType || "",
        typeShortLabel: serverDistrict.zone || district?.districtType || "",
        setKey: "",
        setTitle: "",
        tier: ""
      }),
      buildings: serverBuildings.map((building) => {
        const localBuilding = findLocalPresentationBuilding(localBuildings, building);
        const baseName = String(building?.label || localBuilding?.baseName || building?.displayName || "Budova").trim();
        const displayName = String(localBuilding?.displayName || building?.displayName || baseName).trim();
        return {
          ...(localBuilding || {}),
          baseName,
          buildingId: String(building?.buildingId || ""),
          buildingTypeId: String(building?.buildingTypeId || ""),
          displayName,
          imagePath: localBuilding?.imagePath || null,
          level: Math.max(0, Number(building?.level || 0)),
          serverBuilding: building,
          status: String(building?.status || ""),
          variantName: building?.variantName || (displayName !== baseName ? displayName : null)
        };
      })
    };

    return {
      canonicalDistrictId,
      destroyed: serverDistrict.status === "destroyed",
      intelKnown: serverDistrict.intelKnown === true,
      isOwnedByPlayer: serverDistrict.isOwnedByPlayer === true
        || String(serverDistrict.ownerPlayerId || "") === String(readModel?.player?.playerId || ""),
      profile,
      readModel: scopedReadModel
    };
  }

  getBuilding(district, request) {
    const presentation = this.getDistrictPresentation(district);
    return presentation.readModel
      ? resolveServerDistrictBuilding(presentation.readModel, request)
      : null;
  }

  getBuildingDetailPresentation(district, request, { renderState } = {}) {
    const presentation = this.getDistrictPresentation(district);
    if (!presentation.readModel) {
      return null;
    }
    const building = resolveServerDistrictBuilding(presentation.readModel, request);
    if (!building) {
      return null;
    }
    const localProfile = this.resolveDistrictBuildingProfile?.(district) || null;
    const localBuilding = findLocalPresentationBuilding(
      Array.isArray(localProfile?.buildings) ? localProfile.buildings : [],
      building
    );
    return createServerBuildingDetailView({
      building,
      district: presentation.readModel.district,
      localBuilding,
      localProfile: localProfile || presentation.profile,
      readModel: presentation.readModel,
      renderState
    });
  }
}
