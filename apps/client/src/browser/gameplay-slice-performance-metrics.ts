import { refreshLiveCooldownLabels } from "../shared-ui";

declare global {
  interface Window {
    empireStreetsPerformanceMode?: { active?: boolean; pollingMultiplier?: number };
    empireStreetsPerformanceMetrics?: {
      activeIntervalsCount?: number;
      gameplaySliceRefreshCount?: number;
      lastGameplaySliceRefreshAt?: number;
      managedIntervalCounts?: Record<string, number>;
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

export const trackIntervalMetric = (label: string, delta: 1 | -1): void => {
  const metrics = getPerformanceMetrics();
  const counts = metrics.managedIntervalCounts ?? {};
  counts[label] = Math.max(0, (counts[label] ?? 0) + delta);
  metrics.managedIntervalCounts = counts;
  metrics.activeIntervalsCount = Object.values(counts).reduce((sum, count) => sum + Math.max(0, count), 0);
};

export const recordGameplaySliceRefresh = (): void => {
  const metrics = getPerformanceMetrics();
  metrics.gameplaySliceRefreshCount = (metrics.gameplaySliceRefreshCount ?? 0) + 1;
  metrics.lastGameplaySliceRefreshAt = Date.now();
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
