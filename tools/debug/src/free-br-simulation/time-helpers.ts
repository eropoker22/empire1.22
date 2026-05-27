import type { FreeBrSimulationState } from "./types";

const localHourFormatters = new Map<string, Intl.DateTimeFormat>();

export const isQuietHours = (state: FreeBrSimulationState, tick: number): boolean => {
  const quiet = state.config.balance.elimination?.quietHours;
  if (!quiet?.enabled) return false;
  const cacheKey = Math.floor((state.startAtMs + tick * state.config.tickRateMs) / (60 * 60 * 1000));
  const cached = state.quietHourCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const hour = getLocalHour(state, tick, quiet.timeZone);
  const start = quiet.startHour;
  const end = quiet.endHour;
  const result = start < end ? hour >= start && hour < end : hour >= start || hour < end;
  state.quietHourCache.set(cacheKey, result);
  return result;
};

export const resolveQuietHoursResumeTick = (state: FreeBrSimulationState, tick: number): number => {
  const ticksHour = ticksPerHour(state);
  let candidate = tick + ticksHour;
  while (isQuietHours(state, candidate)) candidate += ticksHour;
  return candidate;
};

export const countActiveAndQuietTicks = (
  state: FreeBrSimulationState,
  fromTickExclusive: number,
  toTickInclusive: number
): { activeTicks: number; pausedTicks: number } => {
  let cursor = fromTickExclusive + 1;
  let activeTicks = 0;
  let pausedTicks = 0;

  while (cursor <= toTickInclusive) {
    const currentMs = state.startAtMs + cursor * state.config.tickRateMs;
    const nextUtcHourMs = (Math.floor(currentMs / (60 * 60 * 1000)) + 1) * 60 * 60 * 1000;
    const nextHourTick = Math.ceil((nextUtcHourMs - state.startAtMs) / state.config.tickRateMs);
    const segmentEnd = Math.min(toTickInclusive, Math.max(cursor, nextHourTick - 1));
    const tickCount = segmentEnd - cursor + 1;

    if (isQuietHours(state, cursor)) pausedTicks += tickCount;
    else activeTicks += tickCount;

    cursor = segmentEnd + 1;
  }

  return { activeTicks, pausedTicks };
};

export const getLocalHour = (state: FreeBrSimulationState, tick: number, timeZone: string): number => {
  const formatter = localHourFormatters.get(timeZone) ?? new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23"
  });
  localHourFormatters.set(timeZone, formatter);
  const hour = formatter
    .formatToParts(new Date(state.startAtMs + tick * state.config.tickRateMs))
    .find((part) => part.type === "hour")?.value;
  return Number(hour ?? 0);
};

export const ticksPerHour = (state: FreeBrSimulationState): number =>
  Math.max(1, Math.round((60 * 60 * 1000) / state.config.tickRateMs));

export const tickToHour = (state: FreeBrSimulationState, tick: number): number =>
  Math.round((tick * state.config.tickRateMs / (60 * 60 * 1000)) * 100) / 100;
