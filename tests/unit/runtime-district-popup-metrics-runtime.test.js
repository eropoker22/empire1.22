import { describe, expect, it, vi } from "vitest";
import {
  TRAP_MOVE_LOCK_MS,
  createDistrictPopupMetricsRuntime,
  formatTrapMoveCooldownLabel
} from "../../page-assets/js/app/runtime/districtPopupMetricsRuntime.js";

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
  const elements = {
    popupDefense: createElement(document),
    popupDefensePower: createElement(document),
    popupFlags: createElement(document),
    popupGossip: createElement(document),
    popupGossipList: createElement(document),
    popupHeat: createElement(document),
    popupIncome: createElement(document),
    popupInfluence: createElement(document),
    popupResidents: createElement(document)
  };
  const runtime = createDistrictPopupMetricsRuntime({
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
    ensureDistrictPassiveGossip: null,
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
      districtTrapById: { 1: { isArmed: true, ownerId: 1, armedAt: new Date(Date.now() - 1000).toISOString() } }
    }),
    isDistrictGossipDevOnlyMode: () => true,
    isDistrictTypeHidden: () => false,
    renderDistrictFlags: vi.fn(),
    renderDistrictMetricSummary: vi.fn(),
    elements,
    ...overrides
  });
  runtime.testElements = elements;
  return runtime;
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
    expect(runtime.getDistrictTrapControlState({ id: 1 }).subtitle).toMatch(/59:5\d/u);
    expect(runtime.getDistrictTrapControlState({ id: 1 }).buildingMeta).toMatch(/59:5\d/u);
    expect(runtime.hasKnownDistrictDefense({ id: 2 })).toBe(true);
  });

  it("uses a one-hour trap move lock and formats it as minutes and seconds", () => {
    expect(TRAP_MOVE_LOCK_MS).toBe(60 * 60 * 1000);
    expect(formatTrapMoveCooldownLabel(3600)).toBe("60:00");
    expect(formatTrapMoveCooldownLabel(125)).toBe("2:05");
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

  it("hides income summary card for foreign districts", () => {
    const runtime = createRuntime();
    const incomeCard = { hidden: false };
    runtime.testElements.popupIncome.closest = (selector) =>
      selector === ".district-popup-summary-card" ? incomeCard : null;

    runtime.renderDistrictEconomySummary({ id: 2, districtType: "industrial" });
    expect(incomeCard.hidden).toBe(true);

    runtime.renderDistrictEconomySummary({ id: 1, districtType: "industrial" });
    expect(incomeCard.hidden).toBe(false);
  });

  it("hides influence summary card for unknown foreign districts", () => {
    const runtime = createRuntime({
      isDistrictTypeHidden: (district) => Number(district.id) === 2
    });
    const influenceCard = { hidden: false };
    runtime.testElements.popupInfluence.closest = (selector) =>
      selector === ".district-popup-summary-card" ? influenceCard : null;

    runtime.renderDistrictEconomySummary({ id: 2, districtType: "industrial" });
    expect(influenceCard.hidden).toBe(true);

    runtime.renderDistrictEconomySummary({ id: 3, districtType: "industrial" });
    expect(influenceCard.hidden).toBe(false);

    runtime.renderDistrictEconomySummary({ id: 1, districtType: "industrial" });
    expect(influenceCard.hidden).toBe(false);
  });

  it("renders passive district gossip in the popup card", () => {
    const runtime = createRuntime({
      ensureDistrictPassiveGossip: () => [
        { text: "Pasivní drb z tooltipu", intelLevel: "rumor", intelType: "district_seed", createdAt: 1 },
        { text: "Druhý drb", intelLevel: "verified", intelType: "rumor", createdAt: 2 }
      ]
    });

    runtime.renderDistrictPopupGossip({ id: 1 });

    expect(runtime.testElements.popupGossip.hidden).toBe(false);
    expect(runtime.testElements.popupGossipList.children).toHaveLength(2);
    expect(runtime.testElements.popupGossipList.children[0].children[0].textContent).toBe("Pasivní drb z tooltipu");
  });
});
