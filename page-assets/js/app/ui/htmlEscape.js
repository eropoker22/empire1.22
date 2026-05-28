const HTML_ESCAPE_MAP = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
});

const SAFE_DATA_IMAGE_URL_PATTERN = /^data:image\/(?:gif|png|jpeg|jpg|webp);base64,[a-z0-9+/=\s]+$/iu;

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => HTML_ESCAPE_MAP[character]);
}

export function escapeAttribute(value) {
  return escapeHtml(value);
}

export function escapeUrlAttribute(value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) {
    return "";
  }

  const schemeCheckValue = rawValue.replace(/[\u0000-\u001F\u007F\s]+/g, "");
  if (/^javascript:/iu.test(schemeCheckValue)) {
    return "";
  }

  const schemeMatch = /^[a-z][a-z0-9+.-]*:/iu.exec(rawValue);
  if (schemeMatch) {
    const scheme = schemeMatch[0].toLowerCase();
    if (scheme !== "http:" && scheme !== "https:" && !SAFE_DATA_IMAGE_URL_PATTERN.test(rawValue)) {
      return "";
    }
  }

  return escapeAttribute(rawValue);
}
