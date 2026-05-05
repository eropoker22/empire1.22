import { afterEach, describe, expect, it } from "vitest";
import { bindOverflowTextTooltips } from "../../page-assets/js/app/ui/overflowTextTooltips.js";

const originalGlobals = {
  document: globalThis.document,
  window: globalThis.window,
  Element: globalThis.Element,
  HTMLElement: globalThis.HTMLElement,
  Node: globalThis.Node
};

class FakeClassList {
  constructor() {
    this.tokens = new Set();
  }

  add(...tokens) {
    for (const token of tokens) {
      if (token) {
        this.tokens.add(token);
      }
    }
  }

  remove(...tokens) {
    for (const token of tokens) {
      this.tokens.delete(token);
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
    this.parentNode = null;
    this.ownerDocument = null;
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.eventListeners = new Map();
    this.style = {};
    this.hidden = false;
    this.textContent = "";
    this._className = "";
    this.scrollWidth = 0;
    this.clientWidth = 0;
    this.scrollHeight = 0;
    this.clientHeight = 0;
  }

  set className(value) {
    this._className = String(value || "");
    this.classList = new FakeClassList();
    for (const token of this._className.split(/\s+/u).filter(Boolean)) {
      this.classList.add(token);
    }
  }

  get className() {
    return this._className;
  }

  append(...children) {
    for (const child of children) {
      this.appendChild(child);
    }
  }

  appendChild(child) {
    child.parentNode = this;
    child.ownerDocument = this.ownerDocument;
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    const stringValue = String(value);
    this.attributes.set(name, stringValue);
    if (name === "id") {
      this.id = stringValue;
    }
  }

  addEventListener(type, handler) {
    const handlers = this.eventListeners.get(type) || [];
    handlers.push(handler);
    this.eventListeners.set(type, handlers);
  }

  dispatchEvent(type, event = {}) {
    for (const handler of this.eventListeners.get(type) || []) {
      handler({ ...event, type });
    }
  }

  contains(target) {
    if (target === this) {
      return true;
    }
    return this.children.some((child) => child.contains?.(target));
  }

  matches(selector) {
    if (selector.includes(",")) {
      return selector.split(",").some((entry) => this.matches(entry.trim()));
    }
    const [baseSelector, descendantSelector] = selector.split(/\s+/u);
    if (descendantSelector) {
      return this.matches(descendantSelector) && this.parentNode?.matches?.(baseSelector);
    }
    if (selector.startsWith(".")) {
      return this.classList.contains(selector.slice(1));
    }
    if (selector.startsWith("#")) {
      return this.id === selector.slice(1);
    }
    return false;
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (current.matches?.(selector)) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  }

  getBoundingClientRect() {
    return { left: 100, top: 100, right: 220, bottom: 124, width: 120, height: 24 };
  }
}

class FakeDocument {
  constructor() {
    this.body = new FakeElement("body");
    this.body.ownerDocument = this;
  }

  createElement(tagName) {
    const element = new FakeElement(tagName);
    element.ownerDocument = this;
    return element;
  }
}

function setupDom() {
  const document = new FakeDocument();
  const windowListeners = new Map();
  const window = {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener(type, handler) {
      const handlers = windowListeners.get(type) || [];
      handlers.push(handler);
      windowListeners.set(type, handlers);
    },
    dispatchEvent(type, event = {}) {
      for (const handler of windowListeners.get(type) || []) {
        handler({ ...event, type });
      }
    }
  };

  globalThis.document = document;
  globalThis.window = window;
  globalThis.Element = FakeElement;
  globalThis.HTMLElement = FakeElement;
  globalThis.Node = FakeElement;

  return { document, window };
}

function createTooltipTarget(document, { clipped = true, text = "Long clipped text" } = {}) {
  const root = document.createElement("main");
  const target = document.createElement("span");
  target.classList.add("resource-label");
  target.textContent = text;
  target.clientWidth = clipped ? 80 : 160;
  target.scrollWidth = 160;
  target.clientHeight = 20;
  target.scrollHeight = 20;
  document.body.append(root);
  root.append(target);
  return { root, target };
}

afterEach(() => {
  globalThis.document = originalGlobals.document;
  globalThis.window = originalGlobals.window;
  globalThis.Element = originalGlobals.Element;
  globalThis.HTMLElement = originalGlobals.HTMLElement;
  globalThis.Node = originalGlobals.Node;
});

describe("overflow text tooltips", () => {
  it("shows a tooltip for clipped non-touch text and hides it on pointerout", () => {
    const { document } = setupDom();
    const { root, target } = createTooltipTarget(document, { clipped: true, text: "  Long   clipped label  " });

    bindOverflowTextTooltips(root);
    root.dispatchEvent("pointerover", { pointerType: "mouse", target });

    const tooltip = document.body.children.find((child) => child.classList.contains("overflow-text-tooltip"));
    expect(tooltip).toBeTruthy();
    expect(tooltip.hidden).toBe(false);
    expect(tooltip.textContent).toBe("Long clipped label");
    expect(tooltip.classList.contains("is-visible")).toBe(true);
    expect(tooltip.style.left).toMatch(/px$/u);
    expect(tooltip.style.top).toMatch(/px$/u);

    root.dispatchEvent("pointerout", { target, relatedTarget: null });

    expect(tooltip.hidden).toBe(true);
    expect(tooltip.classList.contains("is-visible")).toBe(false);
  });

  it("does not show a tooltip for touch hover or unclipped text", () => {
    const { document } = setupDom();
    const { root, target } = createTooltipTarget(document, { clipped: true });

    bindOverflowTextTooltips(root);
    root.dispatchEvent("pointerover", { pointerType: "touch", target });
    expect(document.body.children.some((child) => child.classList.contains("overflow-text-tooltip"))).toBe(false);

    target.clientWidth = 180;
    root.dispatchEvent("pointerover", { pointerType: "mouse", target });
    expect(document.body.children.some((child) => child.classList.contains("overflow-text-tooltip"))).toBe(false);
  });

  it("repositions on resize and hides on scroll", () => {
    const { document, window } = setupDom();
    const { root, target } = createTooltipTarget(document, { clipped: true });

    bindOverflowTextTooltips(root);
    root.dispatchEvent("focusin", { target });
    const tooltip = document.body.children.find((child) => child.classList.contains("overflow-text-tooltip"));
    expect(tooltip.hidden).toBe(false);

    window.dispatchEvent("resize");
    expect(tooltip.style.left).toMatch(/px$/u);
    window.dispatchEvent("scroll");
    expect(tooltip.hidden).toBe(true);
  });
});
