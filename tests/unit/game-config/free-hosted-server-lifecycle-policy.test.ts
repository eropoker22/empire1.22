import { describe, expect, it } from "vitest";
import {
  FREE_HOSTED_SERVER_LIFECYCLE_POLICY,
  FREE_HOSTED_SERVER_TEMPLATE_POLICIES
} from "../../../packages/game-config/src";

describe("Free hosted server lifecycle policy", () => {
  it("keeps the two-player start separate from the one-hour registration window", () => {
    expect(FREE_HOSTED_SERVER_LIFECYCLE_POLICY).toEqual({
      version: 1,
      minimumReadyPlayersToStart: 2,
      registrationWindowMs: 3_600_000,
      allowJoinsWhileRunningDuringWindow: true,
      requireFreshWorkerForRegistration: true,
      allowSetupCompletionAfterWindow: true
    });
  });

  it("separates a small control server from a full server with elimination", () => {
    expect(FREE_HOSTED_SERVER_TEMPLATE_POLICIES.control).toEqual({
      template: "control", eliminationEnabled: false, capacityPolicy: "configurable"
    });
    expect(FREE_HOSTED_SERVER_TEMPLATE_POLICIES.full).toEqual({
      template: "full", eliminationEnabled: true, capacityPolicy: "canonical_max"
    });
  });
});
