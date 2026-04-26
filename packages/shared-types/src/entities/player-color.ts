/**
 * Responsibility: Shared player color vocabulary for server-assigned map ownership.
 * Belongs here: stable color options exposed by faction selection and gameplay views.
 * Does not belong here: UI swatch rendering or per-page local storage behavior.
 */
export interface PlayerColorOption {
  name: string;
  value: string;
}

export const PLAYER_COLOR_OPTIONS = [
  { name: "Červená", value: "#ef4444" },
  { name: "Modrá", value: "#3b82f6" },
  { name: "Zelená", value: "#22c55e" },
  { name: "Žlutá", value: "#eab308" },
  { name: "Oranžová", value: "#f97316" },
  { name: "Fialová", value: "#8b5cf6" },
  { name: "Růžová", value: "#ec4899" },
  { name: "Tyrkysová", value: "#14b8a6" },
  { name: "Azurová", value: "#06b6d4" },
  { name: "Purpurová", value: "#a21caf" },
  { name: "Vínová", value: "#7f1d1d" },
  { name: "Olivová", value: "#6b8e23" },
  { name: "Limetková", value: "#84cc16" },
  { name: "Mentolová", value: "#a7f3d0" },
  { name: "Lososová", value: "#fa8072" },
  { name: "Korálová", value: "#ff7f50" },
  { name: "Zlatá", value: "#ffd700" },
  { name: "Stříbrná", value: "#c0c0c0" },
  { name: "Béžová", value: "#f5f5dc" },
  { name: "Hnědá", value: "#8b4513" },
  { name: "Černá", value: "#111111" },
  { name: "Bílá", value: "#ffffff" },
  { name: "Šedá", value: "#9ca3af" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Safírová", value: "#0f52ba" },
  { name: "Smaragdová", value: "#50c878" },
  { name: "Karmínová", value: "#dc143c" },
  { name: "Levandulová", value: "#e6e6fa" },
  { name: "Broskvová", value: "#ffdab9" },
  { name: "Antracitová", value: "#36454f" }
] as const satisfies PlayerColorOption[];

export type PlayerColorHex = (typeof PLAYER_COLOR_OPTIONS)[number]["value"];

export const DEFAULT_PLAYER_COLOR: PlayerColorHex = PLAYER_COLOR_OPTIONS[0].value;

