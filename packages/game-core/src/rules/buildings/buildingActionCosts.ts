import type { BuildingActionBalanceConfig } from "../../contracts";
import type { GameCoreContext } from "../../engine/context";
import type { CoreGameState } from "../../entities";
import type { DayNightPhaseAvailability } from "../day-night/dayNightActionRules";
import {
  applyDayNightActionCooldownMs,
  applyDayNightActionCost,
  applyDayNightActionDurationMs,
  applyDayNightActionHeat,
  applyDayNightActionReward,
  resolveDayNightActionRule
} from "../day-night/dayNightActionRules";

export interface EffectiveBuildingActionPreview {
  baseInputCost: Record<string, number>;
  effectiveInputCost: Record<string, number>;
  baseOutputGain: Record<string, number>;
  effectiveOutputGain: Record<string, number>;
  baseHeatGain: number;
  effectiveHeatGain: number;
  baseCooldownMs: number;
  effectiveCooldownMs: number;
  baseDurationMs: number;
  effectiveDurationMs: number;
  phaseAvailability: DayNightPhaseAvailability;
  phaseBadgeLabel: string | null;
  phaseTooltip: string | null;
  blockedReason: string | null;
  preferredPhase: "day" | "night" | null;
  currentPhase: "day" | "night";
  phaseEffectSummary: string[];
}

type PreviewActionInput = Pick<
  BuildingActionBalanceConfig,
  "actionId" | "inputCost" | "outputGain" | "heatGain" | "cooldownMs" | "durationMs"
>;

export const resolveEffectiveBuildingActionCostForValidation = (input: {
  action: Pick<BuildingActionBalanceConfig, "actionId" | "inputCost">;
  state: Pick<CoreGameState, "root">;
  context: Pick<GameCoreContext, "config">;
  buildingTypeId: string;
}): Record<string, number> =>
  applyDayNightActionCost(
    input.action.inputCost,
    input.state,
    input.context,
    input.action.actionId,
    input.buildingTypeId
  );

export const resolveEffectiveBuildingActionPreview = (input: {
  action: PreviewActionInput;
  state: Pick<CoreGameState, "root">;
  context: Pick<GameCoreContext, "config">;
  buildingTypeId: string;
}): EffectiveBuildingActionPreview => {
  const phaseRule = resolveDayNightActionRule(
    input.state,
    input.context,
    input.action.actionId,
    input.buildingTypeId
  );
  const effectiveInputCost = applyDayNightActionCost(input.action.inputCost, input.state, input.context, input.action.actionId, input.buildingTypeId);
  const effectiveOutputGain = applyDayNightActionReward(input.action.outputGain, input.state, input.context, input.action.actionId, input.buildingTypeId);
  const effectiveHeatGain = applyDayNightActionHeat(input.action.heatGain, input.state, input.context, input.action.actionId, input.buildingTypeId);
  const effectiveCooldownMs = applyDayNightActionCooldownMs(input.action.cooldownMs, input.state, input.context, input.action.actionId, input.buildingTypeId);
  const effectiveDurationMs = applyDayNightActionDurationMs(input.action.durationMs, input.state, input.context, input.action.actionId, input.buildingTypeId);
  return {
    baseInputCost: { ...input.action.inputCost },
    effectiveInputCost,
    baseOutputGain: { ...input.action.outputGain },
    effectiveOutputGain,
    baseHeatGain: input.action.heatGain,
    effectiveHeatGain,
    baseCooldownMs: input.action.cooldownMs,
    effectiveCooldownMs,
    baseDurationMs: input.action.durationMs,
    effectiveDurationMs,
    phaseAvailability: phaseRule.phaseAvailability,
    phaseBadgeLabel: phaseRule.phaseBadgeLabel,
    phaseTooltip: phaseRule.phaseTooltip,
    blockedReason: phaseRule.blockedReason,
    preferredPhase: phaseRule.preferredPhase,
    currentPhase: phaseRule.currentPhase,
    phaseEffectSummary: createEffectiveActionPhaseSummary({
      baseInputCost: input.action.inputCost,
      effectiveInputCost,
      baseOutputGain: input.action.outputGain,
      effectiveOutputGain,
      baseHeatGain: input.action.heatGain,
      effectiveHeatGain,
      baseCooldownMs: input.action.cooldownMs,
      effectiveCooldownMs,
      baseDurationMs: input.action.durationMs,
      effectiveDurationMs
    })
  };
};

const createEffectiveActionPhaseSummary = (input: {
  baseInputCost: Record<string, number>;
  effectiveInputCost: Record<string, number>;
  baseOutputGain: Record<string, number>;
  effectiveOutputGain: Record<string, number>;
  baseHeatGain: number;
  effectiveHeatGain: number;
  baseCooldownMs: number;
  effectiveCooldownMs: number;
  baseDurationMs: number;
  effectiveDurationMs: number;
}): string[] => [
  ...createChangedResourceParts("Cena", input.baseInputCost, input.effectiveInputCost),
  ...createChangedResourceParts("Zisk", input.baseOutputGain, input.effectiveOutputGain),
  createChangedNumberPart("Heat", input.baseHeatGain, input.effectiveHeatGain, { signed: true }),
  createChangedNumberPart("Cooldown", input.baseCooldownMs, input.effectiveCooldownMs, {
    formatter: formatDurationMs
  }),
  createChangedNumberPart("Trvání", input.baseDurationMs, input.effectiveDurationMs, {
    formatter: formatDurationMs
  })
].filter((part): part is string => Boolean(part));

const createChangedResourceParts = (
  label: string,
  baseValues: Record<string, number>,
  effectiveValues: Record<string, number>
): string[] => {
  const resourceKeys = Array.from(new Set([
    ...Object.keys(baseValues ?? {}),
    ...Object.keys(effectiveValues ?? {})
  ])).sort();
  return resourceKeys
    .map((resourceKey) => {
      const base = Math.max(0, Number(baseValues?.[resourceKey] || 0));
      const effective = Math.max(0, Number(effectiveValues?.[resourceKey] || 0));
      if (Math.abs(base - effective) < 0.001) {
        return null;
      }
      return `${label} ${formatResourceLabel(resourceKey)} ${formatAmount(base)} -> ${formatAmount(effective)}`;
    })
    .filter((part): part is string => Boolean(part));
};

const createChangedNumberPart = (
  label: string,
  baseValue: number,
  effectiveValue: number,
  options: {
    signed?: boolean;
    formatter?: (value: number) => string;
  } = {}
): string | null => {
  const base = Number(baseValue || 0);
  const effective = Number(effectiveValue || 0);
  if (!Number.isFinite(base) || !Number.isFinite(effective) || Math.abs(base - effective) < 0.001) {
    return null;
  }
  const formatter = options.formatter ?? ((value: number) => formatAmount(value, options.signed));
  return `${label} ${formatter(base)} -> ${formatter(effective)}`;
};

const formatResourceLabel = (resourceKey: string): string => {
  const labels: Record<string, string> = {
    cash: "cash",
    "dirty-cash": "dirty cash",
    dirtyCash: "dirty cash",
    influence: "vliv",
    chemicals: "chemicals",
    biomass: "biomass",
    "metal-parts": "metal parts",
    metalParts: "metal parts",
    "tech-core": "tech core",
    techCore: "tech core",
    "combat-module": "bojový modul",
    combatModule: "bojový modul"
  };
  return labels[resourceKey] ?? resourceKey;
};

const formatAmount = (value: number, signed = false): string => {
  const rounded = Math.round(Number(value || 0) * 100) / 100;
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/u, "").replace(/\.$/u, "");
  return signed && rounded > 0 ? `+${label}` : label;
};

const formatDurationMs = (value: number): string => {
  const ms = Math.max(0, Math.round(Number(value || 0)));
  if (ms <= 0) {
    return "0s";
  }
  const totalSeconds = Math.ceil(ms / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes > 0 ? `${hours}h ${restMinutes}m` : `${hours}h`;
};
