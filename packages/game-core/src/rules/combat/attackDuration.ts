import type { GameCoreContext } from "../../engine/context";

const minutesToTicks = (minutes: number, tickRateMs: number): number =>
  Math.ceil((minutes * 60 * 1000) / Math.max(1, tickRateMs));

export const resolveAttackDurationTicks = (context: GameCoreContext): number => {
  const configuredCooldownTicks = context.config.balance.conflict?.attackCooldownTicks ?? 2;
  const configuredMinimumTicks = context.config.balance.conflict?.minAttackDurationTicks ?? 0;
  const freeMinimumTicks = context.config.mode === "free"
    ? Math.ceil((1000 * 60 * 3) / Math.max(1, context.config.tickRateMs))
    : 0;

  return Math.max(1, configuredCooldownTicks, configuredMinimumTicks, freeMinimumTicks);
};

export const resolveAttackDurationGuardrailTicks = (context: GameCoreContext): number => {
  if (context.config.mode === "free") {
    const strategicGuardrailTicks = minutesToTicks(15, context.config.tickRateMs);
    return resolveAttackDurationTicks(context) >= strategicGuardrailTicks
      ? strategicGuardrailTicks
      : Math.max(1, context.config.balance.conflict?.minAttackDurationTicks ?? 1);
  }

  return Math.max(1, context.config.balance.conflict?.minAttackDurationTicks ?? 1);
};
