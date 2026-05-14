import type { ConvenienceStoreBalanceConfig, FixedBuildingBalanceConfig, LobbyClubBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { getOwnedLobbyClubCount } from "./lobbyClubBuildingActions";

export interface ConvenienceStoreNetworkMultipliers {
  cleanIncomeMultiplier: number;
  dirtyIncomeMultiplier: number;
  influenceMultiplier: number;
  rumorMultiplier: number;
  heatMultiplier: number;
}

export interface ConvenienceStoreRumor {
  type: string;
  truthChancePct: number;
  isTrue: boolean;
  districtHint: string | null;
  areaHint: string | null;
  buildingHint: string | null;
  reliabilityVisible: boolean;
  reliabilityLabel: string | null;
  text: string;
}

interface ConvenienceStoreMetadata {
  lastPassiveRumorCheckTick?: number;
  rumorEvents: ConvenienceStoreRumor[];
}

export const getOwnedConvenienceStoreCount = (
  state: CoreGameState,
  playerId: string,
  config: ConvenienceStoreBalanceConfig
): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;

export const resolveConvenienceStoreNetworkMultipliers = (
  count: number,
  config: ConvenienceStoreBalanceConfig
): ConvenienceStoreNetworkMultipliers => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return {
    cleanIncomeMultiplier: Math.min(config.network.maxCleanIncomeMultiplier, 1 + extra * config.network.cleanIncomeBonusPctPerExtraStore / 100),
    dirtyIncomeMultiplier: Math.min(config.network.maxDirtyIncomeMultiplier, 1 + extra * config.network.dirtyIncomeBonusPctPerExtraStore / 100),
    influenceMultiplier: Math.min(config.network.maxInfluenceMultiplier, 1 + extra * config.network.influenceBonusPctPerExtraStore / 100),
    rumorMultiplier: Math.min(config.network.maxRumorMultiplier, 1 + extra * config.network.rumorChanceBonusPctPerExtraStore / 100),
    heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraStore / 100)
  };
};

export const resolveConvenienceStoreRumorStats = (input: {
  state: CoreGameState;
  playerId: string;
  config: ConvenienceStoreBalanceConfig;
  restaurantConfig?: { buildingTypeId: "restaurant" };
  lobbyClubConfig?: LobbyClubBalanceConfig;
}) => {
  const storeCount = getOwnedConvenienceStoreCount(input.state, input.playerId, input.config);
  const restaurantCount = input.restaurantConfig
    ? getOwnedActiveBuildingCount(input.state, input.playerId, input.restaurantConfig.buildingTypeId)
    : 0;
  const network = resolveConvenienceStoreNetworkMultipliers(storeCount, input.config);
  const civilRumorChanceBonusPct = resolveCivilRumorChanceBonusPct(storeCount, restaurantCount, input.config);
  const civilTruthBonusPct = storeCount >= input.config.restaurantSynergy.truthStoreThreshold
    && restaurantCount >= input.config.restaurantSynergy.truthRestaurantThreshold
    ? input.config.restaurantSynergy.civilRumorTruthBonusPct
    : 0;
  const lobbyDistrictHintBonusPct = input.lobbyClubConfig && getOwnedLobbyClubCount(input.state, input.playerId, input.lobbyClubConfig) > 0
    ? input.lobbyClubConfig.civilNetworkSupport.convenienceDistrictHintChancePct
    : 0;
  return {
    storeCount,
    restaurantCount,
    network,
    civilRumorChanceBonusPct,
    passiveRumorChancePct: Math.min(100, input.config.baseRumorChancePct * network.rumorMultiplier + civilRumorChanceBonusPct),
    truthChancePct: Math.min(
      100,
      resolveTruthChancePct(storeCount, input.config)
        + civilTruthBonusPct
    ),
    districtHintChancePct: Math.min(100, input.config.districtHintChancePct + lobbyDistrictHintBonusPct),
    areaHintChancePct: input.config.areaHintChancePct,
    buildingHintChancePct: input.config.buildingHintChancePct,
    reliabilityVisible: false
  };
};

export const applyConvenienceStoreIncomeModifiers = (input: {
  config: ConvenienceStoreBalanceConfig;
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}): FixedBuildingBalanceConfig => {
  if (input.building.buildingTypeId !== input.config.buildingTypeId || !input.building.ownerPlayerId) {
    return {
      cleanPerHour: input.cleanPerHour,
      dirtyPerHour: input.dirtyPerHour,
      heatPerDay: input.heatPerDay,
      influencePerDay: input.influencePerDay,
      maxLevel: 1
    };
  }
  const network = resolveConvenienceStoreNetworkMultipliers(getOwnedConvenienceStoreCount(input.state, input.building.ownerPlayerId, input.config), input.config);
  return {
    cleanPerHour: input.cleanPerHour * network.cleanIncomeMultiplier,
    dirtyPerHour: input.dirtyPerHour * network.dirtyIncomeMultiplier,
    heatPerDay: input.heatPerDay * network.heatMultiplier,
    influencePerDay: input.influencePerDay * network.influenceMultiplier,
    maxLevel: 1
  };
};

export const applyConvenienceStorePassiveRumors = (
  state: CoreGameState,
  config: ConvenienceStoreBalanceConfig,
  tickRateMs: number,
  restaurantConfig?: { buildingTypeId: "restaurant" },
  lobbyClubConfig?: LobbyClubBalanceConfig
): CoreGameState => {
  const intervalTicks = minutesToTicks(config.passiveRumorIntervalMinutes, tickRateMs);
  let buildingsById = state.buildingsById;
  let changed = false;

  for (const building of Object.values(state.buildingsById)) {
    if (building.buildingTypeId !== config.buildingTypeId || building.status !== "active" || !building.ownerPlayerId) {
      continue;
    }
    const metadata = cleanupMetadata(getConvenienceStoreMetadata(building));
    if (metadata.lastPassiveRumorCheckTick === undefined) {
      metadata.lastPassiveRumorCheckTick = state.root.tick;
      buildingsById = updateBuildingMetadata(buildingsById, building, metadata);
      changed = true;
      continue;
    }
    if ((metadata.lastPassiveRumorCheckTick ?? -Infinity) + intervalTicks > state.root.tick) {
      continue;
    }
    const stats = resolveConvenienceStoreRumorStats({ state, playerId: building.ownerPlayerId, config, restaurantConfig, lobbyClubConfig });
    metadata.lastPassiveRumorCheckTick = state.root.tick;
    if (deterministicRollPct(`${building.id}:convenience-store-passive-rumor:${state.root.tick}`) < stats.passiveRumorChancePct) {
      metadata.rumorEvents.push(generateRumor({
        state,
        playerId: building.ownerPlayerId,
        config,
        restaurantConfig,
        seed: `${building.id}:convenience-store-rumor-event:${state.root.tick}`
      }));
    }
    buildingsById = updateBuildingMetadata(buildingsById, building, metadata);
    changed = true;
  }

  return changed ? { ...state, buildingsById } : state;
};

export const getConvenienceStoreMetadata = (building: CoreGameState["buildingsById"][string]): ConvenienceStoreMetadata => {
  const raw = isRecord(building.metadata?.convenienceStore) ? building.metadata.convenienceStore : {};
  return {
    lastPassiveRumorCheckTick: asOptionalTick(raw.lastPassiveRumorCheckTick),
    rumorEvents: Array.isArray(raw.rumorEvents) ? raw.rumorEvents.filter(isRecord).map(normalizeRumor).slice(-12) : []
  };
};

const generateRumor = (input: {
  state: CoreGameState;
  playerId: string;
  config: ConvenienceStoreBalanceConfig;
  restaurantConfig?: { buildingTypeId: "restaurant" };
  seed: string;
}): ConvenienceStoreRumor => {
  const stats = resolveConvenienceStoreRumorStats(input);
  const type = input.config.rumorTypes[Math.floor(deterministicRollPct(`${input.seed}:type`) / 100 * input.config.rumorTypes.length)] ?? "fake";
  const isTrue = deterministicRollPct(`${input.seed}:truth`) < stats.truthChancePct;
  const districtHint = deterministicRollPct(`${input.seed}:district`) < stats.districtHintChancePct ? pickDistrictHint(input.state, input.seed) : null;
  const areaHint = deterministicRollPct(`${input.seed}:area`) < stats.areaHintChancePct ? pickAreaHint(input.state, input.seed) : null;
  const buildingHint = deterministicRollPct(`${input.seed}:building`) < stats.buildingHintChancePct ? pickBuildingHint(input.state, input.seed) : null;
  const reliabilityLabel = stats.reliabilityVisible ? formatReliability(stats.truthChancePct) : null;
  return {
    type,
    truthChancePct: stats.truthChancePct,
    isTrue,
    districtHint,
    areaHint,
    buildingHint,
    reliabilityVisible: stats.reliabilityVisible,
    reliabilityLabel,
    text: formatRumorText(isTrue ? type : "fake", districtHint, areaHint, buildingHint, reliabilityLabel)
  };
};

const formatRumorText = (
  type: string,
  districtHint: string | null,
  areaHint: string | null,
  buildingHint: string | null,
  reliabilityLabel: string | null
): string => {
  const place = districtHint
    ? ` k ${districtHint}`
    : areaHint
      ? ` v ${areaHint}`
      : buildingHint
        ? ` u budovy typu ${buildingHint}`
        : "";
  const reliability = reliabilityLabel ? ` Spolehlivost: ${reliabilityLabel}.` : "";
  return `${formatRumorSubject(type)}${place}.${reliability}`;
};

const formatRumorSubject = (type: string): string => {
  switch (type) {
    case "night_movement": return "Prodavač viděl skupinu lidí mířit";
    case "suspicious_purchase": return "Někdo koupil baterky, rukavice a pásku. Neptal se na cenu";
    case "courier_trace": return "Dodávka bez značek zastavila za obchodem";
    case "small_conflict": return "Před večerkou se řešil krátký konflikt";
    case "police_patrol": return "Hlídka se dnes večer motala kolem stejného bloku";
    case "robbery_preparation": return "Zákazník mluvil o přípravě rychlé vykrádačky";
    case "possible_trap": return "Někdo se chlubil, že jeden blok čeká na nezvané hosty";
    case "weak_defense": return "U regálu padla řeč o slabé obraně";
    case "dirty_cash_movement": return "V zadní místnosti se počítaly bankovky mimo kasu";
    default: return "U pultu kolovala neověřená pouliční historka";
  }
};

const resolveCivilRumorChanceBonusPct = (
  storeCount: number,
  restaurantCount: number,
  config: ConvenienceStoreBalanceConfig
): number => {
  if (storeCount >= config.restaurantSynergy.secondStoreThreshold && restaurantCount >= config.restaurantSynergy.secondRestaurantThreshold) {
    return config.restaurantSynergy.secondCivilRumorChanceBonusPct;
  }
  if (storeCount >= config.restaurantSynergy.firstStoreThreshold && restaurantCount >= config.restaurantSynergy.firstRestaurantThreshold) {
    return config.restaurantSynergy.firstCivilRumorChanceBonusPct;
  }
  return 0;
};

const resolveTruthChancePct = (count: number, config: ConvenienceStoreBalanceConfig): number => {
  const safeCount = Math.max(0, Math.floor(Number(count || 0)));
  const tier = config.truthChanceByOwnedCount.find((candidate) =>
    safeCount >= candidate.minOwned && (candidate.maxOwned === null || safeCount <= candidate.maxOwned)
  );
  return tier?.truthChancePct ?? 0;
};

const updateBuildingMetadata = (
  buildingsById: CoreGameState["buildingsById"],
  building: CoreGameState["buildingsById"][string],
  metadata: ConvenienceStoreMetadata
): CoreGameState["buildingsById"] => ({
  ...buildingsById,
  [building.id]: {
    ...building,
    metadata: {
      ...(building.metadata ?? {}),
      convenienceStore: cleanupMetadata(metadata)
    },
    version: building.version + 1
  }
});

const cleanupMetadata = (metadata: ConvenienceStoreMetadata): ConvenienceStoreMetadata => ({
  ...metadata,
  rumorEvents: metadata.rumorEvents.slice(-12)
});

const pickDistrictHint = (state: CoreGameState, seed: string): string | null => {
  const districts = Object.values(state.districtsById).filter((district) => district.status !== "destroyed");
  return districts.length > 0 ? districts[Math.floor(deterministicRollPct(`${seed}:district-index`) / 100 * districts.length)]?.name ?? null : null;
};

const pickAreaHint = (state: CoreGameState, seed: string): string | null => {
  const districts = Object.values(state.districtsById).filter((district) => district.status !== "destroyed");
  const district = districts.length > 0 ? districts[Math.floor(deterministicRollPct(`${seed}:area-index`) / 100 * districts.length)] : null;
  return district?.zone ? `${district.zone} zóně` : null;
};

const pickBuildingHint = (state: CoreGameState, seed: string): string | null => {
  const buildings = Object.values(state.buildingsById).filter((building) => building.status === "active");
  return buildings.length > 0 ? buildings[Math.floor(deterministicRollPct(`${seed}:building-index`) / 100 * buildings.length)]?.buildingTypeId ?? null : null;
};

const formatReliability = (truthChancePct: number): string =>
  truthChancePct >= 60 ? "střední" : truthChancePct >= 50 ? "nízká až střední" : "nízká";

const normalizeRumor = (value: Record<string, unknown>): ConvenienceStoreRumor => ({
  type: String(value.type || "fake"),
  truthChancePct: Math.max(0, Number(value.truthChancePct || 0)),
  isTrue: Boolean(value.isTrue),
  districtHint: value.districtHint ? String(value.districtHint) : null,
  areaHint: value.areaHint ? String(value.areaHint) : null,
  buildingHint: value.buildingHint ? String(value.buildingHint) : null,
  reliabilityVisible: Boolean(value.reliabilityVisible),
  reliabilityLabel: value.reliabilityLabel ? String(value.reliabilityLabel) : null,
  text: String(value.text || "")
});

const minutesToTicks = (minutes: number, tickRateMs: number): number =>
  Math.max(1, Math.ceil((Math.max(0, Number(minutes || 0)) * 60 * 1000) / Math.max(1, tickRateMs)));

const deterministicRollPct = (seed: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 10000 / 100;
};

const asOptionalTick = (value: unknown): number | undefined => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.floor(numberValue) : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const getOwnedActiveBuildingCount = (state: CoreGameState, playerId: string, buildingTypeId: string): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;
