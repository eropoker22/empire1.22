import type { EliminationBalanceConfig } from "../../contracts";
import type { CoreGameState } from "../../entities";

export const DEFAULT_ELIMINATION_SCORE_WEIGHTS: EliminationBalanceConfig["scoreWeights"] = {
  controlledDistricts: 10000,
  districtInfluence: 25,
  activeBuildingCount: 500,
  cleanCash: 0.1,
  dirtyCash: 0.05,
  resources: 0.2,
  population: 2,
  recentActivityBonus: 250,
  recentActivityWindowTicks: 720,
  resourceScoreValues: {}
};

export const resolveEliminationConfig = (
  config: { balance: { elimination?: EliminationBalanceConfig } }
): EliminationBalanceConfig | null => config.balance.elimination ?? null;

export const resolveNextEliminationTick = (
  config: EliminationBalanceConfig,
  lastEliminationTick: number | null
): number => (lastEliminationTick === null ? config.firstEliminationTick : lastEliminationTick + config.intervalTicks);

export const isEliminationQuietHoursEnabled = (config: EliminationBalanceConfig): boolean =>
  Boolean(config.quietHours?.enabled && config.quietHours.behavior === "defer_to_window_end");

export const isTickInEliminationQuietHours = (
  state: CoreGameState,
  config: EliminationBalanceConfig,
  tick: number,
  tickRateMs: number
): boolean => {
  const quietHours = config.quietHours;
  if (!isEliminationQuietHoursEnabled(config) || !quietHours) return false;
  const localHour = getLocalHourAtTick(state, tick, tickRateMs, quietHours.timeZone);
  const startHour = normalizeHour(quietHours.startHour);
  const endHour = normalizeHour(quietHours.endHour);
  if (startHour === endHour) return true;
  return startHour < endHour
    ? localHour >= startHour && localHour < endHour
    : localHour >= startHour || localHour < endHour;
};

export const resolveQuietHoursResumeTick = (
  state: CoreGameState,
  config: EliminationBalanceConfig,
  tick: number,
  tickRateMs: number
): number | null => {
  if (!isTickInEliminationQuietHours(state, config, tick, tickRateMs)) return null;

  const ticksPerHour = Math.max(1, Math.ceil((60 * 60 * 1000) / Math.max(1, tickRateMs)));
  let high = tick + ticksPerHour;
  const maxHigh = tick + (ticksPerHour * 30);
  while (high < maxHigh && isTickInEliminationQuietHours(state, config, high, tickRateMs)) {
    high += ticksPerHour;
  }

  let low = tick;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (isTickInEliminationQuietHours(state, config, middle, tickRateMs)) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return high;
};

const normalizeHour = (hour: number): number => {
  const normalized = Math.floor(Number(hour) || 0) % 24;
  return normalized < 0 ? normalized + 24 : normalized;
};

const getLocalHourAtTick = (
  state: CoreGameState,
  tick: number,
  tickRateMs: number,
  timeZone: string
): number => {
  const startedAtMs = Date.parse(state.serverInstance.startedAt || new Date(0).toISOString());
  const at = new Date((Number.isFinite(startedAtMs) ? startedAtMs : 0) + (Math.max(0, tick) * Math.max(1, tickRateMs)));
  const hourPart = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(at).find((part) => part.type === "hour")?.value;
  return normalizeHour(Number(hourPart));
};
