export const hostedEnvironmentEnabled = (value: string | undefined): boolean =>
  String(value).trim().toLowerCase() === "true";

export const hasSecureHostedSessions = (environment: Record<string, string | undefined>): boolean => {
  const secrets = [
    environment.GAMEPLAY_SLICE_SESSION_SECRET,
    environment.GAMEPLAY_SLICE_SNAPSHOT_SECRET,
    environment.EMPIRE_ADMIN_FINGERPRINT_SECRET,
    environment.EMPIRE_ADMIN_SESSION_SECRET,
    environment.EMPIRE_AUTH_THROTTLE_PEPPER
  ].map((value) => String(value ?? "").trim());
  return secrets.every((value) => /^(?:[0-9a-f]{64,}|[A-Za-z0-9_-]{43,})$/u.test(value))
    && new Set(secrets).size === secrets.length;
};

export const hasSecureHostedOriginPolicy = (value: string | undefined): boolean => {
  const origins = String(value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  return origins.length > 0 && origins.every((entry) => {
    try {
      const parsed = new URL(entry);
      return parsed.protocol === "https:" && parsed.origin === entry;
    } catch {
      return false;
    }
  });
};

export const safeHostedBuildSha = (value: string | undefined): string | null => {
  const normalized = String(value ?? "").trim();
  return normalized && !["local", "unknown"].includes(normalized.toLowerCase()) ? normalized : null;
};
