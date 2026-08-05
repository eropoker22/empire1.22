import { createHash } from "node:crypto";

export interface ReleaseDatabaseGuardResult {
  environment: "staging" | "production";
  connectionMode: "direct";
  providerHostnameHash: string;
  databaseNameHash: string;
  sslMode: string;
  backupIdHash: string;
  initializationConfirmed: boolean;
}

export interface ReleaseDatabaseInitializationState {
  initializationConfirmed: boolean;
  currentSchema: string | null;
  historyExists: boolean;
  publicObjectCount: number;
}

export const validateReleaseDatabaseEnvironment = (
  environment: Record<string, string | undefined>
): ReleaseDatabaseGuardResult => {
  const releaseEnvironment = String(environment.EMPIRE_RELEASE_ENVIRONMENT ?? "").trim();
  if (!(["staging", "production"] as string[]).includes(releaseEnvironment)) {
    throw new Error("RELEASE_DATABASE_ENVIRONMENT_INVALID");
  }
  if (environment.EMPIRE_DATABASE_TARGET_ENVIRONMENT !== releaseEnvironment) {
    throw new Error("RELEASE_DATABASE_TARGET_ENVIRONMENT_MISMATCH");
  }
  const empireUrl = parseDirectNeonUrl(environment.EMPIRE_DATABASE_URL);
  const gameplayUrl = parseDirectNeonUrl(environment.GAMEPLAY_DATABASE_URL);
  if (!empireUrl || !gameplayUrl) throw new Error("RELEASE_DATABASE_DIRECT_TLS_REQUIRED");
  if (targetIdentity(empireUrl) !== targetIdentity(gameplayUrl)) {
    throw new Error("RELEASE_DATABASE_TARGET_MISMATCH");
  }
  const databaseName = decodeURIComponent(empireUrl.pathname.replace(/^\//u, ""));
  if (releaseEnvironment === "production"
    && `${empireUrl.hostname}/${databaseName}`.toLowerCase().includes("staging")) {
    throw new Error("RELEASE_PRODUCTION_DATABASE_LOOKS_LIKE_STAGING");
  }
  if (environment.EMPIRE_DATABASE_BACKUP_CONFIRMED !== "true") {
    throw new Error("RELEASE_DATABASE_BACKUP_NOT_CONFIRMED");
  }
  const backupId = String(environment.EMPIRE_DATABASE_BACKUP_ID ?? "").trim();
  if (!/^[A-Za-z0-9._:-]{3,200}$/u.test(backupId)) {
    throw new Error("RELEASE_DATABASE_BACKUP_ID_INVALID");
  }
  return {
    environment: releaseEnvironment as "staging" | "production",
    connectionMode: "direct",
    providerHostnameHash: safeHash(empireUrl.hostname.toLowerCase()),
    databaseNameHash: safeHash(databaseName),
    sslMode: empireUrl.searchParams.get("sslmode")!,
    backupIdHash: safeHash(backupId),
    initializationConfirmed: environment.EMPIRE_DATABASE_INITIALIZATION_CONFIRMED === "true"
  };
};

export const assertReleaseMigrationHistoryExists = (historyExists: boolean): void => {
  if (!historyExists) throw new Error("RELEASE_MIGRATION_HISTORY_MISSING");
};

export const assertReleaseDatabaseCanInitialize = (state: ReleaseDatabaseInitializationState): void => {
  if (!state.initializationConfirmed) throw new Error("RELEASE_DATABASE_INITIALIZATION_NOT_CONFIRMED");
  if (state.currentSchema !== "public") throw new Error("RELEASE_DATABASE_SCHEMA_NOT_PUBLIC");
  if (state.historyExists) throw new Error("RELEASE_MIGRATION_HISTORY_ALREADY_EXISTS");
  if (!Number.isSafeInteger(state.publicObjectCount) || state.publicObjectCount !== 0) {
    throw new Error("RELEASE_DATABASE_NOT_EMPTY");
  }
};

const parseDirectNeonUrl = (value: string | undefined): URL | null => {
  try {
    const parsed = new URL(String(value ?? "").trim());
    const tls = ["require", "verify-ca", "verify-full"].includes(parsed.searchParams.get("sslmode") ?? "");
    const direct = parsed.hostname.endsWith(".neon.tech") && !parsed.hostname.split(".")[0]?.endsWith("-pooler");
    const loopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname);
    return ["postgres:", "postgresql:"].includes(parsed.protocol) && tls && direct && !loopback ? parsed : null;
  } catch {
    return null;
  }
};
const targetIdentity = (value: URL): string => `${value.hostname.toLowerCase()}:${value.port || "5432"}${value.pathname}`;
const safeHash = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 16);
