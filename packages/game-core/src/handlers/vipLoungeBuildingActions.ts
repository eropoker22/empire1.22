import type { FixedBuildingBalanceConfig, VipLoungeBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";

export interface VipLoungeRumor {
  type: string;
  truthChancePct: number;
  isTrue: boolean;
  districtHint: string | null;
  buildingHint: string | null;
  reliabilityVisible: boolean;
  reliabilityLabel: string | null;
  text: string;
}

interface VipLoungeMetadata {
  lastPassiveRumorCheckTick?: number;
  rumorEvents: VipLoungeRumor[];
}

export const getOwnedVipLoungeCount = (
  state: CoreGameState,
  playerId: string,
  config: VipLoungeBalanceConfig
): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;

export const resolveVipLoungeNetworkTier = (
  count: number,
  config: VipLoungeBalanceConfig
): VipLoungeBalanceConfig["network"]["tiers"][number] => {
  const safeCount = Math.max(0, Math.floor(Number(count || 0)));
  return config.network.tiers.find((tier) =>
    safeCount >= tier.minOwned && (tier.maxOwned === null || safeCount <= tier.maxOwned)
  ) ?? config.network.tiers[0];
};

export const resolveVipLoungeRumorStats = (input: {
  state: CoreGameState;
  playerId: string;
  config: VipLoungeBalanceConfig;
}) => {
  const ownedCount = getOwnedVipLoungeCount(input.state, input.playerId, input.config);
  const tier = resolveVipLoungeNetworkTier(ownedCount, input.config);
  return {
    ownedCount,
    tier,
    passiveRumorChancePct: input.config.passiveRumor.baseChancePct,
    rumorIntervalMinutes: tier.rumorIntervalMinutes,
    truthChancePct: tier.truthChancePct,
    districtHintChancePct: tier.districtHintChancePct,
    buildingHintChancePct: tier.buildingHintChancePct,
    reliabilityLabelChancePct: tier.reliabilityLabelChancePct
  };
};

export const applyVipLoungeIncomeModifiers = (input: {
  config: VipLoungeBalanceConfig;
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
  const tier = resolveVipLoungeNetworkTier(getOwnedVipLoungeCount(input.state, input.building.ownerPlayerId, input.config), input.config);
  return {
    cleanPerHour: input.cleanPerHour * tier.incomeMultiplier,
    dirtyPerHour: input.dirtyPerHour * tier.incomeMultiplier,
    heatPerDay: input.heatPerDay * tier.heatMultiplier,
    influencePerDay: input.influencePerDay * tier.influenceMultiplier,
    maxLevel: 1
  };
};

export const applyVipLoungePassiveRumors = (
  state: CoreGameState,
  config: VipLoungeBalanceConfig,
  tickRateMs: number
): CoreGameState => {
  let buildingsById = state.buildingsById;
  let changed = false;

  for (const building of Object.values(state.buildingsById)) {
    if (building.buildingTypeId !== config.buildingTypeId || building.status !== "active" || !building.ownerPlayerId) continue;
    const stats = resolveVipLoungeRumorStats({ state, playerId: building.ownerPlayerId, config });
    const intervalTicks = minutesToTicks(stats.rumorIntervalMinutes, tickRateMs);
    const metadata = cleanupVipLoungeMetadata(getVipLoungeMetadata(building));
    if (metadata.lastPassiveRumorCheckTick === undefined) {
      metadata.lastPassiveRumorCheckTick = state.root.tick;
      buildingsById = updateBuildingMetadata(buildingsById, building, metadata);
      changed = true;
      continue;
    }
    if ((metadata.lastPassiveRumorCheckTick ?? -Infinity) + intervalTicks > state.root.tick) continue;
    metadata.lastPassiveRumorCheckTick = state.root.tick;
    if (deterministicRollPct(`${building.id}:vip-lounge-passive-rumor:${state.root.tick}`) < stats.passiveRumorChancePct) {
      metadata.rumorEvents.push(generateVipLoungeRumor({
        state,
        playerId: building.ownerPlayerId,
        config,
        seed: `${building.id}:vip-lounge-rumor-event:${state.root.tick}`
      }));
    }
    buildingsById = updateBuildingMetadata(buildingsById, building, metadata);
    changed = true;
  }

  return changed ? { ...state, buildingsById } : state;
};

export const getVipLoungeMetadata = (building: CoreGameState["buildingsById"][string]): VipLoungeMetadata => {
  const raw = isRecord(building.metadata?.vipLounge) ? building.metadata.vipLounge : {};
  return {
    lastPassiveRumorCheckTick: asOptionalTick(raw.lastPassiveRumorCheckTick),
    rumorEvents: Array.isArray(raw.rumorEvents) ? raw.rumorEvents.filter(isRecord).map(normalizeRumor).slice(-12) : []
  };
};

const generateVipLoungeRumor = (input: {
  state: CoreGameState;
  playerId: string;
  config: VipLoungeBalanceConfig;
  seed: string;
}): VipLoungeRumor => {
  const stats = resolveVipLoungeRumorStats({ state: input.state, playerId: input.playerId, config: input.config });
  const type = input.config.passiveRumor.rumorTypes[Math.floor(deterministicRollPct(`${input.seed}:type`) / 100 * input.config.passiveRumor.rumorTypes.length)] ?? "fake";
  const isTrue = deterministicRollPct(`${input.seed}:truth`) < stats.truthChancePct;
  const districtHint = deterministicRollPct(`${input.seed}:district`) < stats.districtHintChancePct ? pickDistrictHint(input.state, input.seed) : null;
  const buildingHint = deterministicRollPct(`${input.seed}:building`) < stats.buildingHintChancePct ? pickBuildingHint(input.state, input.seed) : null;
  const reliabilityVisible = deterministicRollPct(`${input.seed}:reliability`) < stats.reliabilityLabelChancePct;
  const reliabilityLabel = reliabilityVisible ? resolveReliabilityLabel(stats.truthChancePct, input.config, input.seed) : null;
  const subject = isTrue ? type : "fake";
  return {
    type,
    truthChancePct: stats.truthChancePct,
    isTrue,
    districtHint,
    buildingHint,
    reliabilityVisible,
    reliabilityLabel,
    text: formatRumorText(subject, districtHint, buildingHint, reliabilityLabel)
  };
};

const formatRumorText = (
  type: string,
  districtHint: string | null,
  buildingHint: string | null,
  reliabilityLabel: string | null
): string => {
  const place = districtHint
    ? ` poblíž ${districtHint}`
    : " někde mimo hlavní světla města";
  const building = buildingHint ? ` a kolem budovy typu ${buildingHint}` : "";
  const reliability = reliabilityLabel ? ` Odhad zdroje: ${reliabilityLabel}.` : "";
  return `${formatRumorSubject(type)}${place}${building}.${reliability}`;
};

const formatRumorSubject = (type: string): string => {
  switch (type) {
    case "political_pressure": return "Ve VIP salonku se šeptalo, že se chystá politický tlak";
    case "financial_deal": return "Někdo u zadního stolu mluvil o velkém přesunu peněz";
    case "police_warning": return "Zákulisní zdroj tvrdí, že policie připravuje tlak";
    case "planned_attack": return "Host v drahém obleku naznačil plánovaný útok";
    case "revenge_plan": return "Za závěsem padla řeč o odvetném plánu";
    case "casino_money": return "U VIP stolu se řešil podezřelý casino cashflow";
    case "smuggling_route": return "Zákulisní šeptanda ukazuje na pašovací trasu";
    case "drug_distribution": return "Někdo z VIP části pustil informaci o distribuci drog";
    case "hidden_weakness": return "Elitní host naznačil skrytou slabinu";
    case "weak_defense": return "Host tvrdí, že jeden district má slabší obranu, než se zdá";
    case "storage_hint": return "Zdroj mluvil o skladu, kolem kterého se něco hýbe";
    case "trap_suspicion": return "Někdo zmínil možnou past, ale zdroj není úplně čistý";
    default: return "VIP část pustila historku, která může být jen kouřová clona";
  }
};

const resolveReliabilityLabel = (truthChancePct: number, config: VipLoungeBalanceConfig, seed: string): string => {
  const labels = config.passiveRumor.reliabilityLabels;
  if (truthChancePct >= 82) return labels[2] ?? "vysoká spolehlivost";
  if (truthChancePct >= 74) return deterministicRollPct(`${seed}:reliability-noise`) < 18 ? labels[0] ?? "nízká spolehlivost" : labels[1] ?? "střední spolehlivost";
  return deterministicRollPct(`${seed}:reliability-noise`) < 20 ? labels[1] ?? "střední spolehlivost" : labels[0] ?? "nízká spolehlivost";
};

const updateBuildingMetadata = (
  buildingsById: CoreGameState["buildingsById"],
  building: CoreGameState["buildingsById"][string],
  metadata: VipLoungeMetadata
): CoreGameState["buildingsById"] => ({
  ...buildingsById,
  [building.id]: {
    ...building,
    metadata: withVipLoungeMetadata(building, cleanupVipLoungeMetadata(metadata)),
    version: building.version + 1
  }
});

const cleanupVipLoungeMetadata = (metadata: VipLoungeMetadata): VipLoungeMetadata => ({
  ...metadata,
  rumorEvents: metadata.rumorEvents.slice(-12)
});

const withVipLoungeMetadata = (
  building: CoreGameState["buildingsById"][string],
  vipLounge: VipLoungeMetadata
): Record<string, unknown> => ({
  ...(building.metadata ?? {}),
  vipLounge
});

const pickDistrictHint = (state: CoreGameState, seed: string): string | null => {
  const districts = Object.values(state.districtsById).filter((district) => district.status !== "destroyed");
  return districts.length > 0 ? districts[Math.floor(deterministicRollPct(`${seed}:district-index`) / 100 * districts.length)]?.name ?? null : null;
};

const pickBuildingHint = (state: CoreGameState, seed: string): string | null => {
  const buildings = Object.values(state.buildingsById).filter((building) => building.status === "active");
  return buildings.length > 0 ? buildings[Math.floor(deterministicRollPct(`${seed}:building-index`) / 100 * buildings.length)]?.buildingTypeId ?? null : null;
};

const normalizeRumor = (value: Record<string, unknown>): VipLoungeRumor => ({
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
