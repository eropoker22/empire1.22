import { resolveAlliancePenaltyDeadlines } from "./alliancePenaltyDeadlines";
import type { CoreGameState } from "../../entities";

export interface AlliancePenaltyStatModifiers {
  attackMultiplier: number;
  defenseMultiplier: number;
  productionMultiplier: number;
  incomeMultiplier: number;
  influenceGenerationMultiplier: number;
  actionCooldownMultiplier: number;
}

export const createDefaultAlliancePenaltyStatModifiers = (): AlliancePenaltyStatModifiers => ({
  attackMultiplier: 1,
  defenseMultiplier: 1,
  productionMultiplier: 1,
  incomeMultiplier: 1,
  influenceGenerationMultiplier: 1,
  actionCooldownMultiplier: 1
});

export const resolveActiveAlliancePenaltyStatModifiers = (
  state: CoreGameState,
  playerId: string | null | undefined,
  nowIso: string,
  actionId?: string
): AlliancePenaltyStatModifiers => {
  if (!playerId) return createDefaultAlliancePenaltyStatModifiers();
  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) return createDefaultAlliancePenaltyStatModifiers();

  return Object.values(state.allianceExitPenaltiesById ?? {})
    .filter((penalty) => penalty.playerId === playerId && Date.parse(penalty.startedAt) <= now && Date.parse(penalty.penaltyEndsAt) > now)
    .reduce((modifiers, penalty) => {
      const ends = resolveAlliancePenaltyDeadlines(penalty);
      const effect = (value: number | undefined, end: string) => Date.parse(end) > now ? resolveMultiplier(value) : 1;
      return {
        attackMultiplier: modifiers.attackMultiplier * effect(penalty.attackMultiplier, ends.statDebuffEndsAt),
        defenseMultiplier: modifiers.defenseMultiplier * effect(penalty.defenseMultiplier, ends.statDebuffEndsAt),
        productionMultiplier: modifiers.productionMultiplier * effect(penalty.productionMultiplier, ends.statDebuffEndsAt),
        incomeMultiplier: modifiers.incomeMultiplier * effect(penalty.incomeMultiplier, ends.statDebuffEndsAt),
        influenceGenerationMultiplier: modifiers.influenceGenerationMultiplier * effect(penalty.influenceGenerationMultiplier, ends.influenceDebuffEndsAt),
        actionCooldownMultiplier: modifiers.actionCooldownMultiplier * (!actionId || penalty.affectedActionIds.includes(actionId)
          ? effect(penalty.actionCooldownMultiplier, ends.actionCooldownDebuffEndsAt) : 1)
      };
    }, createDefaultAlliancePenaltyStatModifiers());
};

const resolveMultiplier = (value: number | undefined): number => {
  const multiplier = Number(value);
  return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
};
