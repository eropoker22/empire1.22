import type { FixedBuildingBalanceConfig, SmugglingTunnelBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { deterministicUnitInterval } from "../utils/math";

export interface SmugglingTunnelMetadata {
  storedDirtyCash: number;
  lastUpdatedTick?: number;
  lastCapacity?: number;
  wasFull?: boolean;
  silentChannelExpiresAtTick?: number;
  silentChannelResolvedAtTick?: number;
  silentChannelBlockedUntilTick?: number;
  rumorEvents?: Array<Record<string, unknown>>;
}

export interface SmugglingTunnelNetworkMultipliers {
  dirtyProductionMultiplier: number;
  batchCapacityMultiplier: number;
  passiveHeatMultiplier: number;
}

export interface SmugglingTunnelActionResolution {
  balances: Record<string, number>;
  buildingMetadata: Record<string, unknown>;
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
    batchCapacityMultiplier: Math.min(
      config.network.maxBatchCapacityMultiplier,
      1 + extra * config.network.batchCapacityBonusPctPerExtraTunnel / 100
    ),
    passiveHeatMultiplier: Math.min(
      config.network.maxPassiveHeatMultiplier,
      1 + extra * config.network.passiveHeatBonusPctPerExtraTunnel / 100
    )
  };
};

export const getSmugglingTunnelMetadata = (
  building: CoreGameState["buildingsById"][string]
): SmugglingTunnelMetadata => {
  const raw = isRecord(building.metadata?.smugglingTunnel) ? building.metadata?.smugglingTunnel : {};
  return {
    storedDirtyCash: Math.max(0, Number(raw.storedDirtyCash || 0)),
    lastUpdatedTick: asOptionalTick(raw.lastUpdatedTick),
    lastCapacity: asOptionalNumber(raw.lastCapacity),
    wasFull: Boolean(raw.wasFull),
    silentChannelExpiresAtTick: asOptionalTick(raw.silentChannelExpiresAtTick),
    silentChannelResolvedAtTick: asOptionalTick(raw.silentChannelResolvedAtTick),
    silentChannelBlockedUntilTick: asOptionalTick(raw.silentChannelBlockedUntilTick),
    rumorEvents: Array.isArray(raw.rumorEvents) ? raw.rumorEvents.filter(isRecord) : []
  };
};

export const resolveSmugglingTunnelCapacity = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  config: SmugglingTunnelBalanceConfig;
  tick: number;
}): number => {
  const ownedCount = input.building.ownerPlayerId
    ? getOwnedSmugglingTunnelCount(input.state, input.building.ownerPlayerId, input.config)
    : 0;
  const network = resolveSmugglingTunnelNetworkMultipliers(ownedCount, input.config);
  const metadata = getSmugglingTunnelMetadata(input.building);
  const silentMultiplier = isSilentChannelActive(metadata, input.tick)
    ? input.config.silentChannel.batchCapacityMultiplier
    : 1;
  return Math.max(1, Math.floor(input.config.batch.baseCapacityDirtyCash * network.batchCapacityMultiplier * silentMultiplier));
};

export const resolveSmugglingTunnelCollectHeat = (
  amount: number,
  config: SmugglingTunnelBalanceConfig
): number => {
  const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
  return config.batch.heatByCollectedDirtyCash.find((tier) =>
    safeAmount >= tier.minDirtyCash && (tier.maxDirtyCash === undefined || safeAmount <= tier.maxDirtyCash)
  )?.heatGain ?? 0;
};

export const applySmugglingTunnelIncomeModifiers = (input: {
  config: SmugglingTunnelBalanceConfig;
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  tick: number;
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
  const network = resolveSmugglingTunnelNetworkMultipliers(
    getOwnedSmugglingTunnelCount(input.state, input.building.ownerPlayerId, input.config),
    input.config
  );
  const metadata = getSmugglingTunnelMetadata(input.building);
  const silentHeatMultiplier = isSilentChannelActive(metadata, input.tick)
    ? input.config.silentChannel.passiveHeatMultiplier
    : 1;
  return {
    cleanPerHour: 0,
    dirtyPerHour: 0,
    heatPerDay: input.heatPerDay * network.passiveHeatMultiplier * silentHeatMultiplier,
    influencePerDay: 0,
    maxLevel: 1
  };
};

export const applySmugglingTunnelBatchProduction = (input: {
  state: CoreGameState;
  config: SmugglingTunnelBalanceConfig;
  tickRateMs: number;
  incomeMultiplier: number;
}): CoreGameState => {
  let nextState = input.state;
  let buildingsById = nextState.buildingsById;
  let districtsById = nextState.districtsById;
  let changed = false;

  for (const building of Object.values(nextState.buildingsById)) {
    if (building.buildingTypeId !== input.config.buildingTypeId || building.status !== "active" || !building.ownerPlayerId) {
      continue;
    }
    const current = buildingsById[building.id] ?? building;
    const metadata = getSmugglingTunnelMetadata(current);
    const resolved = resolveExpiredSilentChannel({
      state: nextState,
      building: current,
      metadata,
      config: input.config
    });
    if (resolved.changed) {
      buildingsById = {
        ...buildingsById,
        [current.id]: {
          ...current,
          metadata: withSmugglingTunnelMetadata(current, resolved.metadata),
          version: current.version + 1
        }
      };
      districtsById = resolved.districtsById ?? districtsById;
      nextState = {
        ...nextState,
        buildingsById,
        districtsById
      };
      changed = true;
    }

    const activeBuilding = buildingsById[current.id] ?? current;
    const activeMetadata = getSmugglingTunnelMetadata(activeBuilding);
    const lastTick = activeMetadata.lastUpdatedTick ?? nextState.root.tick;
    const elapsedTicks = Math.max(0, nextState.root.tick - lastTick);
    const capacity = resolveSmugglingTunnelCapacity({
      state: nextState,
      building: activeBuilding,
      config: input.config,
      tick: nextState.root.tick
    });
    const currentStored = Math.min(capacity, activeMetadata.storedDirtyCash);
    const ownedCount = getOwnedSmugglingTunnelCount(nextState, activeBuilding.ownerPlayerId, input.config);
    const network = resolveSmugglingTunnelNetworkMultipliers(ownedCount, input.config);
    const silentProductionMultiplier = isSilentChannelActive(activeMetadata, nextState.root.tick)
      ? input.config.silentChannel.dirtyProductionMultiplier
      : 1;
    const gain = currentStored >= capacity
      ? 0
      : input.config.dirtyCashPerMinute
        * network.dirtyProductionMultiplier
        * silentProductionMultiplier
        * Math.max(0, Number(input.incomeMultiplier || 0))
        * elapsedTicks
        * Math.max(1, input.tickRateMs)
        / 60000;
    const nextStored = Math.min(capacity, currentStored + gain);
    const nextMetadata: SmugglingTunnelMetadata = {
      ...activeMetadata,
      storedDirtyCash: nextStored,
      lastUpdatedTick: nextState.root.tick,
      lastCapacity: capacity,
      wasFull: nextStored >= capacity
    };

    if (
      Math.abs(nextMetadata.storedDirtyCash - activeMetadata.storedDirtyCash) <= Number.EPSILON
      && nextMetadata.lastUpdatedTick === activeMetadata.lastUpdatedTick
      && nextMetadata.lastCapacity === activeMetadata.lastCapacity
      && nextMetadata.wasFull === activeMetadata.wasFull
    ) {
      continue;
    }

    buildingsById = {
      ...buildingsById,
      [activeBuilding.id]: {
        ...activeBuilding,
        metadata: withSmugglingTunnelMetadata(activeBuilding, nextMetadata),
        version: activeBuilding.version + 1
      }
    };
    changed = true;
  }

  return changed ? { ...nextState, buildingsById, districtsById } : input.state;
};

export const resolveSmugglingTunnelAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  actionId: string;
  balances: Record<string, number>;
  config: SmugglingTunnelBalanceConfig;
  tickRateMs: number;
}): SmugglingTunnelActionResolution | null => {
  const metadata = getSmugglingTunnelMetadata(input.building);
  if (input.actionId === input.config.collectBatch.actionId) {
    const collected = Math.max(0, Math.floor(metadata.storedDirtyCash));
    const heatGain = resolveSmugglingTunnelCollectHeat(collected, input.config);
    const nextMetadata: SmugglingTunnelMetadata = {
      ...metadata,
      storedDirtyCash: 0,
      lastUpdatedTick: input.state.root.tick,
      wasFull: false
    };
    return {
      balances: {
        ...input.balances,
        "dirty-cash": Math.max(0, Number(input.balances["dirty-cash"] || 0) + collected)
      },
      buildingMetadata: withSmugglingTunnelMetadata(input.building, nextMetadata),
      heatGain,
      influenceChange: 0,
      inputCost: {},
      outputGain: { "dirty-cash": collected },
      reportText: `Vybral jsi ${collected} dirty cash z Pašovacího tunelu. Heat +${heatGain}.`,
      smugglingTunnelResult: {
        type: "collect_dirty_cash",
        collectedDirtyCash: collected,
        heatGain,
        remainingStoredDirtyCash: 0
      }
    };
  }

  if (input.actionId !== input.config.silentChannel.actionId) {
    return null;
  }
  const durationTicks = Math.ceil(input.config.silentChannel.durationMinutes * 60000 / Math.max(1, input.tickRateMs));
  const nextMetadata: SmugglingTunnelMetadata = {
    ...metadata,
    silentChannelExpiresAtTick: input.state.root.tick + durationTicks,
    silentChannelResolvedAtTick: undefined
  };
  return {
    balances: {
      ...input.balances,
      "dirty-cash": Math.max(0, Number(input.balances["dirty-cash"] || 0) - input.config.silentChannel.costDirtyCash)
    },
    buildingMetadata: withSmugglingTunnelMetadata(input.building, nextMetadata),
    heatGain: 0,
    influenceChange: 0,
    inputCost: { "dirty-cash": input.config.silentChannel.costDirtyCash },
    outputGain: {},
    reportText: "Tichý kanál běží. Tunel dočasně zvedá dávku, produkci dirty cash a heat.",
    smugglingTunnelResult: {
      type: "dirty_cash_boost_risk",
      expiresAtTick: nextMetadata.silentChannelExpiresAtTick,
      raidChancePct: input.config.silentChannel.raidChancePct
    }
  };
};

export const validateSmugglingTunnelAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  actionId: string;
  balances: Record<string, number>;
  config?: SmugglingTunnelBalanceConfig;
}): string | null => {
  const config = input.config;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) return null;
  const metadata = getSmugglingTunnelMetadata(input.building);
  if (input.actionId === config.collectBatch.actionId) {
    return Math.floor(metadata.storedDirtyCash) >= config.collectBatch.minStoredDirtyCash
      ? null
      : "smuggling_tunnel_batch_too_small";
  }
  if (input.actionId !== config.silentChannel.actionId) return null;
  if (isSilentChannelActive(metadata, input.state.root.tick)) return "smuggling_tunnel_silent_channel_active";
  if (Math.max(0, Number(metadata.silentChannelBlockedUntilTick || 0)) > input.state.root.tick) {
    return "smuggling_tunnel_silent_channel_blocked";
  }
  if (Math.max(0, Number(input.balances["dirty-cash"] || 0)) < config.silentChannel.costDirtyCash) {
    return "smuggling_tunnel_insufficient_dirty_cash";
  }
  return null;
};

export const isSilentChannelActive = (
  metadata: SmugglingTunnelMetadata,
  tick: number
): boolean =>
  Math.max(0, Number(metadata.silentChannelExpiresAtTick || 0)) > tick;

const resolveExpiredSilentChannel = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  metadata: SmugglingTunnelMetadata;
  config: SmugglingTunnelBalanceConfig;
}): { changed: boolean; metadata: SmugglingTunnelMetadata; districtsById?: CoreGameState["districtsById"] } => {
  const expiresAt = Math.max(0, Number(input.metadata.silentChannelExpiresAtTick || 0));
  if (
    expiresAt <= 0
    || expiresAt > input.state.root.tick
    || Math.max(0, Number(input.metadata.silentChannelResolvedAtTick || 0)) >= expiresAt
  ) {
    return { changed: false, metadata: input.metadata };
  }

  const raidRoll = deterministicUnitInterval(`${input.state.serverInstance.worldSeed}:smuggling:silent_channel:raid:${input.building.id}:${expiresAt}`);
  const raidTriggered = raidRoll < input.config.silentChannel.raidChancePct / 100;
  const nextMetadata: SmugglingTunnelMetadata = {
    ...input.metadata,
    silentChannelResolvedAtTick: input.state.root.tick
  };
  let districtsById: CoreGameState["districtsById"] | undefined;

  if (raidTriggered) {
    const consequenceRoll = deterministicUnitInterval(`${input.state.serverInstance.worldSeed}:smuggling:silent_channel:consequence:${input.building.id}:${expiresAt}`);
    const consequenceIndex = Math.min(3, Math.floor(consequenceRoll * 4));
    if (consequenceIndex === 0) {
      nextMetadata.storedDirtyCash = Math.max(0, input.metadata.storedDirtyCash * 0.7);
    } else if (consequenceIndex === 1) {
      const district = input.state.districtsById[input.building.districtId];
      if (district) {
        districtsById = {
          ...input.state.districtsById,
          [district.id]: {
            ...district,
            heat: Math.max(0, Number(district.heat || 0) + 10),
            version: district.version + 1
          }
        };
      }
    } else if (consequenceIndex === 2) {
      nextMetadata.silentChannelBlockedUntilTick = input.state.root.tick
        + Math.ceil(input.config.silentChannel.blockedMinutesOnClosedEntrance * 60000 / 5000);
    } else {
      nextMetadata.rumorEvents = [
        ...(nextMetadata.rumorEvents ?? []),
        {
          tick: input.state.root.tick,
          type: "negative_smuggling_rumor",
          districtId: input.building.districtId,
          text: "Okolím se šíří drb, že pod districtem běží pašovací trasa."
        }
      ];
    }
  }

  return { changed: true, metadata: nextMetadata, districtsById };
};

const withSmugglingTunnelMetadata = (
  building: CoreGameState["buildingsById"][string],
  smugglingTunnel: SmugglingTunnelMetadata
): Record<string, unknown> => ({
  ...(building.metadata ?? {}),
  smugglingTunnel
});

const asOptionalTick = (value: unknown): number | undefined => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.floor(numberValue) : undefined;
};

const asOptionalNumber = (value: unknown): number | undefined => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
