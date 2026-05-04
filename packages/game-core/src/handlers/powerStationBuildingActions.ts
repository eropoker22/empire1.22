import type { BuildingActionBalanceConfig, FixedBuildingBalanceConfig, PowerStationBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";

export type PowerStationInfrastructureTarget =
  | "factoryProductionSpeed"
  | "armoryProductionSpeed"
  | "warehouseStorageCapacity"
  | "clinicRecoveryRate"
  | "casinoIncome"
  | "arcadeIncome"
  | "exchangeIncome"
  | "stripClubIncome"
  | "apartmentPopulationProduction";

export interface PowerStationNetworkMultipliers {
  infrastructureBonusPct: number;
  incomeMultiplier: number;
  heatMultiplier: number;
  cameraStrengthBonusPct: number;
  alarmStrengthBonusPct: number;
}

export interface PowerStationActionResolution {
  balances: Record<string, number>;
  buildingMetadata: Record<string, unknown>;
  heatGain: number;
  influenceChange: number;
  outputGain: Record<string, number>;
  inputCost: Record<string, number>;
  effectModifiers?: BuildingActionBalanceConfig["effectModifiers"];
  reportText: string;
  powerStationResult: Record<string, unknown>;
}

interface PowerStationMetadata {
  backupGridSwitchExpiresAtTick?: number;
}

const INCOME_TARGET_BY_BUILDING_TYPE: Record<string, PowerStationInfrastructureTarget | undefined> = {
  casino: "casinoIncome",
  arcade: "arcadeIncome",
  exchange: "exchangeIncome",
  strip_club: "stripClubIncome"
};

export const getOwnedPowerStationCount = (
  state: CoreGameState,
  playerId: string,
  config: PowerStationBalanceConfig
): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;

export const resolvePowerStationNetworkMultipliers = (
  count: number,
  config: PowerStationBalanceConfig
): PowerStationNetworkMultipliers => {
  const safeCount = Math.max(0, Math.floor(Number(count || 0)));
  const extra = Math.max(0, safeCount - 1);
  return {
    infrastructureBonusPct: Math.min(config.infrastructure.maxBonusPct, safeCount * config.infrastructure.bonusPctPerStation),
    incomeMultiplier: Math.min(config.network.maxIncomeMultiplier, 1 + extra * config.network.incomeBonusPctPerExtraStation / 100),
    heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraStation / 100),
    cameraStrengthBonusPct: Math.min(config.defense.maxCameraStrengthBonusPct, safeCount * config.defense.cameraStrengthBonusPctPerStation),
    alarmStrengthBonusPct: Math.min(config.defense.maxAlarmStrengthBonusPct, safeCount * config.defense.alarmStrengthBonusPctPerStation)
  };
};

export const getPowerStationMetadata = (
  building: CoreGameState["buildingsById"][string]
): PowerStationMetadata => {
  const raw = isRecord(building.metadata?.powerStation) ? building.metadata.powerStation : {};
  return {
    backupGridSwitchExpiresAtTick: asOptionalTick(raw.backupGridSwitchExpiresAtTick)
  };
};

export const isPowerStationBackupGridActiveForPlayer = (
  state: CoreGameState,
  playerId: string,
  config: PowerStationBalanceConfig,
  tick: number
): boolean =>
  Object.values(state.buildingsById).some((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
    && (getPowerStationMetadata(building).backupGridSwitchExpiresAtTick ?? 0) > tick
  );

export const resolvePowerStationInfrastructureBonusPct = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: PowerStationBalanceConfig;
  tick: number;
}): number => {
  if (!input.config || !input.playerId) {
    return 0;
  }
  const base = resolvePowerStationNetworkMultipliers(
    getOwnedPowerStationCount(input.state, input.playerId, input.config),
    input.config
  ).infrastructureBonusPct;
  const temporary = isPowerStationBackupGridActiveForPlayer(input.state, input.playerId, input.config, input.tick)
    ? input.config.backupGridSwitch.temporaryInfrastructureBonusPct
    : 0;
  return Math.max(0, base + temporary);
};

export const resolvePowerStationInfrastructureMultiplier = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: PowerStationBalanceConfig;
  tick: number;
  target: PowerStationInfrastructureTarget;
}): number => {
  if (!input.config || !input.playerId) {
    return 1;
  }
  const infrastructureBonusPct = resolvePowerStationInfrastructureBonusPct(input);
  const weightedBonusPct = infrastructureBonusPct * input.config.infrastructure.weights[input.target];
  const directBonusPct = isPowerStationBackupGridActiveForPlayer(input.state, input.playerId, input.config, input.tick)
    ? resolveBackupDirectBonusPct(input.config, input.target)
    : 0;
  return 1 + (weightedBonusPct + directBonusPct) / 100;
};

export const resolvePowerStationDefenseBonuses = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: PowerStationBalanceConfig;
  tick: number;
}): { cameraStrengthBonusPct: number; alarmStrengthBonusPct: number } => {
  if (!input.config || !input.playerId) {
    return { cameraStrengthBonusPct: 0, alarmStrengthBonusPct: 0 };
  }
  const network = resolvePowerStationNetworkMultipliers(
    getOwnedPowerStationCount(input.state, input.playerId, input.config),
    input.config
  );
  const backupActive = isPowerStationBackupGridActiveForPlayer(input.state, input.playerId, input.config, input.tick);
  return {
    cameraStrengthBonusPct: network.cameraStrengthBonusPct + (backupActive ? input.config.backupGridSwitch.cameraStrengthBonusPct : 0),
    alarmStrengthBonusPct: network.alarmStrengthBonusPct + (backupActive ? input.config.backupGridSwitch.alarmStrengthBonusPct : 0)
  };
};

export const applyPowerStationIncomeModifiers = (input: {
  config: PowerStationBalanceConfig;
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  tick: number;
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}): FixedBuildingBalanceConfig => {
  if (!input.building.ownerPlayerId) {
    return {
      cleanPerHour: input.cleanPerHour,
      dirtyPerHour: input.dirtyPerHour,
      heatPerDay: input.heatPerDay,
      influencePerDay: input.influencePerDay,
      maxLevel: 1
    };
  }
  if (input.building.buildingTypeId === input.config.buildingTypeId) {
    const network = resolvePowerStationNetworkMultipliers(
      getOwnedPowerStationCount(input.state, input.building.ownerPlayerId, input.config),
      input.config
    );
    return {
      cleanPerHour: input.cleanPerHour * network.incomeMultiplier,
      dirtyPerHour: 0,
      heatPerDay: input.heatPerDay * network.heatMultiplier,
      influencePerDay: 0,
      maxLevel: 1
    };
  }
  const target = INCOME_TARGET_BY_BUILDING_TYPE[input.building.buildingTypeId];
  const infrastructureMultiplier = target
    ? resolvePowerStationInfrastructureMultiplier({
        state: input.state,
        playerId: input.building.ownerPlayerId,
        config: input.config,
        tick: input.tick,
        target
      })
    : 1;
  return {
    cleanPerHour: input.cleanPerHour * infrastructureMultiplier,
    dirtyPerHour: input.dirtyPerHour * infrastructureMultiplier,
    heatPerDay: input.heatPerDay,
    influencePerDay: input.influencePerDay,
    maxLevel: 1
  };
};

export const resolvePowerStationAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  balances: Record<string, number>;
  powerStationConfig: PowerStationBalanceConfig;
  tickRateMs: number;
}): PowerStationActionResolution | null => {
  const config = input.powerStationConfig;
  if (input.building.buildingTypeId !== config.buildingTypeId || input.action.actionId !== config.backupGridSwitch.actionId) {
    return null;
  }
  const metadata = cleanupPowerStationMetadata(getPowerStationMetadata(input.building), input.state.root.tick);
  metadata.backupGridSwitchExpiresAtTick = input.state.root.tick + minutesToTicks(config.backupGridSwitch.durationMinutes, input.tickRateMs);
  return {
    balances: {
      ...input.balances,
      cash: Math.max(0, Number(input.balances.cash || 0) - config.backupGridSwitch.cleanCashCost)
    },
    buildingMetadata: withPowerStationMetadata(input.building, metadata),
    heatGain: config.backupGridSwitch.heatGain,
    influenceChange: 0,
    inputCost: { cash: config.backupGridSwitch.cleanCashCost },
    outputGain: {},
    reportText: `Záložní síť aktivní ${config.backupGridSwitch.durationMinutes} minut. Infrastructure +${config.backupGridSwitch.temporaryInfrastructureBonusPct} %, kamery +${config.backupGridSwitch.cameraStrengthBonusPct} %, alarm +${config.backupGridSwitch.alarmStrengthBonusPct} %.`,
    powerStationResult: {
      type: "infrastructure_defense_boost",
      activeUntilTick: metadata.backupGridSwitchExpiresAtTick,
      temporaryInfrastructureBonusPct: config.backupGridSwitch.temporaryInfrastructureBonusPct,
      cameraStrengthBonusPct: config.backupGridSwitch.cameraStrengthBonusPct,
      alarmStrengthBonusPct: config.backupGridSwitch.alarmStrengthBonusPct,
      factoryProductionSpeedBonusPct: config.backupGridSwitch.factoryProductionSpeedBonusPct,
      armoryProductionSpeedBonusPct: config.backupGridSwitch.armoryProductionSpeedBonusPct
    }
  };
};

export const validatePowerStationAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  actionId: string;
  powerStationConfig?: PowerStationBalanceConfig;
}): string | null => {
  const config = input.powerStationConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId || input.actionId !== config.backupGridSwitch.actionId) {
    return null;
  }
  if ((getPowerStationMetadata(input.building).backupGridSwitchExpiresAtTick ?? 0) > input.state.root.tick) {
    return "power_station_backup_grid_active";
  }
  return null;
};

const resolveBackupDirectBonusPct = (
  config: PowerStationBalanceConfig,
  target: PowerStationInfrastructureTarget
): number => {
  if (target === "factoryProductionSpeed") return config.backupGridSwitch.factoryProductionSpeedBonusPct;
  if (target === "armoryProductionSpeed") return config.backupGridSwitch.armoryProductionSpeedBonusPct;
  return 0;
};

const cleanupPowerStationMetadata = (metadata: PowerStationMetadata, tick: number): PowerStationMetadata => ({
  backupGridSwitchExpiresAtTick: (metadata.backupGridSwitchExpiresAtTick ?? 0) > tick ? metadata.backupGridSwitchExpiresAtTick : undefined
});

const withPowerStationMetadata = (
  building: CoreGameState["buildingsById"][string],
  powerStation: PowerStationMetadata
): Record<string, unknown> => ({
  ...(building.metadata ?? {}),
  powerStation
});

const minutesToTicks = (minutes: number, tickRateMs: number): number =>
  Math.max(1, Math.ceil((Math.max(0, Number(minutes || 0)) * 60 * 1000) / Math.max(1, tickRateMs)));

const asOptionalTick = (value: unknown): number | undefined => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
