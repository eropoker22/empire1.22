import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import {
  getCurrentDayNightPhase,
  resolveCityMinuteOfDay,
  resolveDayNightGameClock,
  resolveNextCityTimeBoundaryTick
} from "../day-night/dayNight";

const RAID_SCHEDULE = Object.freeze([
  Object.freeze({ hour: 6, minute: 0 }),
  Object.freeze({ hour: 12, minute: 30 }),
  Object.freeze({ hour: 22, minute: 0 })
]);

export const isScheduledRaidBoundary = (
  state: CoreGameState,
  context: GameCoreContext | undefined,
  currentTick: number
): boolean => {
  if (!context) {
    const gameClock = resolveDayNightGameClock(getCurrentDayNightPhase(state));
    return RAID_SCHEDULE.some(({ hour, minute }) =>
      gameClock.gameHour === hour && gameClock.gameMinute === minute
    );
  }

  const normalizedTick = Math.max(0, Math.floor(Number(currentTick) || 0));
  if (normalizedTick <= 1) {
    const initialMinute = resolveCityMinuteOfDay(state, context, 0);
    if (RAID_SCHEDULE.some(({ hour, minute }) => initialMinute === hour * 60 + minute)) {
      return true;
    }
  }

  if (normalizedTick === 0) return false;
  const previousTick = normalizedTick - 1;
  return RAID_SCHEDULE.some(({ hour, minute }) =>
    resolveNextCityTimeBoundaryTick(
      state,
      context,
      hour,
      minute,
      previousTick,
      false
    ) <= normalizedTick
  );
};
