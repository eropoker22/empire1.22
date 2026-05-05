import { describe, expect, it } from "vitest";
import {
  normalizeCityFeedEvent,
  normalizeCityFeedEvents,
  renderDistrictRumorFeed,
  renderRumorFeedPanel
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
    const mount = document.createElement("section");
    const list = document.createElement("div");

    expect(renderRumorFeedPanel(mount, { events: [] })).toBe(true);
    expect(mount.children[0].children[0].textContent).toBe("Drby města");

    expect(renderDistrictRumorFeed(list, [
      { id: "a", districtId: "district:7", message: "District rumor" },
      { id: "b", districtId: "district:8", message: "Other rumor" }
    ], { districtId: "district:7" })).toBe(true);
    expect(list.children).toHaveLength(1);
  });
});
