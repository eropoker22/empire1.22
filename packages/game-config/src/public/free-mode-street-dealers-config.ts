import type { StreetDealersBalanceConfig } from "../contracts/balance-config";

export const freeModeStreetDealersConfig: StreetDealersBalanceConfig = {
  id: "street_dealers",
  buildingTypeId: "street_dealers",
  name: "Pouliční dealeři",
  countOnMap: 19,
  category: ["dirty_cash", "drug_distribution", "street_economy"],
  cleanCashPerMinute: 0,
  dirtyCashPerMinute: 36,
  influencePerMinute: 0,
  populationPerMinute: 0,
  heatPerMinute: 0.06,
  noCleanCash: true,
  noInfluence: true,
  noPopulationProduction: true,
  noIntelPower: true,
  noLaundering: true,
  noAuditRisk: true,
  startDrugSale: {
    actionId: "start_drug_sale"
  },
  dealerSlots: [
    { minOwned: 1, maxOwned: 2, slots: 1 },
    { minOwned: 3, maxOwned: 5, slots: 2 },
    { minOwned: 6, maxOwned: 9, slots: 3 },
    { minOwned: 10, maxOwned: 14, slots: 4 },
    { minOwned: 15, maxOwned: null, slots: 5 }
  ],
  sellableDrugs: [
    {
      itemId: "neon-dust",
      label: "Neon Dust",
      aliases: ["neonDust"],
      basePriceDirtyCash: 95,
      baseDurationMinutes: 4,
      baseHeatPerUnit: 2,
      maxAmountPerSlot: 12,
      baseStreetRiskPct: 4
    },
    {
      itemId: "pulse-shot",
      label: "Pulse Shot",
      aliases: ["pulseShot"],
      basePriceDirtyCash: 135,
      baseDurationMinutes: 5,
      baseHeatPerUnit: 3,
      maxAmountPerSlot: 10,
      baseStreetRiskPct: 6
    },
    {
      itemId: "velvet-smoke",
      label: "Velvet Smoke",
      aliases: ["velvetSmoke"],
      basePriceDirtyCash: 170,
      baseDurationMinutes: 6,
      baseHeatPerUnit: 4,
      maxAmountPerSlot: 8,
      baseStreetRiskPct: 8
    },
    {
      itemId: "ghost-serum",
      label: "Ghost Serum",
      aliases: ["ghostSerum"],
      basePriceDirtyCash: 260,
      baseDurationMinutes: 8,
      baseHeatPerUnit: 6,
      maxAmountPerSlot: 5,
      baseStreetRiskPct: 12
    },
    {
      itemId: "overdrive-x",
      label: "Overdrive X",
      aliases: ["overdriveX"],
      basePriceDirtyCash: 360,
      baseDurationMinutes: 10,
      baseHeatPerUnit: 9,
      maxAmountPerSlot: 3,
      baseStreetRiskPct: 16
    }
  ],
  streetIncidents: {
    extraCooldownMinutes: 3,
    fakeCustomerRewardPenaltyPct: 25,
    streetConflictHeatGain: 8,
    lostPackageAmountPct: 15,
    maxStreetRiskPct: 35
  },
  network: {
    passiveDirtyIncomeBonusPctPerExtraDealer: 4,
    salePriceBonusPctPerExtraDealer: 3,
    saleSpeedBonusPctPerExtraDealer: 3,
    heatBonusPctPerExtraDealer: 3,
    maxPassiveDirtyIncomeMultiplier: 1.28,
    maxSalePriceMultiplier: 1.22,
    maxSaleSpeedMultiplier: 1.22,
    maxHeatMultiplier: 1.22
  }
};
