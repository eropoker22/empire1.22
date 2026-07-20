import type { DomainError } from "@empire/shared-types";

const DEFAULT_DEV_SNAPSHOT_SECRET = "empire-streets-local-gameplay-slice-dev-secret";
const DEFAULT_DEV_SESSION_SECRET = "empire-streets-local-gameplay-session-dev-secret";
const MINIMUM_PRODUCTION_SECRET_LENGTH = 32;

export interface SnapshotSecretResult {
  accepted: boolean;
  secret: string | null;
  errors: DomainError[];
}

/**
 * Responsibility: Environment-aware snapshot token secret resolution.
 * Belongs here: production guardrails for serverless token encryption.
 * Does not belong here: token encryption or HTTP routing.
 */
export const readRequiredSnapshotSecret = (
  environment: Record<string, string | undefined> = readProcessEnvironment()
): SnapshotSecretResult => {
  const configuredSecret = environment.GAMEPLAY_SLICE_SNAPSHOT_SECRET?.trim();
  if (configuredSecret) {
    if (environment.NODE_ENV === "production" && configuredSecret.length < MINIMUM_PRODUCTION_SECRET_LENGTH) {
      return unavailableSnapshotSecret();
    }
    return {
      accepted: true,
      secret: configuredSecret,
      errors: []
    };
  }

  if (environment.NODE_ENV === "production") {
    return unavailableSnapshotSecret();
  }

  return {
    accepted: true,
    secret: DEFAULT_DEV_SNAPSHOT_SECRET,
    errors: []
  };
};

export const readRequiredGameplaySessionSecret = (
  environment: Record<string, string | undefined> = readProcessEnvironment(),
  fallbackSecret?: string | null
): SnapshotSecretResult => {
  const configuredSecret = environment.GAMEPLAY_SLICE_SESSION_SECRET?.trim();
  if (configuredSecret) {
    const snapshotSecret = environment.GAMEPLAY_SLICE_SNAPSHOT_SECRET?.trim();
    if (environment.NODE_ENV === "production" && (
      configuredSecret.length < MINIMUM_PRODUCTION_SECRET_LENGTH ||
      configuredSecret === snapshotSecret
    )) {
      return unavailableGameplaySessionSecret();
    }
    return {
      accepted: true,
      secret: configuredSecret,
      errors: []
    };
  }

  if (environment.NODE_ENV === "production") {
    return unavailableGameplaySessionSecret();
  }

  if (fallbackSecret) {
    return {
      accepted: true,
      secret: fallbackSecret,
      errors: []
    };
  }

  return {
    accepted: true,
    secret: DEFAULT_DEV_SESSION_SECRET,
    errors: []
  };
};

const unavailableSnapshotSecret = (): SnapshotSecretResult => ({
  accepted: false,
  secret: null,
  errors: [
    {
      code: "transport.snapshot_secret_unavailable",
      message: "Snapshot service is not configured."
    }
  ]
});

const unavailableGameplaySessionSecret = (): SnapshotSecretResult => ({
  accepted: false,
  secret: null,
  errors: [
    {
      code: "transport.session_secret_unavailable",
      message: "Gameplay session service is not configured."
    }
  ]
});

const readProcessEnvironment = (): Record<string, string | undefined> =>
  (globalThis as {
    process?: {
      env?: Record<string, string | undefined>;
    };
  }).process?.env ?? {};
