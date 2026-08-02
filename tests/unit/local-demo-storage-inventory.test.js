import { describe, expect, it } from "vitest";
import {
  STREET_DEALERS_CONFIG,
  WAREHOUSE_STORAGE_CONFIG
} from "../../packages/game-config/src/legacy-page/economy-config.js";
import {
  normalizeExistingStorageAmount,
  normalizeExistingStorageBuckets,
  resolveLocalDemoStorageCapacityState
} from "../../page-assets/js/app/runtime/localDemoStorageInventory.js";

const getBaseCapacity = (resourceKey) => Object.values(
  WAREHOUSE_STORAGE_CONFIG.groups
).find((group) => group.resourceKeys.includes(resourceKey))?.baseCapacity;

describe("local demo storage inventory", () => {
  it("preserves configured over-capacity Street Dealers stock and reports it honestly", () => {
    const stockByDrug = Object.fromEntries(STREET_DEALERS_CONFIG.sellableDrugs.map((drug) => {
      const capacityState = resolveLocalDemoStorageCapacityState(200, getBaseCapacity(drug.itemId));
      return [drug.itemId, capacityState];
    }));

    expect(stockByDrug).toEqual({
      "neon-dust": {
        currentAmount: 200,
        maxAmount: 60,
        fillPercent: 200 / 60 * 100,
        isNearCapacity: false,
        isFull: false,
        isOverCapacity: true
      },
      "pulse-shot": {
        currentAmount: 200,
        maxAmount: 24,
        fillPercent: 200 / 24 * 100,
        isNearCapacity: false,
        isFull: false,
        isOverCapacity: true
      },
      "velvet-smoke": {
        currentAmount: 200,
        maxAmount: 24,
        fillPercent: 200 / 24 * 100,
        isNearCapacity: false,
        isFull: false,
        isOverCapacity: true
      }
    });
  });

  it("normalizes malformed existing amounts without applying an upper capacity clamp", () => {
    expect(normalizeExistingStorageAmount("200.9")).toBe(200);
    expect(normalizeExistingStorageAmount(-4)).toBe(0);
    expect(normalizeExistingStorageAmount(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("never restores spent drug stock from a stale duplicate in materials", () => {
    const normalized = normalizeExistingStorageBuckets({
      resourceKeys: ["neon-dust"],
      materials: { "neon-dust": 200 },
      drugs: { "neon-dust": 10 },
      weapons: {},
      isDrugResource: (resourceKey) => resourceKey === "neon-dust"
    });

    expect(normalized.changed).toBe(false);
    expect(normalized.materials["neon-dust"]).toBe(200);
    expect(normalized.drugs["neon-dust"]).toBe(10);
  });
});
