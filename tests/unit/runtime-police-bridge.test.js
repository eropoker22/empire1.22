import { describe, expect, it } from "vitest";
import {
  createPoliceHeatBridge,
  resolvePoliceHeatFeedback
} from "../../page-assets/js/app/runtime/policeHeatBridge.js";

class FakeClassList {
  constructor() {
    this.tokens = new Set();
  }

  add(...tokens) {
    for (const token of tokens) this.tokens.add(token);
  }

  contains(token) {
    return this.tokens.has(token);
  }
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.dataset = {};
    this.textContent = "";
    this.parentNode = null;
    this.hidden = false;
    this.listeners = new Map();
  }

  append(...children) {
    for (const child of children) {
      if (child && typeof child === "object") child.parentNode = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  addEventListener(name, listener) {
    this.listeners.set(name, listener);
  }

  click() {
    this.listeners.get("click")?.({ type: "click", target: this });
  }

  querySelector() {
    return null;
  }
}

class FakeDocument {
  createElement(tagName) {
    const element = new FakeElement(tagName);
    element.ownerDocument = this;
    return element;
  }

  addEventListener() {}

  dispatchEvent() {}
}

describe("runtime police heat bridge", () => {
  it("uses the core PoliceReadModel before legacy heat fallback", () => {
    const feedback = resolvePoliceHeatFeedback({
      player: {
        playerId: "player:1",
        police: {
          playerId: "player:1",
          heat: 72,
          wantedLevel: 3,
          wantedLabel: "3 / 5",
          riskTier: "high",
          aggregatePressure: 132,
          playerHeatPressure: 72,
          districtHeatPressure: 60,
          hottestDistrictId: "district:7",
          hottestDistrictHeat: 60,
          pendingRaid: {
            raidId: "police:raid:1",
            severity: "high",
            reason: "aggregate-pressure:132",
            previewConsequences: {
              seizedDirtyCash: 18,
              heatReducedBy: 25
            }
          },
          policeFeed: [
            {
              id: "police:event:1",
              type: "police-raid-pending",
              message: "Raid pending."
            }
          ],
          lastPoliceEvent: {
            id: "police:event:1",
            type: "police-raid-pending",
            message: "Raid pending."
          },
          recommendedAction: "Zvaž pauzu v útocích."
        }
      },
      gangState: {
        heat: 0
      }
    });

    expect(feedback).toMatchObject({
      heat: 72,
      riskKey: "high",
      aggregatePressure: 132,
      districtHeatPressure: 60,
      hottestDistrictId: "district:7",
      hottestDistrictHeat: 60,
      hasCoreReadModel: true,
      hasRealPoliceEvent: true,
      pendingRaid: {
        raidId: "police:raid:1"
      },
      previewConsequences: {
        seizedDirtyCash: 18
      }
    });
  });

  it("keeps the legacy fallback when the core read model is missing", () => {
    const feedback = resolvePoliceHeatFeedback({
      gangState: {
        heat: 96
      },
      heatLevel: {
        id: 4
      },
      policeActions: {}
    });

    expect(feedback).toMatchObject({
      riskKey: "high",
      aggregatePressure: 96,
      hasCoreReadModel: false,
      hottestDistrictId: null,
      pendingRaid: null
    });
  });

  it("renders police feedback inside the wanted popup card instead of the right rail", () => {
    const documentRef = new FakeDocument();
    const root = new FakeElement("main");
    const wantedFeed = new FakeElement("section");
    const toggle = new FakeElement("button");
    const policeWindow = new FakeElement("aside");
    const closeButton = new FakeElement("button");
    const rightRail = new FakeElement("aside");
    wantedFeed.ownerDocument = documentRef;
    toggle.ownerDocument = documentRef;
    policeWindow.ownerDocument = documentRef;
    closeButton.ownerDocument = documentRef;
    rightRail.ownerDocument = documentRef;
    root.querySelector = (selector) => {
      if (selector === "[data-wanted-popup-police-feed]") return wantedFeed;
      if (selector === "[data-wanted-popup-police-toggle]") return toggle;
      if (selector === "[data-wanted-popup-police-window]") return policeWindow;
      if (selector === "[data-wanted-popup-police-close]") return closeButton;
      if (selector === "#game-rail-right") return rightRail;
      return null;
    };

    const bridge = createPoliceHeatBridge({
      root,
      documentRef,
      getState: () => ({
        gangState: { heat: 96 },
        heatLevel: { id: 4 },
        policeActions: {}
      })
    });

    bridge.init();

    expect(wantedFeed.attributes.get("data-police-feed")).toBe("");
    expect(wantedFeed.classList.contains("police-feed-panel")).toBe(true);
    expect(policeWindow.hidden).toBe(true);
    expect(wantedFeed.hidden).toBe(false);
    expect(wantedFeed.children.length).toBeGreaterThan(0);
    expect(rightRail.children).toHaveLength(0);

    toggle.click();
    expect(policeWindow.hidden).toBe(false);
    expect(toggle.attributes.get("aria-expanded")).toBe("true");

    closeButton.click();
    expect(policeWindow.hidden).toBe(true);
    expect(toggle.attributes.get("aria-expanded")).toBe("false");
  });
});
