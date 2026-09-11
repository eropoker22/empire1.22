import type { AllianceExitPenalty } from "@empire/shared-types";

/** Legacy 2026-09-10 FREE voluntary-leave contract. This is a frozen migration
 * rule, not a lookup of mutable balance. Unrecognized historical profiles retain
 * their saved end until their original configuration can be established. */
export const resolveAlliancePenaltyDeadlines = (penalty: AllianceExitPenalty) => {
  const start = Date.parse(penalty.startedAt);
  const end = Date.parse(penalty.penaltyEndsAt);
  const legacyFreeLeave = penalty.reason === "voluntary_leave" && end - start === 12 * 3600000
    && penalty.influenceGenerationMultiplier === .8 && penalty.actionCooldownMultiplier === 1.15
    && penalty.attackMultiplier === .8 && penalty.defenseMultiplier === .8;
  const legacyEnd = (hours: number) => legacyFreeLeave ? new Date(start + hours * 3600000).toISOString() : penalty.penaltyEndsAt;
  return {
    influenceDebuffEndsAt: penalty.influenceDebuffEndsAt ?? legacyEnd(8),
    actionCooldownDebuffEndsAt: penalty.actionCooldownDebuffEndsAt ?? legacyEnd(6),
    statDebuffEndsAt: penalty.statDebuffEndsAt ?? penalty.penaltyEndsAt
  };
};
