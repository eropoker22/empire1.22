import { describe, expect, it } from "vitest";
import {
  createEventRumorBridge,
  createRumorStreetNewsPayload
} from "../../page-assets/js/app/runtime/eventRumorBridge.js";

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

  after(element) {
    this.afterElement = element;
  }

  replaceChildren(...children) {
    this.children = children;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  addEventListener() {}

  querySelector() {
    return null;
  }
}

class FakeDocument {
  constructor() {
    this.listeners = new Map();
  }

  createElement(tagName) {
    const element = new FakeElement(tagName);
    element.ownerDocument = this;
    return element;
  }

  createTextNode(value) {
    return String(value);
  }

  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) || [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }

  dispatch(name, detail = {}) {
    for (const listener of this.listeners.get(name) || []) {
      listener({ type: name, detail });
    }
  }

  querySelector() {
    return null;
  }
}

class FakeStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) || null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

describe("event rumor bridge", () => {
  it("creates a clickable street-news payload with district, player and rumor text", () => {
    const payload = createRumorStreetNewsPayload({
      districtId: "district:12",
      playerName: "LowKeyLad",
      message: "Někdo přesouvá stash za klubem."
    });

    expect(payload.title).toBe("Drb z ulice");
    expect(payload.rows).toEqual([
      { label: "District", value: "District 12" },
      { label: "Hráč", value: "LowKeyLad" },
      { label: "Drb", value: "Někdo přesouvá stash za klubem." }
    ]);
  });

  it("uses server core feed without generating local runtime action rumors", () => {
    const document = new FakeDocument();
    const storage = new FakeStorage();
    const root = new FakeElement("main");
    const anchor = new FakeElement("section");
    const districtPanel = new FakeElement("section");
    const districtList = new FakeElement("div");
    districtPanel.ownerDocument = document;
    districtList.ownerDocument = document;
    root.querySelector = (selector) => {
      if (selector === ".building-action-status") return anchor;
      if (selector === "[data-district-popup-gossip]") return districtPanel;
      if (selector === "[data-district-popup-gossip-list]") return districtList;
      return null;
    };

    const bridge = createEventRumorBridge({
      root,
      documentRef: document,
      storage,
      getState: () => ({
        cityFeed: {
          currentPlayerFeed: [{
            id: "city-feed:core",
            sourceEventId: "core:1",
            sourceType: "police_raid",
            category: "police",
            severity: "high",
            truthiness: "confirmed",
            visibility: "all",
            districtId: "district:2",
            createdAtTick: 5,
            message: "Core raid"
          }]
        }
      })
    });

    bridge.init();
    expect(anchor.afterElement).toBeUndefined();

    document.dispatch("empire:action-result", {
      kind: "attack",
      payload: {
        reportId: "attack:1",
        targetDistrictId: "district:2",
        title: "Útok hotov",
        summary: "Výsledek"
      }
    });
    document.dispatch("empire:action-result", {
      kind: "attack",
      payload: {
        reportId: "attack:1",
        targetDistrictId: "district:2",
        title: "Útok hotov",
        summary: "Výsledek"
      }
    });

    const events = bridge.getEvents();
    expect(events.some((event) => event.id === "city-feed:core")).toBe(true);
    expect(events.filter((event) => event.sourceEventId === "runtime:attack:attack:1")).toHaveLength(0);
    expect(storage.getItem("empireStreets.cityFeed.v1")).toBeNull();

    document.dispatch("empire:district-opened", { districtId: "district:2" });
    expect(districtPanel.hidden).toBe(false);
    expect(districtList.children).toHaveLength(1);
  });

  it("mirrors server rumor feed into clickable street-news once", () => {
    const document = new FakeDocument();
    const root = new FakeElement("main");
    const districtPanel = new FakeElement("section");
    const districtList = new FakeElement("div");
    const streetNewsEntries = [];
    districtPanel.ownerDocument = document;
    districtList.ownerDocument = document;
    root.querySelector = (selector) => {
      if (selector === "[data-district-popup-gossip]") return districtPanel;
      if (selector === "[data-district-popup-gossip-list]") return districtList;
      return null;
    };

    const bridge = createEventRumorBridge({
      root,
      documentRef: document,
      appendBuildingActionResultEntry: (...args) => streetNewsEntries.push(args),
      getLaunchPlayerName: (ownerId) => `Player ${ownerId}`,
      getState: () => ({
        cityFeed: {
          currentPlayerFeed: [{
            id: "city-feed:rumor",
            sourceEventId: "rumor:1",
            sourceType: "building_action",
            category: "rumor",
            intelType: "rumor",
            districtId: "district:7",
            targetPlayerId: "player:3",
            createdAtTick: 8,
            message: "Dealerům došel klid na rohu."
          }]
        }
      })
    });

    bridge.init();
    bridge.render();

    expect(streetNewsEntries).toHaveLength(1);
    expect(streetNewsEntries[0][1]).toBe("police");
    expect(streetNewsEntries[0][2].rows).toEqual([
      { label: "District", value: "District 7" },
      { label: "Hráč", value: "Player 3" },
      { label: "Drb", value: "Dealerům došel klid na rohu." }
    ]);
    expect(streetNewsEntries[0][3]).toMatchObject({
      id: "rumor-street-news:rumor:1",
      title: "Drb z ulice",
      meta: "District 7 · Player 3"
    });
  });
});
