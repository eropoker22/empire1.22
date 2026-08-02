import { GAMEPLAY_SLICE_STABLE_POLL_INTERVAL_MS } from "./gameplay-slice-timing";

export const createBrowserCommandId = (prefix: string): string =>
  `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;

export const parseGameplaySlicePollingIntervalMs = (value: string | undefined): number => {
  const intervalMs = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(intervalMs) && intervalMs > 0
    ? intervalMs
    : GAMEPLAY_SLICE_STABLE_POLL_INTERVAL_MS;
};
