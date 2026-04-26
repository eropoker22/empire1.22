export * from "./attack-command";
export * from "./spy-command";
export * from "./trap-command";

import type { DistrictPanelViewModel } from "../../selectors";
import { renderBuildingSlot, renderDistrictBuilding } from "../building-panel";

/**
 * Responsibility: Feature module boundary for district panel presentation.
 * Belongs here: district-specific rendering and command dispatch hooks.
 * Does not belong here: district rule evaluation or authoritative state mutation.
 */
export const districtPanelFeature = "district-panel";

export const renderDistrictPanel = (panel: DistrictPanelViewModel): string =>
  panel.statusLabel === "destroyed"
    ? [
        `<section class="district-destroyed-notice" data-feature="district-destroyed-notice" data-district-id="${panel.districtId}" data-district-destroyed="true" role="status" aria-label="Destroyed district">`,
        `<p>V piči, zničen.</p>`,
        `</section>`,
      ].join("")
    : [
        `<section class="district-panel" data-feature="${districtPanelFeature}" data-district-id="${panel.districtId}">`,
    `<header class="district-panel__header">`,
    `<p class="district-panel__eyebrow">District panel</p>`,
    `<h2 class="district-panel__title">${panel.title}</h2>`,
    `<div class="district-panel__badges">`,
    `<span class="district-panel__badge district-panel__badge--owner">${panel.ownershipLabel}</span>`,
    `<span class="district-panel__badge district-panel__badge--status">${panel.statusLabel}</span>`,
    panel.hasPendingCommand
      ? `<span class="district-panel__badge district-panel__badge--pending">Command pending</span>`
      : "",
    `</div>`,
    `</header>`,
    `<section class="district-panel__summary-grid" aria-label="District overview">`,
    `<article class="district-panel__summary-card"><span class="district-panel__summary-label">Ownership</span><strong class="district-panel__summary-value">${panel.ownershipLabel}</strong></article>`,
    `<article class="district-panel__summary-card"><span class="district-panel__summary-label">Zone</span><strong class="district-panel__summary-value">${panel.zoneLabel}</strong></article>`,
    `<article class="district-panel__summary-card"><span class="district-panel__summary-label">Heat</span><strong class="district-panel__summary-value">${panel.heatLabel}</strong></article>`,
    `<article class="district-panel__summary-card"><span class="district-panel__summary-label">Influence</span><strong class="district-panel__summary-value">${panel.influenceLabel}</strong></article>`,
    `<article class="district-panel__summary-card"><span class="district-panel__summary-label">Buildings</span><strong class="district-panel__summary-value">${panel.buildingSummary}</strong></article>`,
    `</section>`,
    panel.trap
      ? [
          `<section class="district-panel__section" data-trap-action="true">`,
          `<div class="district-panel__section-head">`,
          `<div>`,
          `<h3 class="district-panel__section-title">Trap</h3>`,
          `<p class="district-panel__section-copy">Arm one hidden trap on your owned district. Enemy players only learn about it through reports.</p>`,
          `</div>`,
          `<span class="district-panel__section-meta">${panel.trap.activeLabel ? "Armed" : "Ready"}</span>`,
          `</div>`,
          `<div class="district-panel__action-row">`,
          `<button class="district-panel__action-button district-panel__action-button--trap" data-place-trap="true"${panel.trap.disabled ? " disabled" : ""}${panel.trap.disabledReason ? ` data-disabled-reason="${panel.trap.disabledReason}"` : ""}>${panel.trap.actionLabel}</button>`,
          panel.trap.disabledReason
            ? `<p class="district-panel__action-reason">${panel.trap.disabledReason}</p>`
            : panel.trap.activeLabel
              ? `<p class="district-panel__action-reason">${panel.trap.activeLabel}</p>`
              : "",
          `</div>`,
          `</section>`
        ].join("")
      : "",
    `<section class="district-panel__section" data-spy-targets="true">`,
    `<div class="district-panel__section-head">`,
    `<div>`,
    `<h3 class="district-panel__section-title">Spy Targets</h3>`,
    `<p class="district-panel__section-copy">Dispatch one scouting command from this district. Reports stay server-authoritative.</p>`,
    `</div>`,
    `<span class="district-panel__section-meta">${panel.spyTargets.length} total</span>`,
    `</div>`,
    panel.spyTargets.length > 0
      ? panel.spyTargets
          .map((target) => {
            const disabledAttribute = target.disabled ? " disabled" : "";
            const reasonAttribute = target.disabledReason
              ? ` data-disabled-reason="${target.disabledReason}"`
              : "";

            return [
              `<div class="district-panel__action-row">`,
              `<button class="district-panel__action-button district-panel__action-button--spy" data-spy-target-id="${target.districtId}"${disabledAttribute}${reasonAttribute}>`,
              `<span class="district-panel__action-title">${target.label}</span>`,
              `<span class="district-panel__action-meta">${target.ownerLabel} · ${target.statusLabel}</span>`,
              `</button>`,
              target.disabledReason
                ? `<p class="district-panel__action-reason">${target.disabledReason}</p>`
                : "",
              `</div>`
            ].join("");
          })
          .join("")
      : `<p class="district-panel__empty-copy">No spy targets are available for this district.</p>`,
    `</section>`,
    `<section class="district-panel__section" data-attack-targets="true">`,
    `<div class="district-panel__section-head">`,
    `<div>`,
    `<h3 class="district-panel__section-title">Attack Targets</h3>`,
    `<p class="district-panel__section-copy">Pick an adjacent district to dispatch an attack command.</p>`,
    `</div>`,
    `<span class="district-panel__section-meta">${panel.attackTargets.length} total</span>`,
    `</div>`,
    panel.attackTargets.length > 0
      ? panel.attackTargets
          .map((target) => {
            const disabledAttribute = target.disabled ? " disabled" : "";
            const reasonAttribute = target.disabledReason
              ? ` data-disabled-reason="${target.disabledReason}"`
              : "";

            return [
              `<div class="district-panel__action-row">`,
              `<button class="district-panel__action-button district-panel__action-button--attack" data-attack-target-id="${target.districtId}"${disabledAttribute}${reasonAttribute}>`,
              `<span class="district-panel__action-title">${target.label}</span>`,
              `<span class="district-panel__action-meta">${target.ownerLabel} · ${target.statusLabel}</span>`,
              `</button>`,
              target.disabledReason
                ? `<p class="district-panel__action-reason">${target.disabledReason}</p>`
                : "",
              `</div>`
            ].join("");
          })
          .join("")
      : `<p class="district-panel__empty-copy">No attack targets are available for this district.</p>`,
    `</section>`,
    `<section class="district-panel__section">`,
    `<div class="district-panel__section-head">`,
    `<div>`,
    `<h3 class="district-panel__section-title">District buildings</h3>`,
    `<p class="district-panel__section-copy">Buildings are fixed by district map data. Run server-authoritative actions from each building.</p>`,
    `</div>`,
    `<span class="district-panel__section-meta">${panel.buildings.length} fixed</span>`,
    `</div>`,
    `<div class="district-panel__slot-list">`,
    panel.buildings.length > 0
      ? panel.buildings
          .map((building) => renderDistrictBuilding(building, building.buildingId === panel.selectedBuildingId))
          .join("")
      : `<p class="district-panel__empty-copy">No fixed buildings are assigned to this district projection.</p>`,
    `</div>`,
    `</section>`,
    panel.slots.some((slot) => slot.production || slot.craftOptions.length > 0)
      ? [
          `<section class="district-panel__section" data-production-slots="true">`,
          `<div class="district-panel__section-head">`,
          `<div>`,
          `<h3 class="district-panel__section-title">Production slots</h3>`,
          `<p class="district-panel__section-copy">Fixed production buildings expose storage, processing and craft slots here.</p>`,
          `</div>`,
          `<span class="district-panel__section-meta">${panel.slots.filter((slot) => slot.production || slot.craftOptions.length > 0).length} active</span>`,
          `</div>`,
          `<div class="district-panel__slot-list district-panel__slot-list--production">`,
          panel.slots
            .filter((slot) => slot.production || slot.craftOptions.length > 0)
            .map((slot) => renderBuildingSlot(slot))
            .join(""),
          `</div>`,
          `</section>`
        ].join("")
      : "",
    "</section>"
  ].join("");
