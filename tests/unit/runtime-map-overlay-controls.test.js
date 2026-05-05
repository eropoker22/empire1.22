import { describe, expect, it, vi } from "vitest";
import {
  createDefaultMapOverlayState,
  isOverlayEnabled,
  normalizeMapOverlayState,
  setActiveOverlay,
  toggleOverlay
} from "../../page-assets/js/app/map/mapOverlayState.js";
import {
  initMapOverlayControls,
  renderMapOverlayControls,
  updateMapOverlayButtonStates
} from "../../page-assets/js/app/map/mapOverlayControls.js";

class FakeClassList {
  constructor() { this.tokens = new Set(); }
  add(...tokens) { for (const token of tokens) if (token) this.tokens.add(token); }
  contains(token) { return this.tokens.has(token); }
  toggle(token, force) {
    const shouldAdd = force === undefined ? !this.tokens.has(token) : Boolean(force);
    if (shouldAdd) this.tokens.add(token);
    else this.tokens.delete(token);
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
  append(...children) { for (const child of children) this.children.push(child); }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(listener);
  }
  dispatch(name) { for (const listener of this.listeners.get(name) || []) listener({ target: this }); }
  querySelectorAll(selector) {
    if (selector !== "[data-map-overlay-key]") return [];
    return this.children.filter((child) => child.dataset?.mapOverlayKey);
  }
}

class FakeDocument {
  createElement(tagName) { return new FakeElement(tagName, this); }
}

describe("map overlay state and controls", () => {
  it("normalizes and toggles overlay state immutably", () => {
    const defaults = createDefaultMapOverlayState();
    const toggled = toggleOverlay(defaults, "heatmap");
    expect(defaults.heatmap).toBe(false);
    expect(toggled.heatmap).toBe(true);
    expect(isOverlayEnabled(toggled, "heatmap")).toBe(true);
    expect(setActiveOverlay(toggled, "influence")).toMatchObject({
      activeOverlay: "influence",
      influence: true,
      heatmap: false,
      ownership: false
    });
    expect(normalizeMapOverlayState({ activeOverlay: "bad", ownershipEnabled: false }).activeOverlay).toBe("ownership");
  });

  it("renders overlay buttons and fires callbacks", () => {
    const document = new FakeDocument();
    const container = new FakeElement("div", document);
    const onToggleOverlay = vi.fn();

    expect(renderMapOverlayControls(createDefaultMapOverlayState(), { onToggleOverlay }, { container })).toBe(true);
    expect(container.children.map((child) => child.dataset.mapOverlayKey)).toEqual(["heatmap", "influence", "ownership", "trap"]);
    container.children[0].dispatch("click");
    expect(onToggleOverlay).toHaveBeenCalledWith("heatmap");

    updateMapOverlayButtonStates({ heatmap: true }, { container });
    expect(container.children[0].classList.contains("is-active")).toBe(true);

    const controls = initMapOverlayControls({ onToggleOverlay }, { container, overlayState: { ownership: true } });
    expect(typeof controls.update).toBe("function");
  });
});
