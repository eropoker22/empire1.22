import { describe, expect, it, vi } from "vitest";
import {
  refreshMapAfterStateChange,
  refreshMapOverlayUi,
  refreshMapStatusUi,
  refreshMapUiShell,
  refreshSelectedDistrictUi
} from "../../page-assets/js/app/map/mapRefreshPipeline.js";

class FakeClassList {
  constructor() {
    this.tokens = new Set();
  }
  add(...tokens) {
    for (const token of tokens) {
      if (token) this.tokens.add(token);
    }
  }
  remove(...tokens) {
    for (const token of tokens) this.tokens.delete(token);
  }
  contains(token) {
    return this.tokens.has(token);
  }
  toggle(token, force) {
    const shouldAdd = force === undefined ? !this.tokens.has(token) : Boolean(force);
    if (shouldAdd) this.tokens.add(token);
    else this.tokens.delete(token);
    return shouldAdd;
  }
}

class FakeElement {
  constructor(tagName = "div", ownerDocument = null) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.dataset = {};
    this.classList = new FakeClassList();
    this.listeners = new Map();
    this.textContent = "";
    this.disabled = false;
    this.attributes = new Map();
    this.type = "";
  }
  set className(value) {
    this.classList = new FakeClassList();
    String(value || "").split(/\s+/u).filter(Boolean).forEach((token) => this.classList.add(token));
  }
  append(...children) {
    for (const child of children) this.children.push(child);
  }
  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(listener);
  }
  querySelectorAll(selector) {
    if (selector !== "[data-map-overlay-key]") return [];
    return this.children.filter((child) => child.dataset?.mapOverlayKey);
  }
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(tagName, this);
  }
}

describe("map refresh pipeline", () => {
  it("handles partial context without crashing", () => {
    expect(refreshMapUiShell()).toBe(true);
    expect(refreshSelectedDistrictUi()).toBe(true);
    expect(refreshMapOverlayUi()).toBe(false);
    expect(refreshMapStatusUi()).toBe(false);
    expect(refreshMapAfterStateChange()).toBe(true);
  });

  it("calls supplied orchestration callbacks", () => {
    const redrawMap = vi.fn();
    const syncShellVisualState = vi.fn();
    const refreshSelectedDistrict = vi.fn();

    expect(refreshMapAfterStateChange({
      callbacks: { redrawMap, syncShellVisualState, refreshSelectedDistrict }
    })).toBe(true);

    expect(redrawMap).toHaveBeenCalledTimes(1);
    expect(syncShellVisualState).toHaveBeenCalledTimes(1);
    expect(refreshSelectedDistrict).toHaveBeenCalledTimes(1);
  });

  it("renders overlay controls and status panel when containers exist", () => {
    const document = new FakeDocument();
    const overlayControls = new FakeElement("div", document);
    const statusPanel = new FakeElement("div", document);
    const onToggleOverlay = vi.fn();

    expect(refreshMapAfterStateChange({
      overlayState: { heatmap: true },
      statusViewModel: {
        districtCount: 4,
        ownedDistrictCount: 1,
        enemyDistrictCount: 2,
        selectedDistrictLabel: "Market",
        activeOverlayLabel: "Heatmap"
      },
      elements: { overlayControls, statusPanel },
      callbacks: { onToggleOverlay }
    })).toBe(true);

    expect(overlayControls.children.map((child) => child.dataset.mapOverlayKey)).toEqual(["heatmap", "influence", "ownership", "trap"]);
    expect(overlayControls.children[0].classList.contains("is-active")).toBe(true);
    expect(statusPanel.children[0].children[1].textContent).toBe("4");
  });

  it("builds status view model lazily after redraw callback", () => {
    const document = new FakeDocument();
    const statusPanel = new FakeElement("div", document);
    const calls = [];

    expect(refreshMapAfterStateChange({
      elements: { statusPanel },
      callbacks: {
        redrawMap: () => calls.push("redraw"),
        buildStatusViewModel: () => {
          calls.push("status");
          return {
            districtCount: 2,
            ownedDistrictCount: 1,
            enemyDistrictCount: 1,
            selectedDistrictLabel: "District 2",
            activeOverlayLabel: "Ownership"
          };
        }
      }
    })).toBe(true);

    expect(calls).toEqual(["redraw", "status"]);
    expect(statusPanel.children[0].children[1].textContent).toBe("2");
  });
});
