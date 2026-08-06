export const DEFAULT_REMOTE_LOAD_THRESHOLDS = Object.freeze({
  apiP95Ms: 2_500,
  apiP99Ms: 5_000,
  commandP95Ms: 5_000,
  loginP95Ms: 90_000,
  workerP95Ms: 2_000,
  maxHeartbeatAgeMs: 30_000,
  maxHttp429: 0,
  maxHttp5xx: 0,
  maxHttpAuth: 0,
  maxHttpUnexpected4xx: 0,
  maxActionAuthFailures: 0,
  maxActionRateLimitFailures: 0,
  maxUnexpectedActionFailures: 0,
  minActualActionTypes: 5,
  minAcceptedActionTypes: 4,
  minDistrictSelectionChanges: 1
});

export const summarizeRemoteLoadSamples = (input, thresholds = DEFAULT_REMOTE_LOAD_THRESHOLDS) => {
  const resolvedThresholds = Object.freeze({ ...DEFAULT_REMOTE_LOAD_THRESHOLDS, ...thresholds });
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
  const httpAuth = statusCodes.filter((status) => status === 401 || status === 403).length;
  const httpUnexpected4xx = statusCodes.filter((status) => (
    status >= 400 && status < 500 && status !== 401 && status !== 403 && status !== 429
  )).length;
  const actionSummary = summarizeActionOutcomes(input.actionOutcomes);
  if (api.count === 0 || api.p95 > resolvedThresholds.apiP95Ms || api.p99 > resolvedThresholds.apiP99Ms) violations.push("REMOTE_LOAD_API_LATENCY");
  if (commands.count === 0 || commands.p95 > resolvedThresholds.commandP95Ms) violations.push("REMOTE_LOAD_COMMAND_LATENCY");
  if (logins.count < 3 || logins.p95 > resolvedThresholds.loginP95Ms) violations.push("REMOTE_LOAD_LOGIN_LATENCY");
  if (worker.count === 0 || worker.p95 > resolvedThresholds.workerP95Ms) violations.push("REMOTE_LOAD_WORKER_LATENCY");
  if (http429 > resolvedThresholds.maxHttp429) violations.push("REMOTE_LOAD_HTTP_429");
  if (http5xx > resolvedThresholds.maxHttp5xx) violations.push("REMOTE_LOAD_HTTP_5XX");
  if (httpAuth > resolvedThresholds.maxHttpAuth) violations.push("REMOTE_LOAD_HTTP_AUTH");
  if (httpUnexpected4xx > resolvedThresholds.maxHttpUnexpected4xx) violations.push("REMOTE_LOAD_HTTP_UNEXPECTED_4XX");
  if (actionSummary.rejectionClassification.auth > resolvedThresholds.maxActionAuthFailures) {
    violations.push("REMOTE_LOAD_ACTION_AUTH_FAILURE");
  }
  if (actionSummary.rejectionClassification.rateLimit > resolvedThresholds.maxActionRateLimitFailures) {
    violations.push("REMOTE_LOAD_ACTION_RATE_LIMIT_FAILURE");
  }
  if (actionSummary.rejectionClassification.unexpected > resolvedThresholds.maxUnexpectedActionFailures) {
    violations.push("REMOTE_LOAD_ACTION_UNEXPECTED_FAILURE");
  }
  if (
    actionSummary.actionMix.distinctActualActionCount < resolvedThresholds.minActualActionTypes
    || actionSummary.actionMix.distinctAcceptedActionCount < resolvedThresholds.minAcceptedActionTypes
    || actionSummary.actionMix.districtSelectionChangeCount
      < resolvedThresholds.minDistrictSelectionChanges
  ) {
    violations.push("REMOTE_LOAD_ACTION_MIX_INSUFFICIENT");
  }
  if (ticks.length < 2 || Math.max(...ticks) <= Math.min(...ticks)) violations.push("REMOTE_LOAD_TICK_STALLED");
  if (snapshotUpdates.length < 2 || Math.max(...snapshotUpdates) <= Math.min(...snapshotUpdates)) {
    violations.push("REMOTE_LOAD_SNAPSHOT_STALLED");
  }
  if (heartbeatAges.length === 0 || Math.max(...heartbeatAges) > resolvedThresholds.maxHeartbeatAgeMs) {
    violations.push("REMOTE_LOAD_HEARTBEAT_STALE");
  }
  return Object.freeze({
    passed: violations.length === 0,
    violations,
    thresholds: resolvedThresholds,
    http: { total: statusCodes.length, http429, http5xx, httpAuth, httpUnexpected4xx },
    api,
    commands,
    logins,
    worker,
    actionMix: actionSummary.actionMix,
    rejectionClassification: actionSummary.rejectionClassification,
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

export const classifyRemoteLoadActionOutcome = (outcome) => {
  const errorCodes = actionErrorCodes(outcome);
  if (outcome?.skipped === true || outcome?.outcome === "skipped") return "skipped";
  if (hasMatchingCode(errorCodes, isAuthenticationCode)) return "auth";
  if (hasMatchingCode(errorCodes, isRateLimitCode)) return "rate-limit";
  if (outcome?.transportFailure === true) return "unexpected";
  if (outcome?.accepted === true && errorCodes.length === 0) return "accepted";
  if (errorCodes.length > 0 && errorCodes.every(isStaleConflictCode)) return "stale-conflict";
  if (errorCodes.length > 0 && errorCodes.every((code) => (
    isStaleConflictCode(code) || isLegitimateDomainConflictCode(code)
  ))) return "domain-conflict";
  return "unexpected";
};

const summarizeActionOutcomes = (values) => {
  const outcomes = Array.isArray(values) ? values.filter(isRecord) : [];
  const desired = {};
  const actual = {};
  const accepted = {};
  const skipped = {};
  const byCode = {};
  const classifications = {
    accepted: 0,
    skipped: 0,
    staleConflict: 0,
    domainConflict: 0,
    auth: 0,
    rateLimit: 0,
    unexpected: 0
  };
  let attemptedCount = 0;
  for (const outcome of outcomes) {
    const desiredAction = actionName(outcome.desiredAction) ?? "unknown";
    const actualAction = actionName(outcome.actualAction);
    increment(desired, desiredAction);
    if (actualAction) {
      increment(actual, actualAction);
      attemptedCount += 1;
    }
    for (const code of actionErrorCodes(outcome)) increment(byCode, code);
    const classification = classifyRemoteLoadActionOutcome(outcome);
    if (classification === "accepted") {
      classifications.accepted += 1;
      if (actualAction) increment(accepted, actualAction);
    } else if (classification === "skipped") {
      classifications.skipped += 1;
      increment(skipped, desiredAction);
    } else if (classification === "stale-conflict") {
      classifications.staleConflict += 1;
    } else if (classification === "domain-conflict") {
      classifications.domainConflict += 1;
    } else if (classification === "auth") {
      classifications.auth += 1;
    } else if (classification === "rate-limit") {
      classifications.rateLimit += 1;
    } else {
      classifications.unexpected += 1;
    }
  }
  return {
    actionMix: Object.freeze({
      sampleCount: outcomes.length,
      attemptedCount,
      acceptedCount: classifications.accepted,
      skippedCount: classifications.skipped,
      districtSelectionChangeCount: outcomes.filter((outcome) => (
        outcome.selectedDistrictChanged === true
      )).length,
      distinctActualActionCount: Object.keys(actual).length,
      distinctAcceptedActionCount: Object.keys(accepted).length,
      desired: Object.freeze(desired),
      actual: Object.freeze(actual),
      accepted: Object.freeze(accepted),
      skipped: Object.freeze(skipped)
    }),
    rejectionClassification: Object.freeze({
      total: classifications.staleConflict
        + classifications.domainConflict
        + classifications.auth
        + classifications.rateLimit
        + classifications.unexpected,
      staleConflict: classifications.staleConflict,
      domainConflict: classifications.domainConflict,
      auth: classifications.auth,
      rateLimit: classifications.rateLimit,
      unexpected: classifications.unexpected,
      byCode: Object.freeze(byCode)
    })
  };
};

export const summarizeDatabaseTelemetry = (samples, maximumAllowedConnections) => {
  const connectionCounts = numbers(samples.map((sample) => sample.connectionCount));
  const activeCounts = numbers(samples.map((sample) => sample.activeConnectionCount));
  const queryDurations = numbers(samples.map((sample) => sample.probeDurationMs));
  const maximumObserved = connectionCounts.length ? Math.max(...connectionCounts) : 0;
  const errorSamples = samples.filter((sample) => sample.errorCode);
  const violations = [];
  if (samples.length === 0) violations.push("REMOTE_LOAD_DB_TELEMETRY_MISSING");
  if (errorSamples.length > 0) violations.push("REMOTE_LOAD_DB_TELEMETRY_ERROR");
  if (!Number.isInteger(maximumAllowedConnections) || maximumAllowedConnections <= 0) {
    violations.push("REMOTE_LOAD_DB_CONNECTION_THRESHOLD_INVALID");
  } else if (maximumObserved > maximumAllowedConnections) {
    violations.push("REMOTE_LOAD_DB_CONNECTION_SATURATION");
  }
  return Object.freeze({
    passed: violations.length === 0,
    violations,
    sampleCount: samples.length,
    errorSampleCount: errorSamples.length,
    maximumAllowedConnections,
    maximumObservedConnections: maximumObserved,
    maximumObservedActiveConnections: activeCounts.length ? Math.max(...activeCounts) : 0,
    probeLatency: durationSummary(queryDurations)
  });
};

export const summarizeFlyTelemetry = (samples, thresholds) => {
  const memory = numbers(samples.map((sample) => sample.memoryUsedBytes));
  const cpu = numbers(samples.map((sample) => sample.cpuUsedPct));
  const throttle = numbers(samples.map((sample) => sample.cpuThrottleIncrease));
  const concurrency = numbers(samples.map((sample) => sample.appConcurrency));
  const queryDurations = numbers(samples.map((sample) => sample.queryDurationMs));
  const errorSamples = samples.filter((sample) => sample.errorCode);
  const violations = [];
  if (samples.length === 0 || memory.length === 0 || cpu.length === 0 || throttle.length === 0) {
    violations.push("REMOTE_LOAD_FLY_TELEMETRY_MISSING");
  }
  if (errorSamples.length > 0) violations.push("REMOTE_LOAD_FLY_TELEMETRY_ERROR");
  if (!positive(thresholds?.maxMemoryBytes) || !positive(thresholds?.maxCpuPct)
    || !nonNegative(thresholds?.maxThrottleIncrease)) {
    violations.push("REMOTE_LOAD_FLY_THRESHOLD_INVALID");
  } else {
    if (memory.length && Math.max(...memory) > thresholds.maxMemoryBytes) {
      violations.push("REMOTE_LOAD_WORKER_MEMORY_HIGH");
    }
    if (cpu.length && percentile(cpu, 0.95) > thresholds.maxCpuPct) {
      violations.push("REMOTE_LOAD_WORKER_CPU_HIGH");
    }
    if (throttle.length && Math.max(...throttle) > thresholds.maxThrottleIncrease) {
      violations.push("REMOTE_LOAD_WORKER_THROTTLED");
    }
  }
  return Object.freeze({
    passed: violations.length === 0,
    violations,
    sampleCount: samples.length,
    errorSampleCount: errorSamples.length,
    thresholds,
    memoryUsedBytes: durationSummary(memory),
    cpuUsedPct: durationSummary(cpu),
    cpuThrottleIncrease: durationSummary(throttle),
    appConcurrency: durationSummary(concurrency),
    queryLatency: durationSummary(queryDurations)
  });
};

const AUTHENTICATION_ERROR_CODES = new Set([
  "CSRF_ORIGIN_INVALID",
  "CSRF_ORIGIN_REQUIRED",
  "PLAYER_IDENTITY_MISMATCH"
]);
const STALE_CONFLICT_ERROR_CODES = new Set([
  "DISTRICT_CONFLICT_STATE_CHANGED",
  "NORMAL_MARKET_OFFER_UNAVAILABLE",
  "BLACK_MARKET_OFFER_UNAVAILABLE",
  "OCCUPY_SPY_AUTH_EXPIRED",
  "OCCUPY_SPY_AUTH_INVALIDATED",
  "OCCUPY_TARGET_CHANGED"
]);
const LEGITIMATE_DOMAIN_CONFLICT_ERROR_CODES = new Set([
  "ATTACK_INSUFFICIENT_POPULATION",
  "ATTACK_INSUFFICIENT_WEAPON_INVENTORY",
  "BUILDING_ACTION_CONTESTED",
  "BUILDING_ACTION_COOLDOWN",
  "BUILDING_ACTION_INSUFFICIENT_RESOURCES",
  "BUILDING_ACTION_OWNER_REQUIRED",
  "BUILDING_ACTION_PHASE_BLOCKED",
  "BUILDING_NOT_ACTIVE",
  "CONSENT_REQUIRED",
  "DISTRICT_LOCKED",
  "DISTRICT_OPERATION_ACTIVE",
  "DOWNTOWN_LOCKED_UNTIL_FINAL_LOCKDOWN",
  "FACTORY_LINE_RESERVATION_LOCKED",
  "INSUFFICIENT_GANG_MEMBERS",
  "INSUFFICIENT_POPULATION",
  "NO_VALID_ORIGIN",
  "NORMAL_MARKET_STOCK_CAPACITY_EXCEEDED",
  "NOT_ENOUGH_CASH",
  "NOT_ENOUGH_RESOURCE",
  "NOT_ENOUGH_STOCK",
  "OCCUPY_SPY_REQUIRED",
  "PLAYER_MAJOR_OPERATION_ACTIVE",
  "PLAYER_OCCUPY_OPERATION_ACTIVE",
  "PRODUCTION_EMPTY",
  "SOURCE_CONFLICT_LOCKED",
  "SOURCE_DISTRICT_STABILIZING",
  "SPY_INTEL_ALREADY_ACTIVE",
  "SPY_REQUIRED",
  "SPY_SLOT_LIMIT_REACHED",
  "SPY_TARGET_INVALID",
  "SPY_TARGET_IS_ALLY",
  "SPY_TARGET_IS_SELF",
  "SPY_TARGET_NOT_ADJACENT",
  "STORAGE_CAPACITY_FULL",
  "TARGET_IS_ALLY",
  "TARGET_IS_SELF",
  "TARGET_LOOT_EXHAUSTED",
  "TARGET_NOT_ADJACENT",
  "TARGET_NOT_EMPTY",
  "TARGET_NOT_ENEMY"
]);

const actionErrorCodes = (outcome) => {
  const values = [
    ...(Array.isArray(outcome?.errorCodes) ? outcome.errorCodes : []),
    outcome?.errorCode
  ];
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
};
const actionName = (value) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};
const normalizedErrorCode = (value) => String(value ?? "")
  .trim()
  .toUpperCase()
  .replace(/[.-]/gu, "_");
const isAuthenticationCode = (code) => {
  const normalized = normalizedErrorCode(code);
  return AUTHENTICATION_ERROR_CODES.has(normalized)
    || normalized.startsWith("SESSION_")
    || normalized.startsWith("ACCOUNT_SESSION_")
    || normalized.startsWith("GAMEPLAY_SESSION_")
    || normalized === "TRANSPORT_UNAUTHORIZED"
    || normalized === "TRANSPORT_FORBIDDEN";
};
const isRateLimitCode = (code) => {
  const normalized = normalizedErrorCode(code);
  return normalized.includes("RATE_LIMIT") || normalized.includes("THROTTL");
};
const isStaleConflictCode = (code) => {
  const normalized = normalizedErrorCode(code);
  return STALE_CONFLICT_ERROR_CODES.has(normalized)
    || normalized === "SERVER_STATE_VERSION_CONFLICT"
    || normalized.endsWith("_VERSION_CONFLICT");
};
const isLegitimateDomainConflictCode = (code) => {
  const normalized = normalizedErrorCode(code);
  return LEGITIMATE_DOMAIN_CONFLICT_ERROR_CODES.has(normalized)
    || normalized.endsWith("_COOLDOWN_ACTIVE")
    || normalized.endsWith("_ON_COOLDOWN")
    || normalized.endsWith("_QUEUE_FULL")
    || normalized.endsWith("_OUTPUT_FULL")
    || normalized.endsWith("_INSUFFICIENT_CLEAN_CASH")
    || normalized.endsWith("_MISSING_INPUTS")
    || normalized.endsWith("_NOT_OWNED");
};
const hasMatchingCode = (codes, predicate) => codes.some(predicate);
const increment = (counts, key) => {
  counts[key] = Number(counts[key] || 0) + 1;
};
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

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
const numbers = (values = []) => values
  .filter((value) => value !== null && value !== undefined && value !== "")
  .map(Number)
  .filter(Number.isFinite);
const positive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const nonNegative = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;
