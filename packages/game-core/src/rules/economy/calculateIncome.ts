import type { CoreGameState } from "../../entities";
import type { BuildingActionEffectModifiers, FixedBuildingBalanceConfig } from "../../contracts";
import type { GameCoreContext } from "../../engine/context";
import { applyCarDealerIncomeModifiers } from "../../handlers/carDealerBuildingActions";
import { applyArcadeIncomeModifiers } from "../../handlers/arcadeBuildingActions";
import { applyCasinoIncomeModifiers } from "../../handlers/casinoBuildingActions";
import { applyClinicIncomeModifiers } from "../../handlers/clinicBuildingActions";
import { applyConvenienceStoreIncomeModifiers } from "../../handlers/convenienceStoreBuildingActions";
import { applyExchangeOfficeIncomeModifiers } from "../../handlers/exchangeOfficeBuildingActions";
import { applyFitnessClubIncomeModifiers } from "../../handlers/fitnessClubBuildingActions";
import { applyGarageIncomeModifiers } from "../../handlers/garageBuildingActions";
import { applyPowerStationIncomeModifiers } from "../../handlers/powerStationBuildingActions";
import { applyRecruitmentCenterIncomeModifiers } from "../../handlers/recruitmentCenterBuildingActions";
import { applyRecyclingCenterIncomeModifiers } from "../../handlers/recyclingCenterBuildingActions";
import { applyRestaurantIncomeModifiers } from "../../handlers/restaurantBuildingActions";
import { applyShoppingMallIncomeModifiers } from "../../handlers/shoppingMallBuildingActions";
import { applySmugglingTunnelIncomeModifiers } from "../../handlers/smugglingTunnelBuildingActions";
import { applyStripClubIncomeModifiers } from "../../handlers/stripClubBuildingActions";
import { applyWarehouseIncomeModifiers } from "../../handlers/warehouseBuilding";

const HOUR_MS = 60 * 60 * 1000;

export interface ResolvedDistrictEffectModifiers {
  incomeMultiplier: number;
  cleanIncomeMultiplier: number;
  dirtyIncomeMultiplier: number;
  influenceMultiplier: number;
  heatMultiplier: number;
  influencePerDay: number;
  heatPerDay: number;
  attackMultiplier: number;
  defenseMultiplier: number;
}

export interface ActiveFixedBuildingConfig {
  building: CoreGameState["buildingsById"][string];
  config: FixedBuildingBalanceConfig;
}

/**
 * Responsibility: Calculates income from authoritative state and resolved config.
 * Belongs here: pure economy math and server-side derivations.
 * Does not belong here: persistence writes or client formatting.
 */
export const calculateIncome = (state: CoreGameState, context?: GameCoreContext): number =>
  Object.values(calculateIncomeByPlayerId(state, context)).reduce(
    (total, balances) =>
      total + Object.values(balances).reduce((playerTotal, amount) => playerTotal + amount, 0),
    0
  );

export const calculateIncomeByPlayerId = (
  state: CoreGameState,
  context?: GameCoreContext
): Record<string, Record<string, number>> => {
  const incomeByPlayerId: Record<string, Record<string, number>> = {};

  for (const district of Object.values(state.districtsById)) {
    if (!district.ownerPlayerId || district.status === "destroyed") {
      continue;
    }

    for (const [resourceKey, rawAmount] of Object.entries(district.resourceModifiers)) {
      addIncome(incomeByPlayerId, district.ownerPlayerId, resourceKey, rawAmount);
    }

    if (!context) {
      continue;
    }

    const fixedBuildingIncome = calculateFixedBuildingIncomeForDistrict(state, district, context);
    addIncome(incomeByPlayerId, district.ownerPlayerId, "cash", fixedBuildingIncome.cash);
    addIncome(incomeByPlayerId, district.ownerPlayerId, "dirty-cash", fixedBuildingIncome.dirtyCash);
  }

  return incomeByPlayerId;
};

export const getActiveFixedBuildingConfigsForDistrict = (
  state: CoreGameState,
  district: CoreGameState["districtsById"][string],
  context: GameCoreContext
): ActiveFixedBuildingConfig[] => {
  const fixedBuildings = context.config.balance.fixedBuildings;
  if (!fixedBuildings || !district.ownerPlayerId || district.status === "destroyed") {
    return [];
  }

  return district.buildingIds.flatMap((buildingId) => {
    const building = state.buildingsById[buildingId];
    if (!building || building.status !== "active" || building.ownerPlayerId !== district.ownerPlayerId) {
      return [];
    }

    const config = fixedBuildings[building.buildingTypeId];
    return config ? [{ building, config }] : [];
  });
};

export const resolveActiveDistrictEffectModifiers = (
  state: CoreGameState,
  districtId: string
): ResolvedDistrictEffectModifiers => {
  const effectStates = Object.values(state.effectStatesById).filter(
    (effectState) => effectState.ownerType === "district" && effectState.ownerId === districtId
  );
  const resolved = createDefaultDistrictEffectModifiers();

  for (const effectState of effectStates) {
    for (const effect of effectState.effects) {
      if (effect.expiresAtTick !== null && effect.expiresAtTick <= state.root.tick) {
        continue;
      }

      const modifiers = extractEffectModifiers(effect.payload);
      multiplyModifier(resolved, "incomeMultiplier", modifiers.incomeMultiplier);
      multiplyModifier(resolved, "cleanIncomeMultiplier", modifiers.cleanIncomeMultiplier);
      multiplyModifier(resolved, "dirtyIncomeMultiplier", modifiers.dirtyIncomeMultiplier);
      multiplyModifier(resolved, "influenceMultiplier", modifiers.influenceMultiplier);
      multiplyModifier(resolved, "heatMultiplier", modifiers.heatMultiplier);
      multiplyModifier(resolved, "attackMultiplier", modifiers.attackMultiplier);
      multiplyModifier(resolved, "defenseMultiplier", modifiers.defenseMultiplier);
      addModifier(resolved, "influencePerDay", modifiers.influencePerDay);
      addModifier(resolved, "heatPerDay", modifiers.heatPerDay);
    }
  }

  return resolved;
};

export const createDefaultDistrictEffectModifiers = (): ResolvedDistrictEffectModifiers => ({
  incomeMultiplier: 1,
  cleanIncomeMultiplier: 1,
  dirtyIncomeMultiplier: 1,
  influenceMultiplier: 1,
  heatMultiplier: 1,
  influencePerDay: 0,
  heatPerDay: 0,
  attackMultiplier: 1,
  defenseMultiplier: 1
});

const calculateFixedBuildingIncomeForDistrict = (
  state: CoreGameState,
  district: CoreGameState["districtsById"][string],
  context: GameCoreContext
): { cash: number; dirtyCash: number } => {
  const activeBuildings = getActiveFixedBuildingConfigsForDistrict(state, district, context);
  if (activeBuildings.length === 0) {
    return { cash: 0, dirtyCash: 0 };
  }

  const ticksPerHour = HOUR_MS / Math.max(1, context.config.tickRateMs);
  const modifiers = resolveActiveDistrictEffectModifiers(state, district.id);
  const incomeMultiplier = Math.max(0, Number(context.config.balance.incomeMultiplier || 0)) * modifiers.incomeMultiplier;

  return activeBuildings.reduce(
    (totals, { building, config }) => {
      const casinoConfig = context.config.balance.casino
        ? applyCasinoIncomeModifiers({
            config: context.config.balance.casino,
            building,
            tick: state.root.tick,
            cleanPerHour: config.cleanPerHour,
            dirtyPerHour: config.dirtyPerHour,
            heatPerDay: config.heatPerDay,
            influencePerDay: config.influencePerDay
          })
        : config;
      const activeConfig = context.config.balance.exchangeOffice
        ? applyExchangeOfficeIncomeModifiers({
            config: context.config.balance.exchangeOffice,
            state,
            building,
            tick: state.root.tick,
            cleanPerHour: casinoConfig.cleanPerHour,
            dirtyPerHour: casinoConfig.dirtyPerHour,
            heatPerDay: casinoConfig.heatPerDay,
            influencePerDay: casinoConfig.influencePerDay
          })
        : casinoConfig;
      const finalConfig = context.config.balance.arcade
        ? applyArcadeIncomeModifiers({
            config: context.config.balance.arcade,
            state,
            building,
            tick: state.root.tick,
            cleanPerHour: activeConfig.cleanPerHour,
            dirtyPerHour: activeConfig.dirtyPerHour,
            heatPerDay: activeConfig.heatPerDay,
            influencePerDay: activeConfig.influencePerDay
          })
        : activeConfig;
      const warehouseConfig = context.config.balance.warehouse
        ? applyWarehouseIncomeModifiers({
            config: context.config.balance.warehouse,
            state,
            building,
            cleanPerHour: finalConfig.cleanPerHour,
            dirtyPerHour: finalConfig.dirtyPerHour,
            heatPerDay: finalConfig.heatPerDay,
            influencePerDay: finalConfig.influencePerDay
        })
        : finalConfig;
      const clinicConfig = context.config.balance.clinic
        ? applyClinicIncomeModifiers({
            config: context.config.balance.clinic,
            state,
            building,
            cleanPerHour: warehouseConfig.cleanPerHour,
            dirtyPerHour: warehouseConfig.dirtyPerHour,
            heatPerDay: warehouseConfig.heatPerDay,
            influencePerDay: warehouseConfig.influencePerDay
          })
        : warehouseConfig;
      const stripClubConfig = context.config.balance.stripClub
        ? applyStripClubIncomeModifiers({
            config: context.config.balance.stripClub,
            state,
            building,
            tick: state.root.tick,
            cleanPerHour: clinicConfig.cleanPerHour,
            dirtyPerHour: clinicConfig.dirtyPerHour,
            heatPerDay: clinicConfig.heatPerDay,
            influencePerDay: clinicConfig.influencePerDay
        })
        : clinicConfig;
      const restaurantConfig = context.config.balance.restaurant
        ? applyRestaurantIncomeModifiers({
            config: context.config.balance.restaurant,
            state,
            building,
            cleanPerHour: stripClubConfig.cleanPerHour,
            dirtyPerHour: stripClubConfig.dirtyPerHour,
            heatPerDay: stripClubConfig.heatPerDay,
            influencePerDay: stripClubConfig.influencePerDay
          })
        : stripClubConfig;
      const convenienceStoreConfig = context.config.balance.convenienceStore
        ? applyConvenienceStoreIncomeModifiers({
            config: context.config.balance.convenienceStore,
            state,
            building,
            cleanPerHour: restaurantConfig.cleanPerHour,
            dirtyPerHour: restaurantConfig.dirtyPerHour,
            heatPerDay: restaurantConfig.heatPerDay,
            influencePerDay: restaurantConfig.influencePerDay
          })
        : restaurantConfig;
      const recruitmentCenterConfig = context.config.balance.recruitmentCenter
        ? applyRecruitmentCenterIncomeModifiers({
            config: context.config.balance.recruitmentCenter,
            state,
            building,
            cleanPerHour: convenienceStoreConfig.cleanPerHour,
            dirtyPerHour: convenienceStoreConfig.dirtyPerHour,
            heatPerDay: convenienceStoreConfig.heatPerDay,
            influencePerDay: convenienceStoreConfig.influencePerDay
          })
        : convenienceStoreConfig;
      const fitnessClubConfig = context.config.balance.fitnessClub
        ? applyFitnessClubIncomeModifiers({
            config: context.config.balance.fitnessClub,
            state,
            building,
            cleanPerHour: recruitmentCenterConfig.cleanPerHour,
            dirtyPerHour: recruitmentCenterConfig.dirtyPerHour,
            heatPerDay: recruitmentCenterConfig.heatPerDay,
            influencePerDay: recruitmentCenterConfig.influencePerDay
          })
        : recruitmentCenterConfig;
      const shoppingMallConfig = context.config.balance.shoppingMall
        ? applyShoppingMallIncomeModifiers({
            config: context.config.balance.shoppingMall,
            state,
            building,
            cleanPerHour: fitnessClubConfig.cleanPerHour,
            dirtyPerHour: fitnessClubConfig.dirtyPerHour,
            heatPerDay: fitnessClubConfig.heatPerDay,
            influencePerDay: fitnessClubConfig.influencePerDay
          })
        : fitnessClubConfig;
      const garageConfig = context.config.balance.garage
        ? applyGarageIncomeModifiers({
            config: context.config.balance.garage,
            state,
            building,
            cleanPerHour: shoppingMallConfig.cleanPerHour,
            dirtyPerHour: shoppingMallConfig.dirtyPerHour,
            heatPerDay: shoppingMallConfig.heatPerDay,
            influencePerDay: shoppingMallConfig.influencePerDay
        })
        : shoppingMallConfig;
      const carDealerConfig = context.config.balance.carDealer
        ? applyCarDealerIncomeModifiers({
            config: context.config.balance.carDealer,
            state,
            building,
            cleanPerHour: garageConfig.cleanPerHour,
            dirtyPerHour: garageConfig.dirtyPerHour,
            heatPerDay: garageConfig.heatPerDay,
            influencePerDay: garageConfig.influencePerDay
          })
        : garageConfig;
      const recyclingCenterConfig = context.config.balance.recyclingCenter
        ? applyRecyclingCenterIncomeModifiers({
            config: context.config.balance.recyclingCenter,
            state,
            building,
            cleanPerHour: carDealerConfig.cleanPerHour,
            dirtyPerHour: carDealerConfig.dirtyPerHour,
            heatPerDay: carDealerConfig.heatPerDay,
            influencePerDay: carDealerConfig.influencePerDay
          })
        : carDealerConfig;
      const smugglingTunnelConfig = context.config.balance.smugglingTunnel
        ? applySmugglingTunnelIncomeModifiers({
            config: context.config.balance.smugglingTunnel,
            state,
            building,
            tick: state.root.tick,
            cleanPerHour: recyclingCenterConfig.cleanPerHour,
            dirtyPerHour: recyclingCenterConfig.dirtyPerHour,
            heatPerDay: recyclingCenterConfig.heatPerDay,
            influencePerDay: recyclingCenterConfig.influencePerDay
          })
        : recyclingCenterConfig;
      const powerStationConfig = context.config.balance.powerStation
        ? applyPowerStationIncomeModifiers({
            config: context.config.balance.powerStation,
            state,
            building,
            tick: state.root.tick,
            cleanPerHour: smugglingTunnelConfig.cleanPerHour,
            dirtyPerHour: smugglingTunnelConfig.dirtyPerHour,
            heatPerDay: smugglingTunnelConfig.heatPerDay,
            influencePerDay: smugglingTunnelConfig.influencePerDay
          })
        : smugglingTunnelConfig;
      return {
        cash: totals.cash + resolvePerTick(powerStationConfig.cleanPerHour, ticksPerHour) * incomeMultiplier * modifiers.cleanIncomeMultiplier,
        dirtyCash: totals.dirtyCash + resolvePerTick(powerStationConfig.dirtyPerHour, ticksPerHour) * incomeMultiplier * modifiers.dirtyIncomeMultiplier
      };
    },
    { cash: 0, dirtyCash: 0 }
  );
};

const addIncome = (
  incomeByPlayerId: Record<string, Record<string, number>>,
  playerId: string,
  resourceKey: string,
  rawAmount: unknown
): void => {
  const amount = Math.max(0, Number(rawAmount || 0));

  if (!resourceKey || amount <= 0 || !Number.isFinite(amount)) {
    return;
  }

  incomeByPlayerId[playerId] = {
    ...incomeByPlayerId[playerId],
    [resourceKey]: (incomeByPlayerId[playerId]?.[resourceKey] ?? 0) + amount
  };
};

const resolvePerTick = (perHour: number, ticksPerHour: number): number => {
  const amount = Number(perHour || 0);
  return Number.isFinite(amount) && ticksPerHour > 0 ? Math.max(0, amount) / ticksPerHour : 0;
};

const extractEffectModifiers = (payload: Record<string, unknown>): BuildingActionEffectModifiers => {
  const nested = isRecord(payload.effectModifiers) ? payload.effectModifiers : null;
  const source = nested ?? payload;

  return {
    incomeMultiplier: getNumericModifier(source, "incomeMultiplier"),
    cleanIncomeMultiplier: getNumericModifier(source, "cleanIncomeMultiplier"),
    dirtyIncomeMultiplier: getNumericModifier(source, "dirtyIncomeMultiplier"),
    influenceMultiplier: getNumericModifier(source, "influenceMultiplier"),
    heatMultiplier: getNumericModifier(source, "heatMultiplier"),
    influencePerDay: getNumericModifier(source, "influencePerDay"),
    heatPerDay: getNumericModifier(source, "heatPerDay"),
    attackMultiplier: getNumericModifier(source, "attackMultiplier"),
    defenseMultiplier: getNumericModifier(source, "defenseMultiplier")
  };
};

const getNumericModifier = (
  source: Record<string, unknown>,
  key: keyof BuildingActionEffectModifiers
): number | undefined => {
  const value = Number(source[key]);
  return Number.isFinite(value) ? value : undefined;
};

const multiplyModifier = (
  resolved: ResolvedDistrictEffectModifiers,
  key: keyof Pick<
    ResolvedDistrictEffectModifiers,
    | "incomeMultiplier"
    | "cleanIncomeMultiplier"
    | "dirtyIncomeMultiplier"
    | "influenceMultiplier"
    | "heatMultiplier"
    | "attackMultiplier"
    | "defenseMultiplier"
  >,
  value: number | undefined
): void => {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return;
  }

  resolved[key] *= value;
};

const addModifier = (
  resolved: ResolvedDistrictEffectModifiers,
  key: keyof Pick<ResolvedDistrictEffectModifiers, "influencePerDay" | "heatPerDay">,
  value: number | undefined
): void => {
  if (value === undefined || !Number.isFinite(value)) {
    return;
  }

  resolved[key] += value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
