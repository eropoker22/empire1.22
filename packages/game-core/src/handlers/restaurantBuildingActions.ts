import type { FixedBuildingBalanceConfig, RestaurantBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";

export interface RestaurantNetworkMultipliers {
  incomeMultiplier: number;
  influenceMultiplier: number;
  rumorMultiplier: number;
  heatMultiplier: number;
}

export interface RestaurantRumor {
  type: string;
  truthChancePct: number;
  isTrue: boolean;
  districtHint: string | null;
  buildingHint: string | null;
  reliabilityVisible: boolean;
  reliabilityLabel: string | null;
  text: string;
}

interface RestaurantMetadata {
  lastPassiveRumorCheckTick?: number;
  rumorEvents: RestaurantRumor[];
}

export const getOwnedRestaurantCount = (
  state: CoreGameState,
  playerId: string,
  config: RestaurantBalanceConfig
): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;

export const resolveRestaurantNetworkMultipliers = (
  count: number,
  config: RestaurantBalanceConfig
): RestaurantNetworkMultipliers => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return {
    incomeMultiplier: Math.min(config.network.maxIncomeMultiplier, 1 + extra * config.network.incomeBonusPctPerExtraRestaurant / 100),
    influenceMultiplier: Math.min(config.network.maxInfluenceMultiplier, 1 + extra * config.network.influenceBonusPctPerExtraRestaurant / 100),
    rumorMultiplier: Math.min(config.network.maxRumorMultiplier, 1 + extra * config.network.rumorChanceBonusPctPerExtraRestaurant / 100),
    heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraRestaurant / 100)
  };
};

export const resolveRestaurantRumorStats = (input: {
  state: CoreGameState;
  playerId: string;
  config: RestaurantBalanceConfig;
}) => {
  const restaurantCount = getOwnedRestaurantCount(input.state, input.playerId, input.config);
  const network = resolveRestaurantNetworkMultipliers(restaurantCount, input.config);
  const baseTruthChancePct = resolveTruthChancePct(restaurantCount, input.config);
  return {
    restaurantCount,
    network,
    passiveRumorChancePct: Math.min(100, input.config.baseRumorChancePct * network.rumorMultiplier),
    truthChancePct: Math.min(100, baseTruthChancePct),
    districtHintChancePct: input.config.districtHintChancePct,
    buildingHintChancePct: input.config.buildingHintChancePct,
    reliabilityVisible: false
  };
};

export const applyRestaurantIncomeModifiers = (input: {
  config: RestaurantBalanceConfig;
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
  const network = resolveRestaurantNetworkMultipliers(getOwnedRestaurantCount(input.state, input.building.ownerPlayerId, input.config), input.config);
  return {
    cleanPerHour: input.cleanPerHour * network.incomeMultiplier,
    dirtyPerHour: 0,
    heatPerDay: input.heatPerDay * network.heatMultiplier,
    influencePerDay: input.influencePerDay * network.influenceMultiplier,
    maxLevel: 1
  };
};

export const applyRestaurantPassiveRumors = (
  state: CoreGameState,
  config: RestaurantBalanceConfig,
  tickRateMs: number
): CoreGameState => {
  const intervalTicks = minutesToTicks(config.passiveRumorIntervalMinutes, tickRateMs);
  let buildingsById = state.buildingsById;
  let changed = false;

  for (const building of Object.values(state.buildingsById)) {
    if (building.buildingTypeId !== config.buildingTypeId || building.status !== "active" || !building.ownerPlayerId) {
      continue;
    }
    const metadata = cleanupRestaurantMetadata(getRestaurantMetadata(building));
    if (metadata.lastPassiveRumorCheckTick === undefined) {
      metadata.lastPassiveRumorCheckTick = state.root.tick;
      buildingsById = updateBuildingMetadata(buildingsById, building, metadata);
      changed = true;
      continue;
    }
    if ((metadata.lastPassiveRumorCheckTick ?? -Infinity) + intervalTicks > state.root.tick) {
      continue;
    }
    const stats = resolveRestaurantRumorStats({ state, playerId: building.ownerPlayerId, config });
    metadata.lastPassiveRumorCheckTick = state.root.tick;
    if (deterministicRollPct(`${building.id}:restaurant-passive-rumor:${state.root.tick}`) < stats.passiveRumorChancePct) {
      metadata.rumorEvents.push(generateRestaurantRumor({
        state,
        playerId: building.ownerPlayerId,
        config,
        seed: `${building.id}:restaurant-rumor-event:${state.root.tick}`
      }));
    }
    buildingsById = updateBuildingMetadata(buildingsById, building, metadata);
    changed = true;
  }

  return changed ? { ...state, buildingsById } : state;
};

export const getRestaurantMetadata = (building: CoreGameState["buildingsById"][string]): RestaurantMetadata => {
  const raw = isRecord(building.metadata?.restaurant) ? building.metadata.restaurant : {};
  return {
    lastPassiveRumorCheckTick: asOptionalTick(raw.lastPassiveRumorCheckTick),
    rumorEvents: Array.isArray(raw.rumorEvents) ? raw.rumorEvents.filter(isRecord).map(normalizeRumor).slice(-12) : []
  };
};

const updateBuildingMetadata = (
  buildingsById: CoreGameState["buildingsById"],
  building: CoreGameState["buildingsById"][string],
  metadata: RestaurantMetadata
): CoreGameState["buildingsById"] => ({
  ...buildingsById,
  [building.id]: {
    ...building,
    metadata: withRestaurantMetadata(building, cleanupRestaurantMetadata(metadata)),
    version: building.version + 1
  }
});

const generateRestaurantRumor = (input: {
  state: CoreGameState;
  playerId: string;
  config: RestaurantBalanceConfig;
  seed: string;
}): RestaurantRumor => {
  const stats = resolveRestaurantRumorStats({ state: input.state, playerId: input.playerId, config: input.config });
  const type = input.config.rumorTypes[Math.floor(deterministicRollPct(`${input.seed}:type`) / 100 * input.config.rumorTypes.length)] ?? "fake";
  const isTrue = deterministicRollPct(`${input.seed}:truth`) < stats.truthChancePct;
  const districtHint = deterministicRollPct(`${input.seed}:district`) < stats.districtHintChancePct ? pickDistrictHint(input.state, input.seed) : null;
  const buildingHint = deterministicRollPct(`${input.seed}:building`) < stats.buildingHintChancePct ? pickBuildingHint(input.state, input.seed) : null;
  const reliabilityLabel = stats.reliabilityVisible ? formatReliability(stats.truthChancePct) : null;
  return {
    type,
    truthChancePct: stats.truthChancePct,
    isTrue,
    districtHint,
    buildingHint,
    reliabilityVisible: stats.reliabilityVisible,
    reliabilityLabel,
    text: formatRumorText(type, isTrue, districtHint, buildingHint, reliabilityLabel)
  };
};

const formatRumorText = (
  type: string,
  isTrue: boolean,
  districtHint: string | null,
  buildingHint: string | null,
  reliabilityLabel: string | null
): string => {
  const subject = isTrue ? type : "fake";
  const detail = districtHint
    ? buildingHint
      ? ` poblíž ${districtHint}; mluvilo se i o budově typu ${buildingHint}`
      : ` poblíž ${districtHint}`
    : buildingHint
      ? ` kolem budovy typu ${buildingHint}`
      : " někde ve městě";
  const reliability = reliabilityLabel ? ` Spolehlivost: ${reliabilityLabel}.` : "";
  return `Hosté mluvili o ${formatRumorSubject(subject)}${detail}.${reliability}`;
};

const formatRumorSubject = (type: string): string => {
  switch (type) {
    case "civilian_movement": return "neobvyklém pohybu lidí";
    case "suspicious_delivery": return "podezřelé dodávce";
    case "police_interest": return "zájmu policie";
    case "economic_activity": return "nezvyklé ekonomické aktivitě";
    case "storage_movement": return "pohybu zásob";
    case "attack_preparation": return "možné přípravě útoku";
    case "weak_defense": return "slabší obraně";
    default: return "neověřené historce";
  }
};

const resolveTruthChancePct = (count: number, config: RestaurantBalanceConfig): number => {
  const safeCount = Math.max(0, Math.floor(Number(count || 0)));
  const tier = config.truthChanceByOwnedCount.find((candidate) =>
    safeCount >= candidate.minOwned && (candidate.maxOwned === null || safeCount <= candidate.maxOwned)
  );
  return tier?.truthChancePct ?? 0;
};

const formatReliability = (truthChancePct: number): string =>
  truthChancePct >= 60 ? "střední" : truthChancePct >= 50 ? "nízká až střední" : "nízká";

const cleanupRestaurantMetadata = (metadata: RestaurantMetadata): RestaurantMetadata => ({
  ...metadata,
  rumorEvents: metadata.rumorEvents.slice(-12)
});

const withRestaurantMetadata = (
  building: CoreGameState["buildingsById"][string],
  restaurant: RestaurantMetadata
): Record<string, unknown> => ({
  ...(building.metadata ?? {}),
  restaurant
});

const pickDistrictHint = (state: CoreGameState, seed: string): string | null => {
  const districts = Object.values(state.districtsById).filter((district) => district.status !== "destroyed");
  return districts.length > 0 ? districts[Math.floor(deterministicRollPct(`${seed}:district-index`) / 100 * districts.length)]?.name ?? null : null;
};

const pickBuildingHint = (state: CoreGameState, seed: string): string | null => {
  const buildings = Object.values(state.buildingsById).filter((building) => building.status === "active");
  return buildings.length > 0 ? buildings[Math.floor(deterministicRollPct(`${seed}:building-index`) / 100 * buildings.length)]?.buildingTypeId ?? null : null;
};

const normalizeRumor = (value: Record<string, unknown>): RestaurantRumor => ({
  type: String(value.type || "fake"),
  truthChancePct: Math.max(0, Number(value.truthChancePct || 0)),
  isTrue: Boolean(value.isTrue),
  districtHint: value.districtHint ? String(value.districtHint) : null,
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
