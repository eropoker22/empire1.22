import type { GameplaySliceView } from "@empire/shared-types";
import type { ClientUiState } from "../state";
import { createDistrictBasicActionViewModels } from "./district-basic-action-view-model";
export * from "./district-panel-view-model-types";
import type { DistrictPanelViewModel } from "./district-panel-view-model-types";
import {
  createCooldownCountdown,
  formatDurationMs,
  formatHeatLabel,
  formatResourceSummary,
  formatSigned,
  formatTickLabel,
  getStoragePercent,
  toTitleCase
} from "./district-panel-view-model-formatters";

/**
 * Responsibility: Maps server-fed district slice data into UI-ready district panel fields.
 * Belongs here: label formatting and local pending-state overlays.
 * Does not belong here: authoritative build validation.
 */
export const createDistrictPanelViewModel = (
  slice: GameplaySliceView | null,
  uiState: ClientUiState,
  options: { nowMs?: number } = {}
): DistrictPanelViewModel | null => {
  if (!slice?.district || uiState.selectedDistrictId !== slice.district.districtId) {
    return null;
  }

  const hasPendingCommand = uiState.pendingCommandIds.length > 0;
  const playerResources = slice.player.resourceBalances ?? {};
  const nowMs = options.nowMs ?? Date.now();
  const tickRateMs = Math.max(1, slice.mode.tickRateMs);
  const selectedBuildingId = slice.district.buildings.some((building) => building.buildingId === uiState.selectedBuildingId)
    ? uiState.selectedBuildingId
    : null;
  const basicActions = createDistrictBasicActionViewModels(slice.district, hasPendingCommand);

  return {
    districtId: slice.district.districtId,
    selectedBuildingId,
    title: slice.district.name,
    ownershipLabel: slice.district.isOwnedByPlayer
      ? "Vlastní hráč"
      : slice.district.status === "destroyed"
        ? "Zničený distrikt"
        : slice.district.ownerPlayerId
        ? `Vlastní ${slice.district.ownerPlayerId}`
        : "Neobsazený distrikt",
    zoneLabel: toTitleCase(slice.district.zone),
    statusLabel: slice.district.status,
    heatLabel: formatHeatLabel(slice.district.heat),
    influenceLabel: String(slice.district.influence),
    buildingSummary: slice.district.status === "destroyed"
      ? "0 pevných budov · zničeno"
      : `${slice.district.buildings.length} pevných budov`,
    attackSummary:
      slice.district.attackTargets.length > 0
        ? `${slice.district.attackTargets.filter((target) => target.enabled).length}/${slice.district.attackTargets.length} tras útoku připraveno`
        : "Žádné sousední trasy útoku",
    hasPendingCommand,
    trap: slice.district.trap
      ? {
          actionLabel: slice.district.trap.activeTrap ? "Past nastražena" : "Nastražit skrytou past",
          activeLabel: slice.district.trap.activeTrap
            ? `${slice.district.trap.activeTrap.label} · tick ${slice.district.trap.activeTrap.placedAtTick}`
            : null,
          disabled: hasPendingCommand || !slice.district.trap.enabled,
          disabledReason: hasPendingCommand
            ? "Akce se zpracovává."
            : slice.district.trap.disabledReason
        }
      : null,
    spyTargets: slice.district.spyTargets.map((target) => ({
      districtId: target.districtId,
      label: target.name,
      ownerLabel: target.ownerPlayerId
        ? `Vlastník ${target.ownerPlayerId}`
        : "Neutrální distrikt",
      statusLabel: target.status,
      disabled: hasPendingCommand || !target.enabled,
      disabledReason: hasPendingCommand
        ? "Akce se zpracovává."
        : target.disabledReason
    })),
    occupyTargets: slice.district.occupyTargets.map((target) => ({
      districtId: target.districtId,
      label: target.name,
      statusLabel: target.status,
      disabled: hasPendingCommand || !target.enabled,
      disabledReason: hasPendingCommand
        ? "Akce se zpracovává."
        : target.disabledReason,
      disabledCode: target.disabledCode,
      influenceCostLabel: String(target.cost.influence),
      heatGainLabel: `+${target.heatGain}`,
      cooldownLabel: target.cooldownRemainingTicks > 0
        ? `${target.cooldownRemainingTicks} ticks`
        : null
    })),
    robTargets: basicActions.robTargets,
    heistTargets: basicActions.heistTargets,
    placeDefense: basicActions.placeDefense,
    removeDefense: basicActions.removeDefense,
    attackTargets: slice.district.attackTargets.map((target) => ({
      districtId: target.districtId,
      label: target.name,
      ownerLabel: target.ownerPlayerId
        ? `Vlastník ${target.ownerPlayerId}`
        : "Neutrální distrikt",
      statusLabel: target.status,
      disabled: hasPendingCommand || !target.enabled,
      disabledReason: hasPendingCommand
        ? "Akce se zpracovává."
        : target.disabledReason,
      cooldownLabel: (target.cooldownRemainingTicks ?? 0) > 0
        ? `${target.cooldownRemainingTicks} ticks`
        : null
    })),
    buildings: slice.district.buildings.map((building) => ({
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
        const cooldown = createCooldownCountdown(action.cooldownRemainingTicks ?? 0, tickRateMs, nowMs);
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
          disabled: hasPendingCommand || !action.enabled,
          disabledReason: hasPendingCommand
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
        const cooldown = createCooldownCountdown(action.cooldownRemainingTicks ?? 0, tickRateMs, nowMs);
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
          inputs: action.requiresInput.map((input) => ({
            id: input.id,
            type: input.type,
            label: input.label,
            required: input.required,
            min: input.min,
            max: input.max,
            options: input.options ?? []
          })),
          cooldownLabel: cooldown.remainingMs > 0
            ? `Čekání ${formatDurationMs(cooldown.remainingMs)}`
            : `${Math.ceil(effectiveCooldownMs / 1000)}s čekání`,
          cooldownRemainingMs: cooldown.remainingMs,
          cooldownEndsAtMs: cooldown.endsAtMs,
          heatLabel: `+${effectiveHeatGain}`,
          influenceLabel: formatSigned(action.influenceChange),
          disabled: hasPendingCommand || !action.enabled,
          disabledReason: hasPendingCommand
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
      })
    })),
    slots: slice.district.slots.map((slot) => ({
      slotIndex: slot.slotIndex,
      buildingTypeId: slot.buildingTypeId,
      title: slot.buildingTypeId ? toTitleCase(slot.buildingTypeId) : `Prázdný slot ${slot.slotIndex + 1}`,
      statusLabel: slot.status,
      canBuild: false,
      summaryLabel: slot.processing
        ? `${slot.processing.label} se zpracovává na server ticku.`
        : slot.production && slot.craftOptions.length > 0
        ? `${slot.production.resourceLabel} běží na server ticku a vybraný sklad se tady dá zpracovat.`
        : slot.production
          ? `${slot.production.resourceLabel} běží na server ticku.`
          : slot.craftOptions.length > 0
            ? "Tahle stavba zpracovává vybraný sklad přes serverové recepty."
            : slot.buildingTypeId
              ? "Stavba už stojí"
              : "Tomuto slotu není přiřazená pevná budova.",
      production: slot.production && slot.buildingId
        ? {
            buildingId: slot.buildingId,
            resourceLabel: slot.production.resourceLabel,
            storageLabel: `${slot.production.storedAmount}/${slot.production.storageCap} připraveno`,
            storagePercent: getStoragePercent(slot.production.storedAmount, slot.production.storageCap),
            playerStockLabel: `${Math.max(0, Number(playerResources[slot.production.resourceKey] || 0))} ve skladu`,
            rateLabel: `${slot.production.amountPerTick}/tick`,
            canCollect: slot.production.canCollect && !hasPendingCommand,
            collectDisabledReason: hasPendingCommand
              ? "Akce se zpracovává."
              : slot.production.collectDisabledReason
          }
        : null,
      processing: slot.processing
        ? {
            label: slot.processing.label,
            progressLabel: `${Math.max(0, slot.processing.totalTicks - slot.processing.remainingTicks)}/${slot.processing.totalTicks} ticks`,
            completionLabel: `Připraveno za ${formatTickLabel(slot.processing.remainingTicks)}`,
            outputLabel: `+${slot.processing.outputAmount} ${slot.processing.outputResourceLabel}`
          }
        : null,
      craftOptions: slot.craftOptions.map((option) => ({
        buildingId: slot.buildingId ?? "",
        recipeId: option.recipeId,
        label: option.label,
        inputSummary: option.inputSummary,
        outputAmount: option.outputAmount,
        outputResourceLabel: option.outputResourceLabel,
        playerStockLabel: `${Math.max(0, Number(playerResources[option.outputResourceKey] || 0))} ${option.outputResourceLabel} ve skladu`,
        canCraft: option.canCraft && !hasPendingCommand && Boolean(slot.buildingId),
        disabledReason: hasPendingCommand
          ? "Akce se zpracovává."
          : option.craftDisabledReason
      })),
      buildOptions: []
    }))
  };
};

const createPhaseEffectLabel = (input: {
  phaseTooltip: string | null;
  phaseEffectSummary: string[];
}): string | null => {
  if (input.phaseEffectSummary.length > 0) {
    return input.phaseEffectSummary.join(", ");
  }
  const tooltip = String(input.phaseTooltip || "").trim();
  if (tooltip) {
    return tooltip;
  }
  return null;
};
