import type { StreetDealersBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { StreetDealerNetworkMultipliers } from "./streetDealersTypes";
export const getOwnedStreetDealerCount = (
  state: CoreGameState,
  playerId: string,
  config: StreetDealersBalanceConfig
): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;

export const resolveStreetDealerNetworkMultipliers = (
  count: number,
  config: StreetDealersBalanceConfig
): StreetDealerNetworkMultipliers => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return {
    passiveDirtyIncomeMultiplier: Math.min(
      config.network.maxPassiveDirtyIncomeMultiplier,
      1 + extra * config.network.passiveDirtyIncomeBonusPctPerExtraDealer / 100
    ),
    saleSpeedMultiplier: Math.min(
      config.network.maxSaleSpeedMultiplier,
      1 + extra * config.network.saleSpeedBonusPctPerExtraDealer / 100
    ),
    heatMultiplier: Math.min(
      config.network.maxHeatMultiplier,
      1 + extra * config.network.heatBonusPctPerExtraDealer / 100
    )
  };
};

export const resolveStreetDealerSlotCount = (
  _ownedCount: number,
  config: StreetDealersBalanceConfig
): number => config.dealerSlots.length;
