import type { SmugglingTunnelBalanceConfig } from "../contracts/balance-config";

export const freeModeSmugglingTunnelConfig: SmugglingTunnelBalanceConfig = {
  id: "smuggling_tunnel",
  buildingTypeId: "smuggling_tunnel",
  countOnMap: 18,
  category: ["dirty_cash", "smuggling", "dealer_support", "risk_reward"],
  cleanCashPerMinute: 0,
  dirtyCashPerMinute: 54,
  influencePerMinute: 0,
  populationPerMinute: 0,
  heatPerMinute: 0.07,
  noCleanCash: true,
  noInfluence: true,
  noPopulationProduction: true,
  noIntelPower: true,
  noLaundering: true,
  noAuditRisk: true,
  openChannel: {
    actionId: "open_channel",
    cooldownMinutes: 18,
    durationMinutes: 7,
    costDirtyCash: 800,
    heatGain: 5,
    tunnelDirtyProductionBonusPct: 45,
    dealerSalePriceBonusPct: 12,
    dealerSaleSpeedBonusPct: 10,
    dealerCompletionRewardBonusPct: 10,
    dealerSaleHeatBonusPct: 15,
    streetIncidentFlatRiskPct: 5,
    stackable: false
  },
  dealerSupply: {
    bonusPctPerTunnel: 4,
    maxBonusPct: 32,
    salePriceSharePct: 50,
    saleSpeedSharePct: 35,
    streetRiskReductionSharePct: 40,
    passiveDirtyIncomeSharePct: 25,
    saleHeatRiskSharePct: 20
  },
  network: {
    dirtyProductionBonusPctPerExtraTunnel: 5,
    maxDirtyProductionMultiplier: 1.35,
    heatBonusPctPerExtraTunnel: 4,
    maxHeatMultiplier: 1.28
  }
};
