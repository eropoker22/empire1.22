import type { GameplayEconomyRatesView } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import { calculateIncomeByPlayerId } from "../rules/economy/calculateIncome";
import {
  createPassivePopulationSources,
  createPassivePopulationSourceSummary
} from "./gameplay-economy-population-view";
import {
  calculateSelectedDistrictIncome,
  createNextDistrictEconomyState,
  createNextTickRateState,
  createPopulationProductionState,
  finiteNumber
} from "./gameplay-economy-rate-state";

const HOUR_MS = 60 * 60 * 1000;

export const createGameplayEconomyRatesView = (
  state: CoreGameState,
  playerId: string,
  selectedDistrictId: string | null,
  context: GameCoreContext
): GameplayEconomyRatesView => {
  const rateState = createNextTickRateState(state);
  const tickRateMs = Math.max(1, Number(context.config.tickRateMs || 0));
  const ticksPerHour = HOUR_MS / tickRateMs;
  const calculatedIncome =
    calculateIncomeByPlayerId(rateState, context)[playerId] ?? {};
  const nextDistrictState = createNextDistrictEconomyState(
    rateState,
    context
  );
  const populationProductionState = createPopulationProductionState(
    rateState,
    context
  );
  const currentPlayer = state.playersById[playerId];
  const currentBalances = currentPlayer
    ? state.resourceStatesById[currentPlayer.resourceStateId]?.balances ?? {}
    : {};
  const canonicalPopulationPerTick =
    finiteNumber(rateState.playersById[playerId]?.population)
    - finiteNumber(currentPlayer?.population);
  const balanceKeys = new Set([
    ...Object.keys(currentBalances),
    ...Object.keys(calculatedIncome),
    "cash",
    "dirty-cash",
    "population"
  ]);
  const playerBalancePerTick = Object.fromEntries(
    Array.from(balanceKeys, (resourceKey) => [
      resourceKey,
      resourceKey === "population"
        ? canonicalPopulationPerTick
        : finiteNumber(calculatedIncome[resourceKey])
    ])
  );
  const selectedDistrict = selectedDistrictId
    && state.districtsById[selectedDistrictId]?.ownerPlayerId === playerId
    ? state.districtsById[selectedDistrictId]
    : null;
  const nextSelectedDistrict = selectedDistrictId
    ? nextDistrictState.districtsById[selectedDistrictId]
    : null;
  const selectedDistrictIncome = selectedDistrict
    ? calculateSelectedDistrictIncome(
        rateState,
        selectedDistrict.id,
        playerId,
        context
      )
    : {};
  const passivePopulationSources = selectedDistrict
    ? createPassivePopulationSources(
        rateState,
        populationProductionState,
        selectedDistrict,
        playerId,
        context,
        ticksPerHour
      )
    : [];

  return {
    basis: "next-authoritative-economy-tick",
    tickRateMs,
    fromTick: state.root.tick,
    toTick: rateState.root.tick,
    playerBalancePerTick,
    playerBalancePerHour: Object.fromEntries(
      Object.entries(playerBalancePerTick).map(([resourceKey, amount]) => [
        resourceKey,
        amount * ticksPerHour
      ])
    ),
    selectedDistrict: selectedDistrict && nextSelectedDistrict
      ? {
          districtId: selectedDistrict.id,
          cleanCashPerTick: finiteNumber(selectedDistrictIncome.cash),
          dirtyCashPerTick: finiteNumber(selectedDistrictIncome["dirty-cash"]),
          cleanCashPerHour:
            finiteNumber(selectedDistrictIncome.cash) * ticksPerHour,
          dirtyCashPerHour:
            finiteNumber(selectedDistrictIncome["dirty-cash"]) * ticksPerHour,
          heatPerTick:
            finiteNumber(nextSelectedDistrict.heat)
            - finiteNumber(selectedDistrict.heat),
          influencePerTick:
            finiteNumber(nextSelectedDistrict.influence)
            - finiteNumber(selectedDistrict.influence),
          heatPerHour: (
            finiteNumber(nextSelectedDistrict.heat)
            - finiteNumber(selectedDistrict.heat)
          ) * ticksPerHour,
          influencePerHour: (
            finiteNumber(nextSelectedDistrict.influence)
            - finiteNumber(selectedDistrict.influence)
          ) * ticksPerHour,
          passivePopulationSources,
          passivePopulationSourceSummary: createPassivePopulationSourceSummary(
            passivePopulationSources
          )
        }
      : null
  };
};
