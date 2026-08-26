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
  Object.freeze({ hour: 12, minute: 0 }),
  Object.freeze({ hour: 22, minute: 0 })
]);

const isRaidTimeBoundary = (
  state: CoreGameState,
  context: GameCoreContext | undefined,
  currentTick: number,
  hour: number,
  minute: number
): boolean => {
  if (!context) {
    const gameClock = resolveDayNightGameClock(getCurrentDayNightPhase(state));
    return gameClock.gameHour === hour && gameClock.gameMinute === minute;
  }

  const normalizedTick = Math.max(0, Math.floor(Number(currentTick) || 0));
  if (normalizedTick <= 1 && resolveCityMinuteOfDay(state, context, 0) === hour * 60 + minute) {
    return true;
  }
  if (normalizedTick === 0) return false;
  return resolveNextCityTimeBoundaryTick(
    state,
    context,
    hour,
    minute,
    normalizedTick - 1,
    false
  ) <= normalizedTick;
};

export const isScheduledRaidBoundary = (
  state: CoreGameState,
  context: GameCoreContext | undefined,
  currentTick: number
): boolean => {
  return RAID_SCHEDULE.some(({ hour, minute }) =>
    isRaidTimeBoundary(state, context, currentTick, hour, minute)
  );
};

export const isMiddayRaidBoundary = (
  state: CoreGameState,
  context: GameCoreContext | undefined,
  currentTick: number
): boolean => isRaidTimeBoundary(state, context, currentTick, 12, 0);
