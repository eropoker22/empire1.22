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
  formatDistrictBuildingCooldown,
  formatDistrictBuildingMoney
} from "./formatters.js";

const normalizeName = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/gu, " ")
  .trim();

const findLocalPresentationBuilding = (localBuildings, serverBuilding) => {
  const serverNames = [
    serverBuilding?.buildingTypeId,
    serverBuilding?.label,
    serverBuilding?.displayName,
    serverBuilding?.variantName
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

const SERVER_BUILDING_MECHANICS_TYPE_ALIASES = Object.freeze({
  arcade: "arcade",
  "apartment-block": "apartment-block",
  "auto-salon": "auto-salon",
  "car-dealer": "auto-salon",
  "power-plant": "power-plant",
  "power-station": "power-plant",
  retail: "retail",
  "shopping-mall": "retail"
});

const normalizeServerBuildingTypeId = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/gu, "-")
  .replace(/^-+|-+$/gu, "");

const resolveServerBuildingMechanicsType = (buildingTypeId) => {
  const normalizedTypeId = normalizeServerBuildingTypeId(buildingTypeId);
  return SERVER_BUILDING_MECHANICS_TYPE_ALIASES[normalizedTypeId] || normalizedTypeId;
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

const resolveOwnedCount = (statMap) => {
  for (const [label, value] of statMap) {
    if (label.startsWith("vlastnen") || label.includes("sit ")) {
      const count = Number(String(value).match(/\d+/u)?.[0]);
      if (Number.isFinite(count)) return Math.max(0, Math.floor(count));
    }
  }
  return null;
};

const resolveDemoDetailProfile = ({ baseName, localBuilding, building }) => {
  const lookupKeys = [
    baseName,
    localBuilding?.baseName,
    building?.label,
    building?.buildingTypeId
  ].map(normalizeName).filter(Boolean);
  return lookupKeys
    .map((key) => DISTRICT_BUILDING_DETAIL_PROFILES[key])
    .find(Boolean)
    || null;
};

const createServerMechanicsInput = ({
  building,
  mechanicsType,
  passiveStats,
  stats
}) => {
  const statMap = createStatMap(stats);
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
  const ownedBuildingCount = resolveOwnedCount(statMap);
  const networkBonus = (label) => {
    const value = parseLastNumber(resolveStatValue(statMap, [label], "0"), 0);
    return 1 + value / 100;
  };
  const localBuffer = resolveStatValue(statMap, [
    "Lokální zásobník",
    "Obyvatelé",
    "Populace"
  ], "0/0");
  const [localBufferAmount, localBufferCapacity] = String(localBuffer)
    .split("/")
    .map((value) => Math.max(0, parseLastNumber(value, 0)));
  const count = Number.isFinite(ownedBuildingCount)
    ? ownedBuildingCount
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
      : "collect_population"
  );
  const hasManualCollect = mechanicsType === "apartment-block"
    || mechanicsType === "convenience-store"
    || mechanicsType === "school";
  const populationPerMinute = parseFirstNumber(
    resolveStatValue(statMap, ["Populace / min", "Population / min"], "0"),
    0
  );
  const isLocalBufferFull = localBufferCapacity > 0 && localBufferAmount >= localBufferCapacity;

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
    ownedBuildingCount,
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
    ownedWarehouses: count,
    hasManualCollect,
    canCollect: populationAction?.enabled === true,
    storedOutputLabel: localBuffer,
    effectsLabel: [
      cleanHourly > 0 ? `Clean cash +${formatDistrictBuildingMoney(cleanHourly)}/hod` : "",
      dirtyHourly > 0 ? `Dirty cash +${formatDistrictBuildingMoney(dirtyHourly)}/hod` : "",
      mechanicsType === "apartment-block" ? `Populace +${populationPerMinute.toFixed(2)}/min` : "",
      mechanicsType === "convenience-store" ? `Populace +${populationPerMinute.toFixed(2)}/min` : "",
      mechanicsType === "school" ? `Populace +${populationPerMinute.toFixed(2)}/min` : "",
      mechanicsType === "apartment-block" && isLocalBufferFull
        ? "Plná kapacita · Bytový blok je plný. Obyvatelé čekají na vybrání."
        : "",
      mechanicsType === "convenience-store" && isLocalBufferFull
        ? "Plná kapacita · Večerka je plná. Obyvatelé čekají na vybrání."
        : "",
      mechanicsType === "school" && isLocalBufferFull
        ? "Plná kapacita · Škola má naplněnou lokální populační kapacitu."
        : "",
      dailyHeat > 0 ? `Heat +${formatDisplayNumber(dailyHeat)}/den` : "",
      dailyInfluence > 0 ? `Vliv +${formatDisplayNumber(dailyInfluence)}/den` : ""
    ].filter(Boolean).join(" · ") || "Žádné aktivní mechaniky.",
    actionCooldowns: { ...(building?.actionCooldowns || {}) },
    apartmentWholePopulation: localBufferAmount,
    apartmentStoredPopulation: localBufferAmount,
    apartmentCapacity: localBufferCapacity,
    apartmentPopulationPerMinute: populationPerMinute,
    apartmentIsFull: isLocalBufferFull,
    apartmentTimeToFullMs: 0,
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
    schoolTimeToFullMs: 0,
    schoolEveningCourseActive: false,
    schoolEveningCourseRemainingMs: 0,
    schoolNetwork: {
      populationProductionMultiplier: networkBonus("Produkce"),
      studentCapacityMultiplier: networkBonus("Kapacita"),
      incomeMultiplier: networkBonus("Income")
    },
    clinicRecoveryPool: { totalFreshAmount: 0, fresh: [] },
    clinicRecoveryRatePct: 0,
    clinicNetwork: {
      incomeMultiplier: networkBonus("Income"),
      heatMultiplier: 1
    },
    garageSupport: {
      cooldownReductionPct: parseLastNumber(resolveStatValue(statMap, ["Cooldowny"], "0"), 0)
    },
    garageNetwork: {
      incomeMultiplier: networkBonus("Income"),
      heatMultiplier: 1
    },
    shoppingMallMarketDiscount: {
      discountPct: parseLastNumber(resolveStatValue(statMap, ["Market sleva"], "0"), 0),
      feeReductionPct: parseLastNumber(resolveStatValue(statMap, ["Market fee"], "0"), 0)
    },
    shoppingMallBlackMarketDiscount: {
      discountPct: parseLastNumber(resolveStatValue(statMap, ["Black market sleva"], "0"), 0)
    },
    shoppingMallNetwork: {
      cleanIncomeMultiplier: networkBonus("Clean výnos"),
      dirtyIncomeMultiplier: networkBonus("Dirty výnos"),
      influenceMultiplier: networkBonus("Vliv"),
      heatMultiplier: 1
    },
    autoSalonSupport: {
      cooldownReductionPct: parseLastNumber(resolveStatValue(statMap, ["Cooldown"], "0"), 0),
      escapeChanceBonusPct: parseLastNumber(resolveStatValue(statMap, ["Únik"], "0"), 0),
      combinedGarageDealerMaxReductionPct: parseLastNumber(resolveStatValue(statMap, ["Strop čekání"], "0"), 0)
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
      attackStrengthBonusPct: parseLastNumber(resolveStatValue(statMap, ["Útok"], "0"), 0),
      defenseStrengthBonusPct: parseLastNumber(resolveStatValue(statMap, ["Obrana"], "0"), 0),
      combinedRecruitmentFitnessAttackCapPct: 0,
      combinedRecruitmentFitnessDefenseCapPct: 0
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
      cameraStrengthBonusPct: parseLastNumber(resolveStatValue(statMap, ["Kamery", "Cap kamer/alarmu"], "0"), 0)
    },
    casinoLaunderingCapacity: parseLastNumber(resolveStatValue(statMap, ["Kapacita praní"], "0"), 0),
    casinoLaunderingFeePct: parseLastNumber(resolveStatValue(statMap, ["Poplatek"], "9"), 9),
    exchangeLaunderingCapacity: parseLastNumber(resolveStatValue(statMap, ["Kapacita praní"], "0"), 0),
    exchangeAuditRisk: resolveStatValue(statMap, ["Audit risk"], "0 %"),
    exchangeNetwork: {
      incomeMultiplier: networkBonus("Income"),
      launderingLimitMultiplier: 1,
      heatMultiplier: 1
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
    recyclingSalvageRatePct: 0,
    recyclingCenterNetwork: {
      incomeMultiplier: networkBonus("Income"),
      heatMultiplier: 1
    },
    convenienceStoreWholePopulation: localBufferAmount,
    convenienceStoreStoredPopulation: localBufferAmount,
    convenienceStoreCapacity: localBufferCapacity,
    convenienceStorePopulationPerMinute: populationPerMinute,
    convenienceStoreIsFull: isLocalBufferFull,
    convenienceStoreTimeToFullMs: 0,
    smugglingDealerSupplyBonusPct: 0,
    smugglingTunnelNetwork: {
      dirtyProductionMultiplier: networkBonus("Dirty tok"),
      heatMultiplier: 1
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
    serverStorageSummary: null,
    warehouseNetwork: {
      incomeMultiplier: networkBonus("Income"),
      storageCapacityMultiplier: networkBonus("Kapacita"),
      heatMultiplier: 1
    },
    warehouseCapacity: null,
    warehouseUsage: null,
    warehouseWarnings: []
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

const formatRecord = (value) => Object.entries(value || {})
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
  const disabledReason = String(
    entry
      ? entry?.disabledReason
    || entry?.blockedReason
    || entry?.phaseBlockedReason
    || ""
      : "Server nevrátil stav této akce."
  ).trim();
  const mechanicsType = resolveServerBuildingMechanicsType(buildingTypeId);
  const costSummary = resolveActionSummary(entry, "inputSummary", "")
    || formatRecord(entry?.effectiveInputCost || entry?.inputCost || entry?.cost);
  const serverRewardSummary = resolveActionSummary(entry, "outputSummary", "effectSummary")
    || resolveActionSummary(entry, "expectedEffectSummary", "reportText")
    || formatRecord(entry?.effectiveOutputGain || entry?.outputGain);
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
    requiresInput: Array.isArray(entry?.requiresInput) ? entry.requiresInput.slice() : [],
    serverAction: {
      description: String(entry?.description || demoAction?.description || ""),
      riskSummary: Array.isArray(entry?.riskSummary) ? entry.riskSummary.slice() : []
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
  const displayName = String(
    localBuilding?.displayName
    || building?.displayName
    || building?.label
    || localBuilding?.baseName
    || "Budova"
  ).trim();
  const baseName = String(
    localBuilding?.baseName
    || building?.label
    || displayName
  ).trim();
  const demoDetailProfile = resolveDemoDetailProfile({
    baseName,
    localBuilding,
    building
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
    mechanicsType,
    passiveStats: building?.presentation?.passive
      || panelBuilding?.presentation?.passive
      || null,
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
    playerHeat: Math.max(0, Number(readModel?.player?.heat ?? readModel?.player?.policeHeat ?? 0)),
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
  )) || null;

  return {
    serverInstanceId: String(readModel?.server?.serverInstanceId || readModel?.player?.instanceId || ""),
    serverDistrictId: String(district?.districtId || ""),
    buildingId: String(building?.buildingId || ""),
    buildingTypeId: String(building?.buildingTypeId || ""),
    baseName,
    displayName,
    viewModel: {
      ...sharedViewModel,
      districtId: String(district?.districtId || ""),
      buildingId: String(building?.buildingId || ""),
      buildingTypeId: String(building?.buildingTypeId || ""),
      actions,
      collect: collectAction ? {
        ...sharedViewModel.collect,
        actionId: String(collectAction.actionId || ""),
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
          ? "Upgrade ověří a potvrdí server."
          : "Budova nemá další level."
      }
    }
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

export class ServerBuildingPresentationAdapter {
  constructor({ getReadModel, resolveDistrictBuildingProfile } = {}) {
    this.getReadModel = getReadModel;
    this.resolveDistrictBuildingProfile = resolveDistrictBuildingProfile;
  }

  getDistrictPresentation(district) {
    const canonicalDistrictId = toCanonicalServerDistrictId(district);
    const readModel = this.getReadModel?.() || null;
    const serverDistrict = readModel?.district || null;
    if (!canonicalDistrictId || String(serverDistrict?.districtId || "") !== canonicalDistrictId) {
      return {
        canonicalDistrictId,
        destroyed: false,
        intelKnown: false,
        isOwnedByPlayer: false,
        profile: null,
        readModel: null
      };
    }

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
      readModel
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
    const localBuilding = presentation.profile?.buildings?.find?.(
      (entry) => String(entry?.buildingId || "") === String(building.buildingId || "")
    ) || null;
    return createServerBuildingDetailView({
      building,
      district: presentation.readModel.district,
      localBuilding,
      localProfile: presentation.profile,
      readModel: presentation.readModel,
      renderState
    });
  }
}
