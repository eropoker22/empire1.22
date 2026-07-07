import type {
  DayNightBuildingRuleConfig,
  DayNightModifiersConfig,
  DayNightPassiveBuildingRuleConfig,
  DayNightPhaseId
} from "../../contracts";
import type { GameCoreContext } from "../../engine/context";
import type { CoreGameState } from "../../entities";
import { getCurrentDayNightPhase, getDayNightModifiers } from "./dayNightPhase";

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
  // Passive income order:
  // 1. base building config
  // 2. level/network/faction/alliance modifiers
  // 3. global DEN/NOC legal/illegal modifier
  // 4. per-building DEN/NOC passive rule
  const globalResult = {
    cleanPerHour: floorAmount(applyDayNightModifier(input.cleanPerHour, cleanMultiplier)),
    dirtyPerHour: floorAmount(applyDayNightModifier(input.dirtyPerHour, modifiers.dirtyIncomeMultiplier)),
    heatPerDay: floorAmount(applyDayNightModifier(input.heatPerDay, modifiers.heatGainMultiplier)),
    influencePerDay: input.influencePerDay
  };
  return applyDayNightPassiveBuildingRule({
    state: input.state,
    context: input.context,
    buildingTypeId: input.buildingTypeId,
    ...globalResult
  });
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
  const passiveRule = resolveDayNightPassiveBuildingRule(input.state, input.context, input.buildingTypeId);
  return floorAmount(
    input.amountPerTick
      * safeMultiplier(modifiers.productionSpeedMultiplier)
      * safeMultiplier(typeMultiplier)
      * safeMultiplier(passiveRule.modifiers.passiveProductionMultiplier)
  );
};

export interface DayNightPassiveBuildingPreview {
  phaseId: DayNightPhaseId;
  currentPhase: DayNightPhaseId;
  rule: DayNightBuildingRuleConfig | null;
  modifiers: DayNightPassiveBuildingRuleConfig;
  phaseBadgeLabel: string | null;
  phaseEffectLabel: string | null;
  phaseTooltip: string | null;
  effectLabels: string[];
  hasModifiers: boolean;
}

export const resolveDayNightPassiveBuildingRule = (
  state: Pick<CoreGameState, "root">,
  context: Pick<GameCoreContext, "config">,
  buildingTypeId: string
): DayNightPassiveBuildingPreview => {
  const phaseId = getCurrentDayNightPhase(state, context).phaseId;
  const dayNight = context.config.balance.dayNight;
  const rule = dayNight?.buildingRules?.[buildingTypeId] ?? null;
  if (!dayNight?.enabled || !rule) {
    return createNeutralPassiveRule(phaseId, rule);
  }

  const modifiers = resolveActivePassiveBuildingModifiers(rule, phaseId);
  const effectLabels = createPassiveEffectLabels(modifiers);
  const hasModifiers = effectLabels.length > 0;
  const preferredPhase = rule.preferredPhase;
  const isPreferredPhase = preferredPhase === phaseId;
  const badgePhase = phaseId === "night" ? "NOC" : "DEN";
  const phaseBadgeLabel = hasModifiers
    ? isPassiveRiskOnly(modifiers)
      ? `${badgePhase} RISK`
      : `${badgePhase} BONUS`
    : null;

  return {
    phaseId,
    currentPhase: phaseId,
    rule,
    modifiers,
    phaseBadgeLabel,
    phaseEffectLabel: hasModifiers ? `${phaseBadgeLabel}: ${effectLabels.join(" · ")}` : null,
    phaseTooltip: hasModifiers
      ? isPreferredPhase
        ? "Teď je ideální fáze pro pasivní efekt této budovy."
        : "Budova v aktuální fázi běží s jiným pasivním profilem."
      : rule.phaseEffectSummary ?? null,
    effectLabels,
    hasModifiers
  };
};

export const applyDayNightPassiveBuildingRule = (input: {
  state: CoreGameState;
  context: GameCoreContext;
  buildingTypeId: string;
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}) => {
  const passiveRule = resolveDayNightPassiveBuildingRule(input.state, input.context, input.buildingTypeId);
  const modifiers = passiveRule.modifiers;
  if (!passiveRule.hasModifiers) {
    return {
      cleanPerHour: input.cleanPerHour,
      dirtyPerHour: input.dirtyPerHour,
      heatPerDay: input.heatPerDay,
      influencePerDay: input.influencePerDay
    };
  }

  return {
    cleanPerHour: floorAmount(applyDayNightModifier(input.cleanPerHour, modifiers.passiveCleanIncomeMultiplier)),
    dirtyPerHour: floorAmount(applyDayNightModifier(input.dirtyPerHour, modifiers.passiveDirtyIncomeMultiplier)),
    heatPerDay: floorAmount(applyDayNightModifier(input.heatPerDay, modifiers.passiveHeatMultiplier)),
    influencePerDay: floorAmount(applyDayNightModifier(input.influencePerDay, modifiers.passiveInfluenceMultiplier))
  };
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
  context?: Pick<GameCoreContext, "config">,
  buildingTypeId?: string
): number | undefined =>
  chancePct === undefined
    ? undefined
    : clampPct(
      Number(chancePct || 0)
        + Number(getDayNightModifiers(state, context).rumorTruthChanceModifierPct || 0)
        + Number(buildingTypeId && context
          ? resolveDayNightPassiveBuildingRule(state as Pick<CoreGameState, "root">, context, buildingTypeId).modifiers.passiveRumorTruthModifierPct || 0
          : 0)
    );

export const shouldGenerateDayNightRumor = (input: {
  state: Pick<CoreGameState, "root" | "serverInstance"> | AnyRecord;
  context?: Pick<GameCoreContext, "config">;
  sourceKey: string;
  buildingTypeId?: string;
}): boolean => {
  const passiveMultiplier = input.buildingTypeId && input.context
    ? resolveDayNightPassiveBuildingRule(
        input.state as Pick<CoreGameState, "root">,
        input.context,
        input.buildingTypeId
      ).modifiers.passiveRumorGenerationMultiplier
    : undefined;
  const multiplier = safeMultiplier(getDayNightModifiers(input.state, input.context).rumorGenerationMultiplier)
    * safeMultiplier(passiveMultiplier);
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

export const resolveDayNightBuildingEconomyType = (buildingTypeId: string): "legal" | "illegal" =>
  ILLEGAL_BUILDINGS.has(buildingTypeId) ? "illegal" : LEGAL_BUILDINGS.has(buildingTypeId) ? "legal" : "legal";

const resolveBuildingEconomyType = resolveDayNightBuildingEconomyType;

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

const createNeutralPassiveRule = (
  phaseId: DayNightPhaseId,
  rule: DayNightBuildingRuleConfig | null
): DayNightPassiveBuildingPreview => ({
  phaseId,
  currentPhase: phaseId,
  rule,
  modifiers: {},
  phaseBadgeLabel: null,
  phaseEffectLabel: null,
  phaseTooltip: rule?.phaseEffectSummary ?? null,
  effectLabels: [],
  hasModifiers: false
});

const PASSIVE_KEYS: Array<keyof DayNightPassiveBuildingRuleConfig> = [
  "passiveCleanIncomeMultiplier",
  "passiveDirtyIncomeMultiplier",
  "passiveHeatMultiplier",
  "passiveInfluenceMultiplier",
  "passiveRumorGenerationMultiplier",
  "passiveRumorTruthModifierPct",
  "passiveProductionMultiplier",
  "passivePopulationMultiplier",
  "passiveRecoveryMultiplier",
  "passiveDefenseSupportMultiplier"
];

const resolveActivePassiveBuildingModifiers = (
  rule: DayNightBuildingRuleConfig,
  phaseId: DayNightPhaseId
): DayNightPassiveBuildingRuleConfig => {
  const phaseSpecific = rule.phasePassiveModifiers?.[phaseId];
  if (phaseSpecific) {
    return sanitizePassiveModifiers(phaseSpecific);
  }

  if (rule.preferredPhase && rule.preferredPhase !== phaseId) {
    return {};
  }

  return sanitizePassiveModifiers(rule);
};

const sanitizePassiveModifiers = (
  raw: Partial<DayNightPassiveBuildingRuleConfig> | DayNightBuildingRuleConfig
): DayNightPassiveBuildingRuleConfig => {
  const result: DayNightPassiveBuildingRuleConfig = {};
  for (const key of PASSIVE_KEYS) {
    const value = Number(raw[key]);
    if (Number.isFinite(value)) {
      (result as Record<string, number>)[key] = value;
    }
  }
  return result;
};

const createPassiveEffectLabels = (modifiers: DayNightPassiveBuildingRuleConfig): string[] => {
  const labels: string[] = [];
  addMultiplierLabel(labels, modifiers.passiveCleanIncomeMultiplier, "clean income");
  addMultiplierLabel(labels, modifiers.passiveDirtyIncomeMultiplier, "dirty cash");
  addMultiplierLabel(labels, modifiers.passiveHeatMultiplier, "heat");
  addMultiplierLabel(labels, modifiers.passiveInfluenceMultiplier, "vliv");
  addMultiplierLabel(labels, modifiers.passiveRumorGenerationMultiplier, "drby");
  addPctLabel(labels, modifiers.passiveRumorTruthModifierPct, "přesnost drbů");
  addMultiplierLabel(labels, modifiers.passiveProductionMultiplier, "produkce");
  addMultiplierLabel(labels, modifiers.passivePopulationMultiplier, "populace");
  addMultiplierLabel(labels, modifiers.passiveRecoveryMultiplier, "recovery");
  addMultiplierLabel(labels, modifiers.passiveDefenseSupportMultiplier, "obrana");
  return labels;
};

const addMultiplierLabel = (labels: string[], value: number | undefined, label: string): void => {
  const multiplier = Number(value ?? 1);
  if (!Number.isFinite(multiplier) || Math.abs(multiplier - 1) < 0.001) {
    return;
  }
  labels.push(`${label} ${formatSignedPct((multiplier - 1) * 100)}`);
};

const addPctLabel = (labels: string[], value: number | undefined, label: string): void => {
  const pct = Number(value ?? 0);
  if (!Number.isFinite(pct) || Math.abs(pct) < 0.001) {
    return;
  }
  labels.push(`${label} ${formatSignedPct(pct)}`);
};

const formatSignedPct = (value: number): string => {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? "+" : ""}${rounded} %`;
};

const isPassiveRiskOnly = (modifiers: DayNightPassiveBuildingRuleConfig): boolean => {
  const positiveBenefit = Number(modifiers.passiveCleanIncomeMultiplier ?? 1) > 1
    || Number(modifiers.passiveDirtyIncomeMultiplier ?? 1) > 1
    || Number(modifiers.passiveInfluenceMultiplier ?? 1) > 1
    || Number(modifiers.passiveRumorGenerationMultiplier ?? 1) > 1
    || Number(modifiers.passiveRumorTruthModifierPct ?? 0) > 0
    || Number(modifiers.passiveProductionMultiplier ?? 1) > 1
    || Number(modifiers.passivePopulationMultiplier ?? 1) > 1
    || Number(modifiers.passiveRecoveryMultiplier ?? 1) > 1
    || Number(modifiers.passiveDefenseSupportMultiplier ?? 1) > 1
    || Number(modifiers.passiveHeatMultiplier ?? 1) < 1;
  return !positiveBenefit;
};

const deterministicPct = (seed: string): number => {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % 100;
};
