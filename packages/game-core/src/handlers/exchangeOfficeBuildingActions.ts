import type { BuildingActionBalanceConfig, ExchangeOfficeBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { createPlayerPoliceState, resolveWantedLevel } from "./playerPoliceState";

export interface ExchangeOfficeActionResolution {
  balances: Record<string, number>;
  buildingMetadata: Record<string, unknown>;
  heatGain: number;
  influenceChange: number;
  outputGain: Record<string, number>;
  inputCost: Record<string, number>;
  effectModifiers?: BuildingActionBalanceConfig["effectModifiers"];
  reportText: string;
  exchangeResult: Record<string, unknown>;
}

interface ExchangeOfficeMetadata {
  launderedEvents: Array<{ tick: number; amount: number }>;
  auditRiskBonuses: Array<{ expiresAtTick: number; riskPct: number; source: string }>;
  incomePenaltyExpiresAtTick?: number;
  incomePenaltyPct?: number;
  dirtyIncomePenaltyExpiresAtTick?: number;
  dirtyIncomePenaltyPct?: number;
  actionBlockedUntilTick?: number;
  lastAuditCheckTick?: number;
  auditLog?: Array<Record<string, unknown>>;
}

export const isExchangeOfficeAction = (actionId: string, config?: ExchangeOfficeBalanceConfig): boolean =>
  Boolean(config && actionId === config.goodRate.actionId);

export const getOwnedExchangeOfficeCount = (
  state: CoreGameState,
  playerId: string,
  config: ExchangeOfficeBalanceConfig
): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;

export const resolveExchangeOfficeNetworkMultipliers = (
  count: number,
  config: ExchangeOfficeBalanceConfig
): { incomeMultiplier: number; launderingLimitMultiplier: number; heatMultiplier: number } => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return {
    incomeMultiplier: Math.min(config.network.maxIncomeMultiplier, 1 + extra * config.network.incomeBonusPctPerExtraExchange / 100),
    launderingLimitMultiplier: Math.min(config.network.maxLaunderingLimitMultiplier, 1 + extra * config.network.launderingLimitBonusPctPerExtraExchange / 100),
    heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraExchange / 100)
  };
};

export const getExchangeOfficeMetadata = (
  building: CoreGameState["buildingsById"][string]
): ExchangeOfficeMetadata => {
  const raw = isRecord(building.metadata?.exchangeOffice) ? building.metadata?.exchangeOffice : {};
  return {
    launderedEvents: Array.isArray(raw.launderedEvents)
      ? raw.launderedEvents
          .map((entry) => ({
            tick: Math.max(0, Math.floor(Number((entry as Record<string, unknown>)?.tick || 0))),
            amount: Math.max(0, Math.floor(Number((entry as Record<string, unknown>)?.amount || 0)))
          }))
          .filter((entry) => entry.amount > 0)
      : [],
    auditRiskBonuses: Array.isArray(raw.auditRiskBonuses)
      ? raw.auditRiskBonuses
          .map((entry) => ({
            expiresAtTick: Math.max(0, Math.floor(Number((entry as Record<string, unknown>)?.expiresAtTick || 0))),
            riskPct: Math.max(0, Number((entry as Record<string, unknown>)?.riskPct || 0)),
            source: String((entry as Record<string, unknown>)?.source || "exchange_office")
          }))
          .filter((entry) => entry.expiresAtTick > 0 && entry.riskPct > 0)
      : [],
    incomePenaltyExpiresAtTick: asOptionalTick(raw.incomePenaltyExpiresAtTick),
    incomePenaltyPct: asOptionalNumber(raw.incomePenaltyPct),
    dirtyIncomePenaltyExpiresAtTick: asOptionalTick(raw.dirtyIncomePenaltyExpiresAtTick),
    dirtyIncomePenaltyPct: asOptionalNumber(raw.dirtyIncomePenaltyPct),
    actionBlockedUntilTick: asOptionalTick(raw.actionBlockedUntilTick),
    lastAuditCheckTick: asOptionalTick(raw.lastAuditCheckTick),
    auditLog: Array.isArray(raw.auditLog) ? raw.auditLog.filter(isRecord).slice(-10) : []
  };
};

export const resolveExchangeOfficeAuditRisk = (input: {
  config: ExchangeOfficeBalanceConfig;
  state: CoreGameState;
  ownerPlayerId: string;
  playerHeat: number;
  tick: number;
  tickRateMs: number;
}): { riskPct: number; launderedInWindow: number; ownedCount: number } => {
  const windowTicks = minutesToTicks(input.config.auditWindowMinutes, input.tickRateMs);
  const thresholdTick = Math.max(0, input.tick - windowTicks);
  const ownedBuildings = getOwnedExchangeOfficeBuildings(input.state, input.ownerPlayerId, input.config);
  const launderedInWindow = ownedBuildings
    .flatMap((building) => getExchangeOfficeMetadata(building).launderedEvents)
    .filter((entry) => entry.tick >= thresholdTick)
    .reduce((total, entry) => total + entry.amount, 0);
  const tier = input.config.auditRiskTiers.find((candidate) =>
    candidate.maxLaunderedAmount === null || launderedInWindow <= candidate.maxLaunderedAmount
  );
  let riskPct = tier?.riskPct ?? input.config.baseAuditRiskPct;

  riskPct += ownedBuildings
    .flatMap((building) => getExchangeOfficeMetadata(building).auditRiskBonuses)
    .filter((bonus) => bonus.expiresAtTick > input.tick)
    .reduce((total, bonus) => total + bonus.riskPct, 0);
  if (ownedBuildings.length >= 8) {
    riskPct += 9;
  } else if (ownedBuildings.length >= 5) {
    riskPct += 5;
  }
  if (input.playerHeat > 180) {
    riskPct += 15;
  } else if (input.playerHeat > 100) {
    riskPct += 8;
  }

  return {
    riskPct: Math.max(0, Math.round(riskPct * 10) / 10),
    launderedInWindow,
    ownedCount: ownedBuildings.length
  };
};

export const applyExchangeOfficeIncomeModifiers = (input: {
  config: ExchangeOfficeBalanceConfig;
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  tick: number;
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}): { cleanPerHour: number; dirtyPerHour: number; heatPerDay: number; influencePerDay: number } => {
  if (input.building.buildingTypeId !== input.config.buildingTypeId || !input.building.ownerPlayerId) {
    return {
      cleanPerHour: input.cleanPerHour,
      dirtyPerHour: input.dirtyPerHour,
      heatPerDay: input.heatPerDay,
      influencePerDay: input.influencePerDay
    };
  }
  const metadata = getExchangeOfficeMetadata(input.building);
  const network = resolveExchangeOfficeNetworkMultipliers(
    getOwnedExchangeOfficeCount(input.state, input.building.ownerPlayerId, input.config),
    input.config
  );
  const incomePenalty = (metadata.incomePenaltyExpiresAtTick ?? 0) > input.tick
    ? 1 - Math.max(0, Number(metadata.incomePenaltyPct || 0)) / 100
    : 1;
  const dirtyPenalty = (metadata.dirtyIncomePenaltyExpiresAtTick ?? 0) > input.tick
    ? 1 - Math.max(0, Number(metadata.dirtyIncomePenaltyPct || 0)) / 100
    : 1;

  return {
    cleanPerHour: input.cleanPerHour * network.incomeMultiplier * incomePenalty,
    dirtyPerHour: input.dirtyPerHour * network.incomeMultiplier * incomePenalty * dirtyPenalty,
    heatPerDay: input.heatPerDay * network.heatMultiplier,
    influencePerDay: input.influencePerDay
  };
};

export const resolveExchangeOfficeAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  balances: Record<string, number>;
  exchangeConfig: ExchangeOfficeBalanceConfig;
  tickRateMs: number;
}): ExchangeOfficeActionResolution | null => {
  if (input.action.actionId !== input.exchangeConfig.goodRate.actionId) {
    return null;
  }
  const metadata = cleanupExchangeOfficeMetadata(getExchangeOfficeMetadata(input.building), input.state.root.tick);
  const dirtyCash = Math.max(0, Math.floor(Number(input.balances["dirty-cash"] || 0)));
  const ownedCount = input.building.ownerPlayerId
    ? getOwnedExchangeOfficeCount(input.state, input.building.ownerPlayerId, input.exchangeConfig)
    : 1;
  const network = resolveExchangeOfficeNetworkMultipliers(ownedCount, input.exchangeConfig);
  const capacity = Math.floor(input.exchangeConfig.goodRate.maxDirtyCashPerAction * network.launderingLimitMultiplier);
  const amount = Math.min(
    Math.floor(dirtyCash * input.exchangeConfig.goodRate.dirtyCashSharePct / 100),
    capacity
  );
  const fee = Math.floor(amount * input.exchangeConfig.goodRate.feePct / 100);
  const cleanGain = Math.max(0, amount - fee);
  const heatGain = input.exchangeConfig.goodRate.heatGain;
  const nextBalances = {
    ...input.balances,
    "dirty-cash": Math.max(0, dirtyCash - amount),
    cash: Math.max(0, Number(input.balances.cash || 0) + cleanGain)
  };

  metadata.launderedEvents.push({ tick: input.state.root.tick, amount });
  metadata.auditRiskBonuses.push({
    expiresAtTick: input.state.root.tick + minutesToTicks(input.exchangeConfig.goodRate.auditRiskDurationMinutes, input.tickRateMs),
    riskPct: input.exchangeConfig.goodRate.auditRiskBonusPct,
    source: input.exchangeConfig.goodRate.actionId
  });

  return {
    balances: nextBalances,
    buildingMetadata: withExchangeOfficeMetadata(input.building, metadata),
    heatGain,
    influenceChange: input.exchangeConfig.goodRate.influenceGain,
    inputCost: { "dirty-cash": amount },
    outputGain: { cash: cleanGain },
    reportText: `Výhodný kurz vypral ${amount} dirty cash na ${cleanGain} clean cash. Poplatek ${fee}. Heat +${heatGain}.`,
    exchangeResult: {
      type: "laundering",
      launderedDirtyCash: amount,
      cleanCashGained: cleanGain,
      feePaid: fee,
      heatGain,
      influenceGain: input.exchangeConfig.goodRate.influenceGain,
      ownedExchangeOffices: ownedCount,
      networkMultiplier: network
    }
  };
};

export const validateExchangeOfficeAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  actionId: string;
  balances: Record<string, number>;
  exchangeConfig?: ExchangeOfficeBalanceConfig;
}): string | null => {
  const config = input.exchangeConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId || input.actionId !== config.goodRate.actionId) {
    return null;
  }
  const metadata = getExchangeOfficeMetadata(input.building);
  if ((metadata.actionBlockedUntilTick ?? 0) > input.state.root.tick) {
    return "exchange_office_action_blocked";
  }
  if (Math.max(0, Number(input.balances["dirty-cash"] || 0)) < config.goodRate.minimumDirtyCash) {
    return "exchange_office_insufficient_dirty_cash";
  }
  return null;
};

export const applyExchangeOfficeAuditChecks = (
  state: CoreGameState,
  config: ExchangeOfficeBalanceConfig,
  tickRateMs: number
): CoreGameState => {
  const checkEveryTicks = minutesToTicks(config.auditCheckEveryMinutes, tickRateMs);
  let nextState = state;
  let buildingsById = state.buildingsById;
  let districtsById = state.districtsById;
  let resourceStatesById = state.resourceStatesById;
  let policeStatesById = state.policeStatesById;
  let changed = false;

  for (const building of Object.values(state.buildingsById)) {
    if (building.buildingTypeId !== config.buildingTypeId || building.status !== "active" || !building.ownerPlayerId) {
      continue;
    }
    const metadata = cleanupExchangeOfficeMetadata(getExchangeOfficeMetadata(building), state.root.tick);
    if ((metadata.lastAuditCheckTick ?? -Infinity) + checkEveryTicks > state.root.tick) {
      continue;
    }
    if (metadata.lastAuditCheckTick === undefined) {
      metadata.lastAuditCheckTick = state.root.tick;
      buildingsById = {
        ...buildingsById,
        [building.id]: {
          ...building,
          metadata: withExchangeOfficeMetadata(building, metadata),
          version: building.version + 1
        }
      };
      changed = true;
      continue;
    }

    const player = state.playersById[building.ownerPlayerId];
    const district = state.districtsById[building.districtId];
    if (!player || !district) {
      continue;
    }
    const playerHeat = Math.max(0, Number(policeStatesById[player.policeStateId]?.heat ?? district.heat ?? 0));
    const risk = resolveExchangeOfficeAuditRisk({
      config,
      state: { ...nextState, buildingsById },
      ownerPlayerId: player.id,
      playerHeat,
      tick: state.root.tick,
      tickRateMs
    });
    const triggered = deterministicRollPct(`${building.id}:exchange-audit:${state.root.tick}`) < risk.riskPct;
    metadata.lastAuditCheckTick = state.root.tick;

    if (triggered) {
      const consequence = resolveAuditConsequence(building.id, state.root.tick);
      metadata.auditLog = [
        ...(metadata.auditLog || []),
        { tick: state.root.tick, consequence, riskPct: risk.riskPct, launderedInWindow: risk.launderedInWindow }
      ].slice(-10);
      const ownedBuildings = getOwnedExchangeOfficeBuildings({ ...nextState, buildingsById }, player.id, config);

      if (consequence === "suspiciousTransaction") {
        buildingsById = applyMetadataToOwnedExchanges(buildingsById, ownedBuildings, (entry) => ({
          ...entry,
          incomePenaltyPct: config.auditConsequences.suspiciousTransaction.incomePenaltyPct,
          incomePenaltyExpiresAtTick: state.root.tick + minutesToTicks(config.auditConsequences.suspiciousTransaction.durationMinutes, tickRateMs)
        }));
      } else if (consequence === "blockedTransfer") {
        buildingsById = applyMetadataToOwnedExchanges(buildingsById, ownedBuildings, (entry) => ({
          ...entry,
          actionBlockedUntilTick: state.root.tick + minutesToTicks(config.auditConsequences.blockedTransfer.actionBlockedMinutes, tickRateMs)
        }));
      } else if (consequence === "lostClient") {
        buildingsById = applyMetadataToOwnedExchanges(buildingsById, ownedBuildings, (entry) => ({
          ...entry,
          dirtyIncomePenaltyPct: config.auditConsequences.lostClient.dirtyIncomePenaltyPct,
          dirtyIncomePenaltyExpiresAtTick: state.root.tick + minutesToTicks(config.auditConsequences.lostClient.durationMinutes, tickRateMs)
        }));
      } else if (consequence === "documentCheck") {
        districtsById = {
          ...districtsById,
          [district.id]: {
            ...district,
            heat: Math.max(0, Number(district.heat || 0) + config.auditConsequences.documentCheck.heatGain),
            version: district.version + 1
          }
        };
        const policeState = policeStatesById[player.policeStateId] ?? createPlayerPoliceState(player, state.root.tick);
        const heat = Math.max(0, Number(policeState.heat || 0) + config.auditConsequences.documentCheck.heatGain);
        policeStatesById = {
          ...policeStatesById,
          [policeState.id]: {
            ...policeState,
            heat,
            wantedLevel: resolveWantedLevel(heat),
            version: policeState.version + (policeStatesById[policeState.id] ? 1 : 0)
          }
        };
      } else if (consequence === "seizedCash") {
        const current = resourceStatesById[player.resourceStateId];
        const dirtyCash = Math.max(0, Number(current?.balances["dirty-cash"] || 0));
        const loss = Math.floor(dirtyCash * config.auditConsequences.seizedCash.dirtyCashLossPct / 100);
        if (current && loss > 0) {
          resourceStatesById = {
            ...resourceStatesById,
            [current.id]: {
              ...current,
              balances: {
                ...current.balances,
                "dirty-cash": Math.max(0, dirtyCash - loss)
              },
              version: current.version + 1
            }
          };
        }
      }
    }

    const currentMetadata = getExchangeOfficeMetadata(buildingsById[building.id] ?? building);
    const finalMetadata = {
      ...currentMetadata,
      launderedEvents: metadata.launderedEvents,
      auditRiskBonuses: metadata.auditRiskBonuses,
      lastAuditCheckTick: metadata.lastAuditCheckTick,
      auditLog: metadata.auditLog
    };
    buildingsById = {
      ...buildingsById,
      [building.id]: {
        ...building,
        metadata: withExchangeOfficeMetadata(building, finalMetadata),
        version: building.version + 1
      }
    };
    changed = true;
  }

  return changed
    ? { ...nextState, buildingsById, districtsById, resourceStatesById, policeStatesById }
    : state;
};

const getOwnedExchangeOfficeBuildings = (
  state: CoreGameState,
  playerId: string,
  config: ExchangeOfficeBalanceConfig
) =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  );

const applyMetadataToOwnedExchanges = (
  buildingsById: CoreGameState["buildingsById"],
  buildings: Array<CoreGameState["buildingsById"][string]>,
  update: (metadata: ExchangeOfficeMetadata) => ExchangeOfficeMetadata
) => {
  let next = buildingsById;
  for (const building of buildings) {
    const metadata = update(getExchangeOfficeMetadata(building));
    next = {
      ...next,
      [building.id]: {
        ...building,
        metadata: withExchangeOfficeMetadata(building, metadata),
        version: building.version + 1
      }
    };
  }
  return next;
};

const resolveAuditConsequence = (buildingId: string, tick: number): "suspiciousTransaction" | "blockedTransfer" | "lostClient" | "documentCheck" | "seizedCash" => {
  const roll = Math.floor(deterministicRollPct(`${buildingId}:exchange-audit-consequence:${tick}`) / 20);
  return ["suspiciousTransaction", "blockedTransfer", "lostClient", "documentCheck", "seizedCash"][Math.max(0, Math.min(4, roll))] as
    | "suspiciousTransaction"
    | "blockedTransfer"
    | "lostClient"
    | "documentCheck"
    | "seizedCash";
};

const cleanupExchangeOfficeMetadata = (metadata: ExchangeOfficeMetadata, tick: number): ExchangeOfficeMetadata => ({
  ...metadata,
  auditRiskBonuses: metadata.auditRiskBonuses.filter((bonus) => bonus.expiresAtTick > tick),
  auditLog: (metadata.auditLog || []).slice(-10)
});

const withExchangeOfficeMetadata = (
  building: CoreGameState["buildingsById"][string],
  exchangeOffice: ExchangeOfficeMetadata
): Record<string, unknown> => ({
  ...(building.metadata ?? {}),
  exchangeOffice
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
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : undefined;
};

const asOptionalNumber = (value: unknown): number | undefined => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
