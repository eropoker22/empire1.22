import {
  type PlayerColorHex,
  PLAYER_COLOR_OPTIONS
} from "@empire/shared-types";

/**
 * Responsibility: Dev seed allocation for server-unique player map colors.
 * Belongs here: deterministic setup-time assignment from the faction color palette.
 * Does not belong here: client rendering or legacy page local storage behavior.
 */
export const allocateServerPlayerColor = (
  assignedPlayerColors: Set<string>,
  requestedColor?: string | null
): PlayerColorHex => {
  const requested = normalizePlayerColor(requestedColor);

  if (requested && !assignedPlayerColors.has(requested)) {
    assignedPlayerColors.add(requested);
    return requested;
  }

  const nextColor = PLAYER_COLOR_OPTIONS.find((option) => !assignedPlayerColors.has(option.value))?.value;

  if (!nextColor) {
    throw new Error("No unique player colors are left for this server instance.");
  }

  assignedPlayerColors.add(nextColor);
  return nextColor;
};

const normalizePlayerColor = (color?: string | null): PlayerColorHex | null => {
  const normalized = String(color || "").trim().toLowerCase();
  return PLAYER_COLOR_OPTIONS.some((option) => option.value === normalized)
    ? (normalized as PlayerColorHex)
    : null;
};

