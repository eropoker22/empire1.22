import type {
  StorageCapacityGroupId,
  WarehouseBalanceConfig
} from "../contracts";

export const STORAGE_CAPACITY_GROUP_IDS = ["bulk", "tactical", "strategic"] as const satisfies readonly StorageCapacityGroupId[];

export const CANONICAL_STORAGE_RESOURCE_KEYS = [
  "chemicals", "biomass", "metal-parts", "neon-dust", "baseball-bat", "barricades",
  "stim-pack", "pulse-shot", "velvet-smoke", "tech-core", "pistol", "grenade", "vest", "cameras", "alarm",
  "combat-module", "ghost-serum", "overdrive-x", "smg", "bazooka", "defense-tower"
] as const;

const STORAGE_RESOURCE_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  metalParts: "metal-parts",
  metal_parts: "metal-parts",
  techCore: "tech-core",
  tech_core: "tech-core",
  combatModule: "combat-module",
  combat_module: "combat-module"
});

const NON_STOCKABLE_RESOURCE_KEYS = new Set([
  "cash", "clean-cash", "dirty-cash", "dirtyCash", "influence", "heat", "population",
  "spies", "gang-members", "gangMembers", "cooldowns"
]);

const STORAGE_RESOURCE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  chemicals: "Chemicals",
  biomass: "Biomass",
  "metal-parts": "Metal Parts",
  "neon-dust": "Neon Dust",
  "baseball-bat": "Baseballová pálka",
  barricades: "Barikády",
  "stim-pack": "Stim Pack",
  "pulse-shot": "Pulse Shot",
  "velvet-smoke": "Velvet Smoke",
  "tech-core": "Tech Core",
  pistol: "Pistole",
  grenade: "Granát",
  vest: "Vesta",
  cameras: "Kamery",
  alarm: "Alarm",
  "combat-module": "Bojový modul",
  "ghost-serum": "Ghost Serum",
  "overdrive-x": "Overdrive X",
  smg: "SMG",
  bazooka: "Bazuka",
  "defense-tower": "Tower"
});

export interface PlayerStorageItemSummary {
  resourceKey: string;
  label: string;
  currentAmount: number;
  maxAmount: number;
  fillPercent: number;
  isNearCapacity: boolean;
  isFull: boolean;
  isOverCapacity: boolean;
}

export interface PlayerStorageCapacitySummary {
  warehouseSummary: {
    ownedWarehouseCount: number;
    highestWarehouseLevel: number;
    warehouseCountMultiplier: number;
    warehouseLevelMultiplier: number;
    totalCapacityMultiplier: number;
  };
  groups: Array<{
    id: StorageCapacityGroupId;
    label: string;
    baseCapacity: number;
    currentCapacity: number;
    items: PlayerStorageItemSummary[];
  }>;
}

export interface WarehouseUpgradeCapacityPreview {
  before: Array<{ id: StorageCapacityGroupId; label: string; capacity: number }>;
  after: Array<{ id: StorageCapacityGroupId; label: string; capacity: number }>;
  capacityIncreases: boolean;
  noIncreaseReason: string | null;
}

export interface ResourceCreditContext {
  kind?: "new" | "restorative";
}

export interface ResourceCreditCheck {
  allowed: boolean;
  code: "storage_capacity_full" | "storage_capacity_exceeded" | "storage_resource_not_configured" | null;
  message: string | null;
  currentAmount: number;
  maxAmount: number | null;
  receivableAmount: number;
}

export class StorageCapacityError extends Error {
  readonly code = "storage_resource_not_configured";

  constructor(resourceKey: string) {
    super(`Storage resource \"${resourceKey}\" is not configured.`);
    this.name = "StorageCapacityError";
  }
}

export const normalizeStorageResourceKey = (resourceKey: string): string =>
  STORAGE_RESOURCE_ALIASES[String(resourceKey || "")] ?? String(resourceKey || "");

export const normalizeStorageBalances = (balances: Record<string, number>): Record<string, number> => {
  const normalized = { ...balances };
  for (const [alias, canonical] of Object.entries(STORAGE_RESOURCE_ALIASES)) {
    if (!(alias in normalized)) continue;
    normalized[canonical] = Math.max(0, Number(normalized[canonical] || 0)) + Math.max(0, Number(normalized[alias] || 0));
    delete normalized[alias];
  }
  return normalized;
};

export const getStorageResourceLabel = (resourceKey: string): string =>
  STORAGE_RESOURCE_LABELS[resourceKey] ?? resourceKey;

export const isNonStockableResource = (resourceKey: string): boolean =>
  NON_STOCKABLE_RESOURCE_KEYS.has(normalizeStorageResourceKey(resourceKey));

export const validateWarehouseStorageConfig = (config: WarehouseBalanceConfig): void => {
  const seen = new Set<string>();
  for (const groupId of STORAGE_CAPACITY_GROUP_IDS) {
    const group = config.storageCapacityGroups[groupId];
    if (!group || !Number.isInteger(group.baseCapacity) || group.baseCapacity <= 0) {
      throw new Error(`Warehouse storage group \"${groupId}\" requires a positive integer baseCapacity.`);
    }
    for (const key of group.resourceKeys) {
      const canonicalKey = normalizeStorageResourceKey(key);
      if (!CANONICAL_STORAGE_RESOURCE_KEYS.includes(canonicalKey as typeof CANONICAL_STORAGE_RESOURCE_KEYS[number])) {
        throw new Error(`Warehouse storage resource \"${key}\" is not known.`);
      }
      if (isNonStockableResource(canonicalKey)) {
        throw new Error(`Warehouse storage resource \"${key}\" must not be non-stockable.`);
      }
      if (seen.has(canonicalKey)) {
        throw new Error(`Warehouse storage resource \"${canonicalKey}\" belongs to more than one group.`);
      }
      seen.add(canonicalKey);
    }
  }
  for (const key of CANONICAL_STORAGE_RESOURCE_KEYS) {
    if (!seen.has(key)) throw new Error(`Warehouse storage resource \"${key}\" is not configured.`);
  }
  for (const tier of [0, 1, 2, 3, 4, 5] as const) {
    const multiplier = Number(config.warehouseCountMultipliers[tier]);
    if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 1.9) {
      throw new Error(`Warehouse count multiplier ${tier} must be between 1 and 1.9.`);
    }
  }
  if (Number(config.warehouseCountMultipliers[5]) !== 1.9) {
    throw new Error("Warehouse count multiplier for 5+ warehouses must be 1.9.");
  }
  for (const level of [1, 2, 3, 4] as const) {
    const multiplier = Number(config.warehouseLevelMultipliers[level]);
    if (!Number.isFinite(multiplier) || multiplier < 1) {
      throw new Error(`Warehouse level multiplier ${level} must be at least 1.`);
    }
  }
};
