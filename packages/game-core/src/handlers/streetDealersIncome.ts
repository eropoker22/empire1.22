import type { FixedBuildingBalanceConfig, SmugglingTunnelBalanceConfig, StreetDealersBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { resolveDealerSupplyStats } from "./smugglingTunnelBuildingActions";
import { getOwnedStreetDealerCount, resolveStreetDealerNetworkMultipliers } from "./streetDealersNetwork";
export const applyStreetDealersIncomeModifiers = (input: {
  config: StreetDealersBalanceConfig;
  smugglingTunnelConfig?: SmugglingTunnelBalanceConfig;
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
  const network = resolveStreetDealerNetworkMultipliers(
    getOwnedStreetDealerCount(input.state, input.building.ownerPlayerId, input.config),
    input.config
  );
  const dealerSupply = resolveDealerSupplyStats({
    state: input.state,
    playerId: input.building.ownerPlayerId,
    config: input.smugglingTunnelConfig
  });
  return {
    cleanPerHour: 0,
    dirtyPerHour: input.dirtyPerHour * network.passiveDirtyIncomeMultiplier * (1 + dealerSupply.passiveDirtyIncomeBonusPct / 100),
    heatPerDay: input.heatPerDay * network.heatMultiplier,
    influencePerDay: 0,
    maxLevel: 1
  };
};

