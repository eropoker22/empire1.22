import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import {
  createCityScheduleWindowId,
  getCurrentDayNightPhase,
  resolveCityMinuteOfDay,
  resolveDayNightGameClock,
  resolveNextCityTimeBoundaryTick,
  resolvePreviousCityTimeBoundaryTick
} from "../day-night/dayNight";

export type ScheduledRaidBoundary = "morning" | "afternoon" | "midnight";

export interface ScheduledRaidWindow {
  boundary: ScheduledRaidBoundary;
  boundaryTick: number;
  windowId: string;
}

const RAID_SCHEDULE = Object.freeze([
  Object.freeze({ id: "morning" as const, hour: 8, minute: 0 }),
  Object.freeze({ id: "afternoon" as const, hour: 16, minute: 0 }),
  Object.freeze({ id: "midnight" as const, hour: 0, minute: 0 })
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
): boolean => resolveScheduledRaidBoundary(state, context, currentTick) !== null;

export const resolveScheduledRaidBoundary = (
  state: CoreGameState,
  context: GameCoreContext | undefined,
  currentTick: number
): ScheduledRaidBoundary | null => resolveScheduledRaidWindow(state, context, currentTick)?.boundary ?? null;

/**
 * Returns the oldest unprocessed police window up to currentTick. The persisted
 * boundary tick makes a delayed worker/restart catch up exactly once instead of
 * requiring one lucky timer callback at the exact city minute.
 */
export const resolveScheduledRaidWindow = (
  state: CoreGameState,
  context: GameCoreContext | undefined,
  currentTick: number
): ScheduledRaidWindow | null => {
  const normalizedTick = Math.max(0, Math.floor(Number(currentTick) || 0));
  const lastProcessedTick = Number(state.policeScheduleState?.lastProcessedBoundaryTick);

  if (!context) {
    const boundary = RAID_SCHEDULE.find(({ hour, minute }) =>
      isRaidTimeBoundary(state, context, normalizedTick, hour, minute)
    );
    if (!boundary || (Number.isFinite(lastProcessedTick) && lastProcessedTick >= normalizedTick)) return null;
    return {
      boundary: boundary.id,
      boundaryTick: normalizedTick,
      windowId: `police-raid:tick-${normalizedTick}:${boundary.id}`
    };
  }

  const nextWindow = Number.isFinite(lastProcessedTick)
    ? RAID_SCHEDULE
      .map((boundary) => ({
        boundary,
        tick: resolveNextCityTimeBoundaryTick(
          state,
          context,
          boundary.hour,
          boundary.minute,
          lastProcessedTick,
          false
        )
      }))
      .filter(({ tick }) => tick <= normalizedTick)
      .sort((left, right) => left.tick - right.tick)[0]
    : RAID_SCHEDULE
      .map((boundary) => ({
        boundary,
        tick: resolvePreviousCityTimeBoundaryTick(
          state,
          context,
          boundary.hour,
          boundary.minute,
          normalizedTick
        )
      }))
      .filter(({ boundary, tick }) => (
        tick <= normalizedTick
        && resolveCityMinuteOfDay(state, context, tick) === boundary.hour * 60 + boundary.minute
      ))
      .sort((left, right) => right.tick - left.tick)[0];

  if (!nextWindow) return null;
  return {
    boundary: nextWindow.boundary.id,
    boundaryTick: nextWindow.tick,
    windowId: createCityScheduleWindowId(
      state,
      context,
      "police-raid",
      nextWindow.boundary,
      nextWindow.tick
    )
  };
};

export const isAfternoonRaidBoundary = (
  state: CoreGameState,
  context: GameCoreContext | undefined,
  currentTick: number
): boolean => isRaidTimeBoundary(state, context, currentTick, 16, 0);
