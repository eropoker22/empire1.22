import type { GameplaySliceView } from "./gameplay-slice-view";
export function observeAuthoritativeSnapshot(slice: GameplaySliceView | null, connection?: { status: string; staleData?: boolean } | null, receivedAt?: number): void;
export function readAuthoritativeSnapshotClock(slice: GameplaySliceView | null, testNowMs?: number): {
  state: "loading" | "ended" | "paused" | "waiting_start" | "stale" | "running";
  elapsedMs: number; serverNowMs: number | null;
};
