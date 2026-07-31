export interface AdminInstanceTickSample {
  serverInstanceId: string;
  lifecycleStatus: string;
  observedAt: string;
  currentTick: number | null;
  rootTick: number | null;
  stateVersion: number | null;
  lastStartedAt: string | null;
  observationWindowMs: number;
}

export interface AdminInstanceTickProgress {
  status: "pass" | "fail" | "pending";
  reasonCode: string;
  observedAt: string | null;
}

interface CompleteTickSample extends AdminInstanceTickSample {
  currentTick: number;
  rootTick: number;
  stateVersion: number;
}

interface StoredTickObservation {
  baseline: CompleteTickSample;
  lastAdvanceAt: string | null;
}

export interface AdminInstanceTickObservationCache {
  observe(sample: AdminInstanceTickSample): AdminInstanceTickProgress;
  clear(serverInstanceId: string): void;
}

const ACTIVE_RUNTIME_STATUSES = new Set(["running", "restarting"]);

export const createAdminInstanceTickObservationCache = (): AdminInstanceTickObservationCache => {
  const observations = new Map<string, StoredTickObservation>();

  return {
    observe: (sample) => {
      const status = normalizeStatus(sample.lifecycleStatus);
      if (!ACTIVE_RUNTIME_STATUSES.has(status)) {
        observations.delete(sample.serverInstanceId);
        return pending("tick-observation-not-required", sample.observedAt);
      }

      const current = completeSample(sample);
      if (!current) {
        observations.delete(sample.serverInstanceId);
        return pending("tick-observation-missing", sample.observedAt);
      }
      if (current.currentTick !== current.rootTick) {
        observations.delete(sample.serverInstanceId);
        return failed("tick-observation-inconsistent", current.observedAt);
      }

      const stored = observations.get(sample.serverInstanceId);
      if (!stored || stored.baseline.lastStartedAt !== current.lastStartedAt) {
        observations.set(sample.serverInstanceId, { baseline: current, lastAdvanceAt: null });
        return pending("tick-observation-first-sample", current.observedAt);
      }

      const elapsedMs = elapsed(stored.baseline.observedAt, current.observedAt);
      if (elapsedMs === null || elapsedMs <= 0) {
        return pending("tick-observation-awaiting-next-sample", current.observedAt);
      }

      if (regressed(stored.baseline, current)) {
        observations.set(sample.serverInstanceId, { baseline: current, lastAdvanceAt: null });
        return pending("tick-observation-reset", current.observedAt);
      }

      const changed = changedFields(stored.baseline, current);
      if (changed === 3) {
        if (elapsedMs > current.observationWindowMs) {
          observations.set(sample.serverInstanceId, { baseline: current, lastAdvanceAt: null });
          return pending("tick-observation-gap-too-large", current.observedAt);
        }
        observations.set(sample.serverInstanceId, {
          baseline: current,
          lastAdvanceAt: current.observedAt
        });
        return passed("tick-advance-two-sample", current.observedAt);
      }

      const lastAdvanceAt = stored.lastAdvanceAt;
      const lastAdvanceAgeMs = lastAdvanceAt
        ? elapsed(lastAdvanceAt, current.observedAt)
        : null;
      if (lastAdvanceAt && lastAdvanceAgeMs !== null && lastAdvanceAgeMs <= current.observationWindowMs) {
        return passed("tick-advance-two-sample", lastAdvanceAt);
      }
      if (elapsedMs >= current.observationWindowMs) {
        return failed("tick-not-advancing", current.observedAt);
      }
      return pending("tick-observation-window-open", current.observedAt);
    },
    clear: (serverInstanceId) => {
      observations.delete(serverInstanceId);
    }
  };
};

const completeSample = (sample: AdminInstanceTickSample): CompleteTickSample | null => {
  const currentTick = nonNegativeInteger(sample.currentTick);
  const rootTick = nonNegativeInteger(sample.rootTick);
  const stateVersion = nonNegativeInteger(sample.stateVersion);
  const observedAt = timestamp(sample.observedAt);
  if (currentTick === null || rootTick === null || stateVersion === null || observedAt === null) {
    return null;
  }
  return {
    ...sample,
    observedAt: new Date(observedAt).toISOString(),
    currentTick,
    rootTick,
    stateVersion,
    observationWindowMs: Math.max(1, Math.floor(sample.observationWindowMs))
  };
};

const changedFields = (previous: CompleteTickSample, current: CompleteTickSample): number =>
  Number(current.currentTick > previous.currentTick)
  + Number(current.rootTick > previous.rootTick)
  + Number(current.stateVersion > previous.stateVersion);

const regressed = (previous: CompleteTickSample, current: CompleteTickSample): boolean =>
  current.currentTick < previous.currentTick
  || current.rootTick < previous.rootTick
  || current.stateVersion < previous.stateVersion;

const elapsed = (from: string, to: string): number | null => {
  const fromMs = timestamp(from);
  const toMs = timestamp(to);
  return fromMs === null || toMs === null ? null : toMs - fromMs;
};

const timestamp = (value: string): number | null => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const nonNegativeInteger = (value: number | null): number | null =>
  Number.isFinite(value) && Number(value) >= 0 ? Math.floor(Number(value)) : null;

const normalizeStatus = (status: string): string =>
  String(status || "unknown").trim().toLowerCase();

const passed = (reasonCode: string, observedAt: string): AdminInstanceTickProgress => ({
  status: "pass",
  reasonCode,
  observedAt
});

const failed = (reasonCode: string, observedAt: string): AdminInstanceTickProgress => ({
  status: "fail",
  reasonCode,
  observedAt
});

const pending = (reasonCode: string, observedAt: string | null): AdminInstanceTickProgress => ({
  status: "pending",
  reasonCode,
  observedAt
});
