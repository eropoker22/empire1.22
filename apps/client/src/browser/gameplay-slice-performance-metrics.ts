import { refreshLiveCooldownLabels } from "../shared-ui";
import type { GameplayCommandTimingMetadata } from "@empire/shared-types";

export interface GameplayCommandClientTiming extends Partial<GameplayCommandTimingMetadata> {
  commandId: string;
  clientSubmittedAtMs: number;
  clientResponseReceivedAtMs?: number;
  roundTripMs?: number;
  uiRenderCompletedAtMs?: number;
  uiAfterResponseMs?: number;
}

declare global {
  interface EmpireStreetsRuntimeDiagnostics {
    debugEnabled?: boolean;
    observeServerSlice?(gameplaySlice: unknown): { changed: boolean; fingerprint: string };
    recordClientStateRecompute?(reason?: string): number;
    recordFullUiRender?(reason?: string): number;
    recordSelectiveUiUpdate?(reason?: string, count?: number): number;
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
      gameplayPollCount?: number;
      gameplayPollSuccessCount?: number;
      gameplayPollErrorCount?: number;
      gameplayPollSkippedCount?: number;
      fullUiRenderCount?: number;
      selectiveUiUpdateCount?: number;
      lastGameplayCommandTiming?: GameplayCommandClientTiming;
    };
  }
}

interface VisibilityRuntimeOptions {
  root: HTMLElement;
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

const isPerformanceDebugEnabled = (): boolean =>
  Boolean(window.empireStreetsRuntimeDiagnostics?.debugEnabled);

const serverSliceRefreshTimestamps: number[] = [];
const pendingCommandTimings = new Map<string, GameplayCommandClientTiming>();
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

export const recordGameplayPollError = (): void => {
  if (!isPerformanceDebugEnabled()) return;
  const metrics = getPerformanceMetrics();
  metrics.gameplayPollErrorCount = (metrics.gameplayPollErrorCount ?? 0) + 1;
};

export const recordGameplayCommandSubmitted = (commandId: string): void => {
  if (!isPerformanceDebugEnabled()) return;
  const normalizedCommandId = String(commandId || "").trim();
  if (!normalizedCommandId) return;
  pendingCommandTimings.set(normalizedCommandId, {
    commandId: normalizedCommandId,
    clientSubmittedAtMs: Date.now()
  });
};

export const recordGameplayCommandResponse = (
  commandId: string,
  serverTiming?: GameplayCommandTimingMetadata
): void => {
  if (!isPerformanceDebugEnabled()) return;
  const normalizedCommandId = String(commandId || "").trim();
  const pending = pendingCommandTimings.get(normalizedCommandId) ?? {
    commandId: normalizedCommandId,
    clientSubmittedAtMs: Date.now()
  };
  const clientResponseReceivedAtMs = Date.now();
  const timing: GameplayCommandClientTiming = {
    ...pending,
    ...(serverTiming?.commandId === normalizedCommandId ? serverTiming : {}),
    commandId: normalizedCommandId,
    clientResponseReceivedAtMs,
    roundTripMs: Math.max(0, clientResponseReceivedAtMs - pending.clientSubmittedAtMs)
  };
  pendingCommandTimings.set(normalizedCommandId, timing);
  getPerformanceMetrics().lastGameplayCommandTiming = timing;
};

export const recordGameplayCommandUiRenderComplete = (): void => {
  if (!isPerformanceDebugEnabled()) return;
  const metrics = getPerformanceMetrics();
  const timing = metrics.lastGameplayCommandTiming;
  if (!timing?.clientResponseReceivedAtMs || timing.uiRenderCompletedAtMs) return;
  const uiRenderCompletedAtMs = Date.now();
  const completed = {
    ...timing,
    uiRenderCompletedAtMs,
    uiAfterResponseMs: Math.max(0, uiRenderCompletedAtMs - timing.clientResponseReceivedAtMs)
  };
  metrics.lastGameplayCommandTiming = completed;
  pendingCommandTimings.delete(completed.commandId);
};

export const getPollingIntervalMultiplier = (): number => {
  const multiplier = Number(window.empireStreetsPerformanceMode?.pollingMultiplier ?? 1);
  return Number.isFinite(multiplier) && multiplier >= 1 ? multiplier : 1;
};

export const getGameplaySlicePollerPerformanceOptions = () => ({
  visibilityDocument: document,
  intervalMultiplier: getPollingIntervalMultiplier(),
  onRunningChange: (delta: 1 | -1) => trackIntervalMetric("gameplay-slice-poller", delta),
  onAttempt: () => {
    if (!isPerformanceDebugEnabled()) return;
    const metrics = getPerformanceMetrics();
    metrics.gameplayPollCount = (metrics.gameplayPollCount ?? 0) + 1;
  },
  onSuccess: () => {
    if (!isPerformanceDebugEnabled()) return;
    const metrics = getPerformanceMetrics();
    metrics.gameplayPollSuccessCount = (metrics.gameplayPollSuccessCount ?? 0) + 1;
  },
  onSkipped: () => {
    if (!isPerformanceDebugEnabled()) return;
    const metrics = getPerformanceMetrics();
    metrics.gameplayPollSkippedCount = (metrics.gameplayPollSkippedCount ?? 0) + 1;
  }
});

export const createGameplaySliceVisibilityRuntime = ({ root }: VisibilityRuntimeOptions) => {
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
