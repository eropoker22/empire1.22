import { describe, expect, it, vi } from "vitest";
import {
  runStagingAcceptanceCleanup,
  validateStagingAcceptanceCleanupRequest
} from "../../scripts/staging-acceptance-cleanup-contract.mjs";

const HASH = "a".repeat(64);
const NONCE = "b".repeat(64);
const environment = {
  EMPIRE_RELEASE_ENVIRONMENT: "staging",
  EMPIRE_DATABASE_TARGET_ENVIRONMENT: "staging",
  EMPIRE_STAGING_DATABASE_TARGET_HASH: HASH,
  EMPIRE_PRODUCTION_DATABASE_TARGET_HASH: "c".repeat(64)
};
const options = {
  apply: false,
  targetHash: HASH,
  syntheticPrefix: `Remote Staging Acceptance full-lifecycle-20p ${NONCE.slice(0, 16)}`,
  runNonceHash: NONCE,
  createdBefore: "2026-08-09T12:00:00.000Z",
  maxAccounts: 40,
  maxServers: 2
};

describe("staging acceptance cleanup contract", () => {
  it("fails closed for production, target mismatch and missing synthetic marker", () => {
    expect(() => validateStagingAcceptanceCleanupRequest({
      environment: { ...environment, EMPIRE_RELEASE_ENVIRONMENT: "production" }, options
    })).toThrow(/ENVIRONMENT_INVALID/u);
    expect(() => validateStagingAcceptanceCleanupRequest({
      environment, options: { ...options, targetHash: "d".repeat(64) }
    })).toThrow(/TARGET_HASH_MISMATCH/u);
    expect(() => validateStagingAcceptanceCleanupRequest({
      environment, options: { ...options, syntheticPrefix: "Acceptance" }
    })).toThrow(/SYNTHETIC_MARKER_REQUIRED/u);
  });

  it("keeps dry-run non-mutating", async () => {
    const applyScope = vi.fn();
    const summary = await runStagingAcceptanceCleanup({
      request: validateStagingAcceptanceCleanupRequest({ environment, options }),
      repository: {
        findScope: async () => ({ servers: [{ status: "archived" }], accountIds: ["synthetic"], serverIds: ["server"] }),
        applyScope
      },
      nowIso: "2026-08-09T12:00:00.000Z"
    });
    expect(summary).toMatchObject({ dryRun: true, serversArchived: 1, retainedForEvidence: 1 });
    expect(applyScope).not.toHaveBeenCalled();
  });

  it("applies only the repository-proven synthetic scope and retains history", async () => {
    const applyScope = vi.fn(async ({ scope }) => {
      expect(scope.accountIds).toEqual(["synthetic"]);
      expect(scope.accountIds).not.toContain("real-looking-account");
      return { sessionsRevoked: 2, ticketsExpired: 1, syntheticAccountsDisabled: 1 };
    });
    const summary = await runStagingAcceptanceCleanup({
      request: validateStagingAcceptanceCleanupRequest({ environment, options: { ...options, apply: true } }),
      repository: {
        findScope: async () => ({ servers: [{ status: "archived" }], accountIds: ["synthetic"], serverIds: ["server"] }),
        applyScope
      },
      nowIso: "2026-08-09T12:00:00.000Z"
    });
    expect(summary).toMatchObject({
      dryRun: false,
      sessionsRevoked: 2,
      ticketsExpired: 1,
      syntheticAccountsDisabled: 1,
      syntheticAccountsDeleted: 0,
      retainedForEvidence: 1,
      violations: []
    });
  });

  it("rejects non-archived servers and oversized scope", async () => {
    const request = validateStagingAcceptanceCleanupRequest({ environment, options });
    await expect(runStagingAcceptanceCleanup({
      request,
      repository: { findScope: async () => ({ servers: [{ status: "running" }], accountIds: [], serverIds: [] }) },
      nowIso: options.createdBefore
    })).rejects.toThrow(/SERVER_NOT_ARCHIVED/u);
    await expect(runStagingAcceptanceCleanup({
      request,
      repository: { findScope: async () => ({ servers: [], accountIds: Array(41).fill("synthetic"), serverIds: [] }) },
      nowIso: options.createdBefore
    })).rejects.toThrow(/SCOPE_LIMIT_EXCEEDED/u);
  });
});
