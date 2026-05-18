import type { GameplaySliceView } from "@empire/shared-types";
import type { ClientUiState } from "../state";
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

  return {
    districtId: slice.district.districtId,
    selectedBuildingId,
    title: slice.district.name,
    ownershipLabel: slice.district.isOwnedByPlayer
      ? "Owned by current player"
      : slice.district.status === "destroyed"
        ? "Destroyed district"
        : slice.district.ownerPlayerId
        ? `Owned by ${slice.district.ownerPlayerId}`
        : "Unclaimed district",
    zoneLabel: toTitleCase(slice.district.zone),
    statusLabel: slice.district.status,
    heatLabel: formatHeatLabel(slice.district.heat),
    influenceLabel: String(slice.district.influence),
    buildingSummary: slice.district.status === "destroyed"
      ? "0 fixed buildings · destroyed"
      : `${slice.district.buildings.length} fixed buildings`,
    attackSummary:
      slice.district.attackTargets.length > 0
        ? `${slice.district.attackTargets.filter((target) => target.enabled).length}/${slice.district.attackTargets.length} attack routes ready`
        : "No adjacent attack routes",
    hasPendingCommand,
    trap: slice.district.trap
      ? {
          actionLabel: slice.district.trap.activeTrap ? "Trap armed" : "Arm hidden trap",
          activeLabel: slice.district.trap.activeTrap
            ? `${slice.district.trap.activeTrap.label} · tick ${slice.district.trap.activeTrap.placedAtTick}`
            : null,
          disabled: hasPendingCommand || !slice.district.trap.enabled,
          disabledReason: hasPendingCommand
            ? "Command pending."
            : slice.district.trap.disabledReason
        }
      : null,
    spyTargets: slice.district.spyTargets.map((target) => ({
      districtId: target.districtId,
      label: target.name,
      ownerLabel: target.ownerPlayerId
        ? `Owner ${target.ownerPlayerId}`
        : "Neutral district",
      statusLabel: target.status,
      disabled: hasPendingCommand || !target.enabled,
      disabledReason: hasPendingCommand
        ? "Command pending."
        : target.disabledReason
    })),
    occupyTargets: slice.district.occupyTargets.map((target) => ({
      districtId: target.districtId,
      label: target.name,
      statusLabel: target.status,
      disabled: hasPendingCommand || !target.enabled,
      disabledReason: hasPendingCommand
        ? "Command pending."
        : target.disabledReason,
      disabledCode: target.disabledCode,
      influenceCostLabel: String(target.cost.influence),
      heatGainLabel: `+${target.heatGain}`,
      cooldownLabel: target.cooldownRemainingTicks > 0
        ? `${target.cooldownRemainingTicks} ticks`
        : null
    })),
    attackTargets: slice.district.attackTargets.map((target) => ({
      districtId: target.districtId,
      label: target.name,
      ownerLabel: target.ownerPlayerId
        ? `Owner ${target.ownerPlayerId}`
        : "Neutral district",
      statusLabel: target.status,
      disabled: hasPendingCommand || !target.enabled,
      disabledReason: hasPendingCommand
        ? "Command pending."
        : target.disabledReason
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
      summaryLabel: `${building.actions.filter((action) => action.enabled).length}/${building.actions.length} actions ready`,
      stats: building.stats.map((stat) => ({
        label: stat.label,
        value: stat.value
      })),
      specialActions: building.specialActions.map((action) => {
        const cooldown = createCooldownCountdown(action.cooldownRemainingTicks ?? 0, tickRateMs, nowMs);

        return {
          actionId: action.actionId,
          label: action.label,
          description: action.description,
          effectSummary: action.effectSummary,
          durationLabel: action.durationMs > 0 ? formatDurationMs(action.durationMs) : "Instant",
          cooldownLabel: cooldown.remainingMs > 0
            ? `Cooldown ${formatDurationMs(cooldown.remainingMs)}`
            : formatDurationMs(action.cooldownMs),
          cooldownRemainingMs: cooldown.remainingMs,
          cooldownEndsAtMs: cooldown.endsAtMs,
          heatLabel: `+${action.heatGain}`,
          disabled: hasPendingCommand || !action.enabled,
          disabledReason: hasPendingCommand
            ? "Command pending."
            : action.disabledReason
        };
      }),
      actions: building.actions.map((action) => {
        const cooldown = createCooldownCountdown(action.cooldownRemainingTicks ?? 0, tickRateMs, nowMs);

        return {
          actionId: action.actionId,
          label: action.label,
          description: action.description,
          statusLabel: toTitleCase(action.status),
          inputSummary: formatResourceSummary(action.inputCost, "Free"),
          outputSummary: formatResourceSummary(action.outputGain, "No output"),
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
            ? `Cooldown ${formatDurationMs(cooldown.remainingMs)}`
            : `${Math.ceil(action.cooldownMs / 1000)}s cooldown`,
          cooldownRemainingMs: cooldown.remainingMs,
          cooldownEndsAtMs: cooldown.endsAtMs,
          heatLabel: `+${action.heatGain}`,
          influenceLabel: formatSigned(action.influenceChange),
          disabled: hasPendingCommand || !action.enabled,
          disabledReason: hasPendingCommand
            ? "Command pending."
            : action.disabledReason
        };
      })
    })),
    slots: slice.district.slots.map((slot) => ({
      slotIndex: slot.slotIndex,
      buildingTypeId: slot.buildingTypeId,
      title: slot.buildingTypeId ? toTitleCase(slot.buildingTypeId) : `Empty slot ${slot.slotIndex + 1}`,
      statusLabel: slot.status,
      canBuild: false,
      summaryLabel: slot.processing
        ? `${slot.processing.label} is processing on the server tick.`
        : slot.production && slot.craftOptions.length > 0
        ? `${slot.production.resourceLabel} production runs on the server tick and collected stock can be processed here.`
        : slot.production
          ? `${slot.production.resourceLabel} production is running on the server tick.`
          : slot.craftOptions.length > 0
            ? "This structure processes collected stock through server-authoritative recipes."
            : slot.buildingTypeId
              ? "Structure already placed"
              : "No fixed building is assigned to this district slot.",
      production: slot.production && slot.buildingId
        ? {
            buildingId: slot.buildingId,
            resourceLabel: slot.production.resourceLabel,
            storageLabel: `${slot.production.storedAmount}/${slot.production.storageCap} ready`,
            storagePercent: getStoragePercent(slot.production.storedAmount, slot.production.storageCap),
            playerStockLabel: `${Math.max(0, Number(playerResources[slot.production.resourceKey] || 0))} in stock`,
            rateLabel: `${slot.production.amountPerTick}/tick`,
            canCollect: slot.production.canCollect && !hasPendingCommand,
            collectDisabledReason: hasPendingCommand
              ? "Command pending."
              : slot.production.collectDisabledReason
          }
        : null,
      processing: slot.processing
        ? {
            label: slot.processing.label,
            progressLabel: `${Math.max(0, slot.processing.totalTicks - slot.processing.remainingTicks)}/${slot.processing.totalTicks} ticks`,
            completionLabel: `Ready in ${formatTickLabel(slot.processing.remainingTicks)}`,
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
        playerStockLabel: `${Math.max(0, Number(playerResources[option.outputResourceKey] || 0))} ${option.outputResourceLabel} in stock`,
        canCraft: option.canCraft && !hasPendingCommand && Boolean(slot.buildingId),
        disabledReason: hasPendingCommand
          ? "Command pending."
          : option.craftDisabledReason
      })),
      buildOptions: []
    }))
  };
};
