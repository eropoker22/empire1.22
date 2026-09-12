import type { GameCoreContext } from "../../engine/context";
import type { AnyRecord, MarketActionResult } from "./market-types";

export const withMarketContext = (
  original: AnyRecord,
  context: Pick<GameCoreContext, "config"> | undefined,
  action: (state: AnyRecord) => MarketActionResult
): MarketActionResult => {
  const result = action(context ? { ...original, config: context.config } : original);
  if (!context || !result.nextState) return result;
  const nextState = { ...result.nextState };
  if (Object.prototype.hasOwnProperty.call(original, "config")) nextState.config = original.config;
  else delete nextState.config;
  return { ...result, nextState };
};
