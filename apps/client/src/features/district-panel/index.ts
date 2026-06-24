export * from "./attack-command";
export * from "./occupy-command";
export * from "./select-spawn-command";
export * from "./spy-command";
export * from "./trap-command";

import type { DistrictPanelViewModel } from "../../selectors";
import { escapeAttribute, escapeHtml } from "../../shared-ui";
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
        `<section class="district-destroyed-notice" data-feature="district-destroyed-notice" data-district-id="${escapeAttribute(panel.districtId)}" data-district-destroyed="true" role="status" aria-label="Zničený distrikt">`,
        `<p>V piči, zničen.</p>`,
        `</section>`,
      ].join("")
    : [
        `<section class="district-panel" data-feature="${districtPanelFeature}" data-district-id="${escapeAttribute(panel.districtId)}">`,
    `<header class="district-panel__header">`,
    `<p class="district-panel__eyebrow">Panel distriktu</p>`,
    `<h2 class="district-panel__title">${escapeHtml(panel.title)}</h2>`,
    `<div class="district-panel__badges">`,
    `<span class="district-panel__badge district-panel__badge--owner">${escapeHtml(panel.ownershipLabel)}</span>`,
    `<span class="district-panel__badge district-panel__badge--status">${escapeHtml(panel.statusLabel)}</span>`,
    panel.hasPendingCommand
      ? `<span class="district-panel__badge district-panel__badge--pending">Akce se zpracovává</span>`
      : "",
    `</div>`,
    `</header>`,
    `<section class="district-panel__summary-grid" aria-label="Přehled distriktu">`,
    `<article class="district-panel__summary-card"><span class="district-panel__summary-label">Vlastnictví</span><strong class="district-panel__summary-value">${escapeHtml(panel.ownershipLabel)}</strong></article>`,
    `<article class="district-panel__summary-card"><span class="district-panel__summary-label">Zóna</span><strong class="district-panel__summary-value">${escapeHtml(panel.zoneLabel)}</strong></article>`,
    `<article class="district-panel__summary-card"><span class="district-panel__summary-label">Hledanost</span><strong class="district-panel__summary-value">${escapeHtml(panel.heatLabel)}</strong></article>`,
    `<article class="district-panel__summary-card"><span class="district-panel__summary-label">Vliv</span><strong class="district-panel__summary-value">${escapeHtml(panel.influenceLabel)}</strong></article>`,
    `<article class="district-panel__summary-card"><span class="district-panel__summary-label">Budovy</span><strong class="district-panel__summary-value">${escapeHtml(panel.buildingSummary)}</strong></article>`,
    `</section>`,
    panel.trap
      ? [
          `<section class="district-panel__section" data-trap-action="true">`,
          `<div class="district-panel__section-head">`,
          `<div>`,
          `<h3 class="district-panel__section-title">Past</h3>`,
          `<p class="district-panel__section-copy">Nastraž jednu skrytou past ve vlastním distriktu. Nepřátelé ji zjistí jen přes reporty.</p>`,
          `</div>`,
          `<span class="district-panel__section-meta">${panel.trap.activeLabel ? "Nastraženo" : "Připraveno"}</span>`,
          `</div>`,
          `<div class="district-panel__action-row">`,
          `<button class="district-panel__action-button district-panel__action-button--trap" data-place-trap="true"${panel.trap.disabled ? " disabled" : ""}${panel.trap.disabledReason ? ` data-disabled-reason="${escapeAttribute(panel.trap.disabledReason)}"` : ""}>${escapeHtml(panel.trap.actionLabel)}</button>`,
          panel.trap.disabledReason
            ? `<p class="district-panel__action-reason">${escapeHtml(panel.trap.disabledReason)}</p>`
            : panel.trap.activeLabel
              ? `<p class="district-panel__action-reason">${escapeHtml(panel.trap.activeLabel)}</p>`
              : "",
          `</div>`,
          `</section>`
        ].join("")
      : "",
    `<section class="district-panel__section" data-spy-targets="true">`,
    `<div class="district-panel__section-head">`,
    `<div>`,
    `<h3 class="district-panel__section-title">Cíle špehování</h3>`,
    `<p class="district-panel__section-copy">Vyšli průzkum z tohoto distriktu. Reporty potvrzuje server.</p>`,
    `</div>`,
    `<span class="district-panel__section-meta">${escapeHtml(panel.spyTargets.length)} celkem</span>`,
    `</div>`,
    panel.spyTargets.length > 0
      ? panel.spyTargets
          .map((target) => {
            const disabledAttribute = target.disabled ? " disabled" : "";
            const reasonAttribute = target.disabledReason
              ? ` data-disabled-reason="${escapeAttribute(target.disabledReason)}"`
              : "";

            return [
              `<div class="district-panel__action-row">`,
              `<button class="district-panel__action-button district-panel__action-button--spy" data-spy-target-id="${escapeAttribute(target.districtId)}"${disabledAttribute}${reasonAttribute}>`,
              `<span class="district-panel__action-title">${escapeHtml(target.label)}</span>`,
              `<span class="district-panel__action-meta">${escapeHtml(target.ownerLabel)} · ${escapeHtml(target.statusLabel)}</span>`,
              `</button>`,
              target.disabledReason
                ? `<p class="district-panel__action-reason">${escapeHtml(target.disabledReason)}</p>`
                : "",
              `</div>`
            ].join("");
          })
          .join("")
      : `<p class="district-panel__empty-copy">Z tohoto distriktu není dostupný cíl špehování.</p>`,
    `</section>`,
    `<section class="district-panel__section" data-occupy-targets="true">`,
    `<div class="district-panel__section-head">`,
    `<div>`,
    `<h3 class="district-panel__section-title">Cíle obsazení</h3>`,
    `<p class="district-panel__section-copy">Neutrální sousedy obsazuj až po serverem potvrzeném průzkumu.</p>`,
    `</div>`,
    `<span class="district-panel__section-meta">${escapeHtml(panel.occupyTargets.length)} celkem</span>`,
    `</div>`,
    panel.occupyTargets.length > 0
      ? panel.occupyTargets
          .map((target) => {
            const disabledAttribute = target.disabled ? " disabled" : "";
            const reasonAttribute = target.disabledReason
              ? ` data-disabled-reason="${escapeAttribute(target.disabledReason)}"`
              : "";

            return [
              `<div class="district-panel__action-row">`,
              `<button class="district-panel__action-button district-panel__action-button--occupy" data-occupy-target-id="${escapeAttribute(target.districtId)}"${disabledAttribute}${reasonAttribute}>`,
              `<span class="district-panel__action-title">${escapeHtml(target.label)}</span>`,
              `<span class="district-panel__action-meta">${escapeHtml(target.statusLabel)} · cena ${escapeHtml(target.influenceCostLabel)} · hledanost ${escapeHtml(target.heatGainLabel)}</span>`,
              `</button>`,
              target.disabledReason
                ? `<p class="district-panel__action-reason">${escapeHtml(target.disabledReason)}</p>`
                : "",
              `</div>`
            ].join("");
          })
          .join("")
      : `<p class="district-panel__empty-copy">Z tohoto distriktu není dostupný neutrální cíl obsazení.</p>`,
    `</section>`,
    `<section class="district-panel__section" data-attack-targets="true">`,
    `<div class="district-panel__section-head">`,
    `<div>`,
    `<h3 class="district-panel__section-title">Cíle útoku</h3>`,
    `<p class="district-panel__section-copy">Vyber sousední distrikt pro útok.</p>`,
    `</div>`,
    `<span class="district-panel__section-meta">${escapeHtml(panel.attackTargets.length)} celkem</span>`,
    `</div>`,
    panel.attackTargets.length > 0
      ? panel.attackTargets
          .map((target) => {
            const disabledAttribute = target.disabled ? " disabled" : "";
            const reasonAttribute = target.disabledReason
              ? ` data-disabled-reason="${escapeAttribute(target.disabledReason)}"`
              : "";

            return [
              `<div class="district-panel__action-row">`,
              `<button class="district-panel__action-button district-panel__action-button--attack" data-attack-target-id="${escapeAttribute(target.districtId)}"${disabledAttribute}${reasonAttribute}>`,
              `<span class="district-panel__action-title">${escapeHtml(target.label)}</span>`,
              `<span class="district-panel__action-meta">${escapeHtml(target.ownerLabel)} · ${escapeHtml(target.statusLabel)}</span>`,
              `</button>`,
              target.disabledReason
                ? `<p class="district-panel__action-reason">${escapeHtml(target.disabledReason)}</p>`
                : "",
              `</div>`
            ].join("");
          })
          .join("")
      : `<p class="district-panel__empty-copy">Z tohoto distriktu není dostupný cíl útoku.</p>`,
    `</section>`,
    `<section class="district-panel__section">`,
    `<div class="district-panel__section-head">`,
    `<div>`,
    `<h3 class="district-panel__section-title">Budovy distriktu</h3>`,
    `<p class="district-panel__section-copy">Budovy jsou pevně dané mapou distriktu. Akce z budov potvrzuje server.</p>`,
    `</div>`,
    `<span class="district-panel__section-meta">${escapeHtml(panel.buildings.length)} pevně daných</span>`,
    `</div>`,
    `<div class="district-panel__slot-list">`,
    panel.buildings.length > 0
      ? panel.buildings
          .map((building) => renderDistrictBuilding(building, building.buildingId === panel.selectedBuildingId))
          .join("")
      : `<p class="district-panel__empty-copy">Tento distrikt nemá v projekci žádné pevné budovy.</p>`,
    `</div>`,
    `</section>`,
    panel.slots.some((slot) => slot.production || slot.craftOptions.length > 0)
      ? [
          `<section class="district-panel__section" data-production-slots="true">`,
          `<div class="district-panel__section-head">`,
          `<div>`,
          `<h3 class="district-panel__section-title">Produkční sloty</h3>`,
          `<p class="district-panel__section-copy">Pevné produkční budovy tady ukazují sklady, zpracování a recepty.</p>`,
          `</div>`,
          `<span class="district-panel__section-meta">${escapeHtml(panel.slots.filter((slot) => slot.production || slot.craftOptions.length > 0).length)} aktivních</span>`,
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
