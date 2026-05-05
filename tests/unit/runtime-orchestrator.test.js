import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleActionResult,
  hydrateInitialState,
  initRuntime,
  refreshAllUi
} from "../../page-assets/js/app/runtime.js";

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
    for (const token of tokens) {
      this.tokens.delete(token);
    }
  }

  contains(token) {
    return this.tokens.has(token);
  }

  toggle(token, force) {
    const shouldAdd = force === undefined ? !this.tokens.has(token) : Boolean(force);
    if (shouldAdd) {
      this.tokens.add(token);
    } else {
      this.tokens.delete(token);
    }
    return shouldAdd;
  }
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.dataset = {};
    this.classList = new FakeClassList();
    this.style = {
      setProperty: () => {},
      removeProperty: () => {}
    };
    this.children = [];
    this.listeners = [];
    this.ownerDocument = null;
    this.hidden = false;
    this.textContent = "";
    this.attributes = new Map();
  }

  append(...children) {
    this.children.push(...children);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }

  addEventListener(type, handler) {
    this.listeners.push({ type, handler });
  }

  dispatchEvent(event) {
    this.lastEvent = event;
    return true;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  contains() {
    return false;
  }

  closest() {
    return null;
  }
}

class FakeDocument extends FakeElement {
  constructor(root) {
    super("#document");
    this.root = root;
    this.documentElement = new FakeElement("html");
    this.body = new FakeElement("body");
    this.root.ownerDocument = this;
    this.documentElement.ownerDocument = this;
    this.body.ownerDocument = this;
  }

  querySelector(selector) {
    return selector === "main[data-page]" ? this.root : null;
  }

  createElement(tagName) {
    const element = new FakeElement(tagName);
    element.ownerDocument = this;
    return element;
  }
}

const createLocalStorage = () => {
  const store = new Map();

  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };
};

function installRuntimeDom() {
  const root = new FakeElement("main");
  root.dataset.page = "game";
  const document = new FakeDocument(root);
  const windowListeners = [];

  globalThis.Element = FakeElement;
  globalThis.HTMLElement = FakeElement;
  globalThis.HTMLButtonElement = FakeElement;
  globalThis.HTMLCanvasElement = FakeElement;
  globalThis.HTMLDivElement = FakeElement;
  globalThis.HTMLImageElement = FakeElement;
  globalThis.Node = FakeElement;
  globalThis.CustomEvent = class FakeCustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail || null;
    }
  };
  globalThis.document = document;
  globalThis.window = {
    localStorage: createLocalStorage(),
    addEventListener: (type, handler) => windowListeners.push({ type, handler }),
    dispatchEvent: (event) => {
      windowListeners.push({ type: event.type, event });
      return true;
    },
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    innerWidth: 1200,
    innerHeight: 800,
    location: { href: "http://localhost/game.html" }
  };

  return { root, document, windowListeners };
}

describe("runtime orchestrator", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.CustomEvent;
    delete globalThis.Element;
    delete globalThis.HTMLElement;
    delete globalThis.HTMLButtonElement;
    delete globalThis.HTMLCanvasElement;
    delete globalThis.HTMLDivElement;
    delete globalThis.HTMLImageElement;
    delete globalThis.Node;
  });

  it("initializes once and repeated init does not bind root listeners twice", () => {
    const { root } = installRuntimeDom();

    const firstContext = initRuntime(root);
    const listenerCountAfterFirstInit = root.listeners.length;
    const secondContext = initRuntime(root);

    expect(firstContext).toBe(secondContext);
    expect(root.dataset.bootstrap).toBe("ready");
    expect(root.dataset.runtimeInit).toBe("ready");
    expect(listenerCountAfterFirstInit).toBeGreaterThan(0);
    expect(root.listeners).toHaveLength(listenerCountAfterFirstInit);
  });

  it("hydrates and refreshes partial state without throwing", () => {
    const { root } = installRuntimeDom();
    const refreshSelectedDistrictPanel = vi.fn();
    window.empireStreetsDistrictState = { refreshSelectedDistrictPanel };

    const state = hydrateInitialState(root);
    const refreshed = refreshAllUi({ ...state, gang: null, world: null });

    expect(refreshed.root).toBe(root);
    expect(refreshSelectedDistrictPanel).toHaveBeenCalledTimes(1);
  });

  it("action result goes through the central refresh pipeline", () => {
    const { root } = installRuntimeDom();
    const refreshSelectedDistrictPanel = vi.fn();
    window.empireStreetsDistrictState = { refreshSelectedDistrictPanel };

    const handled = handleActionResult(root, {
      kind: "event",
      payload: {
        title: "Výsledek akce",
        summary: "Akce doběhla."
      },
      options: { forceLog: true }
    });

    expect(handled).toBe(true);
    expect(refreshSelectedDistrictPanel).toHaveBeenCalledTimes(1);
  });
});
