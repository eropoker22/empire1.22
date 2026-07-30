import type { AdminApiClient } from "./admin-monitoring-client";

export const ADMIN_POLL_INTERVAL_MS = 30_000;
export const ADMIN_MAX_BACKOFF_MS = 80_000;
export interface AdminAppOptions { client?: AdminApiClient; pollIntervalMs?: number; }
