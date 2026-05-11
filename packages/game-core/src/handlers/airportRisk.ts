import type { AirportBalanceConfig, SmugglingTunnelBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { getAirportMetadata, getOwnedBuildingCount, hasOwnedBuilding } from "./airportMetadata";
export const resolveAirportCustomsRiskPct = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  config: AirportBalanceConfig;
  smugglingTunnelConfig?: SmugglingTunnelBalanceConfig;
  tick: number;
}): number => {
  const player = input.building.ownerPlayerId ? input.state.playersById[input.building.ownerPlayerId] : undefined;
  const policeState = player ? input.state.policeStatesById[player.policeStateId] : undefined;
  const metadata = getAirportMetadata(input.building, input.tick);
  const heatRisk = Number(policeState?.heat || 0) > input.config.customsInspection.heatThreshold
    ? input.config.customsInspection.heatRiskPct
    : 0;
  const tunnelRisk = input.smugglingTunnelConfig && input.building.ownerPlayerId && getOwnedBuildingCount(input.state, input.building.ownerPlayerId, input.smugglingTunnelConfig.buildingTypeId) >= input.config.customsInspection.smugglingTunnelThreshold
    ? input.config.customsInspection.smugglingTunnelRiskPct
    : 0;
  const corridorRisk = Number(metadata.evacuationCorridorExpiresAtTick || 0) > input.tick
    ? input.config.evacuationCorridor.customsRiskPct
    : 0;
  const stockRisk = input.building.ownerPlayerId && hasOwnedBuilding(input.state, input.building.ownerPlayerId, "stock_exchange")
    ? input.config.customsInspection.stockExchangeSynergyRiskPct
    : 0;
  return Math.min(100, input.config.customsInspection.passiveRiskPct + heatRisk + tunnelRisk + corridorRisk + stockRisk);
};
