import { retimeProductionSupport } from "../rules/production/productionSpeedModifiers";
import { calendarTimeAtTick } from "../rules/elimination/serverCalendar";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { GameCoreContext } from "./context";
import { collectIncome } from "../rules/economy/collectIncome";
import { completeCraftProcessing } from "../rules/production/completeCraftProcessing";
import { completeProduction } from "../rules/production/completeProduction";
import { completePharmacyProduction } from "../rules/production/completePharmacyProduction";
import { completeDrugLabProduction } from "../rules/production/completeDrugLabProduction";
import { completeFactoryProduction } from "../rules/production/completeFactoryProduction";
import { completeArmoryProduction } from "../rules/production/completeArmoryProduction";
import { createProductionCompletionEvents } from "../rules/production/createProductionCompletionEvents";
import { expirePlayerBoosts } from "../rules/player-boosts";
import { releaseExpiredPoliceConsequences } from "../rules/police/policeConsequenceExpiry";
import { expirePendingRaids } from "../rules/police/raidLifecycle";
import { triggerRaid } from "../rules/police/triggerRaid";
import { runScheduledElimination } from "../rules/elimination/eliminationLifecycle";
import { runAllianceLifecycleScheduled } from "../rules/alliances/allianceLifecycle";
import { runFinalLockdownLifecycle } from "../rules/victory/finalLockdownLifecycle";
import { checkVictory } from "../rules/victory/checkVictory";
import { appendCityFeedEvents, appendCityFeedEventsFromCoreEvents } from "../rules/events";
import { createDayNightTransitionFeedEvent } from "../rules/day-night/dayNight";
import { completeAirportImportsAndCustoms } from "../handlers/airportBuildingActions";
import { applyCentralBankPassiveInterestAndOversight } from "../handlers/centralBankBuildingActions";
import { applyCityHallCorruptionScandals } from "../handlers/cityHallBuildingActions";
import { completeStreetDealerSales } from "../handlers/streetDealersBuildingActions";
import { completePendingOccupations } from "../handlers/completePendingOccupations";
import { completePendingDistrictActions } from "../handlers/completePendingDistrictActions";
import { expireBounties } from "../handlers/bountyCommands";
import { applyStockExchangeFinancialInspections, applyStockExchangePassiveEffects } from "../handlers/stockExchangeBuildingActions";
import { completeDuePlayerCityEvents } from "../rules/city-events/cityEventLifecycle";
import { tickMarket } from "../rules/market";

/**
 * Responsibility: Canonical tick entry point for periodic server-side simulation.
 * Belongs here: orchestration of one logical tick pass over the authoritative state.
 * Does not belong here: timer scheduling or transport fanout.
 */
export const runTick = (
  state: CoreGameState,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; policeRaidEvaluation?: import("../rules/police/triggerRaid").RaidTriggerEvaluation } => {
  if (
    state.matchResult
    || state.root.phase === "resolved"
    || state.serverInstance.status === "ended"
  ) {
    return { nextState: state, events: [] };
  }

  // A replayed/catch-up tick uses its own server calendar instant, never wall
  // time or an epoch-relative duration. All timed domain rules share it.
  if (!context.clock) {
    const at = new Date(calendarTimeAtTick(state, state.root.tick + 1, context.config.tickRateMs));
    context = { ...context, clock: { now: () => at, nowIso: () => at.toISOString() } };
  }
  const advancedState: CoreGameState = {
    ...state,
    serverInstance: {
      ...state.serverInstance,
      currentTick: state.serverInstance.currentTick + 1,
      ...(context.calendarNow ? { calendarAnchor: { tick: state.root.tick + 1, at: context.calendarNow } } : {})
    },
    root: {
      ...state.root,
      tick: state.root.tick + 1
    }
  };
  // End time-bound production boosts at the exact tick boundary before a
  // completed unit can schedule its successor with the post-expiry speed.
  const boostLifecycleResult = expirePlayerBoosts(retimeProductionSupport(state, advancedState, context), context);
  const releasedPoliceState = retimeProductionSupport(boostLifecycleResult.nextState, releaseExpiredPoliceConsequences(boostLifecycleResult.nextState), context);
  const incomeState = collectIncome(releasedPoliceState, context);
  const producedState = completeProduction(incomeState, context);
  const pharmacyProductionState = completePharmacyProduction(producedState, context);
  const drugLabProductionState = completeDrugLabProduction(pharmacyProductionState, context);
  const factoryProductionState = completeFactoryProduction(drugLabProductionState, context);
  const armoryProductionState = completeArmoryProduction(factoryProductionState, context);
  const productionCompletionEvents = createProductionCompletionEvents(
    producedState,
    armoryProductionState,
    context
  );
  const processingResult = completeCraftProcessing(armoryProductionState, context);
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
  const marketNow = context.clock?.now().getTime() ?? centralBankState.root.tick * context.config.tickRateMs;
  const marketState = tickMarket(centralBankState, marketNow, context).nextState as CoreGameState;
  const cityEventResult = completeDuePlayerCityEvents(marketState, context);
  const bountyExpiryResult = expireBounties(cityEventResult.nextState, context);
  const districtActionResult = completePendingDistrictActions(bountyExpiryResult.nextState, context);
  const occupyResult = completePendingOccupations(districtActionResult.nextState, context);
  const allianceLifecycleResult = runAllianceLifecycleScheduled(occupyResult.nextState, context);
  const lifecycleResult = expirePendingRaids(allianceLifecycleResult.nextState, context);
  const policeResult = triggerRaid(lifecycleResult.nextState, context);
  const eliminationResult = runScheduledElimination(policeResult.nextState, context);
  const finalLockdownResult = runFinalLockdownLifecycle(eliminationResult.nextState, context);
  const victoryResult = checkVictory(finalLockdownResult.nextState, context);
  const events = [
    ...boostLifecycleResult.events,
    ...productionCompletionEvents,
    ...processingResult.events,
    ...streetDealerResult.events,
    ...cityEventResult.events,
    ...bountyExpiryResult.events,
    ...districtActionResult.events,
    ...occupyResult.events,
    ...lifecycleResult.events,
    ...policeResult.events,
    ...eliminationResult.events,
    ...finalLockdownResult.events
  ];
  const feedEvents = createDayNightTransitionFeedEvent(victoryResult.nextState, context, state.root.tick, advancedState.root.tick);
  // Captures, alliance votes and police lifecycle may change production after
  // this tick's completed units. Retime their successors once at this boundary.
  const retimedState = retimeProductionSupport(bountyExpiryResult.nextState, victoryResult.nextState, context);
  const feedState = appendCityFeedEventsFromCoreEvents(retimedState, events, undefined, context);

  return {
    nextState: feedEvents ? appendCityFeedEvents(feedState, [feedEvents], undefined, context) : feedState,
    events,
    ...(policeResult.evaluation ? { policeRaidEvaluation: policeResult.evaluation } : {})
  };
};
