export function createSeededRandom(seed) {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function hashCell(rowIndex, columnIndex) {
  let value = (rowIndex + 1) * 374761393 + (columnIndex + 1) * 668265263;
  value = (value ^ (value >> 13)) * 1274126177;
  return (value ^ (value >> 16)) >>> 0;
}

export function normalizeRuntimeHexColor(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) {
    return null;
  }
  if (/^#[0-9a-f]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return /^#[0-9a-f]{6}$/.test(raw) ? raw : null;
}

export function hexToRgbParts(hexColor) {
  const sanitized = String(hexColor || "").trim().replace("#", "");
  const normalized = sanitized.length === 3
    ? sanitized.split("").map((part) => part + part).join("")
    : sanitized.padEnd(6, "0").slice(0, 6);
  const numeric = Number.parseInt(normalized, 16);

  if (!Number.isFinite(numeric)) {
    return [103, 225, 255];
  }

  return [
    (numeric >> 16) & 255,
    (numeric >> 8) & 255,
    numeric & 255
  ];
}

export function applyHexAlpha(hexColor, alphaHex = "ff") {
  const normalizedColor = normalizeRuntimeHexColor(hexColor);
  const normalizedAlpha = String(alphaHex || "ff").trim().toLowerCase().replace(/[^0-9a-f]/g, "").padEnd(2, "f").slice(0, 2);
  return normalizedColor ? `${normalizedColor}${normalizedAlpha}` : `#67e1ff${normalizedAlpha}`;
}

export function resolveRuntimeAssetUrl(source) {
  const normalizedSource = String(source || "").trim();
  if (!normalizedSource) {
    return "";
  }

  try {
    return new URL(normalizedSource, window.location.href).href;
  } catch {
    return normalizedSource;
  }
}

export function formatCssUrlValue(source) {
  const resolvedSource = resolveRuntimeAssetUrl(source);
  if (!resolvedSource) {
    return "none";
  }

  return `url("${String(resolvedSource).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
}
