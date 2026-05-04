import type { AttackWeaponId, DefenseWeaponId } from "@empire/shared-types";
import type { FitnessClubBalanceConfig, FixedBuildingBalanceConfig, RecruitmentCenterBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { resolveRecruitmentCenterSupportBonuses } from "./recruitmentCenterBuildingActions";

export interface FitnessClubNetworkMultipliers {
  incomeMultiplier: number;
  heatMultiplier: number;
}

export interface FitnessClubSupportBonuses {
  ownedCount: number;
  attackStrengthBonusPct: number;
  defenseStrengthBonusPct: number;
  combinedRecruitmentFitnessAttackCapPct: number;
  combinedRecruitmentFitnessDefenseCapPct: number;
  attackApplication: Record<string, number>;
  defenseApplication: Record<string, number>;
}

export const getOwnedFitnessClubCount = (
  state: CoreGameState,
  playerId: string,
  config: FitnessClubBalanceConfig
): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;

export const resolveFitnessClubNetworkMultipliers = (
  count: number,
  config: FitnessClubBalanceConfig
): FitnessClubNetworkMultipliers => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return {
    incomeMultiplier: Math.min(config.network.maxIncomeMultiplier, 1 + extra * config.network.incomeBonusPctPerExtraClub / 100),
    heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraClub / 100)
  };
};

export const resolveFitnessClubSupportBonuses = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: FitnessClubBalanceConfig;
}): FitnessClubSupportBonuses => {
  if (!input.config || !input.playerId) {
    return createEmptySupportBonuses(input.config);
  }
  const ownedCount = getOwnedFitnessClubCount(input.state, input.playerId, input.config);
  return {
    ownedCount,
    attackStrengthBonusPct: Math.min(
      input.config.combatConditioning.maxAttackStrengthBonusPct,
      ownedCount * input.config.combatConditioning.attackStrengthBonusPctPerClub
    ),
    defenseStrengthBonusPct: Math.min(
      input.config.combatConditioning.maxDefenseStrengthBonusPct,
      ownedCount * input.config.combatConditioning.defenseStrengthBonusPctPerClub
    ),
    combinedRecruitmentFitnessAttackCapPct: input.config.combatConditioning.combinedRecruitmentFitnessAttackCapPct,
    combinedRecruitmentFitnessDefenseCapPct: input.config.combatConditioning.combinedRecruitmentFitnessDefenseCapPct,
    attackApplication: { ...input.config.combatConditioning.attackApplication },
    defenseApplication: { ...input.config.combatConditioning.defenseApplication }
  };
};

export const resolveFitnessAttackWeaponModifiers = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  fitnessConfig?: FitnessClubBalanceConfig;
  recruitmentCenterConfig?: RecruitmentCenterBalanceConfig;
}): Partial<Record<AttackWeaponId, number>> => {
  const recruitment = resolveRecruitmentCenterSupportBonuses({
    state: input.state,
    playerId: input.playerId,
    config: input.recruitmentCenterConfig
  });
  const fitness = resolveFitnessClubSupportBonuses({
    state: input.state,
    playerId: input.playerId,
    config: input.fitnessConfig
  });
  const keys: AttackWeaponId[] = ["baseball-bat", "pistol", "grenade", "smg", "bazooka"];
  return Object.fromEntries(keys.map((weaponId) => {
    const scale = Math.max(0, Number(fitness.attackApplication[weaponId] ?? 0));
    const combinedBonusPct = Math.min(
      fitness.combinedRecruitmentFitnessAttackCapPct,
      recruitment.attackWeaponStrengthBonusPct + fitness.attackStrengthBonusPct * scale
    );
    return [weaponId, 1 + combinedBonusPct / 100];
  })) as Partial<Record<AttackWeaponId, number>>;
};

export const resolveFitnessDefenseItemModifiers = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  fitnessConfig?: FitnessClubBalanceConfig;
  recruitmentCenterConfig?: RecruitmentCenterBalanceConfig;
  baseModifiers: Partial<Record<DefenseWeaponId, number>>;
}): Partial<Record<DefenseWeaponId, number>> => {
  const recruitment = resolveRecruitmentCenterSupportBonuses({
    state: input.state,
    playerId: input.playerId,
    config: input.recruitmentCenterConfig
  });
  const fitness = resolveFitnessClubSupportBonuses({
    state: input.state,
    playerId: input.playerId,
    config: input.fitnessConfig
  });
  const keys: DefenseWeaponId[] = ["vest", "barricades", "cameras", "defense-tower", "alarm"];
  return Object.fromEntries(keys.map((itemId) => {
    const baseModifier = Math.max(0, Number(input.baseModifiers[itemId] ?? 1));
    if (itemId === "cameras" || itemId === "alarm") {
      return [itemId, baseModifier];
    }
    const scale = Math.max(0, Number(fitness.defenseApplication[itemId] ?? 0));
    const combinedBonusPct = Math.min(
      fitness.combinedRecruitmentFitnessDefenseCapPct,
      recruitment.defenseItemStrengthBonusPct + fitness.defenseStrengthBonusPct * scale
    );
    return [itemId, baseModifier * (1 + combinedBonusPct / 100)];
  })) as Partial<Record<DefenseWeaponId, number>>;
};

export const applyFitnessClubIncomeModifiers = (input: {
  config: FitnessClubBalanceConfig;
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}): FixedBuildingBalanceConfig => {
  if (input.building.buildingTypeId !== input.config.buildingTypeId || !input.building.ownerPlayerId) {
    return {
      cleanPerHour: input.cleanPerHour,
      dirtyPerHour: input.dirtyPerHour,
      heatPerDay: input.heatPerDay,
      influencePerDay: input.influencePerDay,
      maxLevel: 1
    };
  }
  const network = resolveFitnessClubNetworkMultipliers(getOwnedFitnessClubCount(input.state, input.building.ownerPlayerId, input.config), input.config);
  return {
    cleanPerHour: input.cleanPerHour * network.incomeMultiplier,
    dirtyPerHour: 0,
    heatPerDay: input.heatPerDay * network.heatMultiplier,
    influencePerDay: 0,
    maxLevel: 1
  };
};

const createEmptySupportBonuses = (config?: FitnessClubBalanceConfig): FitnessClubSupportBonuses => ({
  ownedCount: 0,
  attackStrengthBonusPct: 0,
  defenseStrengthBonusPct: 0,
  combinedRecruitmentFitnessAttackCapPct: config?.combatConditioning.combinedRecruitmentFitnessAttackCapPct ?? 30,
  combinedRecruitmentFitnessDefenseCapPct: config?.combatConditioning.combinedRecruitmentFitnessDefenseCapPct ?? 24,
  attackApplication: config ? { ...config.combatConditioning.attackApplication } : {},
  defenseApplication: config ? { ...config.combatConditioning.defenseApplication } : {}
});
