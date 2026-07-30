export const hostedEnvironmentEnabled = (value: string | undefined): boolean =>
  String(value).trim().toLowerCase() === "true";

export const hasSecureHostedSessions = (environment: Record<string, string | undefined>): boolean => {
  const secrets = [
    environment.GAMEPLAY_SLICE_SESSION_SECRET,
    environment.GAMEPLAY_SLICE_SNAPSHOT_SECRET,
    environment.EMPIRE_ADMIN_FINGERPRINT_SECRET
  ].map((value) => String(value ?? "").trim());
  return secrets.every((value) => value.length >= 32) && new Set(secrets).size === secrets.length;
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
