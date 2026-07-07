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
  const recommendations = (dayNight.recommendations ?? []).slice(0, 4).join(" · ");
  const nextPhaseLabel = dayNight.phaseId === "night" ? "dne" : "noci";
  const clockLabel = dayNight.gameClockLabel ?? "--:--";
  const remainingLabel = formatDayNightRemaining(dayNight);
  const title = [
    summary,
    recommendations ? `Teď se vyplatí: ${recommendations}` : ""
  ].filter(Boolean).join(" | ");
  return ` · <span class="day-night-badge" data-city-phase="${escapeAttribute(dayNight.uiThemeHint)}" title="${escapeAttribute(title)}">${escapeHtml(dayNight.label)} · ${escapeHtml(clockLabel)} · do ${escapeHtml(nextPhaseLabel)} ${escapeHtml(remainingLabel)}</span>`;
};

const formatDayNightRemaining = (dayNight: NonNullable<PlayerViewModel["dayNight"]>): string => {
  const phaseTicks = Math.max(1, Math.floor(Number(dayNight.endsAtTick - dayNight.startedAtTick) || 1));
  const realPhaseDurationMs = Math.max(0, Number(dayNight.realPhaseDurationMs ?? 0));
  const remainingMs = realPhaseDurationMs > 0
    ? Math.round((Math.max(0, Number(dayNight.remainingTicks || 0)) / phaseTicks) * realPhaseDurationMs)
    : 0;
  const totalMinutes = Math.max(0, Math.ceil(remainingMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes}m`;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
};
