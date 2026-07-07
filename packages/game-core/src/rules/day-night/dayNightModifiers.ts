import type { DayNightModifiersConfig } from "../../contracts";
import type { GameCoreContext } from "../../engine/context";
import type { CoreGameState } from "../../entities";
import { getDayNightModifiers } from "./dayNightPhase";

type AnyRecord = Record<string, any>;

const LEGAL_BUILDINGS = new Set([
  "apartment_block", "clinic", "school", "warehouse", "restaurant", "convenience_store",
  "shopping_mall", "stock_exchange", "central_bank", "airport", "city_hall", "court",
  "courthouse", "recruitment_center", "fitness_club", "garage", "car_dealer",
  "recycling_center", "power_station", "pharmacy", "factory"
]);

const ILLEGAL_BUILDINGS = new Set([
  "casino", "exchange", "exchange_office", "arcade", "strip_club", "vip_lounge",
  "smuggling_tunnel", "street_dealers", "drug_lab", "armory"
]);

export const applyDayNightModifier = (value: number, modifier: number | undefined): number =>
  Math.max(0, value * safeMultiplier(modifier));

export const applyDayNightPctModifier = (chance: number, modifierPct: number | undefined): number =>
  clampRatio(chance + Number(modifierPct || 0) / 100);

export const applyDayNightBuildingIncomeModifiers = (input: {
  state: CoreGameState;
  context: GameCoreContext;
  buildingTypeId: string;
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}) => {
  const modifiers = getDayNightModifiers(input.state, input.context);
  const economyType = resolveBuildingEconomyType(input.buildingTypeId);
  const cleanMultiplier = economyType === "illegal"
    ? modifiers.dirtyIncomeMultiplier
    : modifiers.legalIncomeMultiplier;
  return {
    cleanPerHour: floorAmount(applyDayNightModifier(input.cleanPerHour, cleanMultiplier)),
    dirtyPerHour: floorAmount(applyDayNightModifier(input.dirtyPerHour, modifiers.dirtyIncomeMultiplier)),
    heatPerDay: floorAmount(applyDayNightModifier(input.heatPerDay, modifiers.heatGainMultiplier)),
    influencePerDay: input.influencePerDay
  };
};

export const applyDayNightProductionMultiplier = (input: {
  state: CoreGameState;
  context: GameCoreContext;
  buildingTypeId: string;
  amountPerTick: number;
}): number => {
  const modifiers = getDayNightModifiers(input.state, input.context);
  const economyType = resolveBuildingEconomyType(input.buildingTypeId);
  const typeMultiplier = economyType === "illegal"
    ? modifiers.illegalProductionSpeedMultiplier
    : modifiers.legalProductionSpeedMultiplier;
  return floorAmount(input.amountPerTick * safeMultiplier(modifiers.productionSpeedMultiplier) * safeMultiplier(typeMultiplier));
};

export const applyDayNightHeatGain = (
  amount: number,
  state: Pick<CoreGameState, "root"> | AnyRecord,
  context?: Pick<GameCoreContext, "config">
): number => floorAmount(applyDayNightModifier(amount, getDayNightModifiers(state, context).heatGainMultiplier));

export const applyDayNightAttackDurationTicks = (
  ticks: number,
  state: Pick<CoreGameState, "root"> | AnyRecord,
  context?: Pick<GameCoreContext, "config">
): number => Math.max(1, Math.ceil(applyDayNightModifier(ticks, getDayNightModifiers(state, context).attackTravelOrPreparationMultiplier)));

export const applyDayNightHeistDetectionChance = (input: { gameState: AnyRecord; baseChance: number }): number =>
  applyDayNightPctModifier(input.baseChance, getDayNightModifiers(input.gameState, resolveAnyContext(input.gameState)).heistDetectionChanceModifierPct);

export const applyDayNightHeistSuccessChance = (input: { gameState: AnyRecord; baseChance: number }): number =>
  applyDayNightPctModifier(input.baseChance, getDayNightModifiers(input.gameState, resolveAnyContext(input.gameState)).heistSuccessChanceModifierPct);

export const applyDayNightRumorTruthChancePct = (
  chancePct: number | undefined,
  state: Pick<CoreGameState, "root"> | AnyRecord,
  context?: Pick<GameCoreContext, "config">
): number | undefined =>
  chancePct === undefined
    ? undefined
    : clampPct(Number(chancePct || 0) + Number(getDayNightModifiers(state, context).rumorTruthChanceModifierPct || 0));

export const shouldGenerateDayNightRumor = (input: {
  state: Pick<CoreGameState, "root" | "serverInstance"> | AnyRecord;
  context?: Pick<GameCoreContext, "config">;
  sourceKey: string;
}): boolean => {
  const multiplier = safeMultiplier(getDayNightModifiers(input.state, input.context).rumorGenerationMultiplier);
  if (multiplier >= 1) return true;
  const seed = `${input.state?.serverInstance?.worldSeed ?? "world"}:${input.sourceKey}:${input.state?.root?.tick ?? 0}`;
  return deterministicPct(seed) < multiplier * 100;
};

export const applyDayNightMarketVolatilityFactor = (factor: number, state: AnyRecord): number => {
  const multiplier = safeMultiplier(getDayNightModifiers(state, resolveAnyContext(state)).marketVolatilityMultiplier);
  return roundRatio(1 + (safeMultiplier(factor) - 1) * multiplier);
};

export const resolveDayNightModifier = (
  modifiers: DayNightModifiersConfig,
  key: keyof DayNightModifiersConfig
): number => safeMultiplier(modifiers[key]);

const resolveBuildingEconomyType = (buildingTypeId: string): "legal" | "illegal" =>
  ILLEGAL_BUILDINGS.has(buildingTypeId) ? "illegal" : LEGAL_BUILDINGS.has(buildingTypeId) ? "legal" : "legal";

const resolveAnyContext = (state: AnyRecord): Pick<GameCoreContext, "config"> | undefined =>
  state?.config ? { config: state.config } : undefined;

const safeMultiplier = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 1;
};

const clampRatio = (value: number): number => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const clampPct = (value: number): number => Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
const roundRatio = (value: number): number => Math.round(value * 10000) / 10000;
const floorAmount = (value: number): number => Math.floor(value + 1e-9);

const deterministicPct = (seed: string): number => {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % 100;
};
