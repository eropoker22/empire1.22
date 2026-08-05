export const DEFAULT_REMOTE_LOAD_THRESHOLDS = Object.freeze({
  apiP95Ms: 2_500,
  apiP99Ms: 5_000,
  commandP95Ms: 5_000,
  loginP95Ms: 90_000,
  workerP95Ms: 2_000,
  maxHeartbeatAgeMs: 30_000,
  maxHttp429: 0,
  maxHttp5xx: 0
});

export const summarizeRemoteLoadSamples = (input, thresholds = DEFAULT_REMOTE_LOAD_THRESHOLDS) => {
  const apiDurations = numbers(input.apiDurationsMs);
  const commandDurations = numbers(input.commandDurationsMs);
  const loginDurations = numbers(input.loginDurationsMs);
  const workerDurations = numbers(input.workerDurationsMs);
  const statusCodes = (input.statusCodes ?? []).map(Number).filter(Number.isInteger);
  const ticks = numbers(input.ticks);
  const snapshotUpdates = numbers(input.snapshotRecoveryHeadUpdates);
  const heartbeatAges = numbers(input.heartbeatAgesMs);
  const violations = [];
  const api = durationSummary(apiDurations);
  const commands = durationSummary(commandDurations);
  const logins = durationSummary(loginDurations);
  const worker = durationSummary(workerDurations);
  const http429 = statusCodes.filter((status) => status === 429).length;
  const http5xx = statusCodes.filter((status) => status >= 500).length;
  if (api.count === 0 || api.p95 > thresholds.apiP95Ms || api.p99 > thresholds.apiP99Ms) violations.push("REMOTE_LOAD_API_LATENCY");
  if (commands.count === 0 || commands.p95 > thresholds.commandP95Ms) violations.push("REMOTE_LOAD_COMMAND_LATENCY");
  if (logins.count < 3 || logins.p95 > thresholds.loginP95Ms) violations.push("REMOTE_LOAD_LOGIN_LATENCY");
  if (worker.count === 0 || worker.p95 > thresholds.workerP95Ms) violations.push("REMOTE_LOAD_WORKER_LATENCY");
  if (http429 > thresholds.maxHttp429) violations.push("REMOTE_LOAD_HTTP_429");
  if (http5xx > thresholds.maxHttp5xx) violations.push("REMOTE_LOAD_HTTP_5XX");
  if (ticks.length < 2 || Math.max(...ticks) <= Math.min(...ticks)) violations.push("REMOTE_LOAD_TICK_STALLED");
  if (snapshotUpdates.length < 2 || Math.max(...snapshotUpdates) <= Math.min(...snapshotUpdates)) {
    violations.push("REMOTE_LOAD_SNAPSHOT_STALLED");
  }
  if (heartbeatAges.length === 0 || Math.max(...heartbeatAges) > thresholds.maxHeartbeatAgeMs) {
    violations.push("REMOTE_LOAD_HEARTBEAT_STALE");
  }
  return Object.freeze({
    passed: violations.length === 0,
    violations,
    thresholds,
    http: { total: statusCodes.length, http429, http5xx },
    api,
    commands,
    logins,
    worker,
    tick: ticks.length ? { first: ticks[0], min: Math.min(...ticks), max: Math.max(...ticks), last: ticks.at(-1) } : null,
    snapshotRecoveryHeadUpdates: snapshotUpdates.length ? {
      first: snapshotUpdates[0],
      min: Math.min(...snapshotUpdates),
      max: Math.max(...snapshotUpdates),
      last: snapshotUpdates.at(-1)
    } : null,
    heartbeatAgeMs: heartbeatAges.length ? durationSummary(heartbeatAges) : null
  });
};

export const summarizeDatabaseTelemetry = (samples, maximumAllowedConnections) => {
  const connectionCounts = numbers(samples.map((sample) => sample.connectionCount));
  const activeCounts = numbers(samples.map((sample) => sample.activeConnectionCount));
  const queryDurations = numbers(samples.map((sample) => sample.probeDurationMs));
  const maximumObserved = connectionCounts.length ? Math.max(...connectionCounts) : 0;
  const violations = [];
  if (samples.length === 0) violations.push("REMOTE_LOAD_DB_TELEMETRY_MISSING");
  if (!Number.isInteger(maximumAllowedConnections) || maximumAllowedConnections <= 0) {
    violations.push("REMOTE_LOAD_DB_CONNECTION_THRESHOLD_INVALID");
  } else if (maximumObserved > maximumAllowedConnections) {
    violations.push("REMOTE_LOAD_DB_CONNECTION_SATURATION");
  }
  return Object.freeze({
    passed: violations.length === 0,
    violations,
    sampleCount: samples.length,
    maximumAllowedConnections,
    maximumObservedConnections: maximumObserved,
    maximumObservedActiveConnections: activeCounts.length ? Math.max(...activeCounts) : 0,
    probeLatency: durationSummary(queryDurations)
  });
};

const durationSummary = (values) => ({
  count: values.length,
  min: values.length ? Math.min(...values) : null,
  p50: percentile(values, 0.50),
  p95: percentile(values, 0.95),
  p99: percentile(values, 0.99),
  max: values.length ? Math.max(...values) : null
});
const percentile = (values, percentileValue) => {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * percentileValue) - 1))];
};
const numbers = (values = []) => values.map(Number).filter(Number.isFinite);
