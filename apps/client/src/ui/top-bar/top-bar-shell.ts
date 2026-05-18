import type { PlayerViewModel } from "../../selectors";

/**
 * Responsibility: Presentation shell for the future top bar area.
 * Belongs here: top-level status and mode display only.
 * Does not belong here: gameplay calculations or transport logic.
 */
export interface TopBarShellProps {
  player: PlayerViewModel | null;
}

export const renderTopBarShell = ({ player }: TopBarShellProps): string =>
  player
    ? `<header data-mode="${player.modeLabel}" data-city-phase="${player.dayNight?.uiThemeHint ?? "day"}">Mode: ${player.modeLabel} · Player: ${player.playerId}${renderHomeDistrict(player)} · Resources: ${player.resourceSummary} · Alerts: ${player.notificationCount}${renderPoliceBadge(player)}${renderDayNightBadge(player)}</header>`
    : "<header data-mode=\"unknown\">Loading player projection...</header>";

const renderHomeDistrict = (player: PlayerViewModel): string =>
  player.homeDistrictId
    ? ` · Server assigned home: ${escapeHtml(player.homeDistrictId)}`
    : "";

const renderPoliceBadge = (player: PlayerViewModel): string => {
  const police = player.police;
  if (!police) return "";

  const pending = police.pendingRaidLabel ? ` · Pending: ${police.pendingRaidLabel}` : "";
  return ` · <span class="police-badge" data-raid-status="${escapeHtml(police.raidConsequenceStatus)}" title="District heat ${escapeHtml(police.selectedDistrictHeatLabel)} · Protection ${escapeHtml(police.protectionLabel)}">Heat ${escapeHtml(police.heatLabel)} · Wanted ${escapeHtml(police.wantedLevelLabel)}${pending}</span>`;
};

const renderDayNightBadge = (player: PlayerViewModel): string => {
  const dayNight = player.dayNight;
  if (!dayNight) return "";
  const summary = dayNight.effectSummary.slice(0, 2).join(", ");
  return ` · <span class="day-night-badge" data-city-phase="${dayNight.uiThemeHint}" title="${escapeHtml(summary)}">${escapeHtml(dayNight.label)}: ${escapeHtml(summary)} · ${dayNight.remainingTicks} ticků</span>`;
};

const escapeHtml = (value: string): string =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
