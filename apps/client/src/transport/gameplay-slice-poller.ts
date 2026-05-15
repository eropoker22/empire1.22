import type {
  GameplaySliceResponse,
  LoadGameplaySliceRequest
} from "@empire/shared-types";

export interface PollingTimerDriver {
  setInterval(callback: () => void, intervalMs: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface GameplaySlicePoller<TResponse = GameplaySliceResponse> {
  start(): void;
  stop(): void;
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
  onResponse,
  onError
}: GameplaySlicePollerOptions<TResponse>): GameplaySlicePoller<TResponse> => {
  const safeIntervalMs = Math.max(1, Math.floor(intervalMs));
  let intervalHandle: unknown | null = null;
  let refreshInProgress = false;
  let pollingEnabled = enabled;

  const stop = (): void => {
    if (intervalHandle === null) {
      return;
    }

    timerDriver.clearInterval(intervalHandle);
    intervalHandle = null;
  };

  const refreshOnce = async (): Promise<TResponse | null> => {
    if (refreshInProgress) {
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
      return response;
    } catch (error) {
      onError?.(error);
      return null;
    } finally {
      refreshInProgress = false;
    }
  };

  return {
    start: () => {
      if (!pollingEnabled || intervalHandle !== null) {
        return;
      }

      intervalHandle = timerDriver.setInterval(() => {
        void refreshOnce();
      }, safeIntervalMs);
    },
    stop,
    isRunning: () => intervalHandle !== null,
    isEnabled: () => pollingEnabled,
    setEnabled: (nextEnabled) => {
      pollingEnabled = nextEnabled;

      if (!pollingEnabled) {
        stop();
      }
    },
    refreshOnce
  };
};
