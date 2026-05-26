import type { PortBalanceConfig } from "../contracts/balance-config";

export const freeModePortConfig: PortBalanceConfig = {
  id: "port",
  buildingTypeId: "port",
  countOnMap: 1,
  zone: "downtown",
  category: ["logistics", "containers", "materials", "dirty_cash_routes"],
  cleanCashPerMinute: 26,
  dirtyCashPerMinute: 8.5,
  influencePerMinute: 26 / (60 * 24),
  populationPerMinute: 0,
  heatPerMinute: 5 / (60 * 24),
  noPopulationProduction: true,
  containerCut: {
    actionId: "port_container_cut",
    cooldownMinutes: 14,
    heatGain: 6,
    dirtyCashGain: 160,
    metalPartsGain: 3,
    influenceGain: 1
  }
};
