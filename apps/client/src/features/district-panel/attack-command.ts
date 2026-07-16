import type { AttackDistrictCommand, AttackWeaponId, GameplaySliceView } from "@empire/shared-types";

export interface CreateAttackDistrictCommandInput {
  commandId: string;
  slice: GameplaySliceView;
  targetDistrictId: string;
  issuedAt: string;
  weapons: Partial<Record<AttackWeaponId, number>>;
  expectedSourceVersion?: number;
  expectedTargetVersion?: number;
  clientRequestId?: string | null;
}

/**
 * Responsibility: Builds one attack command strictly from the current server-fed district slice.
 * Belongs here: typed command construction only.
 * Does not belong here: attack validation or result prediction.
 */
export const createAttackDistrictCommand = (
  input: CreateAttackDistrictCommandInput
): AttackDistrictCommand => {
  const district = input.slice.district;
  const target = district?.attackTargets.find((entry) => entry.districtId === input.targetDistrictId);
  const corridor = input.slice.frontier?.corridorTargets.find((entry) => entry.targetDistrictId === input.targetDistrictId);

  if (!district) {
    throw new Error("Attack command cannot be created from missing district/target context.");
  }
  const expectedSourceVersion = input.expectedSourceVersion ?? target?.expectedSourceVersion;
  const expectedTargetVersion = input.expectedTargetVersion ?? target?.expectedTargetVersion;

  return {
    id: input.commandId,
    type: "attack-district",
    mode: input.slice.mode.mode,
    playerId: input.slice.player.playerId,
    serverInstanceId: input.slice.player.instanceId,
    issuedAt: input.issuedAt,
    payload: {
      districtId: input.targetDistrictId,
      sourceDistrictId: corridor?.sourceDistrictId ?? district.districtId,
      weapons: { ...input.weapons },
      ...(typeof expectedSourceVersion === "number" ? { expectedSourceVersion } : {}),
      ...(typeof expectedTargetVersion === "number" ? { expectedTargetVersion } : {}),
      expectedConflictRevision: target?.expectedConflictRevision
        ?? (() => { throw new Error("Attack target is missing a conflict revision."); })(),
      ...(corridor ? { routeDistrictId: corridor.routeDistrictId, expectedRouteVersion: corridor.routeVersion } : {})
    },
    clientRequestId: input.clientRequestId ?? null
  };
};
