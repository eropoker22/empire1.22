export const GAMEPLAY_SESSION_COOKIE_NAME = "empire_gameplay_session";
const GAMEPLAY_SESSION_COOKIE_PATH = "/api/gameplay-slice";

export const parseCookieHeader = (
  headers?: Record<string, string | string[] | undefined>
): Record<string, string> => {
  const cookieHeader = normalizeHeader(headers, "cookie");
  if (!cookieHeader) return {};

  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.split("=");
    const name = String(rawName ?? "").trim();
    if (!name || rawValue.length === 0) continue;
    cookies[name] = rawValue.join("=").trim();
  }
  return cookies;
};

export const readGameplaySessionCookie = (
  headers?: Record<string, string | string[] | undefined>
): string | null => parseCookieHeader(headers)[GAMEPLAY_SESSION_COOKIE_NAME] ?? null;

export const createGameplaySessionSetCookie = (
  token: string,
  expiresAt: string,
  environment?: Record<string, string | undefined>
): string => {
  const maxAgeSeconds = Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000));
  return [
    `${GAMEPLAY_SESSION_COOKIE_NAME}=${token}`,
    "HttpOnly",
    `Path=${GAMEPLAY_SESSION_COOKIE_PATH}`,
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    `Expires=${new Date(expiresAt).toUTCString()}`,
    isProduction(environment) ? "Secure" : null
  ].filter(Boolean).join("; ");
};

export const createGameplaySessionClearCookie = (
  environment?: Record<string, string | undefined>
): string => [
  `${GAMEPLAY_SESSION_COOKIE_NAME}=`,
  "HttpOnly",
  `Path=${GAMEPLAY_SESSION_COOKIE_PATH}`,
  "SameSite=Lax",
  "Max-Age=0",
  "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  isProduction(environment) ? "Secure" : null
].filter(Boolean).join("; ");

const normalizeHeader = (
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string
): string => {
  if (!headers) return "";
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  const value = match?.[1];
  return Array.isArray(value) ? String(value[0] ?? "").trim() : String(value ?? "").trim();
};

const isProduction = (environment?: Record<string, string | undefined>): boolean =>
  environment?.NODE_ENV === "production";
