/**
 * Responsibility: Placeholder registry for future map overlay layers.
 * Belongs here: ownership, alert, alliance, trap, and event overlay layer boundaries.
 * Does not belong here: underlying rule computation for those overlays.
 */
export const MAP_LAYER_KEYS = {
  ownership: "ownership",
  alerts: "alerts",
  alliances: "alliances",
  events: "events",
  police: "police",
  traps: "traps"
} as const;

