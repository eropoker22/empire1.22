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
    ? `<header data-mode="${player.modeLabel}">Mode: ${player.modeLabel} · Player: ${player.playerId} · Resources: ${player.resourceSummary} · Alerts: ${player.notificationCount}</header>`
    : "<header data-mode=\"unknown\">Loading player projection...</header>";
