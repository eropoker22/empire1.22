import type { CoreGameState } from "../entities";
import type {
  StockExchangeMarketCategory,
  StockExchangeMarketEffect,
  StockExchangeMetadata,
  StockExchangePressureMode,
  StockExchangeRiskEvent
} from "./stockExchangeTypes";
export const getStockExchangeMetadata = (
  building: CoreGameState["buildingsById"][string],
  tick = 0
): StockExchangeMetadata => cleanupStockExchangeMetadata(readStockExchangeMetadata(building), tick);

export const appendStockExchangeAction = (
  metadata: StockExchangeMetadata,
  actionId: string,
  tick: number,
  input: {
    category?: string;
    mode?: string;
    riskEvent?: StockExchangeRiskEvent;
    marketEffect?: StockExchangeMarketEffect;
  } = {}
): StockExchangeMetadata => ({
  ...metadata,
  actionHistory: [...metadata.actionHistory, { actionId, tick, category: input.category, mode: input.mode }].slice(-16),
  riskEvents: input.riskEvent ? [...metadata.riskEvents, input.riskEvent].slice(-12) : metadata.riskEvents,
  marketEffects: input.marketEffect ? [...metadata.marketEffects, input.marketEffect].slice(-8) : metadata.marketEffects
});

const readStockExchangeMetadata = (building: CoreGameState["buildingsById"][string]): StockExchangeMetadata => {
  const raw = isRecord(building.metadata?.stockExchange) ? building.metadata.stockExchange : {};
  return {
    insiderWindowExpiresAtTick: asOptionalTick(raw.insiderWindowExpiresAtTick),
    incomeFrozenUntilTick: asOptionalTick(raw.incomeFrozenUntilTick),
    feeReductionDisabledUntilTick: asOptionalTick(raw.feeReductionDisabledUntilTick),
    lastInspectionTick: asOptionalTick(raw.lastInspectionTick),
    lastInsightTick: asOptionalTick(raw.lastInsightTick),
    actionHistory: Array.isArray(raw.actionHistory) ? raw.actionHistory.filter(isRecord).map((entry) => ({ actionId: String(entry.actionId || ""), tick: Math.floor(Number(entry.tick || 0)), category: entry.category ? String(entry.category) : undefined, mode: entry.mode ? String(entry.mode) : undefined })).filter((entry) => entry.actionId) : [],
    riskEvents: Array.isArray(raw.riskEvents) ? raw.riskEvents.filter(isRecord).map((entry) => ({ actionId: String(entry.actionId || ""), riskPct: Number(entry.riskPct || 0), expiresAtTick: Math.floor(Number(entry.expiresAtTick || 0)), tick: Math.floor(Number(entry.tick || 0)) })).filter((entry) => entry.actionId) : [],
    trendHints: Array.isArray(raw.trendHints) ? raw.trendHints.filter(isRecord).map((entry) => ({ id: String(entry.id || ""), tick: Math.floor(Number(entry.tick || 0)), category: resolveCategoryOrNull(entry.category, ["materials", "drugsAndBoosts", "weapons", "defenseItems", "rareComponents"]) ?? "materials", text: String(entry.text || "") })).filter((entry) => entry.id && entry.text) : [],
    marketEffects: Array.isArray(raw.marketEffects) ? raw.marketEffects.filter(isRecord).map(readMarketEffect).filter((effect): effect is StockExchangeMarketEffect => Boolean(effect)) : [],
    inspectionEvents: Array.isArray(raw.inspectionEvents) ? raw.inspectionEvents.filter(isRecord).map((entry) => ({ type: String(entry.type || ""), tick: Math.floor(Number(entry.tick || 0)), riskPct: Number(entry.riskPct || 0), label: String(entry.label || entry.type || ""), rumorText: entry.rumorText ? String(entry.rumorText) : undefined })).filter((entry) => entry.type) : []
  };
};

const cleanupStockExchangeMetadata = (metadata: StockExchangeMetadata, tick: number): StockExchangeMetadata => ({
  ...metadata,
  riskEvents: metadata.riskEvents.filter((event) => event.expiresAtTick > tick),
  marketEffects: metadata.marketEffects.filter((effect) => effect.expiresAtTick > tick),
  actionHistory: metadata.actionHistory.slice(-16),
  trendHints: metadata.trendHints.slice(-8),
  inspectionEvents: metadata.inspectionEvents.slice(-8)
});

const readMarketEffect = (entry: Record<string, unknown>): StockExchangeMarketEffect | null => {
  const category = resolveCategoryOrNull(entry.category, ["materials", "drugsAndBoosts", "weapons", "defenseItems", "rareComponents"]);
  const mode = resolvePressureModeOrNull(entry.mode);
  if (!category || !mode) return null;
  return {
    id: String(entry.id || ""),
    category,
    mode,
    regularPriceModifierPct: Number(entry.regularPriceModifierPct || 0),
    blackMarketPriceModifierPct: Number(entry.blackMarketPriceModifierPct || 0),
    startedAtTick: Math.floor(Number(entry.startedAtTick || 0)),
    expiresAtTick: Math.floor(Number(entry.expiresAtTick || 0)),
    ownerPlayerId: String(entry.ownerPlayerId || "")
  };
};

export const withStockExchangeMetadata = (
  building: CoreGameState["buildingsById"][string],
  stockExchange: StockExchangeMetadata
): Record<string, unknown> => ({
  ...(building.metadata ?? {}),
  stockExchange
});

export const resolveCategory = (value: unknown, allowed: string[]): StockExchangeMarketCategory =>
  resolveCategoryOrNull(value, allowed) ?? "materials";

export const resolveCategoryOrNull = (value: unknown, allowed: string[]): StockExchangeMarketCategory | null => {
  const normalized = String(value ?? "").trim();
  return allowed.includes(normalized) ? normalized as StockExchangeMarketCategory : null;
};

export const resolvePressureMode = (value: unknown): StockExchangePressureMode =>
  resolvePressureModeOrNull(value) ?? "pump";

export const resolvePressureModeOrNull = (value: unknown): StockExchangePressureMode | null => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "pump" || normalized === "dump" ? normalized : null;
};

export const interpolate = (min: number, max: number, roll: number): number =>
  min + (max - min) * Math.max(0, Math.min(1, roll));

export const minutesToTicks = (minutes: number, tickRateMs: number): number =>
  Math.max(1, Math.ceil(Math.max(0, minutes) * 60000 / Math.max(1, tickRateMs)));

const asOptionalTick = (value: unknown): number | undefined => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.floor(numberValue) : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
