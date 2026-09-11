import type { CoreGameState } from "../../entities";
import type { ActivePlayerCityEventRun } from "@empire/shared-types";
import type { PlayerCityEventOffer, PlayerCityEventState } from "@empire/shared-types";

export const copyAcceptedCityEventOffer = (offer: PlayerCityEventOffer): PlayerCityEventOffer => ({
  ...offer,
  rewardSnapshot: { ...offer.rewardSnapshot },
  riskSnapshot: { ...offer.riskSnapshot, ...(offer.riskSnapshot.startCost ? { startCost: { ...offer.riskSnapshot.startCost } } : {}) }
});

/** Upgrade a legacy run before replacing the only surviving original offer. Never
 * reconstruct a settlement from today's definitions: their costs may have changed. */
export const retainLegacyCityEventRun = (current: PlayerCityEventState): PlayerCityEventState => {
  const run = current.activeRun;
  if (!run || run.offerSnapshot) return current;
  const offer = Object.values(current.offersByAgent).flat().find(o => o.offerId === run.offerId);
  return offer ? { ...current, activeRun: { ...run, offerSnapshot: copyAcceptedCityEventOffer(offer) } } : current;
};

/** Unblock play without inventing payouts or silently dropping a paid claim. */
export const retainUnsettledLegacyCityEvent = (state: CoreGameState, playerId: string, city: PlayerCityEventState, run: ActivePlayerCityEventRun): CoreGameState => ({
  ...state, playerCityEventStatesByPlayerId: {
    ...state.playerCityEventStatesByPlayerId,
    [playerId]: { ...city, activeRun: null, version: city.version + 1,
      unresolvedRuns: [...(city.unresolvedRuns ?? []), { run, reason: "missing-accepted-contract", recordedAtTick: state.root.tick }] }
  }
});
