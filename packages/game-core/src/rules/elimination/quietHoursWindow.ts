import type { EliminationBalanceConfig } from "../../contracts";
import type { CoreGameState } from "../../entities";
import { calendarTimeAtTick } from "./serverCalendar";
import { isEliminationQuietHoursEnabled, isTickInEliminationQuietHours, resolveQuietHoursResumeTick } from "./eliminationConfig";

/** Calendar boundaries use exactly the scheduler's IANA-zone predicate (including DST). */
export const resolveQuietHoursWindow = (state: CoreGameState, config: EliminationBalanceConfig, tickRateMs: number) => {
  if (!isEliminationQuietHoursEnabled(config) || !config.quietHours) return null;
  const tick = state.root.tick;
  const active = isTickInEliminationQuietHours(state, config, tick, tickRateMs);
  const step = Math.max(1, Math.floor(30 * 60_000 / tickRateMs));
  const horizon = Math.ceil(30 * 3_600_000 / tickRateMs);
  let boundary: number | null = null;
  // Locate the current window's start, or the next window's start.
  for (let distance = step; distance <= horizon + step; distance += step) {
    const candidate = tick + (active ? -distance : distance);
    const inside = isTickInEliminationQuietHours(state, config, candidate, tickRateMs);
    if (inside === active) continue;
    let low = active ? candidate : candidate - step;
    let high = active ? candidate + step : candidate;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if (isTickInEliminationQuietHours(state, config, middle, tickRateMs)) high = middle;
      else low = middle;
    }
    boundary = high;
    break;
  }
  const startTick = boundary;
  const endTick = resolveQuietHoursResumeTick(state, config, active ? tick : startTick ?? tick, tickRateMs);
  const at = (value: number | null) => value === null ? null : new Date(calendarTimeAtTick(state, value, tickRateMs)).toISOString();
  return { active, timeZone: config.quietHours.timeZone, startTick, endTick,
    startsAt: at(startTick), endsAt: at(endTick) };
};
