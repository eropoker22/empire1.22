import type { WarehouseBalanceConfig } from "../contracts/balance-config";

export const freeModeWarehouseConfig: WarehouseBalanceConfig = {
  id: "warehouse",
  buildingTypeId: "warehouse",
  countOnMap: 18,
  category: ["economy", "storage", "logistics"],
  cleanCashPerMinute: 45,
  dirtyCashPerMinute: 0,
  influencePerMinute: 0,
  heatPerMinute: 0.06,
  auditRisk: 0,
  noLaundering: true,
  specialActions: "none",
  storageCapacityBonus: 500,
  storageCapacities: {
    genericResources: 500,
    chemicals: 350,
    biomass: 350,
    metalParts: 400,
    techCore: 120,
    combatModule: 80,
    drugsAndBoosts: 220,
    weaponsAndDefense: 160
  },
  network: {
    incomeBonusPctPerExtraWarehouse: 4,
    storageCapacityBonusPctPerExtraWarehouse: 10,
    heatBonusPctPerExtraWarehouse: 3,
    maxIncomeMultiplier: 1.36,
    maxStorageCapacityMultiplier: 1.9,
    maxHeatMultiplier: 1.27
  },
  upgrades: {
    1: { cleanCashCost: 0, metalPartsCost: 0, techCoreCost: 0, incomeBonusPct: 0, storageBonusPct: 0, heatReductionPct: 0 },
    2: { cleanCashCost: 4000, metalPartsCost: 2, techCoreCost: 0, incomeBonusPct: 10, storageBonusPct: 12, heatReductionPct: 0 },
    3: { cleanCashCost: 9000, metalPartsCost: 5, techCoreCost: 1, incomeBonusPct: 20, storageBonusPct: 25, heatReductionPct: 0 },
    4: { cleanCashCost: 18000, metalPartsCost: 12, techCoreCost: 3, incomeBonusPct: 30, storageBonusPct: 40, heatReductionPct: 10 }
  }
};
