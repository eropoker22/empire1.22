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
  rule: DayNightActionRuleConfig | DayNightBuildingRuleConfig | null;
  allowed: boolean;
  phaseAvailability: DayNightPhaseAvailability;
  phaseBadgeLabel: string | null;
  phaseTooltip: string | null;
  blockedReason: string | null;
  appliesModifiers: boolean;
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
  const isPreferredPhase = preferredPhase === phase;
  const hasPreferredPhase = preferredPhase === "day" || preferredPhase === "night";
  const blockedReason = allowed ? null : (rule.blockedReason || `Tahle akce se dá spustit jen ve fázi ${preferredLabel}.`);
  const phaseAvailability: DayNightPhaseAvailability = !allowed
    ? "blocked"
    : hasPreferredPhase
      ? isPreferredPhase ? "buffed" : "penalized"
      : "available";
  const phaseBadgeLabel = !allowed
    ? "FÁZE BLOK"
    : hasPreferredPhase
      ? isPreferredPhase ? `${preferredLabel} BONUS` : "VYŠŠÍ RISK"
      : null;
  const phaseTooltip = blockedReason
    ?? rule.phaseEffectSummary
    ?? (hasPreferredPhase
      ? isPreferredPhase
        ? `Akce je nejsilnější ve fázi ${preferredLabel}.`
        : `Akce není v ideální fázi. Preferuje ${preferredLabel}.`
      : null);

  return {
    phaseId: phase,
    rule,
    allowed,
    phaseAvailability,
    phaseBadgeLabel,
    phaseTooltip,
    blockedReason,
    appliesModifiers: allowed && (!hasPreferredPhase || !isPreferredPhase)
  };
};

const createNeutralRule = (
  phaseId: DayNightPhaseId,
  rule: DayNightActionRuleConfig | DayNightBuildingRuleConfig | null
): ResolvedDayNightRule => ({
  phaseId,
  rule,
  allowed: true,
  phaseAvailability: rule ? "available" : "neutral",
  phaseBadgeLabel: null,
  phaseTooltip: rule?.phaseEffectSummary ?? null,
  blockedReason: null,
  appliesModifiers: false
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
