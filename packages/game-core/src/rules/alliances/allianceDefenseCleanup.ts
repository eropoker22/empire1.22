import type { CoreGameState } from "../../entities";

export const cleanupAllianceDefense = (
  state: CoreGameState,
  input: { allianceId: string; playerId: string; sourceEventId: string; nowIso: string }
): CoreGameState => {
  const contributions = { ...(state.allianceDefenseContributionsById ?? {}) };
  const districtsById = { ...state.districtsById };
  const resourceStatesById = { ...state.resourceStatesById };
  for (const contribution of Object.values(contributions)) {
    const shouldReturn = contribution.allianceId === input.allianceId
      && contribution.status === "active"
      && (contribution.ownerPlayerId === input.playerId || contribution.hostPlayerId === input.playerId);
    if (!shouldReturn || contribution.combatSnapshotId) continue;
    contributions[contribution.id] = {
      ...contribution,
      status: "returned",
      returnedAt: input.nowIso,
      sourceEventId: input.sourceEventId,
      version: contribution.version + 1
    };
    const district = districtsById[contribution.districtId];
    if (district) {
      const currentAmount = Number(district.defenseLoadout[contribution.itemId as keyof typeof district.defenseLoadout] ?? 0);
      districtsById[district.id] = {
        ...district,
        defenseLoadout: { ...district.defenseLoadout, [contribution.itemId]: Math.max(0, currentAmount - contribution.amount) },
        version: district.version + 1
      };
    }
    const owner = state.playersById[contribution.ownerPlayerId];
    const resource = owner ? resourceStatesById[owner.resourceStateId] : null;
    if (owner && resource) {
      const currentBalance = Math.max(0, Number(resource.balances[contribution.itemId] || 0));
      resourceStatesById[resource.id] = {
        ...resource,
        balances: { ...resource.balances, [contribution.itemId]: currentBalance + contribution.amount },
        version: resource.version + 1
      };
    }
  }
  return { ...state, districtsById, resourceStatesById, allianceDefenseContributionsById: contributions };
};
