import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { GameCoreContext } from "./context";
import { collectIncome } from "../rules/economy/collectIncome";
import { completeCraftProcessing } from "../rules/production/completeCraftProcessing";
import { completeProduction } from "../rules/production/completeProduction";
import { releaseExpiredPoliceConsequences } from "../rules/police/policeConsequenceExpiry";
import { applyPoliceHeatDecay } from "../rules/police/heatDecay";
import { expirePendingRaids } from "../rules/police/raidLifecycle";
import { triggerRaid } from "../rules/police/triggerRaid";
import { checkVictory } from "../rules/victory/checkVictory";
import { appendCityFeedEventsFromCoreEvents } from "../rules/events";
import { completeAirportImportsAndCustoms } from "../handlers/airportBuildingActions";
import { applyCentralBankPassiveInterestAndOversight } from "../handlers/centralBankBuildingActions";
import { applyCityHallCorruptionScandals } from "../handlers/cityHallBuildingActions";
import { completeStreetDealerSales } from "../handlers/streetDealersBuildingActions";
import { applyStockExchangeFinancialInspections, applyStockExchangePassiveEffects } from "../handlers/stockExchangeBuildingActions";

/**
 * Responsibility: Canonical tick entry point for periodic server-side simulation.
 * Belongs here: orchestration of one logical tick pass over the authoritative state.
 * Does not belong here: timer scheduling or transport fanout.
 */
export const runTick = (
  state: CoreGameState,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[] } => {
  const advancedState: CoreGameState = {
    ...state,
    serverInstance: {
      ...state.serverInstance,
      currentTick: state.serverInstance.currentTick + 1
    },
    root: {
      ...state.root,
      tick: state.root.tick + 1
    }
  };
  const releasedPoliceState = releaseExpiredPoliceConsequences(advancedState);
  const incomeState = collectIncome(releasedPoliceState, context);
  const producedState = completeProduction(incomeState, context);
  const processingResult = completeCraftProcessing(producedState, context);
  const streetDealerResult = context.config.balance.streetDealers
    ? completeStreetDealerSales(
        processingResult.nextState,
        context.config.balance.streetDealers,
        context.config.balance.smugglingTunnel,
        context.config.tickRateMs
      )
    : { nextState: processingResult.nextState, events: [] };
  const stockInsightState = context.config.balance.stockExchange
    ? applyStockExchangePassiveEffects(streetDealerResult.nextState, context.config.balance.stockExchange, context.config.tickRateMs)
    : streetDealerResult.nextState;
  const stockInspectionState = context.config.balance.stockExchange
    ? applyStockExchangeFinancialInspections(stockInsightState, context.config.balance.stockExchange, context.config.tickRateMs, context.config.balance.lobbyClub)
    : stockInsightState;
  const airportState = context.config.balance.airport
    ? completeAirportImportsAndCustoms(
        stockInspectionState,
        context.config.balance.airport,
        context.config.balance.warehouse,
        context.config.balance.powerStation,
        context.config.balance.smugglingTunnel,
        context.config.tickRateMs,
        context.config.balance.lobbyClub
      )
    : stockInspectionState;
  const cityHallState = context.config.balance.cityHall
    ? applyCityHallCorruptionScandals(airportState, context.config.balance.cityHall, context.config.tickRateMs, context.config.balance.lobbyClub)
    : airportState;
  const centralBankState = context.config.balance.centralBank
    ? applyCentralBankPassiveInterestAndOversight(cityHallState, context.config.balance.centralBank, context.config.tickRateMs, context.config.balance.lobbyClub)
    : cityHallState;
  const heatDecayState = applyPoliceHeatDecay(centralBankState, context);
  const lifecycleResult = expirePendingRaids(heatDecayState, context);
  const policeResult = triggerRaid(lifecycleResult.nextState, context);
  const victoryResult = checkVictory(policeResult.nextState, context);
  const events = [...processingResult.events, ...streetDealerResult.events, ...lifecycleResult.events, ...policeResult.events];

  return {
    nextState: appendCityFeedEventsFromCoreEvents(victoryResult.nextState, events, undefined, context),
    events
  };
};
