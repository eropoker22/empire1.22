import type { BuildingActionBalanceConfig, CasinoBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";

export interface CasinoActionResolution {
  balances: Record<string, number>;
  buildingMetadata: Record<string, unknown>;
  heatGain: number;
  influenceChange: number;
  outputGain: Record<string, number>;
  inputCost: Record<string, number>;
  effectModifiers?: BuildingActionBalanceConfig["effectModifiers"];
  reportText: string;
  casinoResult: Record<string, unknown>;
}

interface CasinoMetadata {
  launderedEvents: Array<{ tick: number; amount: number }>;
  auditRiskBonuses: Array<{ expiresAtTick: number; riskPct: number; source: string }>;
  vipNightExpiresAtTick?: number;
  bribedInspectorExpiresAtTick?: number;
  incomePenaltyExpiresAtTick?: number;
  incomePenaltyPct?: number;
  launderingBlockedUntilTick?: number;
  vipBlockedUntilTick?: number;
  lastAuditCheckTick?: number;
  auditLog?: Array<Record<string, unknown>>;
}

export const isCasinoAction = (actionId: string, config?: CasinoBalanceConfig): boolean =>
  Boolean(config && [
    config.quietBackroom.actionId,
    config.vipNight.actionId,
    config.bribedInspector.actionId
  ].includes(actionId));

export const getCasinoMetadata = (
  building: CoreGameState["buildingsById"][string]
): CasinoMetadata => {
  const raw = isRecord(building.metadata?.casino) ? building.metadata?.casino : {};
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
            source: String((entry as Record<string, unknown>)?.source || "casino")
          }))
          .filter((entry) => entry.expiresAtTick > 0 && entry.riskPct > 0)
      : [],
    vipNightExpiresAtTick: asOptionalTick(raw.vipNightExpiresAtTick),
    bribedInspectorExpiresAtTick: asOptionalTick(raw.bribedInspectorExpiresAtTick),
    incomePenaltyExpiresAtTick: asOptionalTick(raw.incomePenaltyExpiresAtTick),
    incomePenaltyPct: asOptionalNumber(raw.incomePenaltyPct),
    launderingBlockedUntilTick: asOptionalTick(raw.launderingBlockedUntilTick),
    vipBlockedUntilTick: asOptionalTick(raw.vipBlockedUntilTick),
    lastAuditCheckTick: asOptionalTick(raw.lastAuditCheckTick),
    auditLog: Array.isArray(raw.auditLog) ? raw.auditLog.filter(isRecord).slice(-10) : []
  };
};

export const resolveCasinoAuditRisk = (input: {
  config: CasinoBalanceConfig;
  building: CoreGameState["buildingsById"][string];
  playerHeat: number;
  tick: number;
  tickRateMs: number;
}): { riskPct: number; launderedInWindow: number } => {
  const metadata = getCasinoMetadata(input.building);
  const windowTicks = minutesToTicks(input.config.auditWindowMinutes, input.tickRateMs);
  const thresholdTick = Math.max(0, input.tick - windowTicks);
  const launderedInWindow = metadata.launderedEvents
    .filter((entry) => entry.tick >= thresholdTick)
    .reduce((total, entry) => total + entry.amount, 0);
  const tier = input.config.auditRiskTiers.find((candidate) =>
    candidate.maxLaunderedAmount === null || launderedInWindow <= candidate.maxLaunderedAmount
  );
  let riskPct = tier?.riskPct ?? input.config.baseAuditRiskPct;

  riskPct += metadata.auditRiskBonuses
    .filter((bonus) => bonus.expiresAtTick > input.tick)
    .reduce((total, bonus) => total + bonus.riskPct, 0);
  if ((metadata.vipNightExpiresAtTick ?? 0) > input.tick) {
    riskPct += input.config.vipNight.auditRiskBonusPct;
  }
  if (input.playerHeat > 180) {
    riskPct += 20;
  } else if (input.playerHeat > 100) {
    riskPct += 10;
  }
  if ((metadata.bribedInspectorExpiresAtTick ?? 0) > input.tick) {
    riskPct *= 1 - input.config.bribedInspector.successAuditRiskReductionPct / 100;
  }

  return {
    riskPct: Math.max(0, Math.round(riskPct * 10) / 10),
    launderedInWindow
  };
};

export const applyCasinoIncomeModifiers = (input: {
  config: CasinoBalanceConfig;
  building: CoreGameState["buildingsById"][string];
  tick: number;
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}): { cleanPerHour: number; dirtyPerHour: number; heatPerDay: number; influencePerDay: number } => {
  if (input.building.buildingTypeId !== input.config.buildingTypeId) {
    return input;
  }
  const metadata = getCasinoMetadata(input.building);
  const upgrade = getCasinoUpgrade(input.config, input.building.level);
  const incomeMultiplier = 1 + upgrade.incomeBonusPct / 100;
  const penaltyMultiplier = (metadata.incomePenaltyExpiresAtTick ?? 0) > input.tick
    ? 1 - Math.max(0, Number(metadata.incomePenaltyPct || 0)) / 100
    : 1;
  const vipCleanMultiplier = (metadata.vipNightExpiresAtTick ?? 0) > input.tick
    ? 1 + input.config.vipNight.cleanIncomeBonusPct / 100
    : 1;
  const vipDirtyMultiplier = (metadata.vipNightExpiresAtTick ?? 0) > input.tick
    ? 1 + input.config.vipNight.dirtyIncomeBonusPct / 100
    : 1;
  const vipHeatMultiplier = (metadata.vipNightExpiresAtTick ?? 0) > input.tick
    ? 1 + input.config.vipNight.heatBonusPct / 100
    : 1;
  const vipInfluenceMultiplier = (metadata.vipNightExpiresAtTick ?? 0) > input.tick
    ? 1 + input.config.vipNight.influenceBonusPct / 100
    : 1;

  return {
    cleanPerHour: input.cleanPerHour * incomeMultiplier * penaltyMultiplier * vipCleanMultiplier,
    dirtyPerHour: input.dirtyPerHour * incomeMultiplier * penaltyMultiplier * vipDirtyMultiplier,
    heatPerDay: input.heatPerDay * vipHeatMultiplier,
    influencePerDay: input.influencePerDay * vipInfluenceMultiplier
  };
};

export const resolveCasinoAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  balances: Record<string, number>;
  casinoConfig: CasinoBalanceConfig;
  tickRateMs: number;
  commandId: string;
}): CasinoActionResolution | null => {
  if (input.action.actionId === input.casinoConfig.quietBackroom.actionId) {
    return resolveQuietBackroom(input);
  }
  if (input.action.actionId === input.casinoConfig.vipNight.actionId) {
    return resolveVipNight(input);
  }
  if (input.action.actionId === input.casinoConfig.bribedInspector.actionId) {
    return resolveBribedInspector(input);
  }
  return null;
};

export const validateCasinoAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  actionId: string;
  balances: Record<string, number>;
  casinoConfig?: CasinoBalanceConfig;
}): string | null => {
  const config = input.casinoConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId || !isCasinoAction(input.actionId, config)) {
    return null;
  }
  const metadata = getCasinoMetadata(input.building);
  if (input.actionId === config.quietBackroom.actionId) {
    if ((metadata.launderingBlockedUntilTick ?? 0) > input.state.root.tick) {
      return "casino_laundering_blocked";
    }
    if (Math.max(0, Number(input.balances["dirty-cash"] || 0)) < config.quietBackroom.minimumDirtyCash) {
      return "casino_insufficient_dirty_cash";
    }
  }
  if (input.actionId === config.vipNight.actionId) {
    if ((metadata.vipNightExpiresAtTick ?? 0) > input.state.root.tick) {
      return "casino_vip_night_active";
    }
    if ((metadata.vipBlockedUntilTick ?? 0) > input.state.root.tick) {
      return "casino_vip_lounge_closed";
    }
  }
  return null;
};

export const applyCasinoAuditChecks = (
  state: CoreGameState,
  casinoConfig: CasinoBalanceConfig,
  tickRateMs: number
): CoreGameState => {
  const checkEveryTicks = minutesToTicks(casinoConfig.auditCheckEveryMinutes, tickRateMs);
  let nextState = state;
  let buildingsById = state.buildingsById;
  let districtsById = state.districtsById;
  let resourceStatesById = state.resourceStatesById;
  let policeStatesById = state.policeStatesById;
  let changed = false;

  for (const building of Object.values(state.buildingsById)) {
    if (building.buildingTypeId !== casinoConfig.buildingTypeId || building.status !== "active" || !building.ownerPlayerId) {
      continue;
    }
    const metadata = cleanupCasinoMetadata(getCasinoMetadata(building), state.root.tick);
    if ((metadata.lastAuditCheckTick ?? -Infinity) + checkEveryTicks > state.root.tick) {
      continue;
    }
    if (metadata.lastAuditCheckTick === undefined) {
      metadata.lastAuditCheckTick = state.root.tick;
      buildingsById = {
        ...buildingsById,
        [building.id]: {
          ...building,
          metadata: withCasinoMetadata(building, metadata),
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
    const risk = resolveCasinoAuditRisk({
      config: casinoConfig,
      building: {
        ...building,
        metadata: withCasinoMetadata(building, metadata)
      },
      playerHeat,
      tick: state.root.tick,
      tickRateMs
    });
    const triggered = deterministicRollPct(`${building.id}:audit:${state.root.tick}`) < risk.riskPct;
    metadata.lastAuditCheckTick = state.root.tick;

    if (triggered) {
      const consequence = resolveAuditConsequence(building.id, state.root.tick);
      metadata.auditLog = [
        ...(metadata.auditLog || []),
        { tick: state.root.tick, consequence, riskPct: risk.riskPct, launderedInWindow: risk.launderedInWindow }
      ].slice(-10);

      if (consequence === "lightInspection") {
        metadata.incomePenaltyPct = casinoConfig.auditConsequences.lightInspection.incomePenaltyPct;
        metadata.incomePenaltyExpiresAtTick = state.root.tick + minutesToTicks(casinoConfig.auditConsequences.lightInspection.durationMinutes, tickRateMs);
      } else if (consequence === "seizedBooks") {
        const current = resourceStatesById[player.resourceStateId];
        const dirtyCash = Math.max(0, Number(current?.balances["dirty-cash"] || 0));
        const loss = Math.floor(dirtyCash * casinoConfig.auditConsequences.seizedBooks.dirtyCashLossPct / 100);
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
      } else if (consequence === "frozenAccounts") {
        metadata.launderingBlockedUntilTick = state.root.tick + minutesToTicks(casinoConfig.auditConsequences.frozenAccounts.launderingBlockedMinutes, tickRateMs);
      } else if (consequence === "policeRaid") {
        metadata.incomePenaltyPct = casinoConfig.auditConsequences.policeRaid.incomePenaltyPct;
        metadata.incomePenaltyExpiresAtTick = state.root.tick + minutesToTicks(casinoConfig.auditConsequences.policeRaid.durationMinutes, tickRateMs);
        districtsById = {
          ...districtsById,
          [district.id]: {
            ...district,
            heat: Math.max(0, Number(district.heat || 0) + casinoConfig.auditConsequences.policeRaid.heatGain),
            version: district.version + 1
          }
        };
        const policeState = policeStatesById[player.policeStateId];
        if (policeState) {
          policeStatesById = {
            ...policeStatesById,
            [policeState.id]: {
              ...policeState,
              heat: Math.max(0, Number(policeState.heat || 0) + casinoConfig.auditConsequences.policeRaid.heatGain),
              version: policeState.version + 1
            }
          };
        }
      } else if (consequence === "closedVipLounge") {
        metadata.vipBlockedUntilTick = state.root.tick + minutesToTicks(casinoConfig.auditConsequences.closedVipLounge.vipBlockedMinutes, tickRateMs);
      }
    }

    buildingsById = {
      ...buildingsById,
      [building.id]: {
        ...building,
        metadata: withCasinoMetadata(building, metadata),
        version: building.version + 1
      }
    };
    changed = true;
  }

  if (!changed) {
    return state;
  }

  nextState = {
    ...nextState,
    buildingsById,
    districtsById,
    resourceStatesById,
    policeStatesById
  };
  return nextState;
};

const resolveAuditConsequence = (buildingId: string, tick: number): "lightInspection" | "seizedBooks" | "frozenAccounts" | "policeRaid" | "closedVipLounge" => {
  const roll = Math.floor(deterministicRollPct(`${buildingId}:audit-consequence:${tick}`) / 20);
  return ["lightInspection", "seizedBooks", "frozenAccounts", "policeRaid", "closedVipLounge"][Math.max(0, Math.min(4, roll))] as
    | "lightInspection"
    | "seizedBooks"
    | "frozenAccounts"
    | "policeRaid"
    | "closedVipLounge";
};

const resolveQuietBackroom = (input: Parameters<typeof resolveCasinoAction>[0]): CasinoActionResolution => {
  const config = input.casinoConfig;
  const metadata = cleanupCasinoMetadata(getCasinoMetadata(input.building), input.state.root.tick);
  const dirtyCash = Math.max(0, Math.floor(Number(input.balances["dirty-cash"] || 0)));
  const upgrade = getCasinoUpgrade(config, input.building.level);
  const capacity = Math.floor(config.launderingCapacity * (1 + upgrade.launderingLimitBonusPct / 100));
  const amount = Math.min(Math.floor(dirtyCash * config.quietBackroom.dirtyCashSharePct / 100), config.quietBackroom.maxDirtyCashPerAction, capacity);
  const feePct = Math.max(0, config.quietBackroom.feePct - (upgrade.feeReductionPct ?? 0));
  const fee = Math.floor(amount * feePct / 100);
  const cleanGain = Math.max(0, amount - fee);
  const heatGain = reduceCasinoActionHeat(config.quietBackroom.heatGain, upgrade);
  const nextBalances = {
    ...input.balances,
    "dirty-cash": Math.max(0, dirtyCash - amount),
    cash: Math.max(0, Number(input.balances.cash || 0) + cleanGain)
  };

  metadata.launderedEvents.push({ tick: input.state.root.tick, amount });
  metadata.auditRiskBonuses.push({
    expiresAtTick: input.state.root.tick + minutesToTicks(config.quietBackroom.auditRiskDurationMinutes, input.tickRateMs),
    riskPct: config.quietBackroom.auditRiskBonusPct,
    source: config.quietBackroom.actionId
  });

  return {
    balances: nextBalances,
    buildingMetadata: withCasinoMetadata(input.building, metadata),
    heatGain,
    influenceChange: config.quietBackroom.influenceGain,
    inputCost: { "dirty-cash": amount },
    outputGain: { cash: cleanGain },
    reportText: `Tichá herna vyprala ${amount} dirty cash na ${cleanGain} clean cash. Poplatek ${fee}. Heat +${heatGain}.`,
    casinoResult: {
      type: "laundering",
      launderedDirtyCash: amount,
      cleanCashGained: cleanGain,
      feePaid: fee,
      heatGain,
      influenceGain: config.quietBackroom.influenceGain
    }
  };
};

const resolveVipNight = (input: Parameters<typeof resolveCasinoAction>[0]): CasinoActionResolution => {
  const config = input.casinoConfig;
  const metadata = cleanupCasinoMetadata(getCasinoMetadata(input.building), input.state.root.tick);
  metadata.vipNightExpiresAtTick = input.state.root.tick + minutesToTicks(config.vipNight.durationMinutes, input.tickRateMs);

  return {
    balances: { ...input.balances },
    buildingMetadata: withCasinoMetadata(input.building, metadata),
    heatGain: 0,
    influenceChange: 0,
    inputCost: {},
    outputGain: {},
    effectModifiers: {
      cleanIncomeMultiplier: 1 + config.vipNight.cleanIncomeBonusPct / 100,
      dirtyIncomeMultiplier: 1 + config.vipNight.dirtyIncomeBonusPct / 100,
      influenceMultiplier: 1 + config.vipNight.influenceBonusPct / 100,
      heatMultiplier: 1 + config.vipNight.heatBonusPct / 100
    },
    reportText: `VIP noc aktivní ${config.vipNight.durationMinutes} minut. Income, vliv, heat i audit risk jsou zvýšené.`,
    casinoResult: {
      type: "temporary_boost",
      activeUntilTick: metadata.vipNightExpiresAtTick,
      durationMinutes: config.vipNight.durationMinutes,
      auditRiskBonusPct: config.vipNight.auditRiskBonusPct
    }
  };
};

const resolveBribedInspector = (input: Parameters<typeof resolveCasinoAction>[0]): CasinoActionResolution => {
  const config = input.casinoConfig;
  const metadata = cleanupCasinoMetadata(getCasinoMetadata(input.building), input.state.root.tick);
  const cleanCash = Math.max(0, Number(input.balances.cash || 0));
  const failed = deterministicRollPct(`${input.commandId}:${input.state.root.tick}`) < config.bribedInspector.failureChancePct;
  const nextBalances = {
    ...input.balances,
    cash: Math.max(0, cleanCash - config.bribedInspector.cleanCashCost)
  };

  if (failed) {
    metadata.auditRiskBonuses.push({
      expiresAtTick: input.state.root.tick + minutesToTicks(config.bribedInspector.failureAuditRiskDurationMinutes, input.tickRateMs),
      riskPct: config.bribedInspector.failureAuditRiskBonusPct,
      source: config.bribedInspector.actionId
    });
    return {
      balances: nextBalances,
      buildingMetadata: withCasinoMetadata(input.building, metadata),
      heatGain: config.bribedInspector.failureHeatGain,
      influenceChange: 0,
      inputCost: { cash: config.bribedInspector.cleanCashCost },
      outputGain: {},
      reportText: `Podplacený inspektor selhal. Cena propadla, heat +${config.bribedInspector.failureHeatGain}, audit risk +${config.bribedInspector.failureAuditRiskBonusPct} %.`,
      casinoResult: {
        type: "heat_control",
        success: false,
        costPaid: config.bribedInspector.cleanCashCost,
        heatGain: config.bribedInspector.failureHeatGain,
        auditRiskBonusPct: config.bribedInspector.failureAuditRiskBonusPct
      }
    };
  }

  metadata.bribedInspectorExpiresAtTick = input.state.root.tick + minutesToTicks(config.bribedInspector.protectionMinutes, input.tickRateMs);
  return {
    balances: nextBalances,
    buildingMetadata: withCasinoMetadata(input.building, metadata),
    heatGain: -config.bribedInspector.successHeatReduction,
    influenceChange: config.bribedInspector.successInfluenceGain,
    inputCost: { cash: config.bribedInspector.cleanCashCost },
    outputGain: {},
    reportText: `Podplacený inspektor uspěl. Heat -${config.bribedInspector.successHeatReduction}, audit risk relativně -${config.bribedInspector.successAuditRiskReductionPct} %.`,
    casinoResult: {
      type: "heat_control",
      success: true,
      costPaid: config.bribedInspector.cleanCashCost,
      heatReduction: config.bribedInspector.successHeatReduction,
      influenceGain: config.bribedInspector.successInfluenceGain,
      auditRiskReductionPct: config.bribedInspector.successAuditRiskReductionPct
    }
  };
};

const cleanupCasinoMetadata = (metadata: CasinoMetadata, tick: number): CasinoMetadata => ({
  ...metadata,
  auditRiskBonuses: metadata.auditRiskBonuses.filter((bonus) => bonus.expiresAtTick > tick),
  auditLog: (metadata.auditLog || []).slice(-10)
});

const withCasinoMetadata = (
  building: CoreGameState["buildingsById"][string],
  casino: CasinoMetadata
): Record<string, unknown> => ({
  ...(building.metadata ?? {}),
  casino
});

const getCasinoUpgrade = (config: CasinoBalanceConfig, level: number) => {
  const safeLevel = Math.max(1, Math.floor(Number(level || 1)));
  return [...config.upgrades]
    .sort((a, b) => b.level - a.level)
    .find((upgrade) => upgrade.level <= safeLevel) ?? config.upgrades[0];
};

const reduceCasinoActionHeat = (heatGain: number, upgrade: { actionHeatReductionPct?: number }): number =>
  Math.floor(Number(heatGain || 0) * (1 - Math.max(0, Number(upgrade.actionHeatReductionPct || 0)) / 100));

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
