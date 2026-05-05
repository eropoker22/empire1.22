import { describe, expect, it } from "vitest";
import {
  evaluateFreeSessionReadiness,
  getFreeSessionReadinessStatus
} from "../../page-assets/js/app/dev/freeSessionChecklist.js";

class FakeRoot {
  constructor(selectors = []) {
    this.selectors = new Set(selectors);
  }

  querySelector(selector) {
    const options = String(selector || "").split(",").map((item) => item.trim());
    return options.some((item) => this.selectors.has(item)) ? {} : null;
  }
}

describe("free session readiness checklist", () => {
  it("returns ready when critical state, DOM and APIs are present", () => {
    const result = evaluateFreeSessionReadiness({
      root: new FakeRoot([
        "[data-map-canvas]",
        "[data-topbar-clean-money]",
        "[data-storage-popup]",
        "[data-district-building-detail]",
        "[data-production-panel]",
        "[data-spy-confirm-popup]",
        "[data-attack-confirm-popup]",
        "[data-attack-result-modal]",
        "[data-wanted-panel]",
        "[data-police-action-result-modal]"
      ]),
      state: {
        playerId: "player",
        player: { id: "player" },
        districts: [
          { id: 1, ownerId: "player", buildings: [{ id: "factory" }] },
          { id: 2, ownerId: "enemy" }
        ]
      },
      windowRef: {
        EmpireRuntime: { refreshAllUi() {} },
        empireStreetsDistrictState: { getSelectedDistrict() {} }
      }
    });

    expect(result.status).toBe("ready");
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("returns partial for warning-only gaps and blocked for critical gaps", () => {
    const partial = evaluateFreeSessionReadiness({
      root: new FakeRoot(["[data-map-canvas]"]),
      state: {
        player: { id: "player" },
        districts: [{ id: 1, isOwned: true }]
      },
      windowRef: {}
    });

    expect(partial.status).toBe("partial");
    expect(partial.blockers).toEqual([]);
    expect(partial.warnings.length).toBeGreaterThan(0);

    const blocked = evaluateFreeSessionReadiness({
      root: new FakeRoot([]),
      state: {},
      windowRef: {}
    });

    expect(blocked.status).toBe("blocked");
    expect(blocked.blockers.map((check) => check.id)).toContain("player");
  });

  it("summarizes statuses from arbitrary checks", () => {
    expect(getFreeSessionReadinessStatus([{ ready: true }])).toBe("ready");
    expect(getFreeSessionReadinessStatus([{ ready: false, severity: "warning" }])).toBe("partial");
    expect(getFreeSessionReadinessStatus([{ ready: false, severity: "blocker" }])).toBe("blocked");
  });
});
