import { describe, expect, it } from "vitest";
import {
  BOUNTY_DEMO_TARGETS,
  resolveBountyDemoTargets
} from "../../page-assets/js/app/dev-fixtures/bountyDemoData.js";

describe("bounty demo targets", () => {
  it("uses explicit parity targets, including an explicit empty list", () => {
    const hostedTargets = [{ playerId: "player:hosted-peer", name: "Hosted Peer" }];

    expect(resolveBountyDemoTargets({ bountyDemoTargets: hostedTargets })).toBe(hostedTargets);
    expect(resolveBountyDemoTargets({ bountyDemoTargets: [] })).toEqual([]);
  });

  it("falls back to the canonical three demo targets when no explicit list exists", () => {
    expect(resolveBountyDemoTargets()).toBe(BOUNTY_DEMO_TARGETS);
    expect(resolveBountyDemoTargets({ bountyDemoTargets: null })).toBe(BOUNTY_DEMO_TARGETS);
    expect(BOUNTY_DEMO_TARGETS).toHaveLength(3);
  });
});
