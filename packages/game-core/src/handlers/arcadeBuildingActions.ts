import type { ArcadeBalanceConfig, BuildingActionBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { createPlayerPoliceState, resolveWantedLevel } from "./playerPoliceState";

export interface ArcadeActionResolution {
  balances: Record<string, number>;
  buildingMetadata: Record<string, unknown>;
  heatGain: number;
  influenceChange: number;
  outputGain: Record<string, number>;
  inputCost: Record<string, number>;
  effectModifiers?: BuildingActionBalanceConfig["effectModifiers"];
  reportText: string;
  arcadeResult: Record<string, unknown>;
}

interface ArcadeMetadata {
  launderedEvents: Array<{ tick: number; amount: number }>;
  auditRiskBonuses: Array<{ expiresAtTick: number; riskPct: number; source: string }>;
  nightMachinesExpiresAtTick?: number;
  incomePenaltyExpiresAtTick?: number;
  incomePenaltyPct?: number;
  dirtyIncomePenaltyExpiresAtTick?: number;
  dirtyIncomePenaltyPct?: number;
  backCashdeskBlockedUntilTick?: number;
  lastAuditCheckTick?: number;
  auditLog?: Array<Record<string, unknown>>;
}

export const getOwnedArcadeCount = (state: CoreGameState, playerId: string, config: ArcadeBalanceConfig): number =>
  getOwnedArcadeBuildings(state, playerId, config).length;

export const resolveArcadeNetworkMultipliers = (
  count: number,
  config: ArcadeBalanceConfig
): { incomeMultiplier: number; launderingLimitMultiplier: number; heatMultiplier: number } => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return {
    incomeMultiplier: Math.min(config.network.maxIncomeMultiplier, 1 + extra * config.network.incomeBonusPctPerExtraArcade / 100),
    launderingLimitMultiplier: Math.min(config.network.maxLaunderingLimitMultiplier, 1 + extra * config.network.launderingLimitBonusPctPerExtraArcade / 100),
    heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraArcade / 100)
  };
};

export const getArcadeMetadata = (building: CoreGameState["buildingsById"][string]): ArcadeMetadata => {
  const raw = isRecord(building.metadata?.arcade) ? building.metadata?.arcade : {};
  return {
    launderedEvents: Array.isArray(raw.launderedEvents)
      ? raw.launderedEvents.map((entry) => ({
          tick: Math.max(0, Math.floor(Number((entry as Record<string, unknown>)?.tick || 0))),
          amount: Math.max(0, Math.floor(Number((entry as Record<string, unknown>)?.amount || 0)))
        })).filter((entry) => entry.amount > 0)
      : [],
    auditRiskBonuses: Array.isArray(raw.auditRiskBonuses)
      ? raw.auditRiskBonuses.map((entry) => ({
          expiresAtTick: Math.max(0, Math.floor(Number((entry as Record<string, unknown>)?.expiresAtTick || 0))),
          riskPct: Math.max(0, Number((entry as Record<string, unknown>)?.riskPct || 0)),
          source: String((entry as Record<string, unknown>)?.source || "arcade")
        })).filter((entry) => entry.expiresAtTick > 0 && entry.riskPct > 0)
      : [],
    nightMachinesExpiresAtTick: asOptionalTick(raw.nightMachinesExpiresAtTick),
    incomePenaltyExpiresAtTick: asOptionalTick(raw.incomePenaltyExpiresAtTick),
    incomePenaltyPct: asOptionalNumber(raw.incomePenaltyPct),
    dirtyIncomePenaltyExpiresAtTick: asOptionalTick(raw.dirtyIncomePenaltyExpiresAtTick),
    dirtyIncomePenaltyPct: asOptionalNumber(raw.dirtyIncomePenaltyPct),
    backCashdeskBlockedUntilTick: asOptionalTick(raw.backCashdeskBlockedUntilTick),
    lastAuditCheckTick: asOptionalTick(raw.lastAuditCheckTick),
    auditLog: Array.isArray(raw.auditLog) ? raw.auditLog.filter(isRecord).slice(-10) : []
  };
};

export const resolveArcadeAuditRisk = (input: {
  config: ArcadeBalanceConfig;
  state: CoreGameState;
  ownerPlayerId: string;
  playerHeat: number;
  tick: number;
  tickRateMs: number;
}): { riskPct: number; launderedInWindow: number; ownedCount: number } => {
  const windowTicks = minutesToTicks(input.config.auditWindowMinutes, input.tickRateMs);
  const thresholdTick = Math.max(0, input.tick - windowTicks);
  const ownedBuildings = getOwnedArcadeBuildings(input.state, input.ownerPlayerId, input.config);
  const launderedInWindow = ownedBuildings
    .flatMap((building) => getArcadeMetadata(building).launderedEvents)
    .filter((entry) => entry.tick >= thresholdTick)
    .reduce((total, entry) => total + entry.amount, 0);
  const tier = input.config.auditRiskTiers.find((candidate) =>
    candidate.maxLaunderedAmount === null || launderedInWindow <= candidate.maxLaunderedAmount
  );
  let riskPct = tier?.riskPct ?? input.config.baseAuditRiskPct;
  riskPct += ownedBuildings
    .flatMap((building) => getArcadeMetadata(building).auditRiskBonuses)
    .filter((bonus) => bonus.expiresAtTick > input.tick)
    .reduce((total, bonus) => total + bonus.riskPct, 0);
  if (ownedBuildings.some((building) => (getArcadeMetadata(building).nightMachinesExpiresAtTick ?? 0) > input.tick)) {
    riskPct += input.config.nightMachines.auditRiskBonusPct;
  }
  if (ownedBuildings.length >= 12) {
    riskPct += 9;
  } else if (ownedBuildings.length >= 8) {
    riskPct += 5;
  }
  if (input.playerHeat > 180) {
    riskPct += 13;
  } else if (input.playerHeat > 100) {
    riskPct += 7;
  }
  return { riskPct: Math.max(0, Math.round(riskPct * 10) / 10), launderedInWindow, ownedCount: ownedBuildings.length };
};

export const applyArcadeIncomeModifiers = (input: {
  config: ArcadeBalanceConfig;
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  tick: number;
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}): { cleanPerHour: number; dirtyPerHour: number; heatPerDay: number; influencePerDay: number } => {
  if (input.building.buildingTypeId !== input.config.buildingTypeId || !input.building.ownerPlayerId) {
    return { cleanPerHour: input.cleanPerHour, dirtyPerHour: input.dirtyPerHour, heatPerDay: input.heatPerDay, influencePerDay: input.influencePerDay };
  }
  const metadata = getArcadeMetadata(input.building);
  const network = resolveArcadeNetworkMultipliers(getOwnedArcadeCount(input.state, input.building.ownerPlayerId, input.config), input.config);
  const incomePenalty = (metadata.incomePenaltyExpiresAtTick ?? 0) > input.tick ? 1 - Math.max(0, Number(metadata.incomePenaltyPct || 0)) / 100 : 1;
  const dirtyPenalty = (metadata.dirtyIncomePenaltyExpiresAtTick ?? 0) > input.tick ? 1 - Math.max(0, Number(metadata.dirtyIncomePenaltyPct || 0)) / 100 : 1;
  const nightActive = (metadata.nightMachinesExpiresAtTick ?? 0) > input.tick;
  return {
    cleanPerHour: input.cleanPerHour * network.incomeMultiplier * incomePenalty * (nightActive ? 1 + input.config.nightMachines.cleanIncomeBonusPct / 100 : 1),
    dirtyPerHour: input.dirtyPerHour * network.incomeMultiplier * incomePenalty * dirtyPenalty * (nightActive ? 1 + input.config.nightMachines.dirtyIncomeBonusPct / 100 : 1),
    heatPerDay: input.heatPerDay * network.heatMultiplier * (nightActive ? 1 + input.config.nightMachines.heatBonusPct / 100 : 1),
    influencePerDay: input.influencePerDay * (nightActive ? 1 + input.config.nightMachines.influenceBonusPct / 100 : 1)
  };
};

export const resolveArcadeAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  balances: Record<string, number>;
  arcadeConfig: ArcadeBalanceConfig;
  tickRateMs: number;
}): ArcadeActionResolution | null => {
  if (input.action.actionId === input.arcadeConfig.nightMachines.actionId) {
    return resolveNightMachines(input);
  }
  if (input.action.actionId === input.arcadeConfig.backCashdesk.actionId) {
    return resolveBackCashdesk(input);
  }
  return null;
};

export const validateArcadeAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  actionId: string;
  balances: Record<string, number>;
  arcadeConfig?: ArcadeBalanceConfig;
}): string | null => {
  const config = input.arcadeConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) return null;
  const metadata = getArcadeMetadata(input.building);
  if (input.actionId === config.nightMachines.actionId && (metadata.nightMachinesExpiresAtTick ?? 0) > input.state.root.tick) {
    return "arcade_night_machines_active";
  }
  if (input.actionId === config.backCashdesk.actionId) {
    if ((metadata.backCashdeskBlockedUntilTick ?? 0) > input.state.root.tick) return "arcade_back_cashdesk_blocked";
    if (Math.max(0, Number(input.balances["dirty-cash"] || 0)) < config.backCashdesk.minimumDirtyCash) return "arcade_insufficient_dirty_cash";
  }
  return null;
};

export const applyArcadeAuditChecks = (state: CoreGameState, config: ArcadeBalanceConfig, tickRateMs: number): CoreGameState => {
  const checkEveryTicks = minutesToTicks(config.auditCheckEveryMinutes, tickRateMs);
  let buildingsById = state.buildingsById;
  let districtsById = state.districtsById;
  let resourceStatesById = state.resourceStatesById;
  let policeStatesById = state.policeStatesById;
  let changed = false;
  for (const building of Object.values(state.buildingsById)) {
    if (building.buildingTypeId !== config.buildingTypeId || building.status !== "active" || !building.ownerPlayerId) continue;
    const metadata = cleanupArcadeMetadata(getArcadeMetadata(building), state.root.tick);
    if ((metadata.lastAuditCheckTick ?? -Infinity) + checkEveryTicks > state.root.tick) continue;
    if (metadata.lastAuditCheckTick === undefined) {
      metadata.lastAuditCheckTick = state.root.tick;
      buildingsById = { ...buildingsById, [building.id]: { ...building, metadata: withArcadeMetadata(building, metadata), version: building.version + 1 } };
      changed = true;
      continue;
    }
    const player = state.playersById[building.ownerPlayerId];
    const district = state.districtsById[building.districtId];
    if (!player || !district) continue;
    const playerHeat = Math.max(0, Number(policeStatesById[player.policeStateId]?.heat ?? district.heat ?? 0));
    const risk = resolveArcadeAuditRisk({ config, state: { ...state, buildingsById }, ownerPlayerId: player.id, playerHeat, tick: state.root.tick, tickRateMs });
    const triggered = deterministicRollPct(`${building.id}:arcade-audit:${state.root.tick}`) < risk.riskPct;
    metadata.lastAuditCheckTick = state.root.tick;
    if (triggered) {
      const consequence = resolveAuditConsequence(building.id, state.root.tick);
      metadata.auditLog = [...(metadata.auditLog || []), { tick: state.root.tick, consequence, riskPct: risk.riskPct, launderedInWindow: risk.launderedInWindow }].slice(-10);
      const owned = getOwnedArcadeBuildings({ ...state, buildingsById }, player.id, config);
      if (consequence === "machineInspection") {
        buildingsById = applyMetadataToOwnedArcades(buildingsById, owned, (entry) => ({ ...entry, incomePenaltyPct: config.auditConsequences.machineInspection.incomePenaltyPct, incomePenaltyExpiresAtTick: state.root.tick + minutesToTicks(config.auditConsequences.machineInspection.durationMinutes, tickRateMs) }));
      } else if (consequence === "seizedMachine") {
        buildingsById = applyMetadataToOwnedArcades(buildingsById, owned, (entry) => ({ ...entry, dirtyIncomePenaltyPct: config.auditConsequences.seizedMachine.dirtyIncomePenaltyPct, dirtyIncomePenaltyExpiresAtTick: state.root.tick + minutesToTicks(config.auditConsequences.seizedMachine.durationMinutes, tickRateMs) }));
      } else if (consequence === "closedBackRoom") {
        buildingsById = applyMetadataToOwnedArcades(buildingsById, owned, (entry) => ({ ...entry, backCashdeskBlockedUntilTick: state.root.tick + minutesToTicks(config.auditConsequences.closedBackRoom.actionBlockedMinutes, tickRateMs) }));
      } else if (consequence === "operatingFine") {
        const current = resourceStatesById[player.resourceStateId];
        if (current) resourceStatesById = { ...resourceStatesById, [current.id]: { ...current, balances: { ...current.balances, cash: Math.max(0, Number(current.balances.cash || 0) - config.auditConsequences.operatingFine.cleanCashLoss) }, version: current.version + 1 } };
      } else if (consequence === "localRaid") {
        districtsById = { ...districtsById, [district.id]: { ...district, heat: Math.max(0, Number(district.heat || 0) + config.auditConsequences.localRaid.heatGain), version: district.version + 1 } };
        const policeState = policeStatesById[player.policeStateId] ?? createPlayerPoliceState(player, state.root.tick);
        const heat = Math.max(0, Number(policeState.heat || 0) + config.auditConsequences.localRaid.heatGain);
        policeStatesById = { ...policeStatesById, [policeState.id]: { ...policeState, heat, wantedLevel: resolveWantedLevel(heat), version: policeState.version + (policeStatesById[policeState.id] ? 1 : 0) } };
      }
    }
    const currentMetadata = getArcadeMetadata(buildingsById[building.id] ?? building);
    const finalMetadata = { ...currentMetadata, launderedEvents: metadata.launderedEvents, auditRiskBonuses: metadata.auditRiskBonuses, lastAuditCheckTick: metadata.lastAuditCheckTick, auditLog: metadata.auditLog };
    buildingsById = { ...buildingsById, [building.id]: { ...building, metadata: withArcadeMetadata(building, finalMetadata), version: building.version + 1 } };
    changed = true;
  }
  return changed ? { ...state, buildingsById, districtsById, resourceStatesById, policeStatesById } : state;
};

const resolveNightMachines = (input: Parameters<typeof resolveArcadeAction>[0]): ArcadeActionResolution => {
  const metadata = cleanupArcadeMetadata(getArcadeMetadata(input.building), input.state.root.tick);
  metadata.nightMachinesExpiresAtTick = input.state.root.tick + minutesToTicks(input.arcadeConfig.nightMachines.durationMinutes, input.tickRateMs);
  return {
    balances: { ...input.balances },
    buildingMetadata: withArcadeMetadata(input.building, metadata),
    heatGain: 0,
    influenceChange: 0,
    inputCost: {},
    outputGain: {},
    effectModifiers: input.action.effectModifiers,
    reportText: `Noční automaty aktivní ${input.arcadeConfig.nightMachines.durationMinutes} minut.`,
    arcadeResult: { type: "temporary_boost", activeUntilTick: metadata.nightMachinesExpiresAtTick, durationMinutes: input.arcadeConfig.nightMachines.durationMinutes, auditRiskBonusPct: input.arcadeConfig.nightMachines.auditRiskBonusPct }
  };
};

const resolveBackCashdesk = (input: Parameters<typeof resolveArcadeAction>[0]): ArcadeActionResolution => {
  const metadata = cleanupArcadeMetadata(getArcadeMetadata(input.building), input.state.root.tick);
  const dirtyCash = Math.max(0, Math.floor(Number(input.balances["dirty-cash"] || 0)));
  const ownedCount = input.building.ownerPlayerId ? getOwnedArcadeCount(input.state, input.building.ownerPlayerId, input.arcadeConfig) : 1;
  const network = resolveArcadeNetworkMultipliers(ownedCount, input.arcadeConfig);
  const amount = Math.min(Math.floor(dirtyCash * input.arcadeConfig.backCashdesk.dirtyCashSharePct / 100), Math.floor(input.arcadeConfig.backCashdesk.maxDirtyCashPerAction * network.launderingLimitMultiplier));
  const fee = Math.floor(amount * input.arcadeConfig.backCashdesk.feePct / 100);
  const cleanGain = Math.max(0, amount - fee);
  metadata.launderedEvents.push({ tick: input.state.root.tick, amount });
  metadata.auditRiskBonuses.push({ expiresAtTick: input.state.root.tick + minutesToTicks(input.arcadeConfig.backCashdesk.auditRiskDurationMinutes, input.tickRateMs), riskPct: input.arcadeConfig.backCashdesk.auditRiskBonusPct, source: input.arcadeConfig.backCashdesk.actionId });
  return {
    balances: { ...input.balances, "dirty-cash": Math.max(0, dirtyCash - amount), cash: Math.max(0, Number(input.balances.cash || 0) + cleanGain) },
    buildingMetadata: withArcadeMetadata(input.building, metadata),
    heatGain: input.arcadeConfig.backCashdesk.heatGain,
    influenceChange: input.arcadeConfig.backCashdesk.influenceGain,
    inputCost: { "dirty-cash": amount },
    outputGain: { cash: cleanGain },
    reportText: `Zadní pokladna vyprala ${amount} dirty cash na ${cleanGain} clean cash. Poplatek ${fee}. Heat +${input.arcadeConfig.backCashdesk.heatGain}. Vliv +${input.arcadeConfig.backCashdesk.influenceGain}. Audit risk +${input.arcadeConfig.backCashdesk.auditRiskBonusPct}% na ${input.arcadeConfig.backCashdesk.auditRiskDurationMinutes} min.`,
    arcadeResult: { type: "laundering", launderedDirtyCash: amount, cleanCashGained: cleanGain, feePaid: fee, heatGain: input.arcadeConfig.backCashdesk.heatGain, influenceGain: input.arcadeConfig.backCashdesk.influenceGain, auditRiskBonusPct: input.arcadeConfig.backCashdesk.auditRiskBonusPct, auditRiskDurationMinutes: input.arcadeConfig.backCashdesk.auditRiskDurationMinutes, ownedArcades: ownedCount, networkMultiplier: network }
  };
};

const getOwnedArcadeBuildings = (state: CoreGameState, playerId: string, config: ArcadeBalanceConfig) =>
  Object.values(state.buildingsById).filter((building) => building.buildingTypeId === config.buildingTypeId && building.ownerPlayerId === playerId && building.status === "active");

const applyMetadataToOwnedArcades = (buildingsById: CoreGameState["buildingsById"], buildings: Array<CoreGameState["buildingsById"][string]>, update: (metadata: ArcadeMetadata) => ArcadeMetadata) => {
  let next = buildingsById;
  for (const building of buildings) {
    const metadata = update(getArcadeMetadata(building));
    next = { ...next, [building.id]: { ...building, metadata: withArcadeMetadata(building, metadata), version: building.version + 1 } };
  }
  return next;
};

const resolveAuditConsequence = (buildingId: string, tick: number): "machineInspection" | "seizedMachine" | "closedBackRoom" | "operatingFine" | "localRaid" => {
  const roll = Math.floor(deterministicRollPct(`${buildingId}:arcade-audit-consequence:${tick}`) / 20);
  return ["machineInspection", "seizedMachine", "closedBackRoom", "operatingFine", "localRaid"][Math.max(0, Math.min(4, roll))] as "machineInspection" | "seizedMachine" | "closedBackRoom" | "operatingFine" | "localRaid";
};

const cleanupArcadeMetadata = (metadata: ArcadeMetadata, tick: number): ArcadeMetadata => ({ ...metadata, auditRiskBonuses: metadata.auditRiskBonuses.filter((bonus) => bonus.expiresAtTick > tick), auditLog: (metadata.auditLog || []).slice(-10) });
const withArcadeMetadata = (building: CoreGameState["buildingsById"][string], arcade: ArcadeMetadata): Record<string, unknown> => ({ ...(building.metadata ?? {}), arcade });
const minutesToTicks = (minutes: number, tickRateMs: number): number => Math.max(1, Math.ceil((Math.max(0, Number(minutes || 0)) * 60 * 1000) / Math.max(1, tickRateMs)));
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
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
