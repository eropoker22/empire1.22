import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

describe("free mode performance timing", () => {
  const config = resolveModeConfig("free");
  const tickRateMs = config.tickRateMs;

  it("uses one canonical ten-second gameplay tick", () => {
    expect(tickRateMs).toBe(10_000);
    expect(config.publicMeta.tickRateMs).toBe(10_000);
  });

  it("preserves conflict and protection durations in wall-clock time", () => {
    const conflict = config.balance.conflict!;
    const heist = conflict.heist!;

    expect(conflict.attackCooldownTicks * tickRateMs).toBe(22 * minute);
    expect(conflict.spyCooldownTicks * tickRateMs).toBe(6 * minute);
    expect(conflict.spyCaptureCooldownTicks! * tickRateMs).toBe(10 * minute);
    expect(heist.globalCooldownTicks * tickRateMs).toBe(8 * minute);
    expect(heist.sameTargetCooldownTicks * tickRateMs).toBe(12 * minute);
    expect(conflict.attackTargetProtectionTicks! * tickRateMs).toBe(10 * minute);
    expect(conflict.minAttackDurationTicks! * tickRateMs).toBe(22 * minute);
  });

  it("preserves production durations after the mode cooldown multiplier", () => {
    const cooldownMultiplier = config.balance.cooldownMultiplier;
    const pharmacy = config.balance.pharmacy!;
    const factory = config.balance.factory!;

    expect(Math.ceil(pharmacy.recipes["stim-pack"].durationTicksPerUnit * cooldownMultiplier) * tickRateMs)
      .toBe(10 * minute);
    expect(Math.ceil(factory.recipes["combat-module"].durationTicksPerUnit * cooldownMultiplier) * tickRateMs)
      .toBe(15 * minute);
  });

  it("preserves day-night, elimination, lockdown and full server duration", () => {
    const elimination = config.balance.elimination!;
    const finalLockdown = config.balance.finalLockdown!;

    expect(config.balance.dayLengthTicks * tickRateMs).toBe(2 * hour);
    expect(config.balance.nightLengthTicks * tickRateMs).toBe(2 * hour);
    expect(elimination.intervalTicks * tickRateMs).toBe(4 * hour);
    expect(elimination.firstEliminationTick * tickRateMs).toBe(8 * hour);
    expect(finalLockdown.activeDurationTicks * tickRateMs).toBe(12 * hour);
    expect(config.balance.hardTimeoutTicks! * tickRateMs).toBe(7 * day);
    expect(config.technical.gameDurationMs).toBe(7 * day);
  });

  it("preserves police raid wall-clock intervals", () => {
    const police = config.balance.police!;

    expect(police.raidDurationTicks * tickRateMs).toBe(60 * minute);
    expect(police.raidCooldownTicks * tickRateMs).toBe(240 * minute);
  });
});
