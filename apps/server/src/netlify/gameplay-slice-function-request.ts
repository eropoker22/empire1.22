import { readGameplaySessionCookie } from "./gameplay-session-cookie";

export interface GameplaySliceFunctionEvent {
  httpMethod: string;
  path: string;
  body: string | null;
  headers?: Record<string, string | string[] | undefined>;
}

export const parseGameplaySliceBoundaryBody = (body: string | null): unknown => {
  if (!body) return null;
  try {
    return JSON.parse(body) as unknown;
  } catch (_error) {
    return null;
  }
};

export const readGameplaySliceProcessEnvironment = (): Record<string, string | undefined> => (
  globalThis as { process?: { env?: Record<string, string | undefined> } }
).process?.env ?? {};

export const resolveGameplaySessionToken = (
  headers: Record<string, string | string[] | undefined> | undefined,
  bodySessionToken: string | null | undefined,
  environment: Record<string, string | undefined>
): string | null => {
  const cookieToken = String(readGameplaySessionCookie(headers) ?? "").trim();
  if (cookieToken) return cookieToken;
  if (environment.NODE_ENV === "production") return null;
  return String(bodySessionToken ?? "").trim() || null;
};
