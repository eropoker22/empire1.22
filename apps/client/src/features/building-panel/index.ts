export * from "./collect-command";
export * from "./craft-command";
export * from "./building-detail-popup";
export * from "./run-building-action-command";

import type { DistrictPanelBuildingViewModel, DistrictPanelSlotViewModel } from "../../selectors";
import { renderBuildingDetailPopup } from "./building-detail-popup";

/**
 * Responsibility: Feature module boundary for building panel presentation.
 * Belongs here: rendering of server-fed building data and user-triggered actions.
 * Does not belong here: production or construction resolution logic.
 */
export const buildingPanelFeature = "building-panel";

export const renderBuildingSlot = (slot: DistrictPanelSlotViewModel): string => {
  const buildingType = toCssToken(slot.buildingTypeId || "empty");
  const hasProduction = Boolean(slot.production);
  const hasCraft = slot.craftOptions.length > 0;

  return [
    `<section class="district-panel__slot district-panel__slot--${buildingType}" data-slot-index="${slot.slotIndex}" data-slot-status="${slot.statusLabel}" data-slot-building-type="${buildingType}" data-has-production="${hasProduction}" data-has-craft="${hasCraft}">`,
    `<div class="district-panel__slot-head">`,
    `<div class="district-panel__slot-heading">`,
    `<span class="district-panel__slot-icon" aria-hidden="true">${getBuildingIcon(slot.buildingTypeId)}</span>`,
    `<div>`,
    `<p class="district-panel__slot-index">Slot ${slot.slotIndex + 1}</p>`,
    `<h4 class="district-panel__slot-title">${slot.title}</h4>`,
    `</div>`,
    `</div>`,
    `<span class="district-panel__slot-state">${slot.statusLabel}</span>`,
    `</div>`,
    `<p class="district-panel__slot-summary">${slot.summaryLabel}</p>`,
    slot.production
      ? [
          `<div class="district-panel__production district-panel__production--storage">`,
          `<div class="district-panel__production-head">`,
          `<strong class="district-panel__production-title">${slot.production.resourceLabel}</strong>`,
          `<span class="district-panel__production-rate">${slot.production.rateLabel}</span>`,
          `</div>`,
          `<div class="district-panel__production-bar" style="--production-fill:${slot.production.storagePercent}%">`,
          `<span class="district-panel__production-bar-fill"></span>`,
          `</div>`,
          `<div class="district-panel__production-metrics">`,
          `<span class="district-panel__production-metric">${slot.production.storageLabel}</span>`,
          `<span class="district-panel__production-metric">${slot.production.playerStockLabel}</span>`,
          `</div>`,
          `<div class="district-panel__action-row">`,
          `<button class="district-panel__action-button district-panel__action-button--collect" data-collect-building-id="${slot.production.buildingId}"${slot.production.canCollect ? "" : " disabled"}${slot.production.collectDisabledReason ? ` data-disabled-reason="${slot.production.collectDisabledReason}"` : ""}>Collect ${slot.production.resourceLabel}</button>`,
          slot.production.collectDisabledReason
            ? `<p class="district-panel__action-reason">${slot.production.collectDisabledReason}</p>`
            : "",
          `</div>`,
          `</div>`
        ].join("")
      : "",
    slot.craftOptions.length > 0
      ? [
          `<div class="district-panel__production district-panel__production--craft">`,
          `<div class="district-panel__production-head">`,
          `<strong class="district-panel__production-title">Processing slots</strong>`,
          `<span class="district-panel__production-rate">${slot.craftOptions.length} recipe${slot.craftOptions.length === 1 ? "" : "s"}</span>`,
          `</div>`,
          slot.processing
            ? [
                `<div class="district-panel__production-metrics">`,
                `<span class="district-panel__production-metric">Processing ${slot.processing.label}</span>`,
                `<span class="district-panel__production-metric">${slot.processing.progressLabel}</span>`,
                `<span class="district-panel__production-metric">${slot.processing.completionLabel}</span>`,
                `</div>`,
                `<div class="district-panel__production-metrics">`,
                `<span class="district-panel__production-metric">${slot.processing.outputLabel}</span>`,
                `</div>`
              ].join("")
            : "",
          slot.craftOptions
            .map((option) =>
              [
                `<article class="district-panel__craft-option" data-craft-option="${option.recipeId}">`,
                `<div class="district-panel__production-metrics">`,
                `<span class="district-panel__production-metric">Costs ${option.inputSummary}</span>`,
                `<span class="district-panel__production-metric">+${option.outputAmount} ${option.outputResourceLabel}</span>`,
                `<span class="district-panel__production-metric">${option.playerStockLabel}</span>`,
                `</div>`,
                `<div class="district-panel__action-row">`,
                `<button class="district-panel__action-button district-panel__action-button--craft" data-craft-building-id="${option.buildingId}" data-craft-recipe-id="${option.recipeId}"${option.canCraft ? "" : " disabled"}${option.disabledReason ? ` data-disabled-reason="${option.disabledReason}"` : ""}>Process ${option.label}</button>`,
                option.disabledReason
                  ? `<p class="district-panel__action-reason">${option.disabledReason}</p>`
                  : "",
                `</div>`,
                `</article>`
              ].join("")
            )
            .join(""),
          `</div>`
        ].join("")
      : "",
    slot.production || slot.craftOptions.length > 0
      ? ""
      : `<p class="district-panel__empty-copy">Fixed buildings for this district are defined by district map data.</p>`,
    "</section>"
  ].join("");
};

export const renderDistrictBuilding = (
  building: DistrictPanelBuildingViewModel,
  isOpen = false
): string =>
  [
    `<article class="district-panel__slot district-panel__slot--${toCssToken(building.buildingTypeId)}" data-building-id="${building.buildingId}" data-building-type="${building.buildingTypeId}">`,
    `<div class="district-panel__slot-head">`,
    `<div class="district-panel__slot-heading">`,
    `<span class="district-panel__slot-icon" aria-hidden="true">${getBuildingIcon(building.buildingTypeId)}</span>`,
    `<div>`,
    `<p class="district-panel__slot-index">${building.typeLabel}</p>`,
    `<h4 class="district-panel__slot-title">${building.label}</h4>`,
    `</div>`,
    `</div>`,
    `<span class="district-panel__slot-state">${building.statusLabel}</span>`,
    `</div>`,
    `<p class="district-panel__slot-summary">${building.summaryLabel}</p>`,
    `<details class="district-building-popup-host" data-building-popup-target="${building.buildingId}"${isOpen ? " open" : ""}>`,
    `<summary class="district-panel__action-button district-panel__action-button--info">Stats / Info / Speciální akce</summary>`,
    renderBuildingDetailPopup(building),
    `</details>`,
    building.actions.length > 0
      ? building.actions
          .map((action) => {
            const disabledAttribute = action.disabled ? " disabled" : "";
            const reasonAttribute = action.disabledReason
              ? ` data-disabled-reason="${action.disabledReason}"`
              : "";

            return [
              `<div class="district-panel__production" data-building-action-controls="${action.actionId}">`,
              `<div class="district-panel__production-head">`,
              `<strong class="district-panel__production-title">${action.label}</strong>`,
              `<span class="district-panel__production-rate">${action.statusLabel} · ${renderLiveCooldown(action)}</span>`,
              `</div>`,
              `<p class="district-panel__slot-summary">${action.description}</p>`,
              action.expectedEffectSummary.length > 0
                ? `<p class="district-panel__slot-summary">${action.expectedEffectSummary.join(" · ")}</p>`
                : "",
              `<div class="district-panel__production-metrics">`,
              `<span class="district-panel__production-metric">Cost ${action.inputSummary}</span>`,
              `<span class="district-panel__production-metric">Gain ${action.outputSummary}</span>`,
              `<span class="district-panel__production-metric">Heat ${action.heatLabel}</span>`,
              `<span class="district-panel__production-metric">Influence ${action.influenceLabel}</span>`,
              `</div>`,
              action.riskSummary.length > 0
                ? `<div class="district-panel__production-metrics">${action.riskSummary.map((entry) => `<span class="district-panel__production-metric">${entry}</span>`).join("")}</div>`
                : "",
              `<div class="district-panel__action-row">`,
              renderBuildingActionInputs(action),
              `<button class="district-panel__action-button district-panel__action-button--craft" data-building-action-building-id="${building.buildingId}" data-building-action-id="${action.actionId}"${disabledAttribute}${reasonAttribute}>${action.label}</button>`,
              action.disabledReason
                ? `<p class="district-panel__action-reason">${action.disabledReason}</p>`
                : "",
              `</div>`,
              `</div>`
            ].join("");
          })
          .join("")
      : `<p class="district-panel__empty-copy">No server-fed building actions are available for this fixed building.</p>`,
    `</article>`
  ].join("");

const getBuildingIcon = (buildingTypeId: string | null): string => {
  switch (buildingTypeId) {
    case "pharmacy":
      return "+";
    case "drug_lab":
      return "◆";
    case "factory":
      return "▦";
    case "armory":
      return "✶";
    case "warehouse":
      return "▣";
    default:
      return "•";
  }
};

const renderBuildingActionInputs = (
  action: DistrictPanelBuildingViewModel["actions"][number]
): string =>
  action.inputs
    .map((input) => {
      const dataAttribute = `data-building-action-input="${input.id}"`;
      const dealerAttribute = input.id === "dealerSlotId"
        ? " data-dealer-slot-input"
        : input.id === "itemId"
          ? " data-dealer-item-input"
          : input.id === "amount"
            ? " data-dealer-amount-input"
            : "";

      if (input.type === "select") {
        return [
          `<select class="district-panel__action-select" ${dataAttribute}${dealerAttribute} aria-label="${input.label}">`,
          input.options.map((option) => `<option value="${option.value}">${option.label}</option>`).join(""),
          `</select>`
        ].join("");
      }

      return `<input class="district-panel__action-input" ${dataAttribute}${dealerAttribute} aria-label="${input.label}" type="${input.type}"${input.min !== undefined ? ` min="${input.min}"` : ""}${input.max !== undefined ? ` max="${input.max}"` : ""}${input.required ? " required" : ""}${input.type === "number" ? " value=\"1\"" : ""}>`;
    })
    .join("");

const toCssToken = (value: string): string =>
  String(value || "building")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "building";

const renderLiveCooldown = (
  action: DistrictPanelBuildingViewModel["actions"][number]
): string =>
  action.cooldownEndsAtMs && action.cooldownRemainingMs > 0
    ? [
        `<span data-live-cooldown="true"`,
        ` data-cooldown-ends-at-ms="${action.cooldownEndsAtMs}"`,
        ` data-cooldown-prefix="Cooldown "`,
        ` data-cooldown-ready-label="Ready after server sync">`,
        action.cooldownLabel,
        `</span>`
      ].join("")
    : action.cooldownLabel;
