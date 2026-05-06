import { describe, expect, it } from "vitest";
import { resolveSpyScenario } from "../../packages/game-core/src/legacy-page/spy-preview-rules.js";

describe("legacy spy preview rules", () => {
  it("keeps the legacy district pattern without a dev-only override", () => {
    expect(resolveSpyScenario({ targetDistrictId: 1 })).toBe("Úspěch");
    expect(resolveSpyScenario({ targetDistrictId: 2 })).toBe("Částečný úspěch");
    expect(resolveSpyScenario({ targetDistrictId: 3 })).toBe("Neúspěch");
  });

  it("forces full spy success for the dev-only 99 percent override", () => {
    expect(resolveSpyScenario({ targetDistrictId: 3 }, {
      devOnlyFullSuccessChance: 0.99,
      roll: 0.98
    })).toBe("Úspěch");
  });

  it("falls back to the legacy pattern when the dev-only roll misses", () => {
    expect(resolveSpyScenario({ targetDistrictId: 3 }, {
      devOnlyFullSuccessChance: 0.99,
      roll: 0.995
    })).toBe("Neúspěch");
  });
});
