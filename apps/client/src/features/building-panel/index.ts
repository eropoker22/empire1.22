export * from "./collect-command";
export * from "./craft-command";
export * from "./building-detail-popup";
export * from "./run-building-action-command";

import type { DistrictPanelBuildingViewModel, DistrictPanelSlotViewModel } from "../../selectors";
import { escapeAttribute, escapeHtml } from "../../shared-ui";
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
    `<section class="district-panel__slot district-panel__slot--${buildingType}" data-slot-index="${escapeAttribute(slot.slotIndex)}" data-slot-status="${escapeAttribute(slot.statusLabel)}" data-slot-building-type="${escapeAttribute(buildingType)}" data-has-production="${escapeAttribute(hasProduction)}" data-has-craft="${escapeAttribute(hasCraft)}">`,
    `<div class="district-panel__slot-head">`,
    `<div class="district-panel__slot-heading">`,
    `<span class="district-panel__slot-icon" aria-hidden="true">${getBuildingIcon(slot.buildingTypeId)}</span>`,
    `<div>`,
    `<p class="district-panel__slot-index">Slot ${escapeHtml(slot.slotIndex + 1)}</p>`,
    `<h4 class="district-panel__slot-title">${escapeHtml(slot.title)}</h4>`,
    `</div>`,
    `</div>`,
    `<span class="district-panel__slot-state">${escapeHtml(slot.statusLabel)}</span>`,
    `</div>`,
    `<p class="district-panel__slot-summary">${escapeHtml(slot.summaryLabel)}</p>`,
    slot.production
      ? [
          `<div class="district-panel__production district-panel__production--storage">`,
          `<div class="district-panel__production-head">`,
          `<strong class="district-panel__production-title">${escapeHtml(slot.production.resourceLabel)}</strong>`,
          `<span class="district-panel__production-rate">${escapeHtml(slot.production.rateLabel)}</span>`,
          `</div>`,
          `<div class="district-panel__production-bar" style="--production-fill:${escapeAttribute(toPercentCssValue(slot.production.storagePercent))}%">`,
          `<span class="district-panel__production-bar-fill"></span>`,
          `</div>`,
          `<div class="district-panel__production-metrics">`,
          `<span class="district-panel__production-metric">${escapeHtml(slot.production.storageLabel)}</span>`,
          `<span class="district-panel__production-metric">${escapeHtml(slot.production.playerStockLabel)}</span>`,
          `</div>`,
          `<div class="district-panel__action-row">`,
          `<button class="district-panel__action-button district-panel__action-button--collect" data-collect-building-id="${escapeAttribute(slot.production.buildingId)}"${slot.production.canCollect ? "" : " disabled"}${slot.production.collectDisabledReason ? ` data-disabled-reason="${escapeAttribute(slot.production.collectDisabledReason)}"` : ""}>Vybrat ${escapeHtml(slot.production.resourceLabel)}</button>`,
          slot.production.collectDisabledReason
            ? `<p class="district-panel__action-reason">${escapeHtml(slot.production.collectDisabledReason)}</p>`
            : "",
          `</div>`,
          `</div>`
        ].join("")
      : "",
    slot.craftOptions.length > 0
      ? [
          `<div class="district-panel__production district-panel__production--craft">`,
          `<div class="district-panel__production-head">`,
          `<strong class="district-panel__production-title">Zpracování</strong>`,
          `<span class="district-panel__production-rate">${escapeHtml(slot.craftOptions.length)} receptů</span>`,
          `</div>`,
          slot.processing
            ? [
                `<div class="district-panel__production-metrics">`,
                `<span class="district-panel__production-metric">Zpracovává se ${escapeHtml(slot.processing.label)}</span>`,
                `<span class="district-panel__production-metric">${escapeHtml(slot.processing.progressLabel)}</span>`,
                `<span class="district-panel__production-metric">${escapeHtml(slot.processing.completionLabel)}</span>`,
                `</div>`,
                `<div class="district-panel__production-metrics">`,
                `<span class="district-panel__production-metric">${escapeHtml(slot.processing.outputLabel)}</span>`,
                `</div>`
              ].join("")
            : "",
          slot.craftOptions
            .map((option) =>
              [
                `<article class="district-panel__craft-option" data-craft-option="${escapeAttribute(option.recipeId)}">`,
                `<div class="district-panel__production-metrics">`,
                `<span class="district-panel__production-metric">Cena ${escapeHtml(option.inputSummary)}</span>`,
                `<span class="district-panel__production-metric">+${escapeHtml(option.outputAmount)} ${escapeHtml(option.outputResourceLabel)}</span>`,
                `<span class="district-panel__production-metric">${escapeHtml(option.playerStockLabel)}</span>`,
                `</div>`,
                `<div class="district-panel__action-row">`,
                `<button class="district-panel__action-button district-panel__action-button--craft" data-craft-building-id="${escapeAttribute(option.buildingId)}" data-craft-recipe-id="${escapeAttribute(option.recipeId)}"${option.canCraft ? "" : " disabled"}${option.disabledReason ? ` data-disabled-reason="${escapeAttribute(option.disabledReason)}"` : ""}>Zpracovat ${escapeHtml(option.label)}</button>`,
                option.disabledReason
                  ? `<p class="district-panel__action-reason">${escapeHtml(option.disabledReason)}</p>`
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
      : `<p class="district-panel__empty-copy">Pevné budovy pro tento distrikt určuje mapa.</p>`,
    "</section>"
  ].join("");
};

export const renderDistrictBuilding = (
  building: DistrictPanelBuildingViewModel,
  isOpen = false
): string =>
  [
    `<article class="district-panel__slot district-panel__slot--${toCssToken(building.buildingTypeId)}" data-building-id="${escapeAttribute(building.buildingId)}" data-building-type="${escapeAttribute(building.buildingTypeId)}">`,
    `<div class="district-panel__slot-head">`,
    `<div class="district-panel__slot-heading">`,
    `<span class="district-panel__slot-icon" aria-hidden="true">${getBuildingIcon(building.buildingTypeId)}</span>`,
    `<div>`,
    `<p class="district-panel__slot-index">${escapeHtml(building.typeLabel)}</p>`,
    `<h4 class="district-panel__slot-title">${escapeHtml(building.label)}</h4>`,
    `</div>`,
    `</div>`,
    `<span class="district-panel__slot-state">${escapeHtml(building.statusLabel)}</span>`,
    `</div>`,
    `<p class="district-panel__slot-summary">${escapeHtml(building.summaryLabel)}</p>`,
    `<details class="district-building-popup-host" data-building-popup-target="${escapeAttribute(building.buildingId)}"${isOpen ? " open" : ""}>`,
    `<summary class="district-panel__action-button district-panel__action-button--info">Statistiky / Info / Speciální akce</summary>`,
    renderBuildingDetailPopup(building),
    `</details>`,
    building.actions.length > 0
      ? building.actions
          .map((action) => {
            const disabledAttribute = action.disabled ? " disabled" : "";
            const reasonAttribute = action.disabledReason
              ? ` data-disabled-reason="${escapeAttribute(action.disabledReason)}"`
              : "";

            return [
              `<div class="district-panel__production" data-building-action-controls="${escapeAttribute(action.actionId)}">`,
              `<div class="district-panel__production-head">`,
              `<div class="district-panel__production-title-row">`,
              `<strong class="district-panel__production-title">${escapeHtml(action.label)}</strong>`,
              renderPhaseBadge(action),
              `</div>`,
              `<span class="district-panel__production-rate">${escapeHtml(action.statusLabel)} · ${renderLiveCooldown(action)}</span>`,
              `</div>`,
              `<p class="district-panel__slot-summary">${escapeHtml(action.description)}</p>`,
              action.expectedEffectSummary.length > 0
                ? `<p class="district-panel__slot-summary">${action.expectedEffectSummary.map(escapeHtml).join(" · ")}</p>`
                : "",
              `<div class="district-panel__production-metrics">`,
              `<span class="district-panel__production-metric">Cena ${escapeHtml(action.inputSummary)}</span>`,
              `<span class="district-panel__production-metric">Zisk ${escapeHtml(action.outputSummary)}</span>`,
              `<span class="district-panel__production-metric">Hledanost ${escapeHtml(action.heatLabel)}</span>`,
              `<span class="district-panel__production-metric">Vliv ${escapeHtml(action.influenceLabel)}</span>`,
              `</div>`,
              action.riskSummary.length > 0
                ? `<div class="district-panel__production-metrics">${action.riskSummary.map((entry) => `<span class="district-panel__production-metric">${escapeHtml(entry)}</span>`).join("")}</div>`
                : "",
              `<div class="district-panel__action-row">`,
              renderBuildingActionInputs(action),
              `<button class="district-panel__action-button district-panel__action-button--craft" data-building-action-building-id="${escapeAttribute(building.buildingId)}" data-building-action-id="${escapeAttribute(action.actionId)}"${disabledAttribute}${reasonAttribute}>${escapeHtml(action.label)}</button>`,
              action.disabledReason
                ? `<p class="district-panel__action-reason">${escapeHtml(action.disabledReason)}</p>`
                : "",
              `</div>`,
              `</div>`
            ].join("");
          })
          .join("")
      : `<p class="district-panel__empty-copy">Pro tuto pevnou budovu nejsou dostupné serverové akce.</p>`,
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
      const dataAttribute = `data-building-action-input="${escapeAttribute(input.id)}"`;
      const dealerAttribute = input.id === "dealerSlotId"
        ? " data-dealer-slot-input"
        : input.id === "itemId"
          ? " data-dealer-item-input"
          : input.id === "amount"
            ? " data-dealer-amount-input"
            : "";

      if (input.type === "select") {
        return [
          `<select class="district-panel__action-select" ${dataAttribute}${dealerAttribute} aria-label="${escapeAttribute(input.label)}">`,
          input.options.map((option) => `<option value="${escapeAttribute(option.value)}">${escapeHtml(option.label)}</option>`).join(""),
          `</select>`
        ].join("");
      }

      return `<input class="district-panel__action-input" ${dataAttribute}${dealerAttribute} aria-label="${escapeAttribute(input.label)}" type="${escapeAttribute(input.type)}"${input.min !== undefined ? ` min="${escapeAttribute(input.min)}"` : ""}${input.max !== undefined ? ` max="${escapeAttribute(input.max)}"` : ""}${input.required ? " required" : ""}${input.type === "number" ? " value=\"1\"" : ""}>`;
    })
    .join("");

const toCssToken = (value: string): string =>
  String(value || "building")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "building";

const toPercentCssValue = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

const renderLiveCooldown = (
  action: DistrictPanelBuildingViewModel["actions"][number]
): string =>
  action.cooldownEndsAtMs && action.cooldownRemainingMs > 0
    ? [
        `<span data-live-cooldown="true"`,
        ` data-cooldown-ends-at-ms="${escapeAttribute(action.cooldownEndsAtMs)}"`,
        ` data-cooldown-prefix="Čekání "`,
        ` data-cooldown-ready-label="Připraveno po synchronizaci">`,
        escapeHtml(action.cooldownLabel),
        `</span>`
      ].join("")
    : escapeHtml(action.cooldownLabel);

const renderPhaseBadge = (
  action: DistrictPanelBuildingViewModel["actions"][number]
): string => {
  if (!action.phaseBadgeLabel) return "";
  const availability = toCssToken(action.phaseAvailability || "neutral");
  const tooltip = action.phaseTooltip || action.phaseBadgeLabel;
  return `<span class="district-panel__phase-badge district-panel__phase-badge--${escapeAttribute(availability)}" title="${escapeAttribute(tooltip)}">${escapeHtml(action.phaseBadgeLabel)}</span>`;
};
