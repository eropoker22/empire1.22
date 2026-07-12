import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import {
  canPlayerReceiveResource,
  createPlayerView,
  normalizePlayerStorageResourceAliases,
  resolveHighestWarehouseLevelMultiplier,
  resolvePlayerStorageCapacitySummary,
  resolveWarehouseUpgradeCapacityPreview,
  resolveWarehouseCountMultiplier
} from "@empire/game-core";
import { createCoreStateFixture, createFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

const config = resolveModeConfig("free");
const warehouseConfig = config.balance.warehouse!;

const addWarehouse = (
  state: ReturnType<typeof createCoreStateFixture>,
  index: number,
  level = 1,
  overrides: Partial<ReturnType<typeof createFixedBuildingFixture>> = {}
) => {
  const warehouse = createFixedBuildingFixture("warehouse", {
    id: `building:warehouse:${index}`,
    level,
    ...overrides
  });
  state.buildingsById[warehouse.id] = warehouse;
  return warehouse;
};

describe("warehouse storage capacity", () => {
  it("defines each canonical stock resource exactly once and excludes non-stockable values", () => {
    const groups = warehouseConfig.storageCapacityGroups;
    expect(groups.bulk.baseCapacity).toBe(60);
    expect(groups.tactical.baseCapacity).toBe(24);
    expect(groups.strategic.baseCapacity).toBe(8);
    const keys = Object.values(groups).flatMap((group) => group.resourceKeys);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain("cash");
    expect(keys).not.toContain("influence");
    expect(keys).not.toContain("heat");
    expect(keys).not.toContain("population");
  });

  it.each([
    [0, 1], [1, 1.5], [2, 1.6], [3, 1.7], [4, 1.8], [5, 1.9], [6, 1.9]
  ])("uses the canonical count multiplier for %i warehouses", (count, expected) => {
    expect(resolveWarehouseCountMultiplier(count, warehouseConfig)).toBe(expected);
  });

  it.each([
    [0, 1], [1, 1], [2, 1.12], [3, 1.25], [4, 1.4]
  ])("uses the canonical highest-level multiplier for level %i", (level, expected) => {
    expect(resolveHighestWarehouseLevelMultiplier(level, warehouseConfig)).toBe(expected);
  });

  it.each([
    [[], [60, 24, 8]],
    [[[1]], [90, 36, 12]],
    [[[2]], [101, 41, 14]],
    [[[3]], [113, 45, 15]],
    [[[4]], [126, 51, 17]],
    [[[3], [3]], [120, 48, 16]],
    [[[4], [4], [4]], [143, 58, 20]],
    [[[4], [4], [4], [4], [4]], [160, 64, 22]]
  ])("calculates group capacity from active count and highest level", (levels, expected) => {
    const state = createCoreStateFixture();
    levels.forEach(([level], index) => addWarehouse(state, index, level));
    const summary = resolvePlayerStorageCapacitySummary(state, "player:1", warehouseConfig);
    expect(summary.groups.map((group) => group.currentCapacity)).toEqual(expected);
  });

  it("counts only active warehouses owned by the player and preserves over-capacity inventory", () => {
    const state = createCoreStateFixture();
    addWarehouse(state, 1, 4);
    addWarehouse(state, 2, 4, { status: "disabled" });
    addWarehouse(state, 3, 4, { status: "destroyed" });
    addWarehouse(state, 4, 4, { status: "constructing" });
    addWarehouse(state, 5, 4, { ownerPlayerId: "player:other" });
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: { chemicals: 130 }
    };

    const summary = resolvePlayerStorageCapacitySummary(state, "player:1", warehouseConfig);
    const chemicals = summary.groups[0].items.find((item) => item.resourceKey === "chemicals")!;
    expect(summary.warehouseSummary).toMatchObject({ ownedWarehouseCount: 1, highestWarehouseLevel: 4 });
    expect(chemicals).toMatchObject({ currentAmount: 130, maxAmount: 126, isOverCapacity: true, isFull: false });
    expect(canPlayerReceiveResource(state, "player:1", "chemicals", 1, warehouseConfig).code).toBe("storage_capacity_exceeded");
  });

  it("normalizes compatibility aliases exactly once in the player read model", () => {
    const state = createCoreStateFixture();
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: { "metal-parts": 4, metalParts: 6, techCore: 2 }
    };
    const view = createPlayerView(state, "player:1", {
      config,
      clock: { nowIso: () => new Date(0).toISOString() }
    } as any);

    expect(view.resourceBalances).toMatchObject({ "metal-parts": 10, "tech-core": 2 });
    expect(view.resourceBalances.metalParts).toBeUndefined();
    expect(view.storage?.groups[0].items.find((item) => item.resourceKey === "metal-parts")?.currentAmount).toBe(10);
  });

  it("migrates storage aliases idempotently without changing total inventory", () => {
    const state = createCoreStateFixture();
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: { metalParts: 4, "metal-parts": 6, techCore: 2 }
    };
    const migrated = normalizePlayerStorageResourceAliases(state);
    const migratedAgain = normalizePlayerStorageResourceAliases(migrated);

    expect(migrated.resourceStatesById["resource:1"].balances).toMatchObject({ "metal-parts": 10, "tech-core": 2 });
    expect(migrated.resourceStatesById["resource:1"].balances.metalParts).toBeUndefined();
    expect(migratedAgain).toBe(migrated);
  });

  it("projects before and after capacities for a warehouse upgrade", () => {
    const state = createCoreStateFixture();
    const warehouse = addWarehouse(state, 1, 2);
    const preview = resolveWarehouseUpgradeCapacityPreview(state, warehouse, warehouseConfig)!;

    expect(preview.before.map((group) => group.capacity)).toEqual([101, 41, 14]);
    expect(preview.after.map((group) => group.capacity)).toEqual([113, 45, 15]);
    expect(preview.capacityIncreases).toBe(true);
    expect(preview.noIncreaseReason).toBeNull();
  });

  it("does not promise a storage increase below an existing higher warehouse level", () => {
    const state = createCoreStateFixture();
    const upgradedWarehouse = addWarehouse(state, 1, 1);
    addWarehouse(state, 2, 4);
    const preview = resolveWarehouseUpgradeCapacityPreview(state, upgradedWarehouse, warehouseConfig)!;

    expect(preview.capacityIncreases).toBe(false);
    expect(preview.noIncreaseReason).toContain("jiné aktivní Skladiště");
    expect(preview.before).toEqual(preview.after);
  });
});
