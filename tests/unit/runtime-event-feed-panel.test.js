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
      compact: false,
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

  it("keeps non-resource action results clickable so players can inspect what happened", () => {
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

    let openedEntry = null;
    const item = createBuildingActionFeedItemElement(new FakeDocument(), entry, {
      removeSelector: "[data-building-action-remove]",
      onOpenResult: (selectedEntry) => {
        openedEntry = selectedEntry;
      }
    });

    expect(isBuildingActionEntryOpenable(entry)).toBe(true);
    expect(item.classList.contains("building-action-status__item--clickable")).toBe(true);
    expect(item.attributes.get("role")).toBe("button");
    expect(item.children).toHaveLength(1);
    item.listeners.get("click")?.({ target: { closest: () => null } });
    expect(openedEntry).toBe(entry);
  });

  it("allows result payloads to explicitly opt out of opening", () => {
    const entry = createBuildingActionEntry({
      id: "entry-2b",
      tone: "event",
      title: "Systémová zpráva",
      summary: "Jen informační záznam.",
      resultKind: "police",
      resultPayload: {
        openable: false,
        title: "Systémová zpráva",
        rows: [
          { label: "Stav", value: "Bez detailu" }
        ]
      },
      timestampMs: 2100
    });

    const item = createBuildingActionFeedItemElement(new FakeDocument(), entry, {
      removeSelector: "[data-building-action-remove]",
      onOpenResult: () => {}
    });

    expect(isBuildingActionEntryOpenable(entry)).toBe(false);
    expect(item.classList.contains("building-action-status__item--clickable")).toBe(false);
    expect(item.attributes.has("role")).toBe(false);
    expect(item.children[1].textContent).toBe("Jen informační záznam.");
  });

  it("renders cooldown feed entries as persistent and non-dismissible", () => {
    const entry = createBuildingActionEntry({
      id: "cooldown:spy:1",
      tone: "event",
      title: "Špehování",
      summary: "District 2",
      meta: "Cooldown 0:42",
      sourceKind: "cooldown",
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
    expect(item.classList.contains("building-action-status__item--cooldown")).toBe(true);
    expect(item.classList.contains("building-action-status__item--clickable")).toBe(false);
    expect(item.children).toHaveLength(1);
    expect(item.children[0].children[0].textContent).toBe("Špehování");
    expect(item.children[0].children[1].textContent).toBe("District 2");
    expect(item.children[0].children[2].textContent).toBe("Cooldown 0:42");
    expect(item.children[0].children[3].children).toHaveLength(0);
  });

  it("keeps special action cooldown previews clickable even without a direct resource delta", () => {
    const entry = createBuildingActionEntry({
      id: "cooldown:building:1:vip_night",
      tone: "event",
      title: "VIP noc",
      summary: "District 1 · Kasino",
      meta: "Cooldown 4:20",
      sourceKind: "cooldown",
      dismissible: false,
      persistent: true,
      resultKind: "police",
      resultPayload: {
        openable: true,
        title: "VIP noc běží",
        summary: "District 1 · Kasino",
        rows: [
          { label: "Efekt", value: "Vliv 20/den -> 25/den" },
          { label: "Riziko", value: "Heat 10/den -> 16/den" }
        ]
      },
      timestampMs: 4000
    });

    const item = createBuildingActionFeedItemElement(new FakeDocument(), entry, {
      removeSelector: "[data-building-action-remove]",
      onOpenResult: () => {}
    });

    expect(isBuildingActionEntryOpenable(entry)).toBe(true);
    expect(item.classList.contains("building-action-status__item--clickable")).toBe(true);
    expect(item.classList.contains("building-action-status__item--cooldown")).toBe(true);
    expect(item.dataset.buildingActionResultKind).toBe("police");
    expect(item.children).toHaveLength(1);
    expect(item.children[0].children[0].textContent).toBe("VIP noc");
    expect(item.children[0].children[1].textContent).toBe("District 1 · Kasino");
    expect(item.children[0].children[2].textContent).toBe("Cooldown 4:20");
  });
});
