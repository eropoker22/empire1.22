import type { GameplaySliceView } from "@empire/shared-types";
import type { DistrictPanelBuildingViewModel } from "./district-panel-building-view-model-types";
import {
  createCooldownCountdown,
  formatDurationMs,
  formatResourceSummary,
  formatSigned,
  toTitleCase
} from "./district-panel-view-model-formatters";

type DistrictBuilding = NonNullable<GameplaySliceView["district"]>["buildings"][number];

export const createDistrictPanelBuildingViewModels = (
  buildings: DistrictBuilding[],
  input: {
    hasPendingCommand: boolean;
    nowMs: number;
    tickRateMs: number;
  }
): DistrictPanelBuildingViewModel[] => buildings.map((building) => ({
  buildingId: building.buildingId,
  buildingTypeId: building.buildingTypeId,
  label: building.displayName || building.label,
  variantName: building.variantName,
  typeLabel: building.label,
  zoneLabel: toTitleCase(building.zone),
  roleLabel: building.role,
  info: building.info,
  statusLabel: `${building.status} · level ${building.level}`,
  summaryLabel: `${building.actions.filter((action) => action.enabled).length}/${building.actions.length} akcí připraveno`,
  stats: building.stats.map((stat) => ({
    label: stat.label,
    value: stat.value
  })),
  phaseAvailability: building.phaseAvailability ?? "neutral",
  phaseBadgeLabel: building.phaseBadgeLabel ?? null,
  phaseTooltip: building.phaseTooltip ?? null,
  passivePhaseBadgeLabel: building.passivePhaseBadgeLabel ?? null,
  passivePhaseEffectLabel: building.passivePhaseEffectLabel ?? null,
  passivePhaseTooltip: building.passivePhaseTooltip ?? null,
  specialActions: building.specialActions.map((action) => {
    const cooldown = createCooldownCountdown(action.cooldownRemainingTicks ?? 0, input.tickRateMs, input.nowMs);
    const effectiveInputCost = action.effectiveInputCost ?? action.baseInputCost ?? {};
    const effectiveOutputGain = action.effectiveOutputGain ?? action.baseOutputGain ?? {};
    const effectiveHeatGain = action.effectiveHeatGain ?? action.heatGain;
    const effectiveCooldownMs = action.effectiveCooldownMs ?? action.cooldownMs;
    const effectiveDurationMs = action.effectiveDurationMs ?? action.durationMs;

    return {
      actionId: action.actionId,
      label: action.label,
      description: action.description,
      effectSummary: action.effectSummary,
      durationLabel: effectiveDurationMs > 0 ? formatDurationMs(effectiveDurationMs) : "Okamžitě",
      cooldownLabel: cooldown.remainingMs > 0
        ? `Čekání ${formatDurationMs(cooldown.remainingMs)}`
        : formatDurationMs(effectiveCooldownMs),
      cooldownRemainingMs: cooldown.remainingMs,
      cooldownEndsAtMs: cooldown.endsAtMs,
      heatLabel: `+${effectiveHeatGain}`,
      baseInputCost: { ...(action.baseInputCost ?? action.effectiveInputCost ?? {}) },
      effectiveInputCost: { ...effectiveInputCost },
      baseOutputGain: { ...(action.baseOutputGain ?? action.effectiveOutputGain ?? {}) },
      effectiveOutputGain: { ...effectiveOutputGain },
      baseHeatGain: action.baseHeatGain ?? action.heatGain,
      effectiveHeatGain,
      baseCooldownMs: action.baseCooldownMs ?? action.cooldownMs,
      effectiveCooldownMs,
      baseDurationMs: action.baseDurationMs ?? action.durationMs,
      effectiveDurationMs,
      inputSummary: formatResourceSummary(effectiveInputCost, "Zdarma"),
      outputSummary: formatResourceSummary(effectiveOutputGain, "Bez výstupu"),
      disabled: input.hasPendingCommand || !action.enabled,
      disabledReason: input.hasPendingCommand
        ? "Akce se zpracovává."
        : action.disabledReason,
      phaseAvailability: action.phaseAvailability ?? "neutral",
      phaseBadgeLabel: action.phaseBadgeLabel ?? null,
      phaseTooltip: action.phaseTooltip ?? null,
      blockedReason: action.blockedReason ?? action.phaseBlockedReason ?? null,
      preferredPhase: action.preferredPhase ?? null,
      currentPhase: action.currentPhase ?? null,
      phaseEffectSummary: action.phaseEffectSummary ?? [],
      phaseEffectLabel: createPhaseEffectLabel({
        phaseTooltip: action.phaseTooltip ?? null,
        phaseEffectSummary: action.phaseEffectSummary ?? []
      })
    };
  }),
  actions: building.actions.map((action) => {
    const cooldown = createCooldownCountdown(action.cooldownRemainingTicks ?? 0, input.tickRateMs, input.nowMs);
    const effectiveInputCost = action.effectiveInputCost ?? action.inputCost;
    const effectiveOutputGain = action.effectiveOutputGain ?? action.outputGain;
    const effectiveHeatGain = action.effectiveHeatGain ?? action.heatGain;
    const effectiveCooldownMs = action.effectiveCooldownMs ?? action.cooldownMs;
    const effectiveDurationMs = action.effectiveDurationMs ?? action.durationMs;

    return {
      actionId: action.actionId,
      label: action.label,
      description: action.description,
      statusLabel: toTitleCase(action.status),
      inputSummary: formatResourceSummary(effectiveInputCost, "Zdarma"),
      outputSummary: formatResourceSummary(effectiveOutputGain, "Bez výstupu"),
      baseInputCost: { ...(action.baseInputCost ?? action.inputCost) },
      effectiveInputCost: { ...effectiveInputCost },
      baseOutputGain: { ...(action.baseOutputGain ?? action.outputGain) },
      effectiveOutputGain: { ...effectiveOutputGain },
      baseHeatGain: action.baseHeatGain ?? action.heatGain,
      effectiveHeatGain,
      baseCooldownMs: action.baseCooldownMs ?? action.cooldownMs,
      effectiveCooldownMs,
      baseDurationMs: action.baseDurationMs ?? action.durationMs,
      effectiveDurationMs,
      expectedEffectSummary: action.expectedEffectSummary,
      riskSummary: action.riskSummary,
      inputs: action.requiresInput.map((requiredInput) => ({
        id: requiredInput.id,
        type: requiredInput.type,
        label: requiredInput.label,
        required: requiredInput.required,
        min: requiredInput.min,
        max: requiredInput.max,
        options: requiredInput.options ?? []
      })),
      cooldownLabel: cooldown.remainingMs > 0
        ? `Čekání ${formatDurationMs(cooldown.remainingMs)}`
        : `${Math.ceil(effectiveCooldownMs / 1000)}s čekání`,
      cooldownRemainingMs: cooldown.remainingMs,
      cooldownEndsAtMs: cooldown.endsAtMs,
      heatLabel: `+${effectiveHeatGain}`,
      influenceLabel: formatSigned(action.influenceChange),
      disabled: input.hasPendingCommand || !action.enabled,
      disabledReason: input.hasPendingCommand
        ? "Akce se zpracovává."
        : action.disabledReason,
      phaseAvailability: action.phaseAvailability ?? "neutral",
      phaseBadgeLabel: action.phaseBadgeLabel ?? null,
      phaseTooltip: action.phaseTooltip ?? null,
      blockedReason: action.blockedReason ?? action.phaseBlockedReason ?? null,
      preferredPhase: action.preferredPhase ?? null,
      currentPhase: action.currentPhase ?? null,
      phaseEffectSummary: action.phaseEffectSummary ?? [],
      phaseEffectLabel: createPhaseEffectLabel({
        phaseTooltip: action.phaseTooltip ?? null,
        phaseEffectSummary: action.phaseEffectSummary ?? []
      })
    };
  }),
  productionLines: createBuildingProductionLineViewModels(building, input.tickRateMs)
}));

const createBuildingProductionLineViewModels = (
  building: DistrictBuilding,
  tickRateMs: number
) => {
  const lines = building.pharmacy?.lines
    ?? building.drugLab?.lines
    ?? building.factory?.productionLines
    ?? building.armory?.productionLines
    ?? [];

  return lines.map((line) => ({
    recipeId: line.recipeId,
    label: line.label,
    statusLabel: toTitleCase(line.status),
    inputSummary: createProductionLineCostLabel(line),
    durationLabel: line.remainingMs > 0
      ? `Zbývá ${formatDurationMs(line.remainingMs)}`
      : formatDurationMs(Math.max(0, line.effectiveUnitDurationTicks * tickRateMs)),
    canStart: line.canStart,
    disabledReason: line.disabledReason
  }));
};

const createProductionLineCostLabel = (line: {
  unitCleanCashCost?: number;
  materialInputCosts?: Record<string, number>;
}): string => {
  const costs = [
    Number(line.unitCleanCashCost || 0) > 0
      ? `${Number(line.unitCleanCashCost)} čistých peněz`
      : "",
    formatResourceSummary(line.materialInputCosts ?? {}, "")
  ].filter(Boolean);
  return costs.length > 0 ? costs.join(" · ") : "Zdarma";
};

const createPhaseEffectLabel = (input: {
  phaseTooltip: string | null;
  phaseEffectSummary: string[];
}): string | null => {
  if (input.phaseEffectSummary.length > 0) {
    return input.phaseEffectSummary.join(", ");
  }
  const tooltip = String(input.phaseTooltip || "").trim();
  return tooltip || null;
};
