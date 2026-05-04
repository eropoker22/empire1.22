import type { SmugglingTunnelBalanceConfig } from "../contracts/balance-config";

export const freeModeSmugglingTunnelConfig: SmugglingTunnelBalanceConfig = {
  id: "smuggling_tunnel",
  buildingTypeId: "smuggling_tunnel",
  countOnMap: 18,
  category: ["dirty_cash", "smuggling", "stash", "risk_reward"],
  cleanCashPerMinute: 0,
  dirtyCashPerMinute: 62,
  influencePerMinute: 0,
  populationPerMinute: 0,
  passiveHeatPerMinute: 0.03,
  noCleanCash: true,
  noInfluence: true,
  noPopulationProduction: true,
  noIntelPower: true,
  noLaundering: true,
  noAuditRisk: true,
  batch: {
    baseCapacityDirtyCash: 2500,
    minCollectDirtyCash: 300,
    heatByCollectedDirtyCash: [
      { minDirtyCash: 1, maxDirtyCash: 999, heatGain: 2 },
      { minDirtyCash: 1000, maxDirtyCash: 1999, heatGain: 4 },
      { minDirtyCash: 2000, maxDirtyCash: 2999, heatGain: 7 },
      { minDirtyCash: 3000, maxDirtyCash: 4999, heatGain: 11 },
      { minDirtyCash: 5000, heatGain: 16 }
    ]
  },
  collectBatch: {
    actionId: "collect_smuggling_batch",
    minStoredDirtyCash: 300
  },
  silentChannel: {
    actionId: "silent_channel",
    cooldownMinutes: 20,
    durationMinutes: 8,
    costDirtyCash: 600,
    dirtyProductionMultiplier: 1.8,
    passiveHeatMultiplier: 2,
    batchCapacityMultiplier: 1.25,
    raidChancePct: 12,
    blockedMinutesOnClosedEntrance: 10
  },
  network: {
    dirtyProductionBonusPctPerExtraTunnel: 5,
    batchCapacityBonusPctPerExtraTunnel: 6,
    passiveHeatBonusPctPerExtraTunnel: 4,
    maxDirtyProductionMultiplier: 1.35,
    maxBatchCapacityMultiplier: 1.55,
    maxPassiveHeatMultiplier: 1.28
  }
};
