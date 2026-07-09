import type {
  GameplaySliceResponse,
  LoadGameplaySliceRequest
} from "@empire/shared-types";

export interface PollingTimerDriver {
  setInterval(callback: () => void, intervalMs: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface PollingVisibilityDocument {
  readonly hidden: boolean;
  addEventListener?(type: "visibilitychange", listener: () => void): void;
  removeEventListener?(type: "visibilitychange", listener: () => void): void;
}

export interface GameplaySlicePoller<TResponse = GameplaySliceResponse> {
  start(): void;
  stop(): void;
  destroy(): void;
  isRunning(): boolean;
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  refreshOnce(): Promise<TResponse | null>;
}

export interface GameplaySlicePollerOptions<TResponse = GameplaySliceResponse> {
  load(request: LoadGameplaySliceRequest): Promise<TResponse>;
  getRequest(): LoadGameplaySliceRequest | null;
  intervalMs: number;
  enabled?: boolean;
  timerDriver?: PollingTimerDriver;
  visibilityDocument?: PollingVisibilityDocument | null;
  intervalMultiplier?: number;
  maxErrorIntervalMultiplier?: number;
  onRunningChange?(delta: 1 | -1): void;
  onResponse?(response: TResponse): void | Promise<void>;
  onError?(error: unknown): void;
}

const browserTimerDriver: PollingTimerDriver = {
  setInterval: (callback, intervalMs) => globalThis.setInterval(callback, intervalMs),
  clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof globalThis.setInterval>)
};

/**
 * Responsibility: Optional polling refresh controller for server-fed gameplay slice read models.
 * Belongs here: timer ownership and safe calls into an existing load transport.
 * Does not belong here: gameplay rules, websocket fanout, persistence, or UI rendering policy.
 */
export const createGameplaySlicePoller = <TResponse = GameplaySliceResponse>({
  load,
  getRequest,
  intervalMs,
  enabled = true,
  timerDriver = browserTimerDriver,
  visibilityDocument = typeof document === "undefined" ? null : document,
  intervalMultiplier = 1,
  maxErrorIntervalMultiplier = 4,
  onRunningChange,
  onResponse,
  onError
}: GameplaySlicePollerOptions<TResponse>): GameplaySlicePoller<TResponse> => {
  const baseIntervalMs = Math.max(1, Math.floor(intervalMs * Math.max(1, intervalMultiplier)));
  const maxBackoffMultiplier = Math.max(1, Math.floor(maxErrorIntervalMultiplier));
  let intervalHandle: unknown | null = null;
  let currentIntervalMs = baseIntervalMs;
  let consecutiveErrors = 0;
  let refreshInProgress = false;
  let pollingEnabled = enabled;
  let destroyed = false;

  const isPausedForVisibility = (): boolean => Boolean(visibilityDocument?.hidden);

  const stop = (): void => {
    if (intervalHandle === null) {
      return;
    }

    timerDriver.clearInterval(intervalHandle);
    intervalHandle = null;
    onRunningChange?.(-1);
  };

  const startInterval = (): void => {
    if (!pollingEnabled || destroyed || intervalHandle !== null || isPausedForVisibility()) {
      return;
    }

    intervalHandle = timerDriver.setInterval(() => {
      if (isPausedForVisibility()) {
        stop();
        return;
      }
      void refreshOnce();
    }, currentIntervalMs);
    onRunningChange?.(1);
  };

  const restartWithInterval = (nextIntervalMs: number): void => {
    const wasRunning = intervalHandle !== null;
    stop();
    currentIntervalMs = Math.max(1, Math.floor(nextIntervalMs));
    if (wasRunning) {
      startInterval();
    }
  };

  const syncErrorBackoff = (): void => {
    const multiplier = Math.min(maxBackoffMultiplier, consecutiveErrors + 1);
    const nextIntervalMs = baseIntervalMs * multiplier;
    if (nextIntervalMs !== currentIntervalMs) {
      restartWithInterval(nextIntervalMs);
    }
  };

  const resetErrorBackoff = (): void => {
    if (consecutiveErrors === 0 && currentIntervalMs === baseIntervalMs) {
      return;
    }
    consecutiveErrors = 0;
    if (currentIntervalMs !== baseIntervalMs) {
      restartWithInterval(baseIntervalMs);
    }
  };

  const refreshOnce = async (): Promise<TResponse | null> => {
    if (refreshInProgress || destroyed || isPausedForVisibility()) {
      return null;
    }

    const request = getRequest();

    if (!request) {
      return null;
    }

    refreshInProgress = true;

    try {
      const response = await load(request);
      await onResponse?.(response);
      resetErrorBackoff();
      return response;
    } catch (error) {
      consecutiveErrors += 1;
      onError?.(error);
      syncErrorBackoff();
      return null;
    } finally {
      refreshInProgress = false;
    }
  };

  const handleVisibilityChange = (): void => {
    if (isPausedForVisibility()) {
      stop();
      return;
    }

    if (!pollingEnabled || destroyed) {
      return;
    }

    void refreshOnce();
    startInterval();
  };

  visibilityDocument?.addEventListener?.("visibilitychange", handleVisibilityChange);

  return {
    start: () => {
      if (!pollingEnabled || intervalHandle !== null) {
        return;
      }

      startInterval();
    },
    stop,
    destroy: () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      stop();
      visibilityDocument?.removeEventListener?.("visibilitychange", handleVisibilityChange);
    },
    isRunning: () => intervalHandle !== null,
    isEnabled: () => pollingEnabled,
    setEnabled: (nextEnabled) => {
      pollingEnabled = nextEnabled;

      if (!pollingEnabled) {
        stop();
      } else {
        startInterval();
      }
    },
    refreshOnce
  };
};
