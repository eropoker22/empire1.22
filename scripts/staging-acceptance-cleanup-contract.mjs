const SHA256 = /^[0-9a-f]{64}$/u;
const PREFIX = /^Remote Staging Acceptance [a-z0-9-]+ [0-9a-f]{16}$/u;

export const validateStagingAcceptanceCleanupRequest = ({ environment, options }) => {
  if (environment.EMPIRE_RELEASE_ENVIRONMENT !== "staging"
    || environment.EMPIRE_DATABASE_TARGET_ENVIRONMENT !== "staging") {
    throw new Error("STAGING_ACCEPTANCE_CLEANUP_ENVIRONMENT_INVALID");
  }
  const expectedHash = String(environment.EMPIRE_STAGING_DATABASE_TARGET_HASH ?? "").trim();
  if (!SHA256.test(expectedHash) || options.targetHash !== expectedHash) {
    throw new Error("STAGING_ACCEPTANCE_CLEANUP_TARGET_HASH_MISMATCH");
  }
  if (SHA256.test(String(environment.EMPIRE_PRODUCTION_DATABASE_TARGET_HASH ?? ""))
    && expectedHash === environment.EMPIRE_PRODUCTION_DATABASE_TARGET_HASH) {
    throw new Error("STAGING_ACCEPTANCE_CLEANUP_PRODUCTION_TARGET_REJECTED");
  }
  if (!PREFIX.test(String(options.syntheticPrefix ?? ""))
    || !SHA256.test(String(options.runNonceHash ?? ""))
    || !options.syntheticPrefix.endsWith(options.runNonceHash.slice(0, 16))) {
    throw new Error("STAGING_ACCEPTANCE_CLEANUP_SYNTHETIC_MARKER_REQUIRED");
  }
  const createdBeforeMs = Date.parse(String(options.createdBefore ?? ""));
  if (!Number.isFinite(createdBeforeMs)) throw new Error("STAGING_ACCEPTANCE_CLEANUP_AGE_BOUND_REQUIRED");
  if (!Number.isInteger(options.maxAccounts) || options.maxAccounts < 1 || options.maxAccounts > 100
    || !Number.isInteger(options.maxServers) || options.maxServers < 1 || options.maxServers > 10) {
    throw new Error("STAGING_ACCEPTANCE_CLEANUP_LIMIT_INVALID");
  }
  return Object.freeze({
    apply: options.apply === true,
    syntheticPrefix: options.syntheticPrefix,
    runNonceHash: options.runNonceHash,
    createdBefore: new Date(createdBeforeMs).toISOString(),
    maxAccounts: options.maxAccounts,
    maxServers: options.maxServers,
    targetHash: expectedHash
  });
};

export const runStagingAcceptanceCleanup = async ({ request, repository, nowIso }) => {
  const scope = await repository.findScope(request);
  if (scope.servers.length > request.maxServers || scope.accountIds.length > request.maxAccounts) {
    throw new Error("STAGING_ACCEPTANCE_CLEANUP_SCOPE_LIMIT_EXCEEDED");
  }
  if (scope.servers.some((server) => server.status !== "archived")) {
    throw new Error("STAGING_ACCEPTANCE_CLEANUP_SERVER_NOT_ARCHIVED");
  }
  const counts = request.apply
    ? await repository.applyScope({ scope, nowIso })
    : {
      sessionsRevoked: 0,
      ticketsExpired: 0,
      syntheticAccountsDisabled: 0
    };
  return Object.freeze({
    status: "passed",
    dryRun: !request.apply,
    serversArchived: scope.servers.length,
    sessionsRevoked: counts.sessionsRevoked,
    ticketsExpired: counts.ticketsExpired,
    syntheticAccountsDisabled: counts.syntheticAccountsDisabled,
    syntheticAccountsDeleted: 0,
    retainedForEvidence: scope.accountIds.length,
    violations: Object.freeze([])
  });
};
