import { describe, expect, it } from "vitest";
import {
  BUILDING_ACTION_EMPTY_SNAPSHOT,
  createBuildingActionEntry,
  createBuildingActionFeedItemElement,
  createBuildingActionFingerprint,
  normalizeBuildingActionSnapshot
} from "../../page-assets/js/app/ui/eventFeedPanel.js";

class FakeClassList {
  constructor() {
    this.tokens = new Set();
  }

  add(...tokens) {
    for (const token of tokens) {
      this.tokens.add(token);
    }
  }

  contains(token) {
    return this.tokens.has(token);
  }
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = new FakeClassList();
    this.textContent = "";
  }

  append(...children) {
    this.children.push(...children);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  addEventListener(name, listener) {
    this.listeners.set(name, listener);
  }
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(tagName);
  }
}

describe("event feed panel helpers", () => {
  it("normalizes empty street news snapshots without changing text", () => {
    expect(normalizeBuildingActionSnapshot({ tone: "idle" })).toEqual({
      ...BUILDING_ACTION_EMPTY_SNAPSHOT,
      resultKind: "",
      resultPayload: null
    });
  });

  it("creates stable fingerprints and feed item markup", () => {
    const entry = createBuildingActionEntry({
      id: "entry-1",
      tone: "success",
      title: "Akce hotová",
      summary: "Výsledek je připravený.",
      meta: "Výsledek akce",
      resultKind: "attack",
      resultPayload: { tone: "success" },
      timestampMs: 1000
    });

    expect(createBuildingActionFingerprint(entry)).toContain("Akce hotová");

    const item = createBuildingActionFeedItemElement(new FakeDocument(), entry, {
      removeSelector: "[data-building-action-remove]",
      onOpenResult: () => {}
    });

    expect(item.dataset.buildingActionId).toBe("entry-1");
    expect(item.dataset.buildingActionResultKind).toBe("attack");
    expect(item.classList.contains("building-action-status__item--clickable")).toBe(true);
    expect(item.children[0].children[0].textContent).toBe("Akce hotová");
    expect(item.children[0].children[1].children[0].innerHTML).toContain("building-action-status__trash-icon");
    expect(item.children[0].children[1].children[0].innerHTML).toContain("<svg");
    expect(item.children[1].textContent).toBe("Výsledek je připravený.");
  });
});
