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
  nowIso: string
): AlliancePenaltyStatModifiers => {
  if (!playerId) return createDefaultAlliancePenaltyStatModifiers();
  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) return createDefaultAlliancePenaltyStatModifiers();

  return Object.values(state.allianceExitPenaltiesById ?? {})
    .filter((penalty) => penalty.playerId === playerId && Date.parse(penalty.penaltyEndsAt) > now)
    .reduce((modifiers, penalty) => ({
      attackMultiplier: modifiers.attackMultiplier * resolveMultiplier(penalty.attackMultiplier),
      defenseMultiplier: modifiers.defenseMultiplier * resolveMultiplier(penalty.defenseMultiplier),
      productionMultiplier: modifiers.productionMultiplier * resolveMultiplier(penalty.productionMultiplier),
      incomeMultiplier: modifiers.incomeMultiplier * resolveMultiplier(penalty.incomeMultiplier),
      influenceGenerationMultiplier: modifiers.influenceGenerationMultiplier * resolveMultiplier(penalty.influenceGenerationMultiplier),
      actionCooldownMultiplier: modifiers.actionCooldownMultiplier * resolveMultiplier(penalty.actionCooldownMultiplier)
    }), createDefaultAlliancePenaltyStatModifiers());
};

const resolveMultiplier = (value: number | undefined): number => {
  const multiplier = Number(value);
  return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
};
