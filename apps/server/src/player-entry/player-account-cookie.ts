const COOKIE_NAME = "empire_account_session";

export const readPlayerAccountCookie = (headers?: Record<string, string | string[] | undefined>): string | null => {
  const raw = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === "cookie")?.[1];
  const cookie = Array.isArray(raw) ? raw.join("; ") : String(raw ?? "");
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE_NAME) {
      try {
        return decodeURIComponent(value.join("="));
      } catch (_error) {
        return null;
      }
    }
  }
  return null;
};

export const createPlayerAccountCookie = (token: string, expiresAt: string, environment: Record<string, string | undefined>) => [
  `${COOKIE_NAME}=${encodeURIComponent(token)}`,
  "HttpOnly",
  "SameSite=Strict",
  "Path=/",
  `Expires=${new Date(expiresAt).toUTCString()}`,
  environment.NODE_ENV === "production" ? "Secure" : ""
].filter(Boolean).join("; ");

export const clearPlayerAccountCookie = (environment: Record<string, string | undefined>) => [
  `${COOKIE_NAME}=`,
  "HttpOnly",
  "SameSite=Strict",
  "Path=/",
  "Max-Age=0",
  "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  environment.NODE_ENV === "production" ? "Secure" : ""
].filter(Boolean).join("; ");
