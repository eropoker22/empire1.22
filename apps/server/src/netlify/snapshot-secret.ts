import type { DomainError } from "@empire/shared-types";

const DEFAULT_DEV_SNAPSHOT_SECRET = "empire-streets-local-gameplay-slice-dev-secret";

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
    return {
      accepted: true,
      secret: configuredSecret,
      errors: []
    };
  }

  if (environment.NODE_ENV === "production") {
    return {
      accepted: false,
      secret: null,
      errors: [
        {
          code: "transport.snapshot_secret_unavailable",
          message: "Snapshot service is not configured."
        }
      ]
    };
  }

  return {
    accepted: true,
    secret: DEFAULT_DEV_SNAPSHOT_SECRET,
    errors: []
  };
};

const readProcessEnvironment = (): Record<string, string | undefined> =>
  (globalThis as {
    process?: {
      env?: Record<string, string | undefined>;
    };
  }).process?.env ?? {};
