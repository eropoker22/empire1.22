import { describe, expect, it } from "vitest";
import {
  FACTORY_CONFIG,
  FACTORY_SLOT_CONFIG,
  FACTORY_SLOT_STORAGE_CAPS
} from "../../packages/game-config/src/legacy-page/economy-config.js";
import { syncFactoryProduction } from "../../page-assets/js/app/runtime.js";

function createFactoryState(lastTick, overrides = {}) {
  return {
    level: 1,
    resources: { metalParts: 0, techCore: 0, combatModule: 0 },
    slots: FACTORY_SLOT_CONFIG.map((slot) => ({
      id: slot.id,
      recipeId: slot.recipeId,
      resourceKey: slot.resourceKey,
      mode: slot.mode,
      isProducing: false,
      queueMode: true,
      queuedAmount: 0,
      producedAmount: 0,
      productionRemainder: 0,
      reservedCleanCash: 0,
      reservedInputs: {},
      slotCap: FACTORY_SLOT_STORAGE_CAPS[slot.resourceKey],
      queueCap: FACTORY_CONFIG.recipes[slot.recipeId].queueCap,
      lastTick,
      ...(overrides[slot.resourceKey] || {})
    })),
    updatedAt: lastTick
  };
}

describe("local-demo Factory production lines", () => {
  it("uses generated canonical durations, local caps, and queue caps without passive rates", () => {
    expect(FACTORY_CONFIG.baseProductionPerHour).toBeUndefined();
    expect(FACTORY_CONFIG.slotDurationMs).toEqual({
      metalParts: 4 * 60_000,
      techCore: 8 * 60_000,
      combatModule: 15 * 60_000
    });
    expect(FACTORY_SLOT_STORAGE_CAPS).toEqual({ metalParts: 10, techCore: 5, combatModule: 2 });
    expect(Object.fromEntries(
      Object.entries(FACTORY_CONFIG.recipes).map(([recipeId, recipe]) => [recipeId, recipe.queueCap])
    )).toEqual({ "metal-parts": 8, "tech-core": 4, "combat-module": 2 });
  });

  it("does not produce anything when no paid unit is queued", () => {
    const startedAt = 1_000;
    const result = syncFactoryProduction(createFactoryState(startedAt), startedAt + 60 * 60_000);

    expect(result.state.slots.every((slot) => slot.producedAmount === 0 && slot.queuedAmount === 0)).toBe(true);
    expect(result.produced).toEqual({ metalParts: 0, techCore: 0, combatModule: 0 });
  });

  it("completes queued units one by one and never invents an unpaid output", () => {
    const startedAt = 2_000;
    const result = syncFactoryProduction(createFactoryState(startedAt, {
      metalParts: { isProducing: true, queuedAmount: 2, reservedCleanCash: 600 }
    }), startedAt + 8 * 60_000);
    const line = result.state.slots.find((slot) => slot.resourceKey === "metalParts");

    expect(line).toMatchObject({ producedAmount: 2, queuedAmount: 0, isProducing: false, reservedCleanCash: 0 });
    expect(result.state.resources.metalParts).toBe(2);
    expect(result.produced.metalParts).toBe(2);
  });

  it("pauses at the canonical local cap and preserves the paid queue", () => {
    const startedAt = 3_000;
    const result = syncFactoryProduction(createFactoryState(startedAt, {
      metalParts: { isProducing: true, queuedAmount: 4, producedAmount: 9 }
    }), startedAt + 60 * 60_000);
    const line = result.state.slots.find((slot) => slot.resourceKey === "metalParts");

    expect(line).toMatchObject({ producedAmount: 10, slotCap: 10, queuedAmount: 3, queueCap: 8, isProducing: false });
  });

  it("uses the Factory network only for speed and never scales either cap", () => {
    const startedAt = 4_000;
    const result = syncFactoryProduction(createFactoryState(startedAt, {
      metalParts: { isProducing: true, queuedAmount: 2 }
    }), startedAt + 220_000, { ownedFactoryCount: 2 });
    const line = result.state.slots.find((slot) => slot.resourceKey === "metalParts");

    expect(result.productionMultiplier).toBe(1.1);
    expect(line).toMatchObject({ producedAmount: 1, queuedAmount: 1, slotCap: 10, queueCap: 8 });
  });

  it("preserves a migrated queue above the new cap while blocking silent truncation", () => {
    const startedAt = 5_000;
    const result = syncFactoryProduction(createFactoryState(startedAt, {
      techCore: { isProducing: true, queuedAmount: 14 }
    }), startedAt);
    const line = result.state.slots.find((slot) => slot.resourceKey === "techCore");

    expect(line).toMatchObject({ queuedAmount: 14, queueCap: 4, producedAmount: 0 });
  });
});
