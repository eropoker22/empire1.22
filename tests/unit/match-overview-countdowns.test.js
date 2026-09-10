import { describe, expect, it, vi } from "vitest";
import { resolveAuthoritativeMatchCountdowns, formatEliminationRemainingMs } from "../../page-assets/js/app/runtime/authoritativeEliminationCountdown.js";
import { createMatchOverviewViewModel } from "../../page-assets/js/app/runtime/eliminationMatchOverview.js";
import { observeAuthoritativeSnapshot } from "../../packages/shared-types/src/views/authoritative-snapshot-clock.js";
import { mergeAuthoritativeGameplaySlice } from "../../packages/shared-types/src/views/authoritative-gameplay-slice.js";
const at = Date.parse("2026-09-10T02:40:00.000Z");
const sample = () => ({ server: { status: "running", serverInstanceId: "clock", currentTick: 100, stateVersion: 1, generatedAt: new Date(at).toISOString() }, mode: { tickRateMs: 10000 },
  player: { playerId: "p", finalLockdown: { enabled: true, active: false, remainingActiveTicks: 810, activeDurationTicks: 4320, startConditions: { waitingFor: "registration", registrationClosed: false, effectiveSurvivorThreshold: null, earliestStartTick: 200, latestStartTick: 5000 } } },
  elimination: { enabled: true, nextEliminationTick: 2980, ticksUntilNextElimination: 2880, isQuietHoursNow: true, quietHoursResumeTick: 580, intervalTicks: 1440, playerStatus: "active",
    quietHoursWindow: { active: true, startTick: 0, endTick: 580, timeZone: "Europe/Bratislava", startsAt: "2026-09-09T22:00:00.000Z", endsAt: "2026-09-10T04:00:00.000Z" } } });
describe("shared match overview clocks", () => {
  it("retains the observed transport time after merging and rejects delayed pre-final snapshots", () => {
    const mono = vi.spyOn(performance, "now").mockReturnValue(5000);
    try {
      const incoming = sample(); incoming.server.stateVersion = 3; incoming.player.finalLockdown.active = true;
      observeAuthoritativeSnapshot(incoming, null, 3000);
      const merged = mergeAuthoritativeGameplaySlice(sample(), incoming).model;
      expect(resolveAuthoritativeMatchCountdowns(merged).finalActiveMs).toBe(8100000 - 2000);
      const old = sample(); old.server.stateVersion = 2;
      const rejected = mergeAuthoritativeGameplaySlice(merged, old);
      expect(rejected.accepted).toBe(false); expect(rejected.model.player.finalLockdown.active).toBe(true);
    } finally { mono.mockRestore(); }
  });
  it("shows 8 hours until purge and 80 minutes until quiet hours end", () => {
    const slice = sample();
    const clocks = resolveAuthoritativeMatchCountdowns(slice, at);
    expect(clocks.elimination.remainingMs).toBe(8 * 3600000);
    expect(clocks.quietRemainingMs).toBe(80 * 60000);
    const view = createMatchOverviewViewModel(slice, {}, at);
    expect(view.countdownLabel).toBe("Další očista za");
    expect(view.countdownValue).toBe("8h 00min 00s");
    expect(view.scheduleSections[0]).toMatchObject({ title: "Noční klid · končí za", value: "1h 20min 00s" });
  });
  it("freezes 2h15 active finale during quiet hours while resume counts down", () => {
    const slice = sample();
    slice.player.finalLockdown.active = true;
    slice.player.finalLockdown.pausedByQuietHours = true;
    expect(resolveAuthoritativeMatchCountdowns(slice, at + 30000)).toMatchObject({ finalActiveMs: 8100000, quietRemainingMs: 4770000 });
    slice.player.finalLockdown.pausedByQuietHours = false;
    expect(resolveAuthoritativeMatchCountdowns(slice, at + 30000).finalActiveMs).toBe(8070000);
  });
  it.each(["paused", "crashed", "ended", "lobby"])("does not invent a running countdown for %s", (status) => {
    const slice = sample(); slice.server.status = status;
    const clocks = resolveAuthoritativeMatchCountdowns(slice, at);
    expect(clocks.elimination.remainingMs).toBeNull(); expect(clocks.quietRemainingMs).toBeNull();
  });
  it("expires old snapshots, exposes missing data and holds at zero pending confirmation", () => {
    expect(resolveAuthoritativeMatchCountdowns(sample(), at + 61000).clockState).toBe("stale");
    expect(resolveAuthoritativeMatchCountdowns(null).finalActiveMs).toBeNull();
    const slice = sample(); slice.elimination.nextEliminationTick = 100;
    expect(resolveAuthoritativeMatchCountdowns(slice, at).elimination).toMatchObject({ state: "evaluating", remainingMs: 0 });
    expect(formatEliminationRemainingMs(49 * 3600000)).toBe("49h 00min 00s");
  });
  it("uses monotonic elapsed time even if device wall time changes", () => {
    const monotonic = vi.spyOn(performance, "now").mockReturnValue(1000);
    const slice = sample(); observeAuthoritativeSnapshot(slice);
    const wall = vi.spyOn(Date, "now").mockReturnValue(at + 24 * 3600000);
    monotonic.mockReturnValue(4000);
    expect(resolveAuthoritativeMatchCountdowns(slice).elimination.remainingMs).toBe(8 * 3600000 - 3000);
    wall.mockRestore(); monotonic.mockRestore();
  });
  it("does not promise an exact final start when registration or survivor count is missing", () => {
    const slice = sample();
    expect(createMatchOverviewViewModel(slice, {}, at).scheduleSections[1].detail).toContain("uzavření registrace");
    slice.player.finalLockdown.startConditions = { ...slice.player.finalLockdown.startConditions, waitingFor: "survivors", earliestStartTick: 90, effectiveSurvivorThreshold: 1, activePlayers: 2 };
    const section = createMatchOverviewViewModel(slice, {}, at).scheduleSections[1];
    expect(section.value).toBe("Finále zatím nezačalo"); expect(section.detail).toContain("nejvýše 1 přeživších; nyní 2");
  });
  it("renders authoritative final standings and no timers after the match", () => {
    const slice = sample(); slice.player.finalLockdown.result = { endedAt: new Date(at).toISOString(), currentPlayerRank: 2, winnerPlayerId: "q", ranking: [{ playerId: "p", playerName: "P", rank: 2, score: 800 }] };
    const view = createMatchOverviewViewModel(slice, {}, at);
    expect(view.countdownValue).toBe("#2"); expect(view.scheduleSections).toEqual([]); expect(view.leaderboard[0].score).toBe(800);
  });
  it("interpolates from the last tick observation and stops at the next quiet boundary", () => {
    const s = sample();
    s.server.logicalTime = new Date(at - 5000).toISOString();
    s.player.finalLockdown.active = true; s.player.finalLockdown.pauseDuringQuietHours = true;
    s.elimination.quietHoursWindow = { active: false, startTick: 101, endTick: 260 };
    const initial = resolveAuthoritativeMatchCountdowns(s, at);
    expect(initial.finalActiveMs).toBe(8100000 - 5000);
    const crossed = resolveAuthoritativeMatchCountdowns(s, at + 20000);
    expect(crossed.finalActiveMs).toBe(8100000 - 10000);
    expect(crossed.quietRemainingMs).toBe(0);
  });

});
