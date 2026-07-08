import type { ClinicBalanceConfig } from "../contracts/balance-config";

export const freeModeClinicConfig: ClinicBalanceConfig = {
  id: "clinic",
  buildingTypeId: "clinic",
  countOnMap: 8,
  category: ["economy", "recovery", "support"],
  cleanCashPerMinute: 3100 / 60,
  dirtyCashPerMinute: 0,
  influencePerMinute: 0,
  heatPerMinute: 85 / (60 * 24),
  noLaundering: true,
  noAuditRisk: true,
  recovery: {
    baseRecoveryRatePct: 15,
    recoveryRatePctPerExtraClinic: 3,
    maxRecoveryRatePct: 40,
    poolTtlMinutes: 90,
    toxicTrapRateMultiplier: 0.5
  },
  network: {
    incomeBonusPctPerExtraClinic: 5,
    heatBonusPctPerExtraClinic: 3,
    maxIncomeMultiplier: 1.4,
    maxHeatMultiplier: 1.24
  },
  stabilizationProtocol: {
    actionId: "stabilization_protocol",
    cooldownMinutes: 18,
    cleanCashCost: 1200,
    heatGain: 1
  }
};
