import type { CoreGameState } from "../../entities";

export const spendPlayerInfluence = ({
  state,
  playerId,
  preferredDistrictId,
  amount
}: {
  state: CoreGameState;
  playerId: string;
  preferredDistrictId?: string;
  amount: number;
}): CoreGameState["districtsById"] => {
  let remaining = Math.max(0, Number(amount) || 0);
  const eligibleDistricts = Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === playerId && district.status !== "destroyed")
    .sort((left, right) => {
      if (left.id === preferredDistrictId) return -1;
      if (right.id === preferredDistrictId) return 1;
      return left.id.localeCompare(right.id);
    });
  let nextDistricts = state.districtsById;

  for (const district of eligibleDistricts) {
    if (remaining <= 0) break;
    const available = Math.max(0, Number(district.influence || 0));
    const spent = Math.min(available, remaining);
    if (spent <= 0) continue;
    if (nextDistricts === state.districtsById) nextDistricts = { ...state.districtsById };
    nextDistricts[district.id] = {
      ...district,
      influence: available - spent,
      version: district.version + 1
    };
    remaining -= spent;
  }

  return nextDistricts;
};

