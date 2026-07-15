import type { GameCoreContext } from "../../engine/context";
import { getCurrentDayNightPhase, resolveDayNightGameClock } from "./dayNightPhase";

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_PHASE = 12 * 60;
const DAY_START_MINUTE = 6 * 60;
const NIGHT_START_MINUTE = 18 * 60;

export interface CityClockTime {
  hour: number;
  minute: number;
}

type CityClockState = { root: { tick: number } };

export const resolveCityMinuteOfDay = (
  state: CityClockState,
  context: Pick<GameCoreContext, "config">,
  tickOverride?: number
): number => {
  const phase = getCurrentDayNightPhase(state, context, tickOverride);
  const clock = resolveDayNightGameClock(phase);
  return clock.gameHour * 60 + clock.gameMinute;
};

export const resolveCityHour = (
  state: CityClockState,
  context: Pick<GameCoreContext, "config">,
  tickOverride?: number
): number => Math.floor(resolveCityMinuteOfDay(state, context, tickOverride) / 60);

export const resolveCityDayIndex = (
  state: CityClockState,
  context: Pick<GameCoreContext, "config">,
  tickOverride?: number
): number => {
  const tick = normalizeTick(tickOverride ?? state.root.tick);
  return Math.floor(tick / resolveCityDayDurationTicks(context));
};

export const resolveNextCityTimeBoundaryTick = (
  state: CityClockState,
  context: Pick<GameCoreContext, "config">,
  targetHour: number,
  targetMinute = 0,
  tickOverride?: number,
  includeCurrent = false
): number => {
  const tick = normalizeTick(tickOverride ?? state.root.tick);
  const cycleDuration = resolveCityDayDurationTicks(context);
  const cycleStart = Math.floor(tick / cycleDuration) * cycleDuration;
  let boundary = cycleStart + resolveCityTimeOffsetTicks(context, targetHour, targetMinute);
  if (boundary < tick || (!includeCurrent && boundary === tick)) boundary += cycleDuration;
  return boundary;
};

export const resolvePreviousCityTimeBoundaryTick = (
  state: CityClockState,
  context: Pick<GameCoreContext, "config">,
  targetHour: number,
  targetMinute = 0,
  tickOverride?: number
): number => {
  const tick = normalizeTick(tickOverride ?? state.root.tick);
  const cycleDuration = resolveCityDayDurationTicks(context);
  const cycleStart = Math.floor(tick / cycleDuration) * cycleDuration;
  let boundary = cycleStart + resolveCityTimeOffsetTicks(context, targetHour, targetMinute);
  if (boundary > tick) boundary -= cycleDuration;
  return Math.max(0, boundary);
};

export const createCityScheduleWindowId = (
  state: CityClockState,
  context: Pick<GameCoreContext, "config">,
  agentId: string,
  boundary: CityClockTime,
  tickOverride?: number
): string => {
  const boundaryTick = resolvePreviousCityTimeBoundaryTick(
    state,
    context,
    boundary.hour,
    boundary.minute,
    tickOverride
  );
  const dayIndex = resolveCityDayIndex(state, context, boundaryTick);
  return `${String(agentId || "agent")}:day-${dayIndex}:${formatClock(boundary.hour, boundary.minute)}`;
};

export const resolveCityDayDurationTicks = (
  context: Pick<GameCoreContext, "config">
): number => {
  const day = Math.max(1, Math.floor(Number(context.config.balance.dayNight?.phases.day.durationTicks
    ?? context.config.balance.dayLengthTicks
    ?? 1)));
  const night = Math.max(1, Math.floor(Number(context.config.balance.dayNight?.phases.night.durationTicks
    ?? context.config.balance.nightLengthTicks
    ?? 1)));
  return day + night;
};

const resolveCityTimeOffsetTicks = (
  context: Pick<GameCoreContext, "config">,
  rawHour: number,
  rawMinute: number
): number => {
  const hour = ((Math.floor(Number(rawHour) || 0) % 24) + 24) % 24;
  const minute = Math.max(0, Math.min(59, Math.floor(Number(rawMinute) || 0)));
  const minuteOfDay = hour * 60 + minute;
  const dayTicks = Math.max(1, Math.floor(Number(context.config.balance.dayNight?.phases.day.durationTicks
    ?? context.config.balance.dayLengthTicks
    ?? 1)));
  const nightTicks = Math.max(1, Math.floor(Number(context.config.balance.dayNight?.phases.night.durationTicks
    ?? context.config.balance.nightLengthTicks
    ?? 1)));

  if (minuteOfDay >= DAY_START_MINUTE && minuteOfDay < NIGHT_START_MINUTE) {
    return Math.round(((minuteOfDay - DAY_START_MINUTE) / MINUTES_PER_PHASE) * dayTicks);
  }
  const nightMinute = minuteOfDay >= NIGHT_START_MINUTE
    ? minuteOfDay - NIGHT_START_MINUTE
    : minuteOfDay + MINUTES_PER_DAY - NIGHT_START_MINUTE;
  return dayTicks + Math.round((nightMinute / MINUTES_PER_PHASE) * nightTicks);
};

const normalizeTick = (value: number): number => Math.max(0, Math.floor(Number(value) || 0));
const formatClock = (hour: number, minute: number): string =>
  `${String(((Math.floor(hour) % 24) + 24) % 24).padStart(2, "0")}${String(Math.max(0, Math.min(59, Math.floor(minute)))).padStart(2, "0")}`;
