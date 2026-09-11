import type { AnyRecord, MarketResourceId } from "./market-types";
import { deterministicUnitInterval } from "../../utils/math";

export const resolveAirportCharter = (state: AnyRecord, playerId: string, resourceId: MarketResourceId): {
  active: boolean; discountPct: number; customsRiskPct: number; customsHeat: number;
} => {
  const inactive = { active: false, discountPct: 0, customsRiskPct: 0, customsHeat: 0 };
  const config = state.config?.balance?.airport ?? state.balance?.airport;
  if (!config || !playerId) return inactive;
  const tick = Number(state.root?.tick ?? state.serverInstance?.currentTick ?? 0);
  const airport = Object.values(state.buildingsById ?? {}).find((candidate: any) =>
    candidate?.buildingTypeId === config.buildingTypeId && candidate.ownerPlayerId === playerId && candidate.status === "active"
  ) as AnyRecord | undefined;
  const metadata = airport?.metadata?.airport;
  if (!metadata || Number(metadata.blackCharterExpiresAtTick || 0) <= tick
    || Number(metadata.discountDisabledUntilTick || 0) > tick
    || !config.blackCharter.offerItems.includes(resourceId)) return inactive;
  return {
    active: true,
    discountPct: Math.max(0, Math.min(95, config.blackCharter.specialOfferDiscountPct)),
    customsRiskPct: Math.max(0, Math.min(100, config.blackCharter.purchaseCustomsRiskPct)),
    customsHeat: Math.max(0, config.expressImport.customsHeatGain)
  };
};

export const rollAirportCharterCustoms = (state: AnyRecord, playerId: string, resourceId: MarketResourceId): number => {
  const charter = resolveAirportCharter(state, playerId, resourceId);
  if (!charter.active) return 0;
  // No client command ID or client time enters the outcome seed.
  const seed = `${state.serverInstance?.worldSeed}:charter:${state.root?.tick}:${playerId}:${resourceId}:${state.market?.transactions?.length ?? 0}`;
  return deterministicUnitInterval(seed) < charter.customsRiskPct / 100 ? charter.customsHeat : 0;
};
