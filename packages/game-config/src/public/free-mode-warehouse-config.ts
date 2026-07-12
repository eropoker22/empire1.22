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
  storageCapacityGroups: {
    bulk: {
      label: "Hromadné zásoby",
      baseCapacity: 60,
      resourceKeys: ["chemicals", "biomass", "metal-parts", "neon-dust", "baseball-bat", "barricades"]
    },
    tactical: {
      label: "Taktické zásoby",
      baseCapacity: 24,
      resourceKeys: ["stim-pack", "pulse-shot", "velvet-smoke", "tech-core", "pistol", "grenade", "vest", "cameras", "alarm"]
    },
    strategic: {
      label: "Strategické zásoby",
      baseCapacity: 8,
      resourceKeys: ["combat-module", "ghost-serum", "overdrive-x", "smg", "bazooka", "defense-tower"]
    }
  },
  warehouseCountMultipliers: {
    0: 1, 1: 1.5, 2: 1.6, 3: 1.7, 4: 1.8, 5: 1.9
  },
  warehouseLevelMultipliers: {
    1: 1, 2: 1.12, 3: 1.25, 4: 1.4
  },
  network: {
    incomeBonusPctPerExtraWarehouse: 4,
    heatBonusPctPerExtraWarehouse: 3,
    maxIncomeMultiplier: 1.36,
    maxHeatMultiplier: 1.27
  },
  upgrades: {
    1: { cleanCashCost: 0, metalPartsCost: 0, techCoreCost: 0, incomeBonusPct: 0, heatReductionPct: 0 },
    2: { cleanCashCost: 4000, metalPartsCost: 2, techCoreCost: 0, incomeBonusPct: 10, heatReductionPct: 0 },
    3: { cleanCashCost: 9000, metalPartsCost: 5, techCoreCost: 1, incomeBonusPct: 20, heatReductionPct: 0 },
    4: { cleanCashCost: 18000, metalPartsCost: 12, techCoreCost: 3, incomeBonusPct: 30, heatReductionPct: 10 }
  }
};
