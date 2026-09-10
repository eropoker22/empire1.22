import type { CoreGameState } from "../../entities";

/** Active ticks pause with the worker; calendar quiet hours keep their IANA dates. */
export const calendarTimeAtTick = (state: CoreGameState, tick: number, rate: number): number => {
  const anchor = state.serverInstance.calendarAnchor;
  const anchorMs = Date.parse(anchor?.at ?? "");
  return Number.isFinite(anchorMs) && anchor
    ? anchorMs + (tick - anchor.tick) * rate
    : Date.parse(state.serverInstance.startedAt) + tick * rate;
};
