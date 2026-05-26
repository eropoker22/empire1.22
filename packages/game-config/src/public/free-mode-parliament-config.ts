import type { ParliamentBalanceConfig } from "../contracts/balance-config";

export const freeModeParliamentConfig: ParliamentBalanceConfig = {
  id: "parliament",
  buildingTypeId: "parliament",
  countOnMap: 1,
  zone: "downtown",
  category: ["ultra_rare", "power", "politics", "influence"],
  cleanCashPerMinute: 22,
  dirtyCashPerMinute: 3,
  influencePerMinute: 40 / (60 * 24),
  populationPerMinute: 0,
  heatPerMinute: 3 / (60 * 24),
  noPopulationProduction: true,
  policyWindow: {
    actionId: "parliament_policy_window",
    cooldownMinutes: 18,
    heatGain: 5,
    cleanCashGain: 160,
    influenceGain: 5
  }
};
