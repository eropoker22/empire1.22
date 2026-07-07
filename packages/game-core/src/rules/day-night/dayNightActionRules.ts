import type {
  DayNightActionRuleConfig,
  DayNightBuildingRuleConfig,
  DayNightPhaseId
} from "../../contracts";
import type { GameCoreContext } from "../../engine/context";
import type { CoreGameState } from "../../entities";
import { getCurrentDayNightPhase } from "./dayNightPhase";

export type DayNightPhaseAvailability = "available" | "blocked" | "buffed" | "penalized" | "neutral";

export interface ResolvedDayNightRule {
  phaseId: DayNightPhaseId;
  currentPhase: DayNightPhaseId;
  preferredPhase: DayNightPhaseId | null;
  rule: DayNightActionRuleConfig | DayNightBuildingRuleConfig | null;
  allowed: boolean;
  phaseAvailability: DayNightPhaseAvailability;
  phaseBadgeLabel: string | null;
  phaseTooltip: string | null;
  blockedReason: string | null;
  appliesModifiers: boolean;
  mechanicalEffectLabels: string[];
}

export const resolveDayNightBuildingRule = (
  state: Pick<CoreGameState, "root">,
  context: Pick<GameCoreContext, "config">,
  buildingTypeId: string
): ResolvedDayNightRule =>
  resolveDayNightRule(state, context, context.config.balance.dayNight?.buildingRules?.[buildingTypeId] ?? null);

export const resolveDayNightActionRule = (
  state: Pick<CoreGameState, "root">,
  context: Pick<GameCoreContext, "config">,
  actionId: string,
  buildingTypeId?: string
): ResolvedDayNightRule => {
  const dayNight = context.config.balance.dayNight;
  const buildingRule = buildingTypeId ? dayNight?.buildingRules?.[buildingTypeId] : undefined;
  const actionRule = dayNight?.actionRules?.[actionId];
  return resolveDayNightRule(state, context, mergeRules(buildingRule, actionRule));
};

export const isDayNightActionAllowed = (
  state: Pick<CoreGameState, "root">,
  context: Pick<GameCoreContext, "config">,
  actionId: string,
  buildingTypeId?: string
): boolean => resolveDayNightActionRule(state, context, actionId, buildingTypeId).allowed;

export const applyDayNightActionHeat = (
  heatGain: number,
  state: Pick<CoreGameState, "root">,
  context: Pick<GameCoreContext, "config">,
  actionId: string,
  buildingTypeId?: string
): number => applySignedAmount(heatGain, resolveDayNightActionRule(state, context, actionId, buildingTypeId), "heatMultiplier");

export const applyDayNightActionCooldownMs = (
  cooldownMs: number,
  state: Pick<CoreGameState, "root">,
  context: Pick<GameCoreContext, "config">,
  actionId: string,
  buildingTypeId?: string
): number => applyPositiveAmount(cooldownMs, resolveDayNightActionRule(state, context, actionId, buildingTypeId), "cooldownMultiplier");

export const applyDayNightActionDurationMs = (
  durationMs: number,
  state: Pick<CoreGameState, "root">,
  context: Pick<GameCoreContext, "config">,
  actionId: string,
  buildingTypeId?: string
): number => applyPositiveAmount(durationMs, resolveDayNightActionRule(state, context, actionId, buildingTypeId), "durationMultiplier");

export const applyDayNightActionCost = (
  cost: Record<string, number>,
  state: Pick<CoreGameState, "root">,
  context: Pick<GameCoreContext, "config">,
  actionId: string,
  buildingTypeId?: string
): Record<string, number> => applyRecord(cost, resolveDayNightActionRule(state, context, actionId, buildingTypeId), "costMultiplier", "ceil");

export const applyDayNightActionReward = (
  reward: Record<string, number>,
  state: Pick<CoreGameState, "root">,
  context: Pick<GameCoreContext, "config">,
  actionId: string,
  buildingTypeId?: string
): Record<string, number> => applyRecord(reward, resolveDayNightActionRule(state, context, actionId, buildingTypeId), "rewardMultiplier", "floor");

const resolveDayNightRule = (
  state: Pick<CoreGameState, "root">,
  context: Pick<GameCoreContext, "config">,
  rule: DayNightActionRuleConfig | DayNightBuildingRuleConfig | null
): ResolvedDayNightRule => {
  const phase = getCurrentDayNightPhase(state, context).phaseId;
  const dayNight = context.config.balance.dayNight;
  if (!dayNight?.enabled || !rule) {
    return createNeutralRule(phase, rule);
  }

  const allowedPhases = Array.isArray(rule.allowedPhases) ? rule.allowedPhases : [];
  const allowed = allowedPhases.length < 1 || allowedPhases.includes(phase);
  const preferredPhase = rule.preferredPhase;
  const preferredLabel = preferredPhase === "night" ? "NOC" : "DEN";
  const nextPhaseLabel = phase === "day" ? "Noc" : "Den";
  const isPreferredPhase = preferredPhase === phase;
  const hasPreferredPhase = preferredPhase === "day" || preferredPhase === "night";
  const mechanics = resolveAppliedMechanicalEffectLabels(rule);
  const hasAppliedMechanics = mechanics.length > 0;
  const hasHardPhaseGate = allowedPhases.length > 0;
  const blockedReason = allowed ? null : (rule.blockedReason || `Tahle akce se dá spustit jen ve fázi ${preferredLabel}.`);
  const phaseAvailability: DayNightPhaseAvailability = !allowed
    ? "blocked"
    : hasPreferredPhase && (hasAppliedMechanics || hasHardPhaseGate)
      ? isPreferredPhase ? "buffed" : "penalized"
      : hasPreferredPhase
      ? "neutral"
      : "available";
  const preferredOnlyLabel = hasPreferredPhase
    ? preferredPhase === "night" ? "LEPŠÍ V NOCI" : "LEPŠÍ VE DNE"
    : null;
  const phaseBadgeLabel = !allowed
    ? "FÁZE BLOK"
    : hasPreferredPhase
      ? hasAppliedMechanics || hasHardPhaseGate
        ? isPreferredPhase ? `${preferredLabel} BONUS` : "VYŠŠÍ RISK"
        : preferredOnlyLabel
      : null;
  const waitLabel = formatPhaseWait(getCurrentDayNightPhase(state, context).remainingTicks, context.config.tickRateMs);
  const phaseTooltip = blockedReason
    ? `${preferredPhase === "night" ? "Dostupné až v noci." : "Dostupné až ve dne."} ${nextPhaseLabel} začne za ${waitLabel}.`
    : hasPreferredPhase
      ? isPreferredPhase
        ? hasAppliedMechanics || hasHardPhaseGate
          ? "Teď je ideální fáze pro tuto akci."
          : `Teď je vhodná fáze. Tahle akce preferuje ${preferredLabel}.`
        : hasAppliedMechanics
          ? `Akce jde spustit, ale teď má ${mechanics.join(", ")}.`
          : `Akce jde spustit, ale ideální fáze je ${preferredLabel}.`
      : rule.phaseEffectSummary ?? null;

  return {
    phaseId: phase,
    currentPhase: phase,
    preferredPhase: hasPreferredPhase ? preferredPhase : null,
    rule,
    allowed,
    phaseAvailability,
    phaseBadgeLabel,
    phaseTooltip,
    blockedReason,
    appliesModifiers: allowed && (!hasPreferredPhase || !isPreferredPhase),
    mechanicalEffectLabels: allowed && (!hasPreferredPhase || !isPreferredPhase) ? mechanics : []
  };
};

const createNeutralRule = (
  phaseId: DayNightPhaseId,
  rule: DayNightActionRuleConfig | DayNightBuildingRuleConfig | null
): ResolvedDayNightRule => ({
  phaseId,
  currentPhase: phaseId,
  preferredPhase: null,
  rule,
  allowed: true,
  phaseAvailability: rule ? "available" : "neutral",
  phaseBadgeLabel: null,
  phaseTooltip: rule?.phaseEffectSummary ?? null,
  blockedReason: null,
  appliesModifiers: false,
  mechanicalEffectLabels: []
});

const mergeRules = (
  buildingRule: DayNightBuildingRuleConfig | undefined,
  actionRule: DayNightActionRuleConfig | undefined
): DayNightActionRuleConfig | DayNightBuildingRuleConfig | null => {
  if (buildingRule && actionRule) {
    return {
      ...buildingRule,
      ...actionRule,
      allowedPhases: actionRule.allowedPhases ?? buildingRule.allowedPhases
    };
  }
  return actionRule ?? buildingRule ?? null;
};

const applyPositiveAmount = (
  value: number,
  resolved: ResolvedDayNightRule,
  key: keyof Pick<DayNightActionRuleConfig, "cooldownMultiplier" | "durationMultiplier">
): number => Math.max(0, Math.ceil(Number(value || 0) * getActiveMultiplier(resolved, key)));

const applySignedAmount = (
  value: number,
  resolved: ResolvedDayNightRule,
  key: keyof Pick<DayNightActionRuleConfig, "heatMultiplier">
): number => {
  const nextValue = Number(value || 0) * getActiveMultiplier(resolved, key);
  return nextValue >= 0 ? Math.ceil(nextValue) : Math.floor(nextValue);
};

const applyRecord = (
  values: Record<string, number>,
  resolved: ResolvedDayNightRule,
  key: keyof Pick<DayNightActionRuleConfig, "costMultiplier" | "rewardMultiplier">,
  rounding: "ceil" | "floor"
): Record<string, number> => {
  const multiplier = getActiveMultiplier(resolved, key);
  if (multiplier === 1) {
    return { ...values };
  }
  return Object.fromEntries(Object.entries(values).map(([resourceKey, amount]) => {
    const scaled = Math.max(0, Number(amount || 0) * multiplier);
    return [resourceKey, rounding === "ceil" ? Math.ceil(scaled) : Math.floor(scaled)];
  }));
};

const getActiveMultiplier = (
  resolved: ResolvedDayNightRule,
  key: keyof Pick<DayNightActionRuleConfig, "heatMultiplier" | "cooldownMultiplier" | "durationMultiplier" | "costMultiplier" | "rewardMultiplier">
): number => {
  if (!resolved.appliesModifiers) {
    return 1;
  }
  const multiplier = Number(resolved.rule?.[key] ?? 1);
  return Number.isFinite(multiplier) && multiplier >= 0 ? multiplier : 1;
};

const resolveAppliedMechanicalEffectLabels = (
  rule: DayNightActionRuleConfig | DayNightBuildingRuleConfig
): string[] => {
  const labels: string[] = [];
  if (Number(rule.heatMultiplier ?? 1) > 1) labels.push("vyšší heat");
  if (Number(rule.costMultiplier ?? 1) > 1) labels.push("vyšší cenu");
  if (Number(rule.cooldownMultiplier ?? 1) > 1) labels.push("delší cooldown");
  if (Number(rule.durationMultiplier ?? 1) > 1) labels.push("delší trvání");
  if (Number(rule.rewardMultiplier ?? 1) > 0 && Number(rule.rewardMultiplier ?? 1) < 1) labels.push("nižší reward");
  // TODO(day-night): detectionChanceModifierPct, successChanceModifierPct,
  // auditRiskModifierPct, rumorChanceModifierPct and rumorTruthModifierPct are
  // config-only until action-specific resolvers consume them. They are excluded
  // from VYŠŠÍ RISK/preview labels so UI does not promise inactive mechanics.
  return labels;
};

const formatPhaseWait = (remainingTicks: number, tickRateMs: number): string => {
  const ticks = Math.max(0, Math.ceil(Number(remainingTicks || 0)));
  const ms = ticks * Math.max(1, Number(tickRateMs || 0));
  if (ms <= 0) return "další fázi";
  const minutes = Math.max(1, Math.round(ms / 60000));
  return minutes >= 60 ? `${Math.round(minutes / 60)} h` : `${minutes} min`;
};
