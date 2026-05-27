export const FREE_MODE_TICK_RATE_MS = 5000;
export const FREE_MODE_COOLDOWN_MULTIPLIER = 0.8;

export const ticksFromMinutes = (minutes: number, tickRateMs = FREE_MODE_TICK_RATE_MS): number =>
  Math.ceil((minutes * 60 * 1000) / tickRateMs);

export const ticksFromHours = (hours: number, tickRateMs = FREE_MODE_TICK_RATE_MS): number =>
  ticksFromMinutes(hours * 60, tickRateMs);

export const ticksFromDays = (days: number, tickRateMs = FREE_MODE_TICK_RATE_MS): number =>
  ticksFromHours(days * 24, tickRateMs);

export const baseCooldownTicksForFinalMinutes = (minutes: number): number =>
  Math.ceil(ticksFromMinutes(minutes) / FREE_MODE_COOLDOWN_MULTIPLIER);

export const baseCooldownMsForFinalMinutes = (minutes: number): number =>
  Math.ceil((minutes * 60 * 1000) / FREE_MODE_COOLDOWN_MULTIPLIER);
