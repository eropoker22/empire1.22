/**
 * Responsibility: Collects shared production policy names and placeholders.
 * Belongs here: production-specific rule references and local helpers.
 * Does not belong here: command transport or admin operations.
 */
export const productionRuleSet = "default-production";

export const resolveCraftProcessingDurationTicks = (
  durationTicks: number,
  cooldownMultiplier: number
): number => Math.max(1, Math.ceil(durationTicks * cooldownMultiplier));
