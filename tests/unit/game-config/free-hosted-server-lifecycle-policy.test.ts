import { describe, expect, it } from "vitest";
import {
  FREE_HOSTED_SERVER_LIFECYCLE_POLICY,
  FREE_HOSTED_SERVER_TEMPLATE_POLICIES,
  resolveModeConfig
} from "../../../packages/game-config/src";

describe("Free hosted server lifecycle policy", () => {
  it("allows a single-player start while keeping the one-hour registration window", () => {
    expect(FREE_HOSTED_SERVER_LIFECYCLE_POLICY).toEqual({
      version: 2,
      minimumReadyPlayersToStart: 1,
      registrationWindowMs: 3_600_000,
      allowJoinsWhileRunningDuringWindow: true,
      requireFreshWorkerForRegistration: true,
      allowSetupCompletionAfterWindow: true
    });
  });

  it("enables elimination for both flexible and full hosted servers", () => {
    expect(FREE_HOSTED_SERVER_TEMPLATE_POLICIES.control).toEqual({
      template: "control", eliminationEnabled: true, capacityPolicy: "configurable"
    });
    expect(FREE_HOSTED_SERVER_TEMPLATE_POLICIES.full).toEqual({
      template: "full", eliminationEnabled: true, capacityPolicy: "canonical_max"
    });
  });

  it("keeps the canonical full server at twenty players with Purge, Final Lockdown, and police enabled", () => {
    const config = resolveModeConfig("free");

    expect(config.balance.maxPlayersPerServer).toBe(20);
    expect(config.balance.elimination).toMatchObject({
      enabled: true,
      minActivePlayers: 8
    });
    expect(config.balance.finalLockdown).toMatchObject({
      enabled: true,
      triggerActivePlayers: 8
    });
    expect(config.balance.police).toMatchObject({
      highPressureRaidThreshold: expect.any(Number),
      maxPendingRaidsPerPlayer: 1,
      autoResolveExpiredPendingRaids: true
    });
  });
});
