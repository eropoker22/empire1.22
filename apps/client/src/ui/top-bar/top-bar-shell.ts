import type { PlayerViewModel } from "../../selectors";
import { escapeAttribute, escapeHtml } from "../../shared-ui";

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
    ? `<header data-mode="${escapeAttribute(player.modeLabel)}" data-city-phase="${escapeAttribute(player.dayNight?.uiThemeHint ?? "day")}">Mode: ${escapeHtml(player.modeLabel)} · Player: ${escapeHtml(player.playerId)}${renderHomeDistrict(player)} · Resources: ${escapeHtml(player.resourceSummary)} · Alerts: ${escapeHtml(player.notificationCount)}${renderPoliceBadge(player)}${renderDayNightBadge(player)}</header>`
    : "";

const renderHomeDistrict = (player: PlayerViewModel): string =>
  player.homeDistrictId
    ? ` · Server assigned home: ${escapeHtml(player.homeDistrictId)}`
    : "";

const renderPoliceBadge = (player: PlayerViewModel): string => {
  const police = player.police;
  if (!police) return "";

  const pending = police.pendingRaidLabel ? ` · Pending: ${escapeHtml(police.pendingRaidLabel)}` : "";
  return ` · <span class="police-badge" data-raid-status="${escapeAttribute(police.raidConsequenceStatus)}" title="${escapeAttribute(`Hledanost distriktu ${police.selectedDistrictHeatLabel} · Ochrana ${police.protectionLabel}`)}">Hledanost ${escapeHtml(police.heatLabel)} · Wanted ${escapeHtml(police.wantedLevelLabel)}${pending}</span>`;
};

const renderDayNightBadge = (player: PlayerViewModel): string => {
  const dayNight = player.dayNight;
  if (!dayNight) return "";
  const summary = dayNight.effectSummary.slice(0, 2).join(", ");
  return ` · <span class="day-night-badge" data-city-phase="${escapeAttribute(dayNight.uiThemeHint)}" title="${escapeAttribute(summary)}">${escapeHtml(dayNight.label)}: ${escapeHtml(summary)} · ${escapeHtml(dayNight.remainingTicks)} ticků</span>`;
};
