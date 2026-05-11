import type { CentralBankBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { CentralBankIntervention, CentralBankMarketCategory, CentralBankMetadata, CentralBankReserveStats } from "./centralBankTypes";
export const getCentralBankMetadata = (
  building: CoreGameState["buildingsById"][string],
  tick = 0
): CentralBankMetadata => cleanupCentralBankMetadata(readCentralBankMetadata(building), tick);

export const getOwnedCentralBankCount = (
  state: CoreGameState,
  playerId: string | null | undefined,
  config: CentralBankBalanceConfig
): number =>
  playerId
    ? Object.values(state.buildingsById).filter((building) =>
        building.buildingTypeId === config.buildingTypeId && building.ownerPlayerId === playerId && building.status === "active"
      ).length
    : 0;

export const appendRiskEvent = (
  metadata: CentralBankMetadata,
  actionId: string,
  riskPct: number,
  expiresAtTick: number,
  tick: number
): CentralBankMetadata => ({
  ...metadata,
  riskEvents: [...metadata.riskEvents, { actionId, riskPct, expiresAtTick, tick }].slice(-12)
});

export const resolveCentralBankTier = (
  ownedCount: number,
  config: CentralBankBalanceConfig
): CentralBankBalanceConfig["reserveTiers"][number] | null =>
  config.reserveTiers.find((tier) => ownedCount >= tier.minOwned && ownedCount <= tier.maxOwned)
    ?? config.reserveTiers.find((tier) => ownedCount >= tier.minOwned)
    ?? null;

export const getOwnedCentralBank = (
  state: CoreGameState,
  playerId: string | null | undefined,
  config: CentralBankBalanceConfig
): CoreGameState["buildingsById"][string] | undefined =>
  playerId
    ? Object.values(state.buildingsById)
        .filter((building) => building.buildingTypeId === config.buildingTypeId && building.ownerPlayerId === playerId && building.status === "active")
        .sort((a, b) => a.id.localeCompare(b.id))[0]
    : undefined;

export const countOwnedBuildings = (state: CoreGameState, playerId: string | null | undefined, buildingTypeIds: string[]): number =>
  playerId
    ? Object.values(state.buildingsById).filter((building) =>
        building.ownerPlayerId === playerId && building.status === "active" && buildingTypeIds.includes(building.buildingTypeId)
      ).length
    : 0;

export const hasOwnedBuilding = (state: CoreGameState, playerId: string | null | undefined, buildingTypeId: string): boolean =>
  Boolean(playerId) && Object.values(state.buildingsById).some((building) =>
    building.ownerPlayerId === playerId && building.status === "active" && building.buildingTypeId === buildingTypeId
  );

export const emptyCentralBankStats = (ownedCount = 0): CentralBankReserveStats => ({
  ownedCount,
  tier: null,
  cleanCashProtectionPct: 0,
  dirtyCashProtectionPct: 0,
  fineReductionPct: 0,
  financialEventLossReductionPct: 0,
  financialInspectionPenaltyReductionPct: 0,
  economicCrisisImpactReductionPct: 0,
  marketFeeReductionPct: 0,
  interestPct: 0,
  interestIntervalMinutes: 0,
  maxInterestCleanCash: 0,
  interestDisabled: false,
  liquidityBlocked: false,
  frozenAccountsActive: false,
  activeCurrencyInterventions: []
});

const readCentralBankMetadata = (building: CoreGameState["buildingsById"][string]): CentralBankMetadata => {
  const raw = isRecord(building.metadata?.centralBank) ? building.metadata.centralBank : {};
  return {
    frozenAccountsExpiresAtTick: asOptionalTick(raw.frozenAccountsExpiresAtTick),
    interestDisabledUntilTick: asOptionalTick(raw.interestDisabledUntilTick),
    liquidityBlockedUntilTick: asOptionalTick(raw.liquidityBlockedUntilTick),
    feeReductionDisabledUntilTick: asOptionalTick(raw.feeReductionDisabledUntilTick),
    lastInterestTick: asOptionalTick(raw.lastInterestTick),
    lastOversightTick: asOptionalTick(raw.lastOversightTick),
    riskEvents: Array.isArray(raw.riskEvents) ? raw.riskEvents.filter(isRecord).map((entry) => ({ actionId: String(entry.actionId || ""), riskPct: Number(entry.riskPct || 0), expiresAtTick: Math.floor(Number(entry.expiresAtTick || 0)), tick: Math.floor(Number(entry.tick || 0)) })).filter((entry) => entry.actionId) : [],
    currencyInterventions: Array.isArray(raw.currencyInterventions) ? raw.currencyInterventions.filter(isRecord).map(readIntervention).filter((entry): entry is CentralBankIntervention => Boolean(entry)) : [],
    oversightEvents: Array.isArray(raw.oversightEvents) ? raw.oversightEvents.filter(isRecord).map((entry) => ({ type: String(entry.type || ""), tick: Math.floor(Number(entry.tick || 0)), label: String(entry.label || entry.type || ""), riskPct: Number(entry.riskPct || 0), cleanCashLost: entry.cleanCashLost === undefined ? undefined : Number(entry.cleanCashLost || 0), rumorText: entry.rumorText ? String(entry.rumorText) : undefined })).filter((entry) => entry.type) : [],
    interestEvents: Array.isArray(raw.interestEvents) ? raw.interestEvents.filter(isRecord).map((entry) => ({ tick: Math.floor(Number(entry.tick || 0)), amount: Math.max(0, Math.floor(Number(entry.amount || 0))), cleanCashBefore: Math.max(0, Math.floor(Number(entry.cleanCashBefore || 0))), interestPct: Number(entry.interestPct || 0) })).filter((entry) => entry.amount > 0) : []
  };
};

const cleanupCentralBankMetadata = (metadata: CentralBankMetadata, tick: number): CentralBankMetadata => ({
  ...metadata,
  frozenAccountsExpiresAtTick: Number(metadata.frozenAccountsExpiresAtTick || 0) > tick ? metadata.frozenAccountsExpiresAtTick : undefined,
  interestDisabledUntilTick: Number(metadata.interestDisabledUntilTick || 0) > tick ? metadata.interestDisabledUntilTick : undefined,
  liquidityBlockedUntilTick: Number(metadata.liquidityBlockedUntilTick || 0) > tick ? metadata.liquidityBlockedUntilTick : undefined,
  feeReductionDisabledUntilTick: Number(metadata.feeReductionDisabledUntilTick || 0) > tick ? metadata.feeReductionDisabledUntilTick : undefined,
  riskEvents: metadata.riskEvents.filter((event) => event.expiresAtTick > tick),
  currencyInterventions: metadata.currencyInterventions.filter((effect) => effect.expiresAtTick > tick),
  oversightEvents: metadata.oversightEvents.slice(-8),
  interestEvents: metadata.interestEvents.slice(-8)
});

const readIntervention = (entry: Record<string, unknown>): CentralBankIntervention | null => {
  const category = resolveCategoryOrNull(entry.category, ["materials", "weapons", "defenseItems", "rareComponents", "drugsAndBoosts"]);
  if (!category) return null;
  return {
    id: String(entry.id || ""),
    category,
    startedAtTick: Math.floor(Number(entry.startedAtTick || 0)),
    expiresAtTick: Math.floor(Number(entry.expiresAtTick || 0)),
    volatilityReductionPct: Number(entry.volatilityReductionPct || 0),
    priceMoveCapPct: Number(entry.priceMoveCapPct || 0),
    holderMarketFeeReductionPct: Number(entry.holderMarketFeeReductionPct || 0),
    stockExchangeEffectReductionPct: Number(entry.stockExchangeEffectReductionPct || 0),
    ownerPlayerId: String(entry.ownerPlayerId || "")
  };
};

export const withCentralBankMetadata = (
  building: CoreGameState["buildingsById"][string],
  centralBank: CentralBankMetadata
): Record<string, unknown> => ({
  ...(building.metadata ?? {}),
  centralBank
});

export const resolveCategory = (value: unknown, allowed: string[]): CentralBankMarketCategory =>
  resolveCategoryOrNull(value, allowed) ?? "materials";

export const resolveCategoryOrNull = (value: unknown, allowed: string[]): CentralBankMarketCategory | null => {
  const normalized = String(value ?? "").trim();
  return allowed.includes(normalized) ? normalized as CentralBankMarketCategory : null;
};

const asOptionalTick = (value: unknown): number | undefined => {
  const tick = Math.floor(Number(value || 0));
  return tick > 0 ? tick : undefined;
};

export const minutesToTicks = (minutes: number, tickRateMs: number): number =>
  Math.max(1, Math.ceil(Math.max(0, minutes) * 60000 / Math.max(1, tickRateMs)));

const hashText = (value: string): number =>
  Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0);

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
