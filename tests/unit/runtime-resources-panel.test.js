import { describe, expect, it } from "vitest";
import {
  bindTopbarMoneySkipControls,
  renderStorageList,
  updateTopbarResources
} from "../../page-assets/js/app/ui/resourcesPanel.js";
import { renderResourcesPanel } from "../../page-assets/js/app/runtime.js";

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
    this.children = [];
    this.parentNode = null;
    this.ownerDocument = null;
    this.attributes = new Map();
    this.dataset = {};
    this.classList = new FakeClassList();
    this.textContent = "";
    this.title = "";
    this.offsetWidth = 0;
    this.nodeType = 1;
    this.listeners = new Map();
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
    if (name.startsWith("data-")) {
      const datasetName = name
        .slice(5)
        .replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
      this.dataset[datasetName] = stringValue;
    }
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  matches(selector) {
    if (selector.startsWith(".")) {
      return this.classList.contains(selector.slice(1));
    }

    const dataAttribute = selector.match(/^\[data-([a-z0-9-]+)(?:="([^"]*)")?\]$/iu);
    if (!dataAttribute) {
      return false;
    }

    const attributeName = `data-${dataAttribute[1]}`;
    if (!this.attributes.has(attributeName)) {
      return false;
    }

    return dataAttribute[2] === undefined || this.attributes.get(attributeName) === dataAttribute[2];
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

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (element) => {
      for (const child of element.children) {
        if (child.matches(selector)) {
          matches.push(child);
        }
        visit(child);
      }
    };
    visit(this);
    return matches;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) || []) {
      listener(event);
    }
  }
}

class FakeDocument extends FakeElement {
  constructor() {
    super("#document");
    this.nodeType = 9;
    this.ownerDocument = this;
  }

  createElement(tagName) {
    const element = new FakeElement(tagName);
    element.ownerDocument = this;
    return element;
  }
}

function createElement(document, tagName, attributes = {}) {
  const element = document.createElement(tagName);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  return element;
}

function createResourceFixture() {
  const document = new FakeDocument();
  const root = document.createElement("main");
  document.append(root);

  const cleanPill = createElement(document, "div");
  cleanPill.classList.add("resource-pill");
  const cleanValue = createElement(document, "strong", { "data-topbar-clean-money": "" });
  cleanPill.append(cleanValue);

  const dirtyPill = createElement(document, "div");
  dirtyPill.classList.add("resource-pill");
  const dirtyValue = createElement(document, "strong", { "data-topbar-dirty-money": "" });
  dirtyPill.append(dirtyValue);

  const spyPill = createElement(document, "button", { "data-topbar-spy-pill": "" });
  spyPill.classList.add("resource-pill");
  const spyLabel = createElement(document, "span", { "data-topbar-spy-label": "" });
  const spyValue = createElement(document, "strong", {
    "data-topbar-influence": "",
    "data-topbar-spy-value": ""
  });
  spyPill.append(spyLabel, spyValue);

  const gangMembers = createElement(document, "strong", { "data-gang-members": "" });
  root.append(cleanPill, dirtyPill, spyPill, gangMembers);

  return { root, cleanPill, cleanValue, dirtyPill, dirtyValue, spyPill, spyLabel, spyValue, gangMembers };
}

function createStorageCounter(document, attribute, itemId) {
  return createElement(document, "span", { [attribute]: itemId });
}

describe("resources panel UI rendering", () => {
  it("does not throw when DOM anchors are missing", () => {
    const document = new FakeDocument();
    const root = document.createElement("main");
    document.append(root);

    expect(() => updateTopbarResources({ cleanMoney: 10, dirtyMoney: 5 }, { root })).not.toThrow();
    expect(() => renderStorageList({ weapons: { pistol: 1 } }, { root })).not.toThrow();
  });

  it("renders topbar cash, influence, and spy resource values", () => {
    const { root, cleanPill, cleanValue, dirtyValue, spyPill, spyLabel, spyValue } = createResourceFixture();

    updateTopbarResources({
      cleanMoney: 120,
      dirtyMoney: 45,
      influence: 7,
      spyAvailable: 2,
      maxSpies: 5,
      sourceMode: "stored"
    }, { root, instant: true });

    expect(cleanValue.textContent).toBe("$120");
    expect(dirtyValue.textContent).toBe("$45");
    expect(spyLabel.textContent).toBe("Vliv");
    expect(spyValue.textContent).toBe("7");
    expect(spyValue.dataset.influenceValue).toBe("7");
    expect(spyPill.classList.contains("resource-pill--influence")).toBe(true);
    expect(spyPill.getAttribute("aria-label")).toContain("7 vlivu");
    expect(cleanPill.title).toBe("Aktuální stav čistých peněz.");
  });

  it("refreshes resource values after state changes", () => {
    const { root, cleanValue, dirtyValue, spyPill, spyLabel, spyValue } = createResourceFixture();
    spyPill.dataset.resourceMode = "spy";

    updateTopbarResources({
      cleanMoney: 120,
      dirtyMoney: 45,
      influence: 7,
      spyAvailable: 2,
      maxSpies: 5
    }, { root, instant: true });
    updateTopbarResources({
      cleanMoney: 250,
      dirtyMoney: 100,
      influence: 9,
      spyAvailable: 4,
      maxSpies: 5,
      resourceMode: "spy"
    }, { root, instant: true });

    expect(cleanValue.textContent).toBe("$250");
    expect(dirtyValue.textContent).toBe("$100");
    expect(spyLabel.textContent).toBe("Špeh");
    expect(spyValue.textContent).toBe("4");
    expect(spyValue.dataset.spyValue).toBe("4");
    expect(spyPill.classList.contains("resource-pill--spy")).toBe(true);
  });

  it("counts money and influence one unit at a time when values change", () => {
    const { root, cleanValue, dirtyValue, spyValue } = createResourceFixture();
    const intervals = [];
    const timerApi = {
      setInterval(callback) {
        intervals.push(callback);
        return callback;
      },
      clearInterval(callback) {
        const index = intervals.indexOf(callback);
        if (index >= 0) intervals.splice(index, 1);
      },
      setTimeout(callback) {
        return callback;
      },
      clearTimeout() {}
    };

    updateTopbarResources({
      cleanMoney: 10,
      dirtyMoney: 20,
      influence: 5,
      spyAvailable: 0,
      maxSpies: 0
    }, { root, instant: true, timerApi });

    updateTopbarResources({
      cleanMoney: 13,
      dirtyMoney: 18,
      influence: 7,
      spyAvailable: 0,
      maxSpies: 0
    }, { root, timerApi });

    expect(cleanValue.textContent).toBe("$11");
    expect(dirtyValue.textContent).toBe("$19");
    expect(spyValue.textContent).toBe("6");

    for (const callback of [...intervals]) callback();

    expect(cleanValue.textContent).toBe("$12");
    expect(dirtyValue.textContent).toBe("$18");
    expect(spyValue.textContent).toBe("7");

    for (const callback of [...intervals]) callback();

    expect(cleanValue.textContent).toBe("$13");
    expect(dirtyValue.textContent).toBe("$18");
    expect(spyValue.textContent).toBe("7");
  });

  it("binds topbar money controls to skip counters to the latest snapshot", () => {
    const { root, cleanPill, cleanValue, dirtyPill, dirtyValue } = createResourceFixture();

    updateTopbarResources({ cleanMoney: 10, dirtyMoney: 20 }, { root, instant: true });
    bindTopbarMoneySkipControls(root, {
      getDisplaySnapshot: () => ({ cleanMoney: 99, dirtyMoney: 77 })
    });

    const event = {
      type: "click",
      preventDefault() {},
      stopPropagation() {}
    };
    cleanPill.dispatchEvent(event);
    dirtyPill.dispatchEvent(event);

    expect(cleanValue.textContent).toBe("$99");
    expect(dirtyValue.textContent).toBe("$77");
    expect(cleanPill.dataset.moneySkipBound).toBe("1");
  });

  it("renders and refreshes storage counters", () => {
    const document = new FakeDocument();
    const root = document.createElement("main");
    const pistol = createStorageCounter(document, "data-storage-weapon-count", "pistol");
    const chemicals = createStorageCounter(document, "data-storage-material-count", "chemicals");
    const neonDust = createStorageCounter(document, "data-storage-drug-count", "neon-dust");
    const metalParts = createStorageCounter(document, "data-storage-factory-count", "metalParts");
    document.append(root);
    root.append(pistol, chemicals, neonDust, metalParts);

    renderStorageList({
      weapons: { pistol: 3 },
      materials: { chemicals: 8 },
      drugs: { "neon-dust": 2 },
      factorySupplies: { metalParts: 11 }
    }, { root });

    expect(pistol.textContent).toBe("3 ks");
    expect(chemicals.textContent).toBe("8 ks");
    expect(neonDust.textContent).toBe("2 ks");
    expect(metalParts.textContent).toBe("11 ks");

    renderStorageList({
      weapons: { pistol: 5 },
      materials: { chemicals: 1 },
      drugs: { "neon-dust": 0 },
      factorySupplies: { metalParts: 14 }
    }, { root });

    expect(pistol.textContent).toBe("5 ks");
    expect(chemicals.textContent).toBe("1 ks");
    expect(neonDust.textContent).toBe("0 ks");
    expect(metalParts.textContent).toBe("14 ks");
  });

  it("keeps the runtime facade resource renderer working", () => {
    const { root, gangMembers } = createResourceFixture();

    renderResourcesPanel({ gangMembers: 42 }, { root, includeMoney: false, includeSpy: false });

    expect(gangMembers.textContent).toBe("42");
  });
});
