import type { runTick } from "@empire/game-core";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import { writeDiagnosticLog } from "../logging";
import type { Clock } from "./clock";

type TickResult = ReturnType<typeof runTick>;

/** Boundary-only diagnostics: no identity/session payloads and no per-tick spam. */
export const recordPoliceRaidTickDiagnostics = (
  runtime: ServerInstanceRuntime,
  result: Pick<TickResult, "events" | "policeRaidEvaluation">,
  clock: Clock
): void => {
  const evaluation = result.policeRaidEvaluation;
  if (evaluation) {
    void writeDiagnosticLog(
      runtime.replayLogWriter,
      runtime.record.id,
      "info",
      "lifecycle",
      "Police raid boundary evaluated.",
      {
        kind: "police-raid-boundary",
        tick: evaluation.evaluatedAtTick,
        boundary: evaluation.boundary,
        boundaryTick: evaluation.boundaryTick,
        windowId: evaluation.windowId,
        candidateCount: evaluation.candidateCount,
        decisionCounts: evaluation.decisionCounts,
        pendingRaidCreatedCount: evaluation.pendingRaidCreatedCount
      },
      clock
    ).catch(() => undefined);
  }

  const resolvedCount = result.events.filter((event) => event.type === "police-raid-resolved").length;
  if (resolvedCount > 0) {
    void writeDiagnosticLog(
      runtime.replayLogWriter,
      runtime.record.id,
      "info",
      "lifecycle",
      "Police raid lifecycle resolved.",
      { kind: "police-raid-resolution", tick: runtime.state.root.tick, resolvedCount },
      clock
    ).catch(() => undefined);
  }
};
