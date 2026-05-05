import { describe, expect, it } from "vitest";
import {
  canRenderMap,
  clearMapShellUi,
  getMapShellElements,
  initMapShell,
  renderMapMissingState,
  setMapBusy,
  setMapError,
  syncMapShellVisualState
} from "../../page-assets/js/app/map/mapShell.js";

class FakeClassList {
  constructor() {
    this.tokens = new Set();
  }
  add(...tokens) { for (const token of tokens) if (token) this.tokens.add(token); }
  remove(...tokens) { for (const token of tokens) this.tokens.delete(token); }
  contains(token) { return this.tokens.has(token); }
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
    this.hidden = false;
    this.width = 300;
    this.height = 200;
    this.attributes = new Map();
    this.style = { values: new Map(), setProperty: (name, value) => this.style.values.set(name, String(value)) };
  }
  set className(value) {
    this.classList = new FakeClassList();
    String(value || "").split(/\s+/u).filter(Boolean).forEach((token) => this.classList.add(token));
  }
  get className() {
    return Array.from(this.classList.tokens).join(" ");
  }
  append(...children) { for (const child of children) this.children.push(child); }
  after(child) { this.afterNode = child; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getContext() { return { clearRect() {} }; }
  querySelector(selector) {
    if (!selector?.startsWith(".")) return null;
    const token = selector.slice(1);
    return this.children.find((child) => child.classList?.contains(token)) || null;
  }
}

class FakeRoot extends FakeElement {
  constructor(ownerDocument) {
    super("div", ownerDocument);
    this.nodes = new Map();
  }
  querySelector(selector) {
    return this.nodes.get(selector) || super.querySelector(selector);
  }
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(tagName, this);
  }
}

describe("map shell", () => {
  it("handles missing root and missing required anchors", () => {
    expect(canRenderMap(getMapShellElements(null, {}))).toBe(false);
    expect(renderMapMissingState("Missing", {})).toBe(false);
  });

  it("initializes shell elements, overlay and hover canvas", () => {
    const document = new FakeDocument();
    const root = new FakeRoot(document);
    const canvas = new FakeElement("canvas", document);
    const phase = new FakeElement("div", document);
    const viewport = new FakeElement("div", document);
    const canvasHost = new FakeElement("div", document);
    const statusPanel = new FakeElement("div", document);
    root.nodes.set("[data-canvas]", canvas);
    root.nodes.set("[data-phase]", phase);
    root.nodes.set("[data-viewport]", viewport);
    root.nodes.set("[data-host]", canvasHost);
    root.nodes.set("[data-map-status]", statusPanel);

    const shell = initMapShell({
      root,
      selectors: { canvas: "[data-canvas]", phaseHost: "[data-phase]", viewport: "[data-viewport]", canvasHost: "[data-host]" },
      classes: { interactionOverlay: "map-interaction", hoverCanvas: "map-hover" }
    });

    expect(shell.canRender).toBe(true);
    expect(shell.interactionOverlay.classList.contains("map-interaction")).toBe(true);
    expect(shell.hoverCanvas.classList.contains("map-hover")).toBe(true);
    expect(shell.statusPanel).toBe(statusPanel);

    syncMapShellVisualState({
      interactionOverlay: shell.interactionOverlay,
      canvasHost,
      viewport,
      canvas,
      focusedDistrict: { centerX: 150, centerY: 100 },
      hasFocus: true,
      classes: { hasHover: "has-hover", focused: "is-focused" }
    });

    expect(canvasHost.classList.contains("is-focused")).toBe(true);
    expect(shell.interactionOverlay.style.values.get("--map-focus-x")).toBe("50%");
    expect(setMapBusy(true, { viewport })).toBe(true);
    expect(viewport.dataset.mapBusy).toBe("true");
    expect(setMapError("Broken", { viewport })).toBe(true);
    expect(viewport.dataset.mapError).toBe("Broken");
    expect(clearMapShellUi({ interactionOverlay: shell.interactionOverlay, hoverCanvas: shell.hoverCanvas })).toBe(true);
  });
});
