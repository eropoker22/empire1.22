import type { DomainError } from "@empire/shared-types";

export const validateStateChangingOrigin = (
  headers: Record<string, string | string[] | undefined> | undefined,
  environment?: Record<string, string | undefined>
): DomainError | null => {
  if (environment?.NODE_ENV !== "production") {
    return null;
  }

  const origin = normalizeHeader(headers, "origin");
  if (!origin) {
    return {
      code: "CSRF_ORIGIN_REQUIRED",
      message: "Origin header is required for state-changing gameplay requests."
    };
  }

  const allowedOrigins = parseAllowedOrigins(environment);
  if (!allowedOrigins.has(origin)) {
    return {
      code: "CSRF_ORIGIN_INVALID",
      message: "Origin is not allowed for state-changing gameplay requests."
    };
  }

  return null;
};

const parseAllowedOrigins = (
  environment: Record<string, string | undefined> | undefined
): Set<string> => new Set(
  String(environment?.EMPIRE_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const normalizeHeader = (
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string
): string => {
  if (!headers) return "";
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  const value = match?.[1];
  return Array.isArray(value) ? String(value[0] ?? "").trim() : String(value ?? "").trim();
};
