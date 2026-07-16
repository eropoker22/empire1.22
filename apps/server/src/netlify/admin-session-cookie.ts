import { parseCookieHeader } from "./gameplay-session-cookie";

export const ADMIN_SESSION_COOKIE_NAME = "empire_admin_session";
const ADMIN_SESSION_COOKIE_PATH = "/api/admin";

export const readAdminSessionCookie = (
  headers?: Record<string, string | string[] | undefined>
): string | null => parseCookieHeader(headers)[ADMIN_SESSION_COOKIE_NAME] ?? null;

export const createAdminSessionSetCookie = (
  token: string,
  expiresAt: string,
  environment: Record<string, string | undefined>
): string => cookie([
  `${ADMIN_SESSION_COOKIE_NAME}=${token}`,
  "HttpOnly",
  `Path=${ADMIN_SESSION_COOKIE_PATH}`,
  "SameSite=Strict",
  `Max-Age=${Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000))}`,
  `Expires=${new Date(expiresAt).toUTCString()}`,
  environment.NODE_ENV === "production" ? "Secure" : null
]);

export const createAdminSessionClearCookie = (
  environment: Record<string, string | undefined>
): string => cookie([
  `${ADMIN_SESSION_COOKIE_NAME}=`,
  "HttpOnly",
  `Path=${ADMIN_SESSION_COOKIE_PATH}`,
  "SameSite=Strict",
  "Max-Age=0",
  "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  environment.NODE_ENV === "production" ? "Secure" : null
]);

const cookie = (parts: Array<string | null>): string => parts.filter(Boolean).join("; ");
