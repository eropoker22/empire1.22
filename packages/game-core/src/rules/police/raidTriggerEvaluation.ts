import type { ScheduledRaidWindow } from "./raidSchedule";
import type { RaidTriggerDecision } from "./raidTriggerTypes";

export interface RaidTriggerEvaluation {
  windowId: string;
  boundary: string;
  boundaryTick: number;
  evaluatedAtTick: number;
  candidateCount: number;
  decisionCounts: Record<string, number>;
  pendingRaidCreatedCount: number;
}

export const createRaidTriggerEvaluation = (
  scheduledWindow: ScheduledRaidWindow,
  currentTick: number,
  candidateCount: number,
  decisions: RaidTriggerDecision[],
  scheduleVersion: number
): {
  evaluation: RaidTriggerEvaluation;
  policeScheduleState: {
    lastProcessedBoundaryTick: number;
    lastProcessedBoundaryId: string;
    version: number;
  };
} => {
  const decisionCounts = decisions.reduce<Record<string, number>>((counts, decision) => {
    counts[decision.type] = (counts[decision.type] ?? 0) + 1;
    return counts;
  }, {});
  return {
    evaluation: {
      windowId: scheduledWindow.windowId,
      boundary: scheduledWindow.boundary,
      boundaryTick: scheduledWindow.boundaryTick,
      evaluatedAtTick: currentTick,
      candidateCount,
      decisionCounts,
      pendingRaidCreatedCount: decisionCounts.pending_raid_created ?? 0
    },
    policeScheduleState: {
      lastProcessedBoundaryTick: scheduledWindow.boundaryTick,
      lastProcessedBoundaryId: scheduledWindow.windowId,
      version: scheduleVersion + 1
    }
  };
};
