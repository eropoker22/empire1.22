import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { createCoreStateFixture } from "../../fixtures/game-state-fixtures";
import { resolveQuietHoursWindow } from "../../../packages/game-core/src/rules/elimination/quietHoursWindow";
import { estimateFinalLockdownEndTick } from "../../../packages/game-core/src/rules/victory/finalLockdownLifecycle";
const config = resolveModeConfig("free");
describe("server calendar windows", () => {
  it.each([
    ["2026-03-28T23:00:00Z", "2026-03-29T04:00:00.000Z", 5],
    ["2026-10-24T22:00:00Z", "2026-10-25T05:00:00.000Z", 7]
  ])("follows IANA DST at %s", (start, end, hours) => {
    const state = createCoreStateFixture(); state.serverInstance.startedAt = start as string; state.root.tick = 0;
    const window = resolveQuietHoursWindow(state, config.balance.elimination!, config.tickRateMs)!;
    expect(window.active).toBe(true); expect(window.endsAt).toBe(end);
    expect(window.endTick! * config.tickRateMs).toBe(Number(hours) * 3600000);
  });
  it("includes multiple quiet windows in a long final estimate", () => {
    const state = createCoreStateFixture(); state.serverInstance.startedAt = "2026-09-10T04:00:00.000Z"; state.root.tick = 0;
    const duration = 40 * 3600000 / config.tickRateMs;
    state.finalLockdownState = { id: "f", serverInstanceId: state.serverInstance.id, status: "active", startedAtTick: 0,
      activeDurationTicks: duration, activeElapsedTicks: 0, remainingActiveTicks: duration, pausedByQuietHours: false,
      lastUpdatedTick: 0, resolvedAtTick: null, finalTopPlayerIds: [], version: 1 };
    const endTick = estimateFinalLockdownEndTick(state, { config })!;
    expect(new Date(Date.parse(state.serverInstance.startedAt) + endTick * config.tickRateMs).toISOString()).toBe("2026-09-12T08:00:00.000Z");
  });
  it("keeps the real calendar after an administrative pause without spending active ticks", () => {
    const state = createCoreStateFixture();
    state.serverInstance.startedAt = "2026-09-10T10:00:00.000Z";
    state.root.tick = 10;
    state.serverInstance.calendarAnchor = { tick: 10, at: "2026-09-10T22:30:00.000Z" };
    const quiet = resolveQuietHoursWindow(state, config.balance.elimination!, config.tickRateMs)!;
    expect(quiet.active).toBe(true);
    expect(quiet.endsAt).toBe("2026-09-11T04:00:00.000Z");
    expect(quiet.endTick! - state.root.tick).toBe(5.5 * 3600000 / config.tickRateMs);
    expect(state.root.tick).toBe(10);
  });

});
