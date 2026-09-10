// Local observation metadata is never sent to the server or persisted as game state.
const observationKey = Symbol.for("empire.authoritativeSnapshotClock");
const observations = globalThis[observationKey] ??= new WeakMap();
const monotonicNow = () => globalThis.performance?.now?.() ?? 0;
export function observeAuthoritativeSnapshot(slice, connection = null, receivedAt = monotonicNow()) {
  if (!slice || typeof slice !== "object") return;
  const key = slice.server || slice;
  const previous = observations.get(key);
  observations.set(key, { receivedAt: previous?.receivedAt ?? receivedAt,
    unavailable: connection ? connection.status !== "ready" || connection.staleData === true : previous?.unavailable ?? false });
}
export function readAuthoritativeSnapshotClock(slice, testNowMs) {
  if (!slice?.server) return { state: "loading", elapsedMs: 0, serverNowMs: null };
  observeAuthoritativeSnapshot(slice);
  const observation = observations.get(slice.server);
  const generated = Date.parse(slice.server.generatedAt || "");
  const logical = Date.parse(slice.server.logicalTime || "");
  const elapsedMs = testNowMs !== undefined ? Math.max(0, Number(testNowMs) - generated)
    : Math.max(0, monotonicNow() - observation.receivedAt);
  const freshnessMs = Math.max(60_000, Number(slice.mode?.tickRateMs || 0) * 3);
  const status = slice.server.status;
  const state = ["ended", "destroyed", "stopped"].includes(status) || slice.server.phase === "resolved" ? "ended"
    : ["paused", "pausing", "maintenance"].includes(status) ? "paused"
    : ["created", "lobby", "booting"].includes(status) ? "waiting_start"
    : observation.unavailable || ["crashed", "restarting", "stopping"].includes(status)
      || !Number.isFinite(generated) || !Number.isFinite(elapsedMs) || elapsedMs > freshnessMs
      || (Number.isFinite(logical) && generated - logical > freshnessMs) ? "stale" : "running";
  return { state, elapsedMs: state === "running" ? elapsedMs + (Number.isFinite(logical) ? Math.max(0, generated - logical) : 0) : 0,
    serverNowMs: Number.isFinite(generated) ? generated + elapsedMs : null };
}
