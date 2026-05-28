const htmlEscapeMap: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
};

export const escapeHtml = (value: unknown): string =>
  String(value ?? "").replace(/[&<>"']/g, (character) => htmlEscapeMap[character] ?? character);

export const escapeAttribute = (value: unknown): string => escapeHtml(value);

const safeDataImageUrlPattern = /^data:image\/(?:gif|png|jpeg|jpg|webp);base64,[a-z0-9+/=\s]+$/iu;

export const escapeUrlAttribute = (value: unknown): string => {
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
    if (scheme !== "http:" && scheme !== "https:" && !safeDataImageUrlPattern.test(rawValue)) {
      return "";
    }
  }

  return escapeAttribute(rawValue);
};
