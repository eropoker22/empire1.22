import { describe, expect, it } from "vitest";
import {
  BUILDING_ACTION_EMPTY_SNAPSHOT,
  createBuildingActionEntry,
  createBuildingActionFeedItemElement,
  createBuildingActionFingerprint,
  isBuildingActionEntryOpenable,
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
      districtType: "unknown",
      dismissible: true,
      persistent: false,
      resultKind: "",
      resultPayload: null,
      sourceKind: ""
    });
  });

  it("creates stable fingerprints and feed item markup", () => {
    const entry = createBuildingActionEntry({
      id: "entry-1",
      tone: "success",
      title: "Akce hotová",
      summary: "Výsledek je připravený.",
      meta: "Výsledek akce",
      districtType: "industrial",
      resultKind: "raid",
      resultPayload: {
        tone: "success",
        rows: [
          { label: "Zisk", value: "Chemicals x2" }
        ]
      },
      timestampMs: 1000
    });

    expect(createBuildingActionFingerprint(entry)).toContain("Akce hotová");
    expect(isBuildingActionEntryOpenable(entry)).toBe(true);

    const item = createBuildingActionFeedItemElement(new FakeDocument(), entry, {
      removeSelector: "[data-building-action-remove]",
      onOpenResult: () => {}
    });

    expect(item.dataset.buildingActionId).toBe("entry-1");
    expect(item.dataset.buildingActionResultKind).toBe("raid");
    expect(item.dataset.buildingActionKind).toBe("raid");
    expect(item.dataset.buildingActionDistrictType).toBe("industrial");
    expect(item.classList.contains("building-action-status__item--kind-raid")).toBe(true);
    expect(item.classList.contains("building-action-status__item--district-industrial")).toBe(true);
    expect(item.classList.contains("building-action-status__item--clickable")).toBe(true);
    expect(item.children[0].children[0].textContent).toBe("Akce hotová");
    expect(item.children[0].children[1].children[0].innerHTML).toContain("building-action-status__trash-icon");
    expect(item.children[0].children[1].children[0].innerHTML).toContain("<svg");
    expect(item.children).toHaveLength(1);
  });

  it("keeps non-resource action results readable but not clickable", () => {
    const entry = createBuildingActionEntry({
      id: "entry-2",
      tone: "success",
      title: "Útok dokončen",
      summary: "District zůstal pod tlakem.",
      meta: "Žádné suroviny se nezměnily.",
      districtType: "downtown",
      resultKind: "attack",
      resultPayload: {
        tone: "success",
        rows: [
          { label: "Stav", value: "Rozkaz dokončen" }
        ]
      },
      timestampMs: 2000
    });

    const item = createBuildingActionFeedItemElement(new FakeDocument(), entry, {
      removeSelector: "[data-building-action-remove]",
      onOpenResult: () => {}
    });

    expect(isBuildingActionEntryOpenable(entry)).toBe(false);
    expect(item.classList.contains("building-action-status__item--clickable")).toBe(false);
    expect(item.attributes.has("role")).toBe(false);
    expect(item.children[1].textContent).toBe("District zůstal pod tlakem.");
    expect(item.children[2].textContent).toBe("Žádné suroviny se nezměnily.");
  });

  it("renders cooldown feed entries as persistent and non-dismissible", () => {
    const entry = createBuildingActionEntry({
      id: "cooldown:spy:1",
      tone: "event",
      title: "Cooldown: Špehování",
      summary: "District 2",
      meta: "Zbývá 0:42",
      dismissible: false,
      persistent: true,
      timestampMs: 3000
    });

    const item = createBuildingActionFeedItemElement(new FakeDocument(), entry, {
      removeSelector: "[data-building-action-remove]",
      onOpenResult: () => {}
    });

    expect(item.dataset.buildingActionPersistent).toBe("true");
    expect(item.classList.contains("building-action-status__item--persistent")).toBe(true);
    expect(item.classList.contains("building-action-status__item--clickable")).toBe(false);
    expect(item.children[0].children[1].children).toHaveLength(0);
    expect(item.children[1].textContent).toBe("District 2");
    expect(item.children[2].textContent).toBe("Zbývá 0:42");
  });
});
