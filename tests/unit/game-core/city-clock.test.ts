import { describe, expect, it } from "vitest";
import { createFreeModeConfig } from "../../../packages/game-config/src/factories/create-free-mode-config";
import {
  createCityScheduleWindowId,
  resolveCityDayIndex,
  resolveCityHour,
  resolveCityMinuteOfDay,
  resolveNextCityTimeBoundaryTick
} from "../../../packages/game-core/src/rules/day-night/dayNight";

const freeModeConfig = createFreeModeConfig();
const context = { config: freeModeConfig };
const phaseTicks = freeModeConfig.balance.dayNight!.phases.day.durationTicks;
const tickAt = (hour: number, minute = 0): number => {
  const totalMinutes = ((hour * 60 + minute) - 6 * 60 + 24 * 60) % (24 * 60);
  return Math.round((totalMinutes / (12 * 60)) * phaseTicks);
};
const stateAt = (tick: number) => ({ root: { tick } });

describe("canonical city clock", () => {
  it.each([
    [5, 59], [6, 0], [9, 59], [10, 0], [13, 59], [14, 0], [17, 59], [18, 0],
    [21, 59], [22, 0], [1, 59], [2, 0], [3, 59], [4, 0]
  ])("resolves %i:%i from the existing day/night cycle", (hour, minute) => {
    const tick = tickAt(hour, minute);
    expect(resolveCityHour(stateAt(tick), context)).toBe(hour);
    expect(resolveCityMinuteOfDay(stateAt(tick), context)).toBe(hour * 60 + minute);
  });

  it("wraps the city day at 06:00", () => {
    const cycle = phaseTicks * 2;
    expect(resolveCityDayIndex(stateAt(cycle - 1), context)).toBe(0);
    expect(resolveCityDayIndex(stateAt(cycle), context)).toBe(1);
  });

  it("resolves current and next schedule boundaries without using wall clock time", () => {
    const at1800 = tickAt(18);
    expect(resolveNextCityTimeBoundaryTick(stateAt(at1800), context, 18, 0, undefined, true)).toBe(at1800);
    expect(resolveNextCityTimeBoundaryTick(stateAt(at1800), context, 18, 0)).toBe(at1800 + phaseTicks * 2);
    expect(createCityScheduleWindowId(stateAt(tickAt(23)), context, "victor", { hour: 22, minute: 0 }))
      .toBe("victor:day-0:2200");
  });
});
