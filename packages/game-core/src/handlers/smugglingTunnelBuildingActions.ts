import type { FixedBuildingBalanceConfig, SmugglingTunnelBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { FactionPassiveModifiers } from "@empire/shared-types";
import { applyFactionSmugglingIncome } from "../rules/factions/factionRules";

export interface SmugglingTunnelPlayerMetadata {
  openChannelExpiresAtTick?: number;
  openChannelStartedAtTick?: number;
  openChannelHistory: Array<Record<string, unknown>>;
}

export interface SmugglingTunnelNetworkMultipliers {
  dirtyProductionMultiplier: number;
  heatMultiplier: number;
}

export interface DealerSupplyStats {
  ownedTunnelCount: number;
  dealerSupplyBonusPct: number;
  salePriceBonusPct: number;
  saleSpeedBonusPct: number;
  streetRiskReductionPct: number;
  passiveDirtyIncomeBonusPct: number;
  saleHeatRiskBonusPct: number;
  contrabandFlowLevel: "none" | "low" | "stable" | "strong" | "underground";
  contrabandFlowLabel: string;
  contrabandFlowEffect: string;
}

export interface OpenChannelStats {
  active: boolean;
  remainingTicks: number;
  expiresAtTick?: number;
  tunnelDirtyProductionBonusPct: number;
  dealerSalePriceBonusPct: number;
  dealerSaleSpeedBonusPct: number;
  dealerCompletionRewardBonusPct: number;
  dealerSaleHeatBonusPct: number;
  streetIncidentFlatRiskPct: number;
}

export interface SmugglingTunnelActionResolution {
  balances: Record<string, number>;
  buildingMetadata?: Record<string, unknown>;
  playerMetadata: Record<string, unknown>;
  heatGain: number;
  influenceChange: number;
  outputGain: Record<string, number>;
  inputCost: Record<string, number>;
  effectModifiers?: Record<string, number>;
  reportText: string;
  smugglingTunnelResult: Record<string, unknown>;
}

export const getOwnedSmugglingTunnelCount = (
  state: CoreGameState,
  playerId: string,
  config: SmugglingTunnelBalanceConfig
): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;

export const resolveSmugglingTunnelNetworkMultipliers = (
  count: number,
  config: SmugglingTunnelBalanceConfig
): SmugglingTunnelNetworkMultipliers => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return {
    dirtyProductionMultiplier: Math.min(
      config.network.maxDirtyProductionMultiplier,
      1 + extra * config.network.dirtyProductionBonusPctPerExtraTunnel / 100
    ),
    heatMultiplier: Math.min(
      config.network.maxHeatMultiplier,
      1 + extra * config.network.heatBonusPctPerExtraTunnel / 100
    )
  };
};

export const resolveDealerSupplyStats = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: SmugglingTunnelBalanceConfig;
}): DealerSupplyStats => {
  const config = input.config;
  const ownedTunnelCount = config && input.playerId
    ? getOwnedSmugglingTunnelCount(input.state, input.playerId, config)
    : 0;
  const dealerSupplyBonusPct = config
    ? Math.min(config.dealerSupply.maxBonusPct, ownedTunnelCount * config.dealerSupply.bonusPctPerTunnel)
    : 0;
  const flow = resolveContrabandFlow(ownedTunnelCount);
  return {
    ownedTunnelCount,
    dealerSupplyBonusPct,
    salePriceBonusPct: config ? dealerSupplyBonusPct * config.dealerSupply.salePriceSharePct / 100 : 0,
    saleSpeedBonusPct: config ? dealerSupplyBonusPct * config.dealerSupply.saleSpeedSharePct / 100 : 0,
    streetRiskReductionPct: config ? dealerSupplyBonusPct * config.dealerSupply.streetRiskReductionSharePct / 100 : 0,
    passiveDirtyIncomeBonusPct: config ? dealerSupplyBonusPct * config.dealerSupply.passiveDirtyIncomeSharePct / 100 : 0,
    saleHeatRiskBonusPct: config ? dealerSupplyBonusPct * config.dealerSupply.saleHeatRiskSharePct / 100 : 0,
    contrabandFlowLevel: flow.level,
    contrabandFlowLabel: flow.label,
    contrabandFlowEffect: flow.effect
  };
};

export const resolveOpenChannelStats = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: SmugglingTunnelBalanceConfig;
  tick: number;
}): OpenChannelStats => {
  const config = input.config;
  const player = input.playerId ? input.state.playersById[input.playerId] : undefined;
  const metadata = player ? getSmugglingTunnelPlayerMetadata(player) : { openChannelHistory: [] };
  const expiresAtTick = metadata.openChannelExpiresAtTick;
  const active = Boolean(config && expiresAtTick && expiresAtTick > input.tick);
  return {
    active,
    remainingTicks: active ? Math.max(0, Number(expiresAtTick || 0) - input.tick) : 0,
    expiresAtTick: active ? expiresAtTick : undefined,
    tunnelDirtyProductionBonusPct: active && config ? config.openChannel.tunnelDirtyProductionBonusPct : 0,
    dealerSalePriceBonusPct: active && config ? config.openChannel.dealerSalePriceBonusPct : 0,
    dealerSaleSpeedBonusPct: active && config ? config.openChannel.dealerSaleSpeedBonusPct : 0,
    dealerCompletionRewardBonusPct: active && config ? config.openChannel.dealerCompletionRewardBonusPct : 0,
    dealerSaleHeatBonusPct: active && config ? config.openChannel.dealerSaleHeatBonusPct : 0,
    streetIncidentFlatRiskPct: active && config ? config.openChannel.streetIncidentFlatRiskPct : 0
  };
};

export const isOpenChannelActiveForPlayer = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: SmugglingTunnelBalanceConfig;
  tick: number;
}): boolean => resolveOpenChannelStats(input).active;

export const getSmugglingTunnelPlayerMetadata = (
  player: CoreGameState["playersById"][string]
): SmugglingTunnelPlayerMetadata => {
  const raw = isRecord(player.metadata?.smugglingTunnel) ? player.metadata.smugglingTunnel : {};
  return {
    openChannelExpiresAtTick: asOptionalTick(raw.openChannelExpiresAtTick),
    openChannelStartedAtTick: asOptionalTick(raw.openChannelStartedAtTick),
    openChannelHistory: Array.isArray(raw.openChannelHistory) ? raw.openChannelHistory.filter(isRecord).slice(-12) : []
  };
};

export const getSmugglingTunnelMetadata = (
  _building: CoreGameState["buildingsById"][string]
): Record<string, never> => ({});

export const applySmugglingTunnelIncomeModifiers = (input: {
  config: SmugglingTunnelBalanceConfig;
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  tick: number;
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
  factionModifiers?: FactionPassiveModifiers;
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
  const ownedCount = getOwnedSmugglingTunnelCount(input.state, input.building.ownerPlayerId, input.config);
  const network = resolveSmugglingTunnelNetworkMultipliers(ownedCount, input.config);
  const channel = resolveOpenChannelStats({
    state: input.state,
    playerId: input.building.ownerPlayerId,
    config: input.config,
    tick: input.tick
  });
  const channelDirtyMultiplier = 1 + channel.tunnelDirtyProductionBonusPct / 100;
  return {
    cleanPerHour: 0,
    dirtyPerHour: applyFactionSmugglingIncome(
      input.dirtyPerHour * network.dirtyProductionMultiplier * channelDirtyMultiplier,
      input.factionModifiers ?? {}
    ),
    heatPerDay: input.heatPerDay * network.heatMultiplier,
    influencePerDay: 0,
    maxLevel: 1
  };
};

export const applySmugglingTunnelBatchProduction = (input: {
  state: CoreGameState;
  config: SmugglingTunnelBalanceConfig;
  tickRateMs: number;
  incomeMultiplier: number;
}): CoreGameState => input.state;

export const resolveSmugglingTunnelAction = (input: {
  state: CoreGameState;
  player: CoreGameState["playersById"][string];
  building: CoreGameState["buildingsById"][string];
  actionId: string;
  balances: Record<string, number>;
  config: SmugglingTunnelBalanceConfig;
  tickRateMs: number;
}): SmugglingTunnelActionResolution | null => {
  if (input.actionId !== input.config.openChannel.actionId || input.building.buildingTypeId !== input.config.buildingTypeId) {
    return null;
  }
  const metadata = getSmugglingTunnelPlayerMetadata(input.player);
  const durationTicks = minutesToTicks(input.config.openChannel.durationMinutes, input.tickRateMs);
  const expiresAtTick = input.state.root.tick + durationTicks;
  const nextMetadata: SmugglingTunnelPlayerMetadata = {
    ...metadata,
    openChannelStartedAtTick: input.state.root.tick,
    openChannelExpiresAtTick: expiresAtTick,
    openChannelHistory: [
      ...metadata.openChannelHistory,
      {
        tick: input.state.root.tick,
        buildingId: input.building.id,
        districtId: input.building.districtId,
        expiresAtTick
      }
    ].slice(-12)
  };
  return {
    balances: {
      ...input.balances,
      cash: Math.max(0, Number(input.balances.cash || 0) - input.config.openChannel.costCleanCash)
    },
    playerMetadata: withSmugglingTunnelPlayerMetadata(input.player, nextMetadata),
    heatGain: input.config.openChannel.heatGain,
    influenceChange: 0,
    inputCost: { cash: input.config.openChannel.costCleanCash },
    outputGain: {},
    reportText: "Otevřený kanál běží. Tunely zvedají dirty cash a Pouliční dealeři prodávají rychleji za víc, ale roste heat a riziko pouličního incidentu.",
    smugglingTunnelResult: {
      type: "open_channel",
      activeUntilTick: expiresAtTick,
      durationTicks,
      cleanCashCost: input.config.openChannel.costCleanCash,
      heatGain: input.config.openChannel.heatGain,
      tunnelDirtyProductionBonusPct: input.config.openChannel.tunnelDirtyProductionBonusPct,
      dealerSalePriceBonusPct: input.config.openChannel.dealerSalePriceBonusPct,
      dealerSaleSpeedBonusPct: input.config.openChannel.dealerSaleSpeedBonusPct,
      dealerCompletionRewardBonusPct: input.config.openChannel.dealerCompletionRewardBonusPct,
      dealerSaleHeatBonusPct: input.config.openChannel.dealerSaleHeatBonusPct,
      streetIncidentFlatRiskPct: input.config.openChannel.streetIncidentFlatRiskPct
    }
  };
};

export const validateSmugglingTunnelAction = (input: {
  state: CoreGameState;
  player: CoreGameState["playersById"][string];
  building: CoreGameState["buildingsById"][string];
  actionId: string;
  balances: Record<string, number>;
  config?: SmugglingTunnelBalanceConfig;
}): string | null => {
  const config = input.config;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId || input.actionId !== config.openChannel.actionId) {
    return null;
  }
  if (isOpenChannelActiveForPlayer({ state: input.state, playerId: input.player.id, config, tick: input.state.root.tick })) {
    return "smuggling_tunnel_open_channel_active";
  }
  if (Math.max(0, Number(input.balances.cash || 0)) < config.openChannel.costCleanCash) {
    return "smuggling_tunnel_insufficient_clean_cash";
  }
  return null;
};

export const resolveSmugglingTunnelCollectHeat = (): number => 0;

export const isSilentChannelActive = (): boolean => false;

const resolveContrabandFlow = (
  ownedTunnelCount: number
): { level: DealerSupplyStats["contrabandFlowLevel"]; label: string; effect: string } => {
  if (ownedTunnelCount >= 10) {
    return { level: "underground", label: "Podzemní síť", effect: "maximální podpora Pouličních dealerů, ale vysoká heat stopa" };
  }
  if (ownedTunnelCount >= 6) {
    return { level: "strong", label: "Silná podpora", effect: "výraznější dirty cash ekonomika" };
  }
  if (ownedTunnelCount >= 3) {
    return { level: "stable", label: "Stabilní podpora", effect: "lepší prodej přes Pouliční dealery" };
  }
  if (ownedTunnelCount >= 1) {
    return { level: "low", label: "Nízká podpora", effect: "malé posílení Pouličních dealerů" };
  }
  return { level: "none", label: "Bez podpory", effect: "bez podpory Pouličních dealerů" };
};

const withSmugglingTunnelPlayerMetadata = (
  player: CoreGameState["playersById"][string],
  smugglingTunnel: SmugglingTunnelPlayerMetadata
): Record<string, unknown> => ({
  ...(player.metadata ?? {}),
  smugglingTunnel
});

const minutesToTicks = (minutes: number, tickRateMs: number): number =>
  Math.max(1, Math.ceil(Math.max(0, minutes) * 60000 / Math.max(1, tickRateMs)));

const asOptionalTick = (value: unknown): number | undefined => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.floor(numberValue) : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
