import type { FullGameExecutionMetrics } from "./executor";

export const recordResolvedSimulationEvents = (metrics: FullGameExecutionMetrics, events: readonly unknown[]): void => {
  for (const candidate of events) {
    if (!candidate || typeof candidate !== "object") continue;
    const event = candidate as { type?: unknown; payload?: unknown };
    if (typeof event.type !== "string") continue;
    metrics.eventCounts[event.type] = (metrics.eventCounts[event.type] ?? 0) + 1;
    const payload = event.payload && typeof event.payload === "object"
      ? event.payload as Record<string, unknown> : {};
    const playerId = String(payload.attackerPlayerId ?? "");
    if (!playerId) continue;
    const add = (key: string) => {
      const outcomes = metrics.outcomesByPlayer[playerId] ??= {};
      outcomes[key] = (outcomes[key] ?? 0) + 1;
    };
    if (event.type === "district-attacked" && typeof payload.attackSucceeded === "boolean") {
      add(payload.attackSucceeded ? "attacksWon" : "attacksLost");
      if (payload.attackSucceeded) add("districtsCaptured");
    }
    if (event.type === "district-spied" && typeof payload.result === "string") {
      add(payload.result === "success" ? "spySuccesses" : "spyFailures");
      if (payload.result === "partial") add("spyPartialResults");
    }
  }
};
