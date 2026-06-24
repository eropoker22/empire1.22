import { describe, expect, it } from "vitest";
import {
  getCityFeedBadge,
  normalizeCityFeedEvent,
  normalizeCityFeedEvents,
  renderDistrictRumorFeed
} from "../../page-assets/js/app/ui/rumorFeedPanel.js";

class FakeClassList {
  constructor() {
    this.tokens = new Set();
  }

  add(...tokens) {
    for (const token of tokens) this.tokens.add(token);
  }
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.textContent = "";
    this.hidden = false;
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = children;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  addEventListener() {}
}

class FakeDocument {
  createElement(tagName) {
    const element = new FakeElement(tagName);
    element.ownerDocument = this;
    return element;
  }

  createTextNode(value) {
    return String(value);
  }
}

describe("rumor feed panel", () => {
  it("normalizes partial feed events with safe fallbacks and dedupe", () => {
    const events = normalizeCityFeedEvents([
      { id: "e1", sourceEventId: "source:1", message: "První drb", createdAtTick: 1 },
      { id: "e2", sourceEventId: "source:1", message: "Duplicitní drb", createdAtTick: 2 },
      { sourceType: "spy" }
    ]);

    expect(events).toHaveLength(2);
    expect(normalizeCityFeedEvent({}).message).toBe("Město zachytilo nejasný pohyb v ulicích.");
    expect(events.find((event) => event.sourceEventId === "source:1")).toMatchObject({
      id: "e1",
      sourceEventId: "source:1"
    });
  });

  it("renders empty, partial and district-specific feed without DOM crashes", () => {
    const document = new FakeDocument();
    const list = document.createElement("div");

    expect(renderDistrictRumorFeed(list, [], { districtId: "district:7" })).toBe(false);
    expect(list.children).toHaveLength(0);

    expect(renderDistrictRumorFeed(list, [
      { id: "a", districtId: "district:7", message: "District rumor" },
      { id: "b", districtId: "district:8", message: "Other rumor" }
    ], { districtId: "district:7" })).toBe(true);
    expect(list.children).toHaveLength(1);
  });

  it("maps intel types to player-facing badges", () => {
    expect(getCityFeedBadge({ confidence: "confirmed", intelType: "confirmed_event", truthiness: "confirmed" }).label).toBe("Potvrzené");
    expect(getCityFeedBadge({ confidence: "rumor", intelType: "rumor", truthiness: "unconfirmed" }).label).toBe("Nepotvrzená fáma");
    expect(getCityFeedBadge({ confidence: "suspicion", intelType: "suspicion", truthiness: "unconfirmed" }).label).toBe("Podezření");
    expect(getCityFeedBadge({ confidence: "credible", intelType: "scandal", truthiness: "unconfirmed" }).label).toBe("Důvěryhodný drb");
    expect(getCityFeedBadge({ confidence: "false_possible", intelType: "false_lead", truthiness: "false_possible" }).label).toBe("Pochybný zdroj");
    expect(getCityFeedBadge({ rumorCategory: "atmosphere", intelType: "rumor" }).label).toBe("Hlas ulice");
  });
});
