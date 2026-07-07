import type { DistrictPanelBuildingViewModel } from "../../selectors";
import { escapeAttribute, escapeHtml } from "../../shared-ui";

type PhaseBadgeRenderable = Pick<DistrictPanelBuildingViewModel, "phaseAvailability" | "phaseBadgeLabel" | "phaseTooltip">;

export const renderBuildingDetailPopup = (building: DistrictPanelBuildingViewModel): string => {
  const zoneKey = toCssToken(building.zoneLabel);

  return [
    `<section class="district-building-popup district-building-popup--${zoneKey}" role="dialog" aria-label="${escapeAttribute(`Detail budovy ${building.label}`)}" data-building-zone="${escapeAttribute(zoneKey)}" data-building-popup-id="${escapeAttribute(building.buildingId)}">`,
    `<header class="district-building-popup__header">`,
    `<div>`,
    `<p class="district-building-popup__eyebrow">${escapeHtml(building.zoneLabel)} · ${escapeHtml(building.roleLabel)}</p>`,
    `<h5 class="district-building-popup__title">${escapeHtml(building.label)}</h5>`,
    `<p class="district-building-popup__type">${escapeHtml(building.typeLabel)}</p>`,
    `</div>`,
    `<span class="district-building-popup__badge">${escapeHtml(building.statusLabel)}</span>`,
    `</header>`,
    `<div class="district-building-popup__info-card">`,
    `<span class="district-building-popup__section-label">Info</span>`,
    `<p class="district-building-popup__info">${escapeHtml(building.info)}</p>`,
    building.phaseTooltip || building.phaseBadgeLabel
      ? [
          `<p class="district-building-popup__phase-effect">`,
          `<span class="district-building-popup__section-label">Efekt</span>`,
          renderPhaseBadge(building),
          building.phaseTooltip ? `<span>${escapeHtml(building.phaseTooltip)}</span>` : "",
          `</p>`
        ].join("")
      : "",
    `</div>`,
    `<p class="district-building-popup__section-label">Statistiky</p>`,
    `<div class="district-building-popup__stats">`,
    building.stats
      .map((stat) => [
        `<span class="district-building-popup__stat">`,
        `<span class="district-building-popup__stat-label">${escapeHtml(stat.label)}</span>`,
        `<strong class="district-building-popup__stat-value">${escapeHtml(stat.value)}</strong>`,
        `</span>`
      ].join(""))
      .join(""),
    `</div>`,
    `<div class="district-building-popup__actions">`,
    `<div class="district-building-popup__actions-head">`,
    `<p class="district-building-popup__section-label">Speciální akce</p>`,
    `<span class="district-building-popup__count">${escapeHtml(building.specialActions.length)}</span>`,
    `</div>`,
    building.specialActions.length > 0
      ? [
          `<div class="district-building-popup__action-grid">`,
          building.specialActions.map((action) => renderSpecialAction(building, action)).join(""),
          `</div>`
        ].join("")
      : `<p class="district-panel__empty-copy">Tahle budova nemá v katalogu speciální akce.</p>`,
    `</div>`,
    `</section>`
  ].join("");
};

const renderSpecialAction = (
  building: DistrictPanelBuildingViewModel,
  action: DistrictPanelBuildingViewModel["specialActions"][number]
): string => {
  const disabledAttribute = action.disabled ? " disabled" : "";
  const reasonAttribute = action.disabledReason
    ? ` data-disabled-reason="${escapeAttribute(action.disabledReason)}"`
    : "";

  return [
    `<article class="district-building-popup__action${action.disabled ? " is-disabled" : ""}" data-special-action-id="${escapeAttribute(action.actionId)}">`,
    `<span class="district-building-popup__action-light" aria-hidden="true"></span>`,
    `<div class="district-building-popup__action-copy">`,
    `<div class="district-building-popup__action-state-row">`,
    `<span class="district-building-popup__action-state">${action.disabled ? "Blokováno" : "Připraveno"}</span>`,
    renderPhaseBadge(action),
    `</div>`,
    `<strong>${escapeHtml(action.label)}</strong>`,
    `<span>${escapeHtml(action.description)}</span>`,
    `<div class="district-building-popup__action-metrics">`,
    `<small>${escapeHtml(action.effectSummary)}</small>`,
    `<small>CD ${renderLiveCooldown(action)}</small>`,
    `<small>${escapeHtml(action.durationLabel)}</small>`,
    `<small>Hledanost ${escapeHtml(action.heatLabel)}</small>`,
    `</div>`,
    `</div>`,
    `<button class="district-panel__action-button district-panel__action-button--craft district-building-popup__run-button" data-building-action-building-id="${escapeAttribute(building.buildingId)}" data-building-action-id="${escapeAttribute(action.actionId)}"${disabledAttribute}${reasonAttribute}>Spustit</button>`,
    action.disabledReason
      ? `<p class="district-panel__action-reason">${escapeHtml(action.disabledReason)}</p>`
      : "",
    `</article>`
  ].join("");
};

const toCssToken = (value: string): string =>
  String(value || "building")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "building";

const renderLiveCooldown = (
  action: DistrictPanelBuildingViewModel["specialActions"][number]
): string =>
  action.cooldownEndsAtMs && action.cooldownRemainingMs > 0
    ? [
        `<span data-live-cooldown="true"`,
        ` data-cooldown-ends-at-ms="${escapeAttribute(action.cooldownEndsAtMs)}"`,
        ` data-cooldown-prefix=""`,
        ` data-cooldown-ready-label="Připraveno po synchronizaci">`,
        escapeHtml(action.cooldownLabel.replace(/^(?:Cooldown|Čekání)\s+/u, "")),
        `</span>`
      ].join("")
    : escapeHtml(action.cooldownLabel);

const renderPhaseBadge = (
  action: PhaseBadgeRenderable
): string => {
  if (!action.phaseBadgeLabel) return "";
  const availability = toCssToken(action.phaseAvailability || "neutral");
  const tooltip = action.phaseTooltip || action.phaseBadgeLabel;
  return `<span class="district-panel__phase-badge district-panel__phase-badge--${escapeAttribute(availability)}" title="${escapeAttribute(tooltip)}">${escapeHtml(action.phaseBadgeLabel)}</span>`;
};
