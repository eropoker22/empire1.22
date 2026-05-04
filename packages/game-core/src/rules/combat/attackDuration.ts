import type { GameCoreContext } from "../../engine/context";

export const resolveAttackDurationTicks = (context: GameCoreContext): number => {
  const configuredCooldownTicks = context.config.balance.conflict?.attackCooldownTicks ?? 2;
  const configuredMinimumTicks = context.config.balance.conflict?.minAttackDurationTicks ?? 0;
  const freeMinimumTicks = context.config.mode === "free"
    ? Math.ceil((1000 * 60 * 3) / Math.max(1, context.config.tickRateMs))
    : 0;

  return Math.max(1, configuredCooldownTicks, configuredMinimumTicks, freeMinimumTicks);
};
