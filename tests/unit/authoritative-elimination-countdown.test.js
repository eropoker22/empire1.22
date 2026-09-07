import { describe, expect, it } from "vitest";
import {
  ELIMINATION_WARNING_MILESTONES_MS,
  formatEliminationRemainingMs,
  resolveAuthoritativeEliminationCountdown,
  resolveEliminationWarningMilestone
} from "../../page-assets/js/app/runtime/authoritativeEliminationCountdown.js";

const GENERATED_AT = "2026-09-01T10:00:00.000Z";
const GENERATED_AT_MS = Date.parse(GENERATED_AT);

function slice({
  currentTick = 100,
  nextEliminationTick = 460,
  tickRateMs = 10_000,
  generatedAt = GENERATED_AT,
  elimination = {}
} = {}) {
  return {
    server: {
      serverInstanceId: "server:countdown-test",
      currentTick,
      generatedAt
    },
    mode: { tickRateMs },
    elimination: {
      enabled: true,
      eliminationsStopped: false,
      isQuietHoursNow: false,
      nextEliminationTick,
      ticksUntilNextElimination: Math.max(0, nextEliminationTick - currentTick),
      ...elimination
    }
  };
}

describe("authoritative elimination countdown", () => {
  it("converts ticks through the authoritative tick rate", () => {
    expect(resolveAuthoritativeEliminationCountdown(slice(), GENERATED_AT_MS)).toMatchObject({
      state: "counting",
      remainingMs: 3_600_000,
      deadlineTick: 460,
      currentTick: 100,
      tickRateMs: 10_000
    });
    expect(resolveAuthoritativeEliminationCountdown(slice({ nextEliminationTick: 160 }), GENERATED_AT_MS).remainingMs)
      .toBe(600_000);
    expect(resolveAuthoritativeEliminationCountdown(slice({ nextEliminationTick: 160, tickRateMs: 1_000 }), GENERATED_AT_MS).remainingMs)
      .toBe(60_000);
    expect(resolveAuthoritativeEliminationCountdown(slice({ nextEliminationTick: 160, tickRateMs: 5_000 }), GENERATED_AT_MS).remainingMs)
      .toBe(300_000);
  });

  it("subtracts elapsed wall time from one authoritative server snapshot", () => {
    const countdown = resolveAuthoritativeEliminationCountdown(slice(), GENERATED_AT_MS + 5_000);
    expect(countdown.remainingAtSnapshotMs).toBe(3_600_000);
    expect(countdown.elapsedSinceSnapshotMs).toBe(5_000);
    expect(countdown.remainingMs).toBe(3_595_000);
    expect(countdown.deadlineMs).toBe(GENERATED_AT_MS + 3_600_000);
  });

  it("uses the quiet-hours resume tick and exposes stopped/evaluating states", () => {
    expect(resolveAuthoritativeEliminationCountdown(slice({
      elimination: { isQuietHoursNow: true, quietHoursResumeTick: 220 }
    }), GENERATED_AT_MS)).toMatchObject({
      state: "quiet_hours",
      remainingMs: 1_200_000,
      deadlineTick: 220,
      isQuietHours: true
    });
    expect(resolveAuthoritativeEliminationCountdown(slice({
      elimination: { eliminationsStopped: true, nextEliminationTick: null }
    }), GENERATED_AT_MS)).toMatchObject({ state: "stopped", stopped: true, remainingMs: null });
    expect(resolveAuthoritativeEliminationCountdown(slice({ nextEliminationTick: 100 }), GENERATED_AT_MS))
      .toMatchObject({ state: "evaluating", remainingMs: 0 });
  });

  it("does not invent a demo deadline before hosted hydration", () => {
    expect(resolveAuthoritativeEliminationCountdown(null, GENERATED_AT_MS)).toMatchObject({
      state: "loading",
      remainingMs: null
    });
    expect(resolveAuthoritativeEliminationCountdown({
      mode: { tickRateMs: 10_000 },
      server: { currentTick: 100, generatedAt: GENERATED_AT },
      elimination: { enabled: true, nextEliminationTick: null, ticksUntilNextElimination: null }
    }, GENERATED_AT_MS)).toMatchObject({ state: "loading", remainingMs: null });
    expect(formatEliminationRemainingMs(null)).toBe("—");
  });

  it("formats one canonical duration for compact pill and detailed card", () => {
    expect(formatEliminationRemainingMs(3_600_000, { compact: true })).toBe("1h 00m");
    expect(formatEliminationRemainingMs(3_600_000)).toBe("1h 00min 00s");
    expect(formatEliminationRemainingMs(600_000, { compact: true })).toBe("10m");
    expect(formatEliminationRemainingMs(599_000, { compact: true })).toBe("9m 59s");
  });

  it("uses exactly the five requested red-card milestones", () => {
    expect(ELIMINATION_WARNING_MILESTONES_MS).toEqual([
      28_740_000,
      14_400_000,
      3_600_000,
      900_000,
      300_000
    ]);
    for (const milestoneMs of ELIMINATION_WARNING_MILESTONES_MS) {
      expect(resolveEliminationWarningMilestone(milestoneMs + 1_000, milestoneMs)).toBe(milestoneMs);
      expect(resolveEliminationWarningMilestone(null, milestoneMs)).toBe(milestoneMs);
    }
    expect(resolveEliminationWarningMilestone(null, (7 * 60 + 55) * 60_000)).toBe(28_740_000);
    expect(resolveEliminationWarningMilestone(null, 8 * 60 * 60_000)).toBeNull();
  });
});
