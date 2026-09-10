import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { resolveEliminationConfig } from "../elimination/eliminationConfig";
import { resolveQuietHoursWindow } from "../elimination/quietHoursWindow";

export const estimateFinalLockdownEndTick = (
  state: CoreGameState,
  context: GameCoreContext
): number | null => {
  const finalState = state.finalLockdownState;
  if (!finalState || finalState.status === "inactive" || finalState.status === "resolved") return null;
  let remaining = Math.max(0, finalState.remainingActiveTicks);
  let tick = state.root.tick;
  const elimination = resolveEliminationConfig(context.config);
  if (!context.config.balance.finalLockdown?.pauseDuringQuietHours || !elimination?.quietHours?.enabled) return tick + remaining;
  // Skip complete calendar windows, preserving the lifecycle's (from, to] tick convention.
  for (let windows = 0; remaining > 0 && windows < 10000; windows += 1) {
    const nextTick = tick + 1;
    const quietPeriod = resolveQuietHoursWindow({ ...state, root: { ...state.root, tick: nextTick } }, elimination, context.config.tickRateMs);
    if (!quietPeriod) return tick + remaining;
    if (quietPeriod.active) {
      if (quietPeriod.endTick === null) return null;
      tick = quietPeriod.endTick - 1;
    } else {
      if (quietPeriod.startTick === null) return tick + remaining;
      const activeTicks = quietPeriod.startTick - nextTick;
      if (remaining <= activeTicks) return tick + remaining;
      remaining -= activeTicks;
      tick = quietPeriod.startTick - 1;
    }
  }
  return remaining <= 0 ? tick : null;
};
