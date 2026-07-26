import {
  ticksFromHours,
  ticksFromMinutes
} from "../../../../packages/game-config/src/modes/free/free-mode-timing";

const DETERMINISTIC_HOUR_BUCKET_TICKS = ticksFromHours(1);
const PLAYER_OFFSET_STEP_TICKS = ticksFromMinutes(1);

export const findScheduledTick = (
  playerId: string,
  interval: number,
  previousTick: number,
  currentTick: number
): number | null => {
  const offset = playerOffset(playerId, interval);
  let scheduledTick = offset;
  if (scheduledTick <= previousTick) {
    scheduledTick += Math.ceil((previousTick - scheduledTick + 1) / interval) * interval;
  }
  return scheduledTick > 0 && scheduledTick <= currentTick ? scheduledTick : null;
};

export const shouldRunExtraAttack = (playerId: string, tick: number, chancePct: number): boolean => {
  if (chancePct <= 0) return false;
  return stableHash(
    `${playerId}:${Math.floor(tick / DETERMINISTIC_HOUR_BUCKET_TICKS)}:extra-attack`
  ) % 10_000 < Math.min(100, chancePct) * 100;
};

export const scoreRouteSeed = (playerId: string, districtId: string, tick: number): number =>
  stableHash(`${playerId}:${districtId}:${Math.floor(tick / DETERMINISTIC_HOUR_BUCKET_TICKS)}`);

export const stableHash = (value: string): number => {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const playerOffset = (playerId: string, interval: number): number =>
  (stableHash(playerId) % Math.max(1, Math.floor(interval / PLAYER_OFFSET_STEP_TICKS)))
  * PLAYER_OFFSET_STEP_TICKS;
