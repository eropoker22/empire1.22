import type { FixedBuildingBalanceConfig, LobbyClubBalanceConfig, ResolvedGameModeConfig, VipLoungeBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { deterministicRollPct, isRecord } from "../utils";
import { applyResolvedRumorEventsToState, createPassiveBuildingRumorInput, type ResolveRumorEventInput } from "../rules/events/rumorPipeline";
import { getOwnedLobbyClubCount } from "./lobbyClubBuildingActions";
import type { VipLoungeMetadata, VipLoungeRumor } from "./vipLoungeTypes";

export type { VipLoungeRumor } from "./vipLoungeTypes";

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
  lobbyClubConfig?: LobbyClubBalanceConfig;
}) => {
  const ownedCount = getOwnedVipLoungeCount(input.state, input.playerId, input.config);
  const tier = resolveVipLoungeNetworkTier(ownedCount, input.config);
  const lobbyTruthBonusPct = input.lobbyClubConfig && getOwnedLobbyClubCount(input.state, input.playerId, input.lobbyClubConfig) > 0
    ? input.lobbyClubConfig.civilNetworkSupport.vipLoungeTruthChancePct + input.lobbyClubConfig.synergies.vipLoungeTruthChancePct
    : 0;
  return {
    ownedCount,
    tier,
    passiveRumorChancePct: input.config.passiveRumor.baseChancePct,
    rumorIntervalMinutes: tier.rumorIntervalMinutes,
    truthChancePct: Math.min(100, tier.truthChancePct + lobbyTruthBonusPct),
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
  tickRateMs: number,
  lobbyClubConfig?: LobbyClubBalanceConfig,
  dayNightConfig?: ResolvedGameModeConfig
): CoreGameState => {
  let buildingsById = state.buildingsById;
  let changed = false;
  const feedInputs: ResolveRumorEventInput[] = [];

  for (const building of Object.values(state.buildingsById)) {
    if (building.buildingTypeId !== config.buildingTypeId || building.status !== "active" || !building.ownerPlayerId) continue;
    const stats = resolveVipLoungeRumorStats({ state, playerId: building.ownerPlayerId, config, lobbyClubConfig });
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
      const rumor = generateVipLoungeRumor({
        state,
        playerId: building.ownerPlayerId,
        config,
        lobbyClubConfig,
        seed: `${building.id}:vip-lounge-rumor-event:${state.root.tick}`
      });
      metadata.rumorEvents.push(rumor);
      feedInputs.push(createPassiveBuildingRumorInput({
        state,
        building,
        source: "vip_lounge",
        rumor,
        severity: "medium",
        negative: ["political_pressure", "police_warning", "planned_attack", "revenge_plan"].includes(rumor.type)
      }));
    }
    buildingsById = updateBuildingMetadata(buildingsById, building, metadata);
    changed = true;
  }

  const metadataState = changed ? { ...state, buildingsById } : state;
  return feedInputs.length > 0
    ? applyResolvedRumorEventsToState(metadataState, feedInputs, { lobbyClubConfig, config: dayNightConfig })
    : metadataState;
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
  lobbyClubConfig?: LobbyClubBalanceConfig;
  seed: string;
}): VipLoungeRumor => {
  const stats = resolveVipLoungeRumorStats({ state: input.state, playerId: input.playerId, config: input.config, lobbyClubConfig: input.lobbyClubConfig });
  const rawType = input.config.passiveRumor.rumorTypes[Math.floor(deterministicRollPct(`${input.seed}:type`) / 100 * input.config.passiveRumor.rumorTypes.length)] ?? "fake";
  const type = rawType === "trap_suspicion" ? "fake" : rawType;
  const truthChancePct = stats.truthChancePct;
  const isTrue = deterministicRollPct(`${input.seed}:truth`) < truthChancePct;
  const districtHint = deterministicRollPct(`${input.seed}:district`) < stats.districtHintChancePct ? pickDistrictHint(input.state, input.seed) : null;
  const buildingHint = deterministicRollPct(`${input.seed}:building`) < stats.buildingHintChancePct ? pickBuildingHint(input.state, input.seed) : null;
  const reliabilityVisible = deterministicRollPct(`${input.seed}:reliability`) < stats.reliabilityLabelChancePct;
  const reliabilityLabel = reliabilityVisible ? resolveReliabilityLabel(stats.truthChancePct, input.config, input.seed) : null;
  return {
    type,
    truthChancePct,
    isTrue,
    districtHint,
    buildingHint,
    reliabilityVisible,
    reliabilityLabel,
    text: ""
  };
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

const asOptionalTick = (value: unknown): number | undefined => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.floor(numberValue) : undefined;
};
