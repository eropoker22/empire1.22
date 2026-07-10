import { refreshLiveCooldownLabels } from "../shared-ui";

declare global {
  interface EmpireStreetsRuntimeDiagnostics {
    observeServerSlice?(gameplaySlice: unknown): { changed: boolean; fingerprint: string };
    recordClientStateRecompute?(reason?: string): number;
  }
  interface Window {
    empireStreetsPerformanceMode?: { active?: boolean; pollingMultiplier?: number };
    empireStreetsRuntimeDiagnostics?: EmpireStreetsRuntimeDiagnostics;
    empireStreetsPerformanceMetrics?: {
      activeIntervalsCount?: number;
      gameplaySliceRefreshCount?: number;
      lastGameplaySliceRefreshAt?: number;
      managedIntervalCounts?: Record<string, number>;
      serverSliceRefreshPerMinute?: number;
      clientStateRecomputePerMinute?: number;
      runtimeMode?: "server-authoritative" | "demo" | "legacy-fallback" | "local";
      localTickActive?: boolean;
      localProjectionActive?: boolean;
      serverSliceActive?: boolean;
      mapInvalidationReasonCounts?: Record<string, number>;
      lastMapInvalidationReason?: string | null;
      demoFallbackActive?: boolean;
    };
  }
}

interface VisibilityRuntimeOptions {
  root: HTMLElement;
  poller: { refreshOnce(): Promise<unknown | null> };
}

const getPerformanceMetrics = () => {
  window.empireStreetsPerformanceMetrics ??= {
    activeIntervalsCount: 0,
    gameplaySliceRefreshCount: 0,
    managedIntervalCounts: {}
  };
  window.empireStreetsPerformanceMetrics.managedIntervalCounts ??= {};
  return window.empireStreetsPerformanceMetrics;
};

const serverSliceRefreshTimestamps: number[] = [];
let lastServerSliceFingerprint = "";

const pruneTimestamps = (timestamps: number[], nowMs: number): number => {
  const cutoff = nowMs - 60_000;
  while (timestamps.length > 0 && (timestamps[0] ?? 0) < cutoff) {
    timestamps.shift();
  }
  return timestamps.length;
};

const createServerSliceFingerprint = (gameplaySlice: any): string => {
  if (!gameplaySlice || typeof gameplaySlice !== "object") return "";
  const server = gameplaySlice.server ?? {};
  const player = gameplaySlice.player ?? {};
  return JSON.stringify({
    instanceId: server.serverInstanceId || player.instanceId || "",
    playerId: player.playerId || "",
    stateVersion: server.stateVersion ?? null,
    currentTick: server.currentTick ?? null,
    selectedDistrictId: gameplaySlice.district?.districtId || server.selectedDistrictId || "",
    spawnStatus: gameplaySlice.spawnSelection?.status || "",
    gamePhase: gameplaySlice.gamePhase || ""
  });
};

export const trackIntervalMetric = (label: string, delta: 1 | -1): void => {
  const metrics = getPerformanceMetrics();
  const counts = metrics.managedIntervalCounts ?? {};
  counts[label] = Math.max(0, (counts[label] ?? 0) + delta);
  metrics.managedIntervalCounts = counts;
  metrics.activeIntervalsCount = Object.values(counts).reduce((sum, count) => sum + Math.max(0, count), 0);
};

export const recordGameplaySliceRefresh = (gameplaySlice: unknown): { changed: boolean; fingerprint: string } => {
  const metrics = getPerformanceMetrics();
  const nowMs = Date.now();
  metrics.gameplaySliceRefreshCount = (metrics.gameplaySliceRefreshCount ?? 0) + 1;
  metrics.lastGameplaySliceRefreshAt = nowMs;
  serverSliceRefreshTimestamps.push(nowMs);
  metrics.serverSliceRefreshPerMinute = pruneTimestamps(serverSliceRefreshTimestamps, nowMs);

  const diagnosticsObservation = window.empireStreetsRuntimeDiagnostics?.observeServerSlice?.(gameplaySlice);
  if (diagnosticsObservation) {
    return diagnosticsObservation;
  }

  const fingerprint = createServerSliceFingerprint(gameplaySlice);
  const changed = Boolean(fingerprint && fingerprint !== lastServerSliceFingerprint);
  if (fingerprint) lastServerSliceFingerprint = fingerprint;
  metrics.runtimeMode = "server-authoritative";
  metrics.serverSliceActive = Boolean(gameplaySlice);
  metrics.localTickActive = false;
  metrics.localProjectionActive = false;
  metrics.demoFallbackActive = false;
  return { changed, fingerprint };
};

export const recordClientStateRecompute = (reason: string): void => {
  const diagnostics = window.empireStreetsRuntimeDiagnostics;
  if (diagnostics?.recordClientStateRecompute) {
    diagnostics.recordClientStateRecompute(reason);
    return;
  }

  const metrics = getPerformanceMetrics();
  metrics.clientStateRecomputePerMinute = (metrics.clientStateRecomputePerMinute ?? 0) + 1;
};

export const getPollingIntervalMultiplier = (): number => {
  const multiplier = Number(window.empireStreetsPerformanceMode?.pollingMultiplier ?? 1);
  return Number.isFinite(multiplier) && multiplier >= 1 ? multiplier : 1;
};

export const getGameplaySlicePollerPerformanceOptions = () => ({
  visibilityDocument: document,
  intervalMultiplier: getPollingIntervalMultiplier(),
  onRunningChange: (delta: 1 | -1) => trackIntervalMetric("gameplay-slice-poller", delta)
});

export const createGameplaySliceVisibilityRuntime = ({ root, poller }: VisibilityRuntimeOptions) => {
  let cooldownTimerId: ReturnType<typeof window.setInterval> | null = null;
  const stopCooldownTimer = (): void => {
    if (cooldownTimerId === null) return;
    window.clearInterval(cooldownTimerId);
    cooldownTimerId = null;
    trackIntervalMetric("gameplay-slice-cooldowns", -1);
  };
  const startCooldownTimer = (): void => {
    if (cooldownTimerId !== null || document.hidden) return;
    cooldownTimerId = window.setInterval(() => refreshLiveCooldownLabels(root), 1000);
    trackIntervalMetric("gameplay-slice-cooldowns", 1);
  };
  const handleVisibilityChange = (): void => {
    if (document.hidden) {
      stopCooldownTimer();
      return;
    }
    refreshLiveCooldownLabels(root);
    startCooldownTimer();
    void poller.refreshOnce();
  };
  return {
    start() {
      startCooldownTimer();
      document.addEventListener("visibilitychange", handleVisibilityChange);
    },
    destroy() {
      stopCooldownTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  };
};

export {};
