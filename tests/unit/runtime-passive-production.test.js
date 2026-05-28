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
    resources: {
      metalParts: 0,
      techCore: 0,
      combatModule: 0
    },
    slots: FACTORY_SLOT_CONFIG.map((slot) => ({
      id: slot.id,
      resourceKey: slot.resourceKey,
      mode: slot.mode,
      isProducing: slot.mode === "produce",
      producedAmount: 0,
      productionRemainder: 0,
      slotCap: FACTORY_SLOT_STORAGE_CAPS[slot.resourceKey],
      lastTick,
      ...(overrides[slot.resourceKey] || {})
    })),
    updatedAt: lastTick
  };
}

describe("legacy runtime passive production", () => {
  it("keeps factory config rates aligned with slot production durations", () => {
    expect(FACTORY_CONFIG.baseProductionPerHour.metalParts).toBe(60 / 4);
    expect(FACTORY_CONFIG.baseProductionPerHour.techCore).toBe(60 / 8);
    expect(FACTORY_CONFIG.combatModule.durationMs).toBe(FACTORY_CONFIG.slotDurationMs.combatModule);
  });

  it("syncs factory production from elapsed time without opening the factory popup", () => {
    const startedAt = 1_000;
    const now = startedAt + 60 * 60 * 1000;
    const result = syncFactoryProduction(createFactoryState(startedAt), now);

    expect(result.state.slots.find((slot) => slot.resourceKey === "metalParts")?.producedAmount).toBe(15);
    expect(result.state.slots.find((slot) => slot.resourceKey === "techCore")?.producedAmount).toBe(7);
    expect(result.state.slots.every((slot) => slot.lastTick === now)).toBe(true);
  });

  it("does not produce into paused factory slots during offline sync", () => {
    const startedAt = 2_000;
    const now = startedAt + 60 * 60 * 1000;
    const result = syncFactoryProduction(createFactoryState(startedAt, {
      metalParts: { isProducing: false }
    }), now);

    expect(result.state.slots.find((slot) => slot.resourceKey === "metalParts")?.producedAmount).toBe(0);
    expect(result.state.slots.find((slot) => slot.resourceKey === "metalParts")?.lastTick).toBe(now);
    expect(result.state.slots.find((slot) => slot.resourceKey === "techCore")?.producedAmount).toBe(7);
  });

  it("drains queued factory production and stops the slot when the queued amount is complete", () => {
    const startedAt = 3_000;
    const now = startedAt + 60 * 60 * 1000;
    const result = syncFactoryProduction(createFactoryState(startedAt, {
      metalParts: {
        queueMode: true,
        queuedAmount: 2,
        isProducing: true
      }
    }), now);
    const metalSlot = result.state.slots.find((slot) => slot.resourceKey === "metalParts");

    expect(metalSlot?.producedAmount).toBe(2);
    expect(metalSlot?.queuedAmount).toBe(0);
    expect(metalSlot?.isProducing).toBe(false);
  });

  it("does not add tech core output before the production cycle is complete", () => {
    const startedAt = 3_500;
    const beforeCycle = syncFactoryProduction(createFactoryState(startedAt, {
      metalParts: { isProducing: false },
      techCore: { queueMode: true, queuedAmount: 3, isProducing: true }
    }), startedAt + 7 * 60 * 1000);
    const pendingTechSlot = beforeCycle.state.slots.find((slot) => slot.resourceKey === "techCore");

    expect(pendingTechSlot?.producedAmount).toBe(0);
    expect(pendingTechSlot?.queuedAmount).toBe(3);
    expect(pendingTechSlot?.productionRemainder).toBeGreaterThan(0);
    expect(beforeCycle.state.resources.techCore).toBe(0);

    const afterCycle = syncFactoryProduction(beforeCycle.state, startedAt + 8 * 60 * 1000);
    const readyTechSlot = afterCycle.state.slots.find((slot) => slot.resourceKey === "techCore");

    expect(readyTechSlot?.producedAmount).toBe(1);
    expect(readyTechSlot?.queuedAmount).toBe(2);
    expect(afterCycle.state.resources.techCore).toBe(1);
  });

  it("caps combat module output until the player collects factory supplies", () => {
    const startedAt = 4_000;
    const now = startedAt + 60 * 60 * 1000;
    const result = syncFactoryProduction(createFactoryState(startedAt, {
      combatModule: {
        queueMode: true,
        queuedAmount: 10,
        isProducing: true
      }
    }), now);
    result.state.resources.metalParts = 100;
    result.state.resources.techCore = 100;

    const filledResult = syncFactoryProduction(result.state, now + 60 * 60 * 1000);
    const filledCombatSlot = filledResult.state.slots.find((slot) => slot.resourceKey === "combatModule");

    expect(filledCombatSlot?.producedAmount).toBe(FACTORY_SLOT_STORAGE_CAPS.combatModule);
    expect(filledCombatSlot?.queuedAmount).toBe(5);
    expect(filledCombatSlot?.isProducing).toBe(true);
  });
});
