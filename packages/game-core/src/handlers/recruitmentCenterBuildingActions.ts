import type { FixedBuildingBalanceConfig, PowerStationBalanceConfig, RecruitmentCenterBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { resolvePowerStationDefenseBonuses } from "./powerStationBuildingActions";

export interface RecruitmentCenterNetworkMultipliers {
  incomeMultiplier: number;
  heatMultiplier: number;
}

export interface RecruitmentCenterSupportBonuses {
  populationProductionBonusPct: number;
  apartmentCapacityBonusPct: number;
  attackWeaponStrengthBonusPct: number;
  defenseItemStrengthBonusPct: number;
  cameraStrengthBonusPct: number;
  alarmStrengthBonusPct: number;
  combinedCameraAlarmCapPct: number;
}

export const getOwnedRecruitmentCenterCount = (
  state: CoreGameState,
  playerId: string,
  config: RecruitmentCenterBalanceConfig
): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;

export const resolveRecruitmentCenterNetworkMultipliers = (
  count: number,
  config: RecruitmentCenterBalanceConfig
): RecruitmentCenterNetworkMultipliers => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return {
    incomeMultiplier: Math.min(config.network.maxIncomeMultiplier, 1 + extra * config.network.incomeBonusPctPerExtraCenter / 100),
    heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraCenter / 100)
  };
};

export const resolveRecruitmentCenterSupportBonuses = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: RecruitmentCenterBalanceConfig;
}): RecruitmentCenterSupportBonuses => {
  if (!input.config || !input.playerId) {
    return createEmptySupportBonuses(input.config);
  }
  const count = getOwnedRecruitmentCenterCount(input.state, input.playerId, input.config);
  const populationProductionBonusPct = Math.min(
    input.config.populationSupport.maxPopulationProductionBonusPct,
    count * input.config.populationSupport.populationProductionBonusPctPerCenter
  );
  const apartmentCapacityBonusPct = Math.min(
    input.config.populationSupport.maxApartmentCapacityBonusPct,
    count * input.config.populationSupport.apartmentCapacityBonusPctPerCenter
  );
  const attackWeaponStrengthBonusPct = Math.min(
    input.config.combatSupport.maxAttackWeaponStrengthBonusPct,
    count * input.config.combatSupport.attackWeaponStrengthBonusPctPerCenter
  );
  const defenseItemStrengthBonusPct = Math.min(
    input.config.combatSupport.maxDefenseItemStrengthBonusPct,
    count * input.config.combatSupport.defenseItemStrengthBonusPctPerCenter
  );

  return {
    populationProductionBonusPct,
    apartmentCapacityBonusPct,
    attackWeaponStrengthBonusPct,
    defenseItemStrengthBonusPct,
    cameraStrengthBonusPct: defenseItemStrengthBonusPct,
    alarmStrengthBonusPct: defenseItemStrengthBonusPct,
    combinedCameraAlarmCapPct: input.config.combatSupport.maxCombinedCameraAlarmBonusPct
  };
};

export const resolveCombinedCameraAlarmBonuses = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  recruitmentCenterConfig?: RecruitmentCenterBalanceConfig;
  powerStationConfig?: PowerStationBalanceConfig;
  tick: number;
}): { cameraStrengthBonusPct: number; alarmStrengthBonusPct: number; recruitmentBonuses: RecruitmentCenterSupportBonuses } => {
  const recruitmentBonuses = resolveRecruitmentCenterSupportBonuses({
    state: input.state,
    playerId: input.playerId,
    config: input.recruitmentCenterConfig
  });
  const powerBonuses = resolvePowerStationDefenseBonuses({
    state: input.state,
    playerId: input.playerId,
    config: input.powerStationConfig,
    tick: input.tick
  });
  const cap = recruitmentBonuses.combinedCameraAlarmCapPct;
  return {
    cameraStrengthBonusPct: Math.min(cap, powerBonuses.cameraStrengthBonusPct + recruitmentBonuses.cameraStrengthBonusPct),
    alarmStrengthBonusPct: Math.min(cap, powerBonuses.alarmStrengthBonusPct + recruitmentBonuses.alarmStrengthBonusPct),
    recruitmentBonuses
  };
};

export const applyRecruitmentCenterIncomeModifiers = (input: {
  config: RecruitmentCenterBalanceConfig;
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
  const network = resolveRecruitmentCenterNetworkMultipliers(getOwnedRecruitmentCenterCount(input.state, input.building.ownerPlayerId, input.config), input.config);
  return {
    cleanPerHour: input.cleanPerHour * network.incomeMultiplier,
    dirtyPerHour: 0,
    heatPerDay: input.heatPerDay * network.heatMultiplier,
    influencePerDay: 0,
    maxLevel: 1
  };
};

const createEmptySupportBonuses = (config?: RecruitmentCenterBalanceConfig): RecruitmentCenterSupportBonuses => ({
  populationProductionBonusPct: 0,
  apartmentCapacityBonusPct: 0,
  attackWeaponStrengthBonusPct: 0,
  defenseItemStrengthBonusPct: 0,
  cameraStrengthBonusPct: 0,
  alarmStrengthBonusPct: 0,
  combinedCameraAlarmCapPct: config?.combatSupport.maxCombinedCameraAlarmBonusPct ?? 50
});
