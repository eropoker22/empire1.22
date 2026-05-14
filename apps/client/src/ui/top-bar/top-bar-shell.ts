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
    ? `<header data-mode="${player.modeLabel}" data-city-phase="${player.dayNight?.uiThemeHint ?? "day"}">Mode: ${player.modeLabel} · Player: ${player.playerId} · Resources: ${player.resourceSummary} · Alerts: ${player.notificationCount}${renderDayNightBadge(player)}</header>`
    : "<header data-mode=\"unknown\">Loading player projection...</header>";

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
