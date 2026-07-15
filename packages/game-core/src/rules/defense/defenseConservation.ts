import type {
  AllianceDefenseCombatImpact,
  AllianceDefenseContribution,
  DefenseWeaponId
} from "@empire/shared-types";
import type { ConflictBalanceConfig } from "../../contracts";
import type { CoreGameState } from "../../entities";
import { bumpDistrictSecurityRevision } from "../../state";

const DEFAULT_ITEM_WEIGHTS: Record<DefenseWeaponId, number> = {
  vest: 1,
  barricades: 1,
  cameras: 2,
  alarm: 2,
  "defense-tower": 4
};

const isDeployedContribution = (contribution: AllianceDefenseContribution): boolean =>
  (contribution.status === "active" || contribution.status === "partially_lost")
  && contribution.remainingAmount > 0;

export const listDeployedDefenseContributions = (
  state: CoreGameState,
  districtId: string,
  itemId?: string
): AllianceDefenseContribution[] =>
  Object.values(state.allianceDefenseContributionsById ?? {})
    .filter((contribution) =>
      isDeployedContribution(contribution)
      && contribution.districtId === districtId
      && (!itemId || contribution.itemId === itemId)
    )
    .sort((left, right) => left.id.localeCompare(right.id));

export const calculateOwnerOwnedDefenseAmount = (
  state: CoreGameState,
  districtId: string,
  itemId: DefenseWeaponId
): number => {
  const total = Math.max(0, Number(state.districtsById[districtId]?.defenseLoadout[itemId] ?? 0));
  const contributed = listDeployedDefenseContributions(state, districtId, itemId)
    .reduce((sum, contribution) => sum + contribution.remainingAmount, 0);
  return Math.max(0, total - contributed);
};

export const calculateContributorDefenseAmount = (
  state: CoreGameState,
  playerId: string,
  districtId: string,
  itemId: DefenseWeaponId
): number => listDeployedDefenseContributions(state, districtId, itemId)
  .filter((contribution) => contribution.ownerPlayerId === playerId)
  .reduce((sum, contribution) => sum + contribution.remainingAmount, 0);

export const resolveDefenseCapacityPoints = (
  districtZone: string,
  config?: ConflictBalanceConfig["defenseCapacity"]
): number => {
  const resolved = config ?? {
    baseCapacityPoints: 20,
    zoneBonusPoints: { downtown: 4 },
    itemWeights: DEFAULT_ITEM_WEIGHTS
  };
  return Math.max(
    0,
    resolved.baseCapacityPoints + Number(resolved.zoneBonusPoints[districtZone.toLowerCase()] ?? 0)
  );
};

export const calculateDefenseCapacityUsage = (
  loadout: Partial<Record<DefenseWeaponId, number>>,
  config?: ConflictBalanceConfig["defenseCapacity"]
): number => {
  const weights = config?.itemWeights ?? DEFAULT_ITEM_WEIGHTS;
  return (Object.entries(weights) as Array<[DefenseWeaponId, number]>)
    .reduce((total, [itemId, weight]) =>
      total + Math.max(0, Number(loadout[itemId] ?? 0)) * Math.max(1, Number(weight)), 0);
};

export const calculateDefensePlacementPoints = (
  itemId: DefenseWeaponId,
  amount: number,
  config?: ConflictBalanceConfig["defenseCapacity"]
): number =>
  Math.max(0, amount) * Math.max(1, Number(config?.itemWeights[itemId] ?? DEFAULT_ITEM_WEIGHTS[itemId]));

export const removeContributorDefenseAmount = (
  state: CoreGameState,
  input: {
    playerId: string;
    districtId: string;
    itemId: DefenseWeaponId;
    amount: number;
    returnedAt: string;
  }
): CoreGameState["allianceDefenseContributionsById"] => {
  let remainingToReturn = input.amount;
  const next = { ...(state.allianceDefenseContributionsById ?? {}) };
  for (const contribution of listDeployedDefenseContributions(state, input.districtId, input.itemId)) {
    if (remainingToReturn <= 0 || contribution.ownerPlayerId !== input.playerId) continue;
    const returned = Math.min(remainingToReturn, contribution.remainingAmount);
    remainingToReturn -= returned;
    const remainingAmount = contribution.remainingAmount - returned;
    next[contribution.id] = {
      ...contribution,
      remainingAmount,
      returnedAmount: contribution.returnedAmount + returned,
      status: remainingAmount === 0
        ? "returned"
        : contribution.lostAmount > 0
          ? "partially_lost"
          : "active",
      returnedAt: remainingAmount === 0 ? input.returnedAt : contribution.returnedAt,
      version: contribution.version + 1
    };
  }
  return next;
};

export const applyDefenseCombatLosses = (
  state: CoreGameState,
  input: {
    districtId: string;
    losses: Partial<Record<DefenseWeaponId, number>>;
    snapshotId: string;
    createdAtTick: number;
  }
): CoreGameState => {
  if (state.allianceDefenseCombatSnapshotsById?.[input.snapshotId]) return state;
  const district = state.districtsById[input.districtId];
  if (!district) return state;

  const contributions = { ...(state.allianceDefenseContributionsById ?? {}) };
  const contributionImpacts: AllianceDefenseCombatImpact[] = [];
  const actualLosses: Record<string, number> = {};
  const ownerLosses: Record<string, number> = {};

  for (const [rawItemId, rawLoss] of Object.entries(input.losses)) {
    const itemId = rawItemId as DefenseWeaponId;
    const deployed = Math.max(0, Number(district.defenseLoadout[itemId] ?? 0));
    const loss = Math.min(deployed, Math.max(0, Math.floor(Number(rawLoss ?? 0))));
    if (loss <= 0) continue;

    const active = listDeployedDefenseContributions(state, district.id, itemId);
    const contributed = active.reduce((sum, contribution) => sum + contribution.remainingAmount, 0);
    const ownerAmount = Math.max(0, deployed - contributed);
    const buckets = [
      ...(ownerAmount > 0 ? [{ id: `owner:${district.id}:${itemId}`, amount: ownerAmount }] : []),
      ...active.map((contribution) => ({ id: contribution.id, amount: contribution.remainingAmount }))
    ];
    const allocations = allocateProportionalLoss(loss, buckets);

    ownerLosses[itemId] = allocations.get(`owner:${district.id}:${itemId}`) ?? 0;
    actualLosses[itemId] = loss;
    for (const contribution of active) {
      const allocated = allocations.get(contribution.id) ?? 0;
      if (allocated <= 0) continue;
      const remainingAmount = contribution.remainingAmount - allocated;
      contributions[contribution.id] = {
        ...contribution,
        remainingAmount,
        lostAmount: contribution.lostAmount + allocated,
        status: remainingAmount === 0 ? "depleted" : "partially_lost",
        combatSnapshotId: input.snapshotId,
        version: contribution.version + 1
      };
      contributionImpacts.push({
        contributionId: contribution.id,
        lostAmount: allocated,
        remainingAmount
      });
    }
  }

  const defenseLoadout = { ...district.defenseLoadout };
  for (const [rawItemId, loss] of Object.entries(actualLosses)) {
    const itemId = rawItemId as DefenseWeaponId;
    defenseLoadout[itemId] = Math.max(0, Number(defenseLoadout[itemId] ?? 0) - loss);
  }
  const nextDistrict = bumpDistrictSecurityRevision({
    ...district,
    defenseLoadout,
    version: district.version + 1
  });

  return {
    ...state,
    districtsById: { ...state.districtsById, [district.id]: nextDistrict },
    allianceDefenseContributionsById: contributions,
    allianceDefenseCombatSnapshotsById: {
      ...(state.allianceDefenseCombatSnapshotsById ?? {}),
      [input.snapshotId]: {
        id: input.snapshotId,
        districtId: district.id,
        losses: actualLosses,
        ownerLosses,
        contributionImpacts,
        createdAtTick: input.createdAtTick,
        version: 1
      }
    }
  };
};

const allocateProportionalLoss = (
  loss: number,
  buckets: Array<{ id: string; amount: number }>
): Map<string, number> => {
  const total = buckets.reduce((sum, bucket) => sum + bucket.amount, 0);
  if (loss <= 0 || total <= 0) return new Map();
  const rows = buckets.map((bucket) => {
    const exact = loss * bucket.amount / total;
    return { ...bucket, allocated: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let undistributed = loss - rows.reduce((sum, row) => sum + row.allocated, 0);
  for (const row of [...rows].sort((left, right) =>
    right.remainder - left.remainder || left.id.localeCompare(right.id)
  )) {
    if (undistributed <= 0) break;
    if (row.allocated < row.amount) {
      row.allocated += 1;
      undistributed -= 1;
    }
  }
  return new Map(rows.map((row) => [row.id, row.allocated]));
};
