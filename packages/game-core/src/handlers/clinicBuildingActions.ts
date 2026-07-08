import type { PlayerRecoveryPoolEntry } from "@empire/shared-types";
import type { ClinicBalanceConfig, FixedBuildingBalanceConfig, PowerStationBalanceConfig, WarehouseBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { resolvePowerStationInfrastructureMultiplier } from "./powerStationBuildingActions";
import { getWarehouseCapacityForResource, resolveWarehouseStorageCapacity } from "./warehouseBuilding";

export interface ClinicActionResolution {
  balances: Record<string, number>;
  playerRecoveryPool: PlayerRecoveryPoolEntry[];
  buildingMetadata?: Record<string, unknown>;
  effectModifiers?: Record<string, number>;
  heatGain: number;
  influenceChange: number;
  inputCost: Record<string, number>;
  outputGain: Record<string, number>;
  reportText: string;
  clinicResult: Record<string, unknown>;
}

const CLINIC_RECOVERABLE_ITEMS = new Set(["population"]);
const RARE_ITEMS = new Set<string>();

export const getOwnedClinicCount = (state: CoreGameState, playerId: string, config: ClinicBalanceConfig): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;

export const resolveClinicRecoveryRatePct = (count: number, config: ClinicBalanceConfig): number => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return Math.min(config.recovery.maxRecoveryRatePct, config.recovery.baseRecoveryRatePct + extra * config.recovery.recoveryRatePctPerExtraClinic);
};

export const resolveClinicRecoveryRatePctForPlayer = (
  state: CoreGameState,
  playerId: string,
  config: ClinicBalanceConfig,
  powerStationConfig?: PowerStationBalanceConfig
): number => {
  const baseRate = resolveClinicRecoveryRatePct(getOwnedClinicCount(state, playerId, config), config);
  const infrastructureMultiplier = resolvePowerStationInfrastructureMultiplier({
    state,
    playerId,
    config: powerStationConfig,
    tick: state.root.tick,
    target: "clinicRecoveryRate"
  });
  return Math.min(config.recovery.maxRecoveryRatePct, baseRate * infrastructureMultiplier);
};

export const resolveClinicNetworkMultipliers = (
  count: number,
  config: ClinicBalanceConfig
): { incomeMultiplier: number; heatMultiplier: number } => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return {
    incomeMultiplier: Math.min(config.network.maxIncomeMultiplier, 1 + extra * config.network.incomeBonusPctPerExtraClinic / 100),
    heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraClinic / 100)
  };
};

export const applyClinicIncomeModifiers = (input: {
  config: ClinicBalanceConfig;
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}): FixedBuildingBalanceConfig => {
  if (input.building.buildingTypeId !== input.config.buildingTypeId || !input.building.ownerPlayerId) {
    return { cleanPerHour: input.cleanPerHour, dirtyPerHour: input.dirtyPerHour, heatPerDay: input.heatPerDay, influencePerDay: input.influencePerDay, maxLevel: 1 };
  }
  const network = resolveClinicNetworkMultipliers(getOwnedClinicCount(input.state, input.building.ownerPlayerId, input.config), input.config);
  return {
    cleanPerHour: input.cleanPerHour * network.incomeMultiplier,
    dirtyPerHour: 0,
    heatPerDay: input.heatPerDay * network.heatMultiplier,
    influencePerDay: 0,
    maxLevel: 1
  };
};

export const appendRecoveryPoolEntries = (
  state: CoreGameState,
  playerId: string | null | undefined,
  entries: Array<Omit<PlayerRecoveryPoolEntry, "id" | "lostAtTick" | "lostAt">>,
  sourceId = "loss"
): CoreGameState => {
  if (!playerId || entries.length <= 0) return state;
  const player = state.playersById[playerId];
  if (!player) return state;
  const safeEntries = entries
    .map((entry) => ({
      ...entry,
      itemType: normalizeClinicRecoverableItem(entry.itemType)
    }))
    .filter((entry) => Math.floor(Number(entry.amount || 0)) > 0 && entry.itemType)
    .map((entry, index) => ({
      ...entry,
      amount: Math.floor(Number(entry.amount || 0)),
      id: `recovery:${state.root.tick}:${sourceId}:${index}:${entry.itemType}`,
      lostAtTick: state.root.tick,
      lostAt: new Date(0).toISOString()
    }));
  if (safeEntries.length <= 0) return state;
  return {
    ...state,
    playersById: {
      ...state.playersById,
      [player.id]: {
        ...player,
        recoveryPool: [...(player.recoveryPool ?? []), ...safeEntries],
        version: player.version + 1
      }
    }
  };
};

export const createRecoveryEntriesFromLosses = (
  losses: Record<string, unknown> | undefined,
  source: string
): Array<Omit<PlayerRecoveryPoolEntry, "id" | "lostAtTick" | "lostAt">> =>
  Object.entries(losses ?? {}).flatMap(([itemType, amount]) =>
    isClinicRecoverableItem(itemType)
      ? [{
          itemType: normalizeClinicRecoverableItem(itemType),
          amount: Math.floor(Number(amount || 0)),
          source
        }]
      : []
  );

export const resolveClinicAction = (input: {
  state: CoreGameState;
  playerId: string;
  actionId: string;
  balances: Record<string, number>;
  clinicConfig: ClinicBalanceConfig;
  warehouseConfig?: WarehouseBalanceConfig;
  powerStationConfig?: PowerStationBalanceConfig;
  tickRateMs: number;
  random?: () => number;
}): ClinicActionResolution | null => {
  if (input.actionId !== input.clinicConfig.stabilizationProtocol.actionId) return null;
  const player = input.state.playersById[input.playerId];
  if (!player) return null;
  const nowTick = input.state.root.tick;
  const ttlTicks = Math.ceil(input.clinicConfig.recovery.poolTtlMinutes * 60000 / Math.max(1, input.tickRateMs));
  const ttlMs = input.clinicConfig.recovery.poolTtlMinutes * 60000;
  const pool = player.recoveryPool ?? [];
  const fresh = pool.filter((entry) => isRecoveryEntryFresh(entry, nowTick, ttlTicks, ttlMs));
  const expired = pool.filter((entry) => !fresh.includes(entry));
  const recoverableFresh = fresh.filter((entry) => isClinicRecoverableItem(entry.itemType));
  const recyclingFresh = fresh.filter((entry) => !isClinicRecoverableItem(entry.itemType));
  const baseRate = resolveClinicRecoveryRatePctForPlayer(input.state, input.playerId, input.clinicConfig, input.powerStationConfig) / 100;
  const nextBalances: Record<string, number> = {
    ...input.balances,
    cash: Math.max(0, Number(input.balances.cash || 0) - input.clinicConfig.stabilizationProtocol.cleanCashCost)
  };
  const random = input.random ?? Math.random;
  const recovered: Record<string, number> = {};
  const lostByCapacity: Record<string, number> = {};
  const rawRecoverableByType: Record<string, number> = {};
  const capacity = input.warehouseConfig
    ? resolveWarehouseStorageCapacity(input.state, input.playerId, input.warehouseConfig, input.powerStationConfig)
    : null;

  for (const entry of recoverableFresh) {
    const itemType = normalizeClinicRecoverableItem(entry.itemType);
    const rate = entry.source === "trap" || entry.source === "toxic_trap"
      ? baseRate * input.clinicConfig.recovery.toxicTrapRateMultiplier
      : baseRate;
    const raw = Math.max(0, Number(entry.amount || 0)) * rate;
    rawRecoverableByType[itemType] = Math.max(0, Number(rawRecoverableByType[itemType] || 0)) + raw;
  }

  for (const [itemType, raw] of Object.entries(rawRecoverableByType)) {
    let amount = Math.floor(Math.max(0, Number(raw || 0)));
    if (RARE_ITEMS.has(itemType) && random() < raw - amount) amount += 1;
    if (amount <= 0) continue;
    if (itemType === "population") {
      recovered.population = Math.max(0, Number(recovered.population || 0) + amount);
      continue;
    }
    const cap = capacity ? getWarehouseCapacityForResource(capacity, itemType) : Number.POSITIVE_INFINITY;
    const current = Math.max(0, Number(nextBalances[itemType] || 0));
    const accepted = Number.isFinite(cap) ? Math.max(0, Math.min(amount, cap - current)) : amount;
    const overflow = Math.max(0, amount - accepted);
    if (accepted > 0) {
      nextBalances[itemType] = current + accepted;
      recovered[itemType] = Math.max(0, Number(recovered[itemType] || 0) + accepted);
    }
    if (overflow > 0) lostByCapacity[itemType] = Math.max(0, Number(lostByCapacity[itemType] || 0) + overflow);
  }

  return {
    balances: nextBalances,
    playerRecoveryPool: recyclingFresh,
    heatGain: input.clinicConfig.stabilizationProtocol.heatGain,
    influenceChange: 0,
    inputCost: { cash: input.clinicConfig.stabilizationProtocol.cleanCashCost },
    outputGain: recovered,
    reportText: "Stabilizační protokol obnovil část nedávných ztrát.",
    clinicResult: {
      type: "recovery",
      recoveryRatePct: Math.round(baseRate * 100),
      recovered,
      lostByCapacity,
      keptForRecycling: recyclingFresh.reduce((total, entry) => total + Math.max(0, Number(entry.amount || 0)), 0),
      expiredCount: expired.reduce((total, entry) => total + Math.max(0, Number(entry.amount || 0)), 0),
      cleanCashCost: input.clinicConfig.stabilizationProtocol.cleanCashCost,
      heatGain: input.clinicConfig.stabilizationProtocol.heatGain
    }
  };
};

export const validateClinicAction = (input: {
  state: CoreGameState;
  playerId: string;
  actionId: string;
  balances: Record<string, number>;
  clinicConfig?: ClinicBalanceConfig;
  tickRateMs: number;
}): string | null => {
  const config = input.clinicConfig;
  if (!config || input.actionId !== config.stabilizationProtocol.actionId) return null;
  if (Math.max(0, Number(input.balances.cash || 0)) < config.stabilizationProtocol.cleanCashCost) return "clinic_insufficient_clean_cash";
  const player = input.state.playersById[input.playerId];
  const ttlTicks = Math.ceil(config.recovery.poolTtlMinutes * 60000 / Math.max(1, input.tickRateMs));
  const ttlMs = config.recovery.poolTtlMinutes * 60000;
  const hasFresh = (player?.recoveryPool ?? []).some((entry) =>
    isRecoveryEntryFresh(entry, input.state.root.tick, ttlTicks, ttlMs)
    && isClinicRecoverableItem(entry.itemType)
    && Number(entry.amount || 0) > 0
  );
  return hasFresh ? null : "clinic_recovery_pool_empty";
};

const normalizeClinicRecoverableItem = (itemType: string): string => {
  const key = String(itemType || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
  if (key === "gang-members" || key === "gang-member" || key === "members" || key === "clenove") {
    return "population";
  }
  if (key === "population" || key === "populace" || key === "obyvatele") {
    return "population";
  }
  return key;
};

const isClinicRecoverableItem = (itemType: string): boolean =>
  CLINIC_RECOVERABLE_ITEMS.has(normalizeClinicRecoverableItem(itemType));

const isRecoveryEntryFresh = (
  entry: PlayerRecoveryPoolEntry,
  nowTick: number,
  ttlTicks: number,
  ttlMs: number
): boolean => {
  const lostAtTick = Number(entry.lostAtTick);
  if (Number.isFinite(lostAtTick)) {
    return nowTick - Math.max(0, lostAtTick) <= ttlTicks;
  }

  const lostAtMs = entry.lostAt ? Date.parse(entry.lostAt) : Number.NaN;
  return Number.isFinite(lostAtMs) ? Date.now() - lostAtMs <= ttlMs : true;
};
