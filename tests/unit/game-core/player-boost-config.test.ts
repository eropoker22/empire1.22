import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { validatePlayerBoostConfig } from "@empire/game-core";
// @ts-expect-error The generated browser adapter is intentionally plain JavaScript.
import { BROWSER_GAMEPLAY_CONFIG } from "../../../packages/game-config/src/legacy-page/gameplay-config.generated.js";

const config = resolveModeConfig("free");
const boosts = config.balance.playerBoosts!;
const minutes = (ticks: number) => ticks * config.tickRateMs / 60_000;

describe("strategic player boost config", () => {
  it("contains exactly the three canonical protocols", () => {
    expect(Object.keys(boosts)).toEqual([
      "ghost-network",
      "industrial-overdrive",
      "tactical-grid"
    ]);
    expect(() => validatePlayerBoostConfig(boosts)).not.toThrow();
  });

  it("defines the exact Ghost Network balance", () => {
    expect(boosts["ghost-network"]).toMatchObject({
      cleanCashCost: 5_000,
      inputCosts: { "ghost-serum": 2, "pulse-shot": 2 },
      consumptionMode: "timed",
      effect: {
        spyDurationMultiplier: 0.65,
        criticalFailureChanceMultiplier: 0.75,
        extraIntelBlocksOnSuccess: 1
      }
    });
    expect(minutes(boosts["ghost-network"].activeDurationTicks)).toBe(12);
    expect(minutes(boosts["ghost-network"].cooldownTicks)).toBe(35);
  });

  it("defines the exact Industrial Overdrive balance", () => {
    expect(boosts["industrial-overdrive"]).toMatchObject({
      cleanCashCost: 7_500,
      inputCosts: { "overdrive-x": 2, "combat-module": 2 },
      consumptionMode: "timed",
      effect: { productionSpeedMultiplier: 1.25 }
    });
    expect(minutes(boosts["industrial-overdrive"].activeDurationTicks)).toBe(12);
    expect(minutes(boosts["industrial-overdrive"].cooldownTicks)).toBe(45);
  });

  it("defines the exact Tactical Grid balance", () => {
    expect(boosts["tactical-grid"]).toMatchObject({
      cleanCashCost: 10_000,
      inputCosts: { "ghost-serum": 2, "overdrive-x": 1, "combat-module": 3 },
      consumptionMode: "next-valid-pvp-combat",
      effect: { combatPowerMultiplier: 1.12 }
    });
    expect(minutes(boosts["tactical-grid"].activeDurationTicks)).toBe(20);
    expect(minutes(boosts["tactical-grid"].cooldownTicks)).toBe(60);
  });

  it("keeps the generated browser config identical to typed balance", () => {
    for (const [boostId, definition] of Object.entries(boosts)) {
      expect(BROWSER_GAMEPLAY_CONFIG.playerBoosts[boostId]).toMatchObject({
        boostId,
        cleanCashCost: definition.cleanCashCost,
        inputCosts: definition.inputCosts,
        durationMs: definition.activeDurationTicks * config.tickRateMs,
        cooldownMs: definition.cooldownTicks * config.tickRateMs,
        consumptionMode: definition.consumptionMode,
        effect: definition.effect,
        uiAccent: definition.uiAccent,
        iconKey: definition.iconKey
      });
    }
  });
});
