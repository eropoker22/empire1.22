const FACTION_ACCENT_COLORS = Object.freeze({
  mafian: "#67e1ff",
  kartel: "#ff9a3d",
  kult: "#71ffbc",
  "tajna-organizace": "#ff47c2",
  hackeri: "#a5ff59",
  "motorkarsky-gang": "#8a7dff",
  "soukroma-armada": "#ff6b6b",
  korporace: "#ffd166"
});

const FACTION_GLYPHS = Object.freeze({
  mafian: "♛",
  kartel: "✶",
  kult: "✦",
  "tajna-organizace": "◈",
  hackeri: "⌘",
  "motorkarsky-gang": "⚡",
  "soukroma-armada": "⛨",
  korporace: "⬢"
});

function normalizeFactionId(factionId) {
  return String(factionId || "").trim().toLowerCase();
}

function normalizePaletteColor(color, normalizeHexColor) {
  return typeof normalizeHexColor === "function"
    ? normalizeHexColor(color)
    : String(color || "").trim().toLowerCase();
}

export function getRegistrationAccentColor(factionId) {
  return FACTION_ACCENT_COLORS[normalizeFactionId(factionId)] || "#67e1ff";
}

export function getFactionGlyph(factionId) {
  return FACTION_GLYPHS[normalizeFactionId(factionId)] || "✦";
}

export function createLaunchPlayerColorMap(currentPlayerColor, options = {}) {
  const currentPlayerId = Number(options.currentPlayerId ?? 0);
  const playerColors = Array.isArray(options.playerColors) ? options.playerColors : [];
  const usedColors = new Set();
  const colorMap = new Map();

  colorMap.set(currentPlayerId, currentPlayerColor);
  usedColors.add(currentPlayerColor);

  for (let ownerId = 1; ownerId <= playerColors.length; ownerId += 1) {
    if (ownerId === currentPlayerId) {
      continue;
    }

    const color = playerColors.find((candidate) => !usedColors.has(candidate));
    if (!color) {
      throw new Error("No unique dev-only launch player colors are left.");
    }

    colorMap.set(ownerId, color);
    usedColors.add(color);
  }

  return colorMap;
}

export function normalizeLaunchPlayerPaletteColor(color, options = {}) {
  const normalizedColor = normalizePaletteColor(color, options.normalizeHexColor);
  const playerColors = Array.isArray(options.playerColors) ? options.playerColors : [];
  return playerColors.includes(normalizedColor) ? normalizedColor : null;
}

if (typeof window !== "undefined") {
  window.EmpirePlayerIdentityVisuals = {
    createLaunchPlayerColorMap,
    getFactionGlyph,
    getRegistrationAccentColor,
    normalizeLaunchPlayerPaletteColor
  };
}
