import { describe, expect, it, vi } from "vitest";
import { createDistrictPopupMetricsRuntime } from "../../page-assets/js/app/runtime/districtPopupMetricsRuntime.js";

class FakeElement {
  constructor(tagName = "div", ownerDocument = null) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.className = "";
    this.textContent = "";
    this.hidden = false;
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(tagName, this);
  }
}

function createElement(document, tagName = "div") {
  return document.createElement(tagName);
}

function createRuntime(overrides = {}) {
  const document = new FakeDocument();
  return createDistrictPopupMetricsRuntime({
    calculateTotalDefensePower: ({ loadout, residents }) =>
      Object.values(loadout || {}).reduce((sum, value) => sum + Number(value || 0), 0) + residents,
    currentPlayerId: 1,
    formatDefenseLoadout: (loadout) => Object.keys(loadout || {}).join(", "),
    formatDistrictGossipTimestamp: () => "teď",
    formatDistrictHeatLabel: (value) => String(value),
    formatDistrictIncomeLabel: (value) => String(value),
    formatDistrictInfluenceLabel: (value) => String(value),
    getCurrentPlayerOwnedDistrictIds: () => new Set([1]),
    getDistrictEconomySnapshot: () => ({ totalHourlyIncome: 10, passiveHeatPerDay: 2, totalInfluencePerHour: 3 }),
    getDistrictGossipEntries: () => [{ text: "Nový drb", intelLevel: "verified", intelType: "rumor", createdAt: Date.now() }],
    getInteractionState: () => ({
      gamePhase: "launch",
      destroyedDistrictIds: new Set()
    }),
    getResolvedSpyIntel: () => ({ revealedDefenseDistrictIds: [2] }),
    getResolvedWorldState: () => ({
      districtDefenseById: { 1: 6 },
      districtDefenseLoadoutById: { 1: { pistol: 2 } },
      districtDefenseResidentsById: { 1: 3 },
      districtTrapById: { 1: { isArmed: true, ownerId: 1, armedAt: new Date().toISOString() } }
    }),
    isDistrictGossipDevOnlyMode: () => true,
    isDistrictTypeHidden: () => false,
    renderDistrictFlags: vi.fn(),
    renderDistrictMetricSummary: vi.fn(),
    elements: {
      popupDefense: createElement(document),
      popupDefensePower: createElement(document),
      popupFlags: createElement(document),
      popupGossip: createElement(document),
      popupGossipList: createElement(document),
      popupHeat: createElement(document),
      popupIncome: createElement(document),
      popupInfluence: createElement(document),
      popupResidents: createElement(document)
    },
    ...overrides
  });
}

describe("district popup metrics runtime", () => {
  it("keeps defense, trap and popup helpers read-only and deterministic", () => {
    const runtime = createRuntime();

    expect(runtime.getDistrictDefenseState(1)).toEqual({
      loadout: { pistol: 2 },
      residents: 3,
      totalPower: 6
    });
    expect(runtime.getCurrentPlayerTrapDistrictId()).toBe(1);
    expect(runtime.getDistrictTrapControlState({ id: 1 }).label).toBe("Past aktivní");
    expect(runtime.hasKnownDistrictDefense({ id: 2 })).toBe(true);
  });

  it("renders metric and gossip fallbacks without runtime DOM coupling", () => {
    const renderDistrictMetricSummary = vi.fn();
    const renderDistrictFlags = vi.fn();
    const runtime = createRuntime({ renderDistrictMetricSummary, renderDistrictFlags });

    runtime.renderDistrictDefenseSummary({ id: 1 });
    runtime.renderDistrictEconomySummary({ id: 1, districtType: "industrial" });
    runtime.renderDistrictPopupGossip({ id: 1 });
    runtime.renderDistrictPopupFlags([{ label: "flag" }]);

    expect(renderDistrictMetricSummary).toHaveBeenCalledTimes(2);
    expect(renderDistrictFlags).toHaveBeenCalledWith(expect.any(FakeElement), [{ label: "flag" }]);
  });
});
