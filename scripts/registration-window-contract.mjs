export const MAX_PUBLIC_REGISTRATION_WINDOW_MS = 24 * 60 * 60 * 1_000;

export const validatePublicRegistrationWindow = ({ enabled, expiresAt, now = new Date() }) => {
  if (!enabled) return Object.freeze({ valid: true, expiresAt: null });
  const nowMs = dateMilliseconds(now);
  const expiresAtValue = String(expiresAt ?? "");
  if (!expiresAtValue.trim()) return Object.freeze({ valid: true, expiresAt: null, mode: "permanently-open" });
  const expiresAtMs = dateMilliseconds(expiresAtValue);
  const canonicalExpiry = expiresAtMs === null ? null : new Date(expiresAtMs).toISOString();
  const valid = nowMs !== null
    && expiresAtMs !== null
    && canonicalExpiry === expiresAtValue
    && expiresAtMs > nowMs
    && expiresAtMs <= nowMs + MAX_PUBLIC_REGISTRATION_WINDOW_MS;
  return Object.freeze({
    valid,
    expiresAt: valid ? canonicalExpiry : null,
    mode: "bounded-open"
  });
};

const dateMilliseconds = (value) => {
  const milliseconds = value instanceof Date ? value.getTime() : Date.parse(String(value ?? ""));
  return Number.isFinite(milliseconds) ? milliseconds : null;
};
