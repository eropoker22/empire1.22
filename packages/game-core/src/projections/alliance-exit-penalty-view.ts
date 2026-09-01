import type { AllianceBoardReadModel } from "@empire/shared-types";
import type { getAllianceLifecycleConfig } from "../rules/alliances/allianceLifecycle";

export const createAllianceExitPenaltyView = (
  penalty: ReturnType<typeof getAllianceLifecycleConfig>["voluntaryLeavePenalty"]
): AllianceBoardReadModel["exitConsequences"]["voluntaryLeave"] => ({
  allianceJoinLockoutSeconds: penalty.allianceJoinLockoutSeconds,
  allianceCreateLockoutSeconds: penalty.allianceCreateLockoutSeconds,
  influenceDebuffSeconds: penalty.influenceDebuffSeconds,
  actionCooldownDebuffSeconds: penalty.actionCooldownDebuffSeconds,
  statDebuffSeconds: penalty.statDebuffSeconds ?? 0,
  formerAllyTruceSeconds: penalty.formerAllyTruceSeconds,
  influenceGenerationMultiplier: penalty.influenceGenerationMultiplier,
  actionCooldownMultiplier: penalty.actionCooldownMultiplier,
  attackMultiplier: penalty.attackMultiplier ?? 1,
  defenseMultiplier: penalty.defenseMultiplier ?? 1,
  productionMultiplier: penalty.productionMultiplier ?? 1,
  incomeMultiplier: penalty.incomeMultiplier ?? 1,
  blocksAllianceDefenseSupport: penalty.blocksAllianceDefenseSupport
});
