import type {
  GameplaySliceView,
  HeistDistrictCommand,
  HeistDistrictStyle
} from "@empire/shared-types";

export interface CreateHeistDistrictCommandInput {
  commandId: string;
  slice: GameplaySliceView;
  targetDistrictId: string;
  issuedAt: string;
  clientRequestId?: string | null;
}

export const createHeistDistrictCommand = (
  input: CreateHeistDistrictCommandInput
): HeistDistrictCommand => {
  const district = input.slice.district;
  const target = district?.heistTargets?.find((entry) => entry.districtId === input.targetDistrictId);
  const styleFallback = { style: "balanced" as HeistDistrictStyle, defaultGangMembersSent: 1 };
  const style = target?.styles.find((entry) => entry.style === "balanced") ?? target?.styles[0] ?? styleFallback;
  const corridor = input.slice.frontier?.corridorTargets.find((entry) => entry.targetDistrictId === input.targetDistrictId);

  if (!district) {
    throw new Error("Heist command cannot be created from missing district/target context.");
  }

  return {
    id: input.commandId,
    type: "heist-district",
    mode: input.slice.mode.mode,
    playerId: input.slice.player.playerId,
    serverInstanceId: input.slice.player.instanceId,
    issuedAt: input.issuedAt,
    payload: {
      targetDistrictId: input.targetDistrictId,
      sourceDistrictId: corridor?.sourceDistrictId ?? district.districtId,
      style: style.style,
      gangMembersSent: style.defaultGangMembersSent,
      ...(target?.expectedTargetVersion !== undefined ? { expectedTargetVersion: target.expectedTargetVersion } : {}),
      ...(target?.expectedSourceVersion !== undefined ? { expectedSourceVersion: target.expectedSourceVersion } : {}),
      ...(corridor ? { routeDistrictId: corridor.routeDistrictId, expectedRouteVersion: corridor.routeVersion } : {})
    },
    clientRequestId: input.clientRequestId ?? null
  };
};
