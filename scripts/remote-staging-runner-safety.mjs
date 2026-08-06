export const REMOTE_STAGING_PLAYWRIGHT_TRACE_ARGUMENT = "--trace=off";

const RETRYABLE_ARCHIVE_ERROR_CODES = Object.freeze([
  "SERVER_LIFECYCLE_OPERATION_ACTIVE",
  "ADMIN_STALE_VERSION"
]);

export const isRetryableRemoteStagingArchiveError = (error) => {
  const message = String(error?.message ?? error ?? "");
  return RETRYABLE_ARCHIVE_ERROR_CODES.some((code) => message.includes(code));
};

export async function archiveRemoteStagingServerWithRetry({
  loadServer,
  requestArchive,
  wait,
  now = Date.now,
  timeoutMs = 180_000,
  retryDelayMs = 1_000
}) {
  if (typeof loadServer !== "function" || typeof requestArchive !== "function"
    || typeof wait !== "function" || typeof now !== "function"
    || !Number.isFinite(timeoutMs) || timeoutMs <= 0
    || !Number.isFinite(retryDelayMs) || retryDelayMs < 0) {
    throw new Error("REMOTE_STAGING_ARCHIVE_RETRY_CONFIG_INVALID");
  }

  const startedAt = now();
  while (now() - startedAt < timeoutMs) {
    const server = await loadServer();
    if (!server || server.status === "archived") return "archived";

    try {
      await requestArchive(server);
    } catch (error) {
      if (!isRetryableRemoteStagingArchiveError(error)) throw error;
    }

    if (now() - startedAt >= timeoutMs) break;
    await wait(retryDelayMs);
  }

  throw new Error("REMOTE_STAGING_ARCHIVE_TIMEOUT");
}

export const assertPinnedRemoteStagingFlyApp = ({ app, pinnedApp }) => {
  const normalizedApp = String(app ?? "").trim();
  const normalizedPin = String(pinnedApp ?? "").trim();
  if (!/^[a-z0-9-]{3,63}$/u.test(normalizedApp)
    || !/^[a-z0-9-]{3,63}$/u.test(normalizedPin)) {
    throw new Error("REMOTE_STAGING_FLY_APP_INVALID");
  }
  if (/(?:^|-)(?:prod|production)(?:-|$)/u.test(normalizedApp)
    || /(?:^|-)(?:prod|production)(?:-|$)/u.test(normalizedPin)) {
    throw new Error("REMOTE_STAGING_FLY_APP_PRODUCTION_LIKE");
  }
  if (normalizedApp !== normalizedPin) {
    throw new Error("REMOTE_STAGING_FLY_APP_NOT_PINNED");
  }
  return normalizedApp;
};

export const isExactRemoteStagingWorkerHealth = (payload, expectedBuildSha) => (
  payload?.status === "ok"
  && payload?.environment === "staging"
  && payload?.buildSha === expectedBuildSha
  && payload?.heartbeat?.registered === true
);
