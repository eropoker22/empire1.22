import { describe, expect, it } from "vitest";
import {
  clearMapStatusPanel,
  renderMapBusyState,
  renderMapErrorState,
  renderMapStatusPanel
} from "../../page-assets/js/app/map/mapStatusPanel.js";

class FakeClassList {
  constructor() {
    this.tokens = new Set();
  }
  add(...tokens) {
    for (const token of tokens) {
      if (token) this.tokens.add(token);
    }
  }
  contains(token) {
    return this.tokens.has(token);
  }
}

class FakeElement {
  constructor(tagName = "div", ownerDocument = null) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.classList = new FakeClassList();
    this.textContent = "";
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
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(tagName, this);
  }
}

describe("map status panel", () => {
  it("handles missing container without crashing", () => {
    expect(renderMapStatusPanel({}, {})).toBe(false);
    expect(renderMapBusyState("Busy", {})).toBe(false);
    expect(renderMapErrorState("Error", {})).toBe(false);
    expect(clearMapStatusPanel({})).toBe(false);
  });

  it("renders map status rows and optional message", () => {
    const document = new FakeDocument();
    const container = new FakeElement("div", document);

    expect(renderMapStatusPanel({
      districtCount: 12,
      ownedDistrictCount: 3,
      enemyDistrictCount: 6,
      selectedDistrictLabel: "Docks",
      activeOverlayLabel: "Heatmap",
      message: "Synced"
    }, { container })).toBe(true);

    expect(container.children).toHaveLength(6);
    expect(container.children[0].children[0].textContent).toBe("Districty");
    expect(container.children[0].children[1].textContent).toBe("12");
    expect(container.children[5].textContent).toBe("Synced");

    expect(clearMapStatusPanel({ container })).toBe(true);
    expect(container.children).toHaveLength(0);
  });

  it("renders busy and error states", () => {
    const document = new FakeDocument();
    const container = new FakeElement("div", document);

    expect(renderMapBusyState("Loading map", { container })).toBe(true);
    expect(container.children[0].classList.contains("map-status-panel__message--busy")).toBe(true);
    expect(container.children[0].textContent).toBe("Loading map");

    expect(renderMapErrorState("Map failed", { container })).toBe(true);
    expect(container.children[0].classList.contains("map-status-panel__message--error")).toBe(true);
    expect(container.children[0].textContent).toBe("Map failed");
  });
});
