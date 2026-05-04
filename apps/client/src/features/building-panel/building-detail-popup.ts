import type { DistrictPanelBuildingViewModel } from "../../selectors";

export const renderBuildingDetailPopup = (building: DistrictPanelBuildingViewModel): string => {
  const zoneKey = toCssToken(building.zoneLabel);

  return [
    `<section class="district-building-popup district-building-popup--${zoneKey}" role="dialog" aria-label="${building.label} detail" data-building-zone="${zoneKey}" data-building-popup-id="${building.buildingId}">`,
    `<header class="district-building-popup__header">`,
    `<div>`,
    `<p class="district-building-popup__eyebrow">${building.zoneLabel} · ${building.roleLabel}</p>`,
    `<h5 class="district-building-popup__title">${building.label}</h5>`,
    `<p class="district-building-popup__type">${building.typeLabel}</p>`,
    `</div>`,
    `<span class="district-building-popup__badge">${building.statusLabel}</span>`,
    `</header>`,
    `<div class="district-building-popup__info-card">`,
    `<span class="district-building-popup__section-label">Info</span>`,
    `<p class="district-building-popup__info">${building.info}</p>`,
    `</div>`,
    `<p class="district-building-popup__section-label">Statistiky</p>`,
    `<div class="district-building-popup__stats">`,
    building.stats
      .map((stat) => [
        `<span class="district-building-popup__stat">`,
        `<span class="district-building-popup__stat-label">${stat.label}</span>`,
        `<strong class="district-building-popup__stat-value">${stat.value}</strong>`,
        `</span>`
      ].join(""))
      .join(""),
    `</div>`,
    `<div class="district-building-popup__actions">`,
    `<div class="district-building-popup__actions-head">`,
    `<p class="district-building-popup__section-label">Speciální akce</p>`,
    `<span class="district-building-popup__count">${building.specialActions.length}</span>`,
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
    ? ` data-disabled-reason="${action.disabledReason}"`
    : "";

  return [
    `<article class="district-building-popup__action${action.disabled ? " is-disabled" : ""}" data-special-action-id="${action.actionId}">`,
    `<span class="district-building-popup__action-light" aria-hidden="true"></span>`,
    `<div class="district-building-popup__action-copy">`,
    `<span class="district-building-popup__action-state">${action.disabled ? "Blocked" : "Ready"}</span>`,
    `<strong>${action.label}</strong>`,
    `<span>${action.description}</span>`,
    `<div class="district-building-popup__action-metrics">`,
    `<small>${action.effectSummary}</small>`,
    `<small>CD ${renderLiveCooldown(action)}</small>`,
    `<small>${action.durationLabel}</small>`,
    `<small>Heat ${action.heatLabel}</small>`,
    `</div>`,
    `</div>`,
    `<button class="district-panel__action-button district-panel__action-button--craft district-building-popup__run-button" data-building-action-building-id="${building.buildingId}" data-building-action-id="${action.actionId}"${disabledAttribute}${reasonAttribute}>Spustit</button>`,
    action.disabledReason
      ? `<p class="district-panel__action-reason">${action.disabledReason}</p>`
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
        ` data-cooldown-ends-at-ms="${action.cooldownEndsAtMs}"`,
        ` data-cooldown-prefix=""`,
        ` data-cooldown-ready-label="Ready after server sync">`,
        action.cooldownLabel.replace(/^Cooldown\s+/u, ""),
        `</span>`
      ].join("")
    : action.cooldownLabel;
