import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import {
  applyApartmentBlockPopulationProduction
} from "../handlers/apartmentBlockBuildingActions";
import {
  applyConvenienceStorePopulationProduction
} from "../handlers/convenienceStoreBuildingActions";
import {
  applySchoolStudentProduction
} from "../handlers/schoolBuildingActions";
import { calculateIncomeByPlayerId } from "../rules/economy/calculateIncome";
import {
  calculateFixedBuildingPassivePressureByDistrictId
} from "../rules/economy/collectIncome";
import { applyPoliceHeatDecay } from "../rules/police/heatDecay";

export const createNextTickRateState = (
  state: CoreGameState
): CoreGameState => ({
  ...state,
  serverInstance: {
    ...state.serverInstance,
    currentTick: state.serverInstance.currentTick + 1
  },
  root: {
    ...state.root,
    tick: state.root.tick + 1
  }
});

export const createNextDistrictEconomyState = (
  state: CoreGameState,
  context: GameCoreContext
): CoreGameState => {
  const pressureByDistrictId =
    calculateFixedBuildingPassivePressureByDistrictId(state, context);
  const pressuredDistrictsById = Object.fromEntries(
    Object.entries(state.districtsById).map(([districtId, district]) => {
      const pressure = pressureByDistrictId[districtId];
      return [
        districtId,
        pressure
          ? {
              ...district,
              heat: pressure.nextHeat,
              influence: pressure.nextInfluence
            }
          : district
      ];
    })
  );
  return applyPoliceHeatDecay(
    {
      ...state,
      districtsById: pressuredDistrictsById
    },
    context
  );
};

export const createPopulationProductionState = (
  state: CoreGameState,
  context: GameCoreContext
): CoreGameState => {
  const apartmentState = context.config.balance.apartmentBlock
    ? applyApartmentBlockPopulationProduction(
        state,
        context.config.balance.apartmentBlock,
        context.config.tickRateMs,
        context.config.balance.powerStation,
        context.config.balance.recruitmentCenter,
        context.config.balance.school,
        context
      )
    : state;
  const schoolState = context.config.balance.school
    ? applySchoolStudentProduction(
        apartmentState,
        context.config.balance.school,
        context.config.tickRateMs,
        context
      )
    : apartmentState;
  return context.config.balance.convenienceStore
    ? applyConvenienceStorePopulationProduction(
        schoolState,
        context.config.balance.convenienceStore,
        context.config.tickRateMs
      )
    : schoolState;
};

export const calculateSelectedDistrictIncome = (
  state: CoreGameState,
  districtId: string,
  playerId: string,
  context: GameCoreContext
): Record<string, number> => {
  const totalIncome = calculateIncomeByPlayerId(state, context)[playerId] ?? {};
  const withoutSelectedDistrictState: CoreGameState = {
    ...state,
    districtsById: {
      ...state.districtsById,
      [districtId]: {
        ...state.districtsById[districtId],
        ownerPlayerId: null
      }
    }
  };
  const incomeWithoutSelectedDistrict =
    calculateIncomeByPlayerId(
      withoutSelectedDistrictState,
      context
    )[playerId] ?? {};
  return Object.fromEntries(
    Array.from(new Set([
      ...Object.keys(totalIncome),
      ...Object.keys(incomeWithoutSelectedDistrict)
    ]), (resourceKey) => [
      resourceKey,
      finiteNumber(totalIncome[resourceKey])
        - finiteNumber(incomeWithoutSelectedDistrict[resourceKey])
    ])
  );
};

export const finiteNumber = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};
