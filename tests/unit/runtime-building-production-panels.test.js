import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ensureBuildingDetailPanel,
  renderBuildingDetailPanel
} from "../../page-assets/js/app/ui/buildingDetailPanel.js";
import {
  renderCollectProductionButton,
  renderProductionOutputs,
  renderProductionPanel
} from "../../page-assets/js/app/ui/productionPanel.js";
import {
  renderCraftButton,
  renderRecipeCard,
  renderRecipeList,
  renderRecipeRequirements
} from "../../page-assets/js/app/ui/recipePanel.js";

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;
const originalHTMLElement = globalThis.HTMLElement;
const originalHTMLButtonElement = globalThis.HTMLButtonElement;

class FakeClassList {
  constructor() {
    this.tokens = new Set();
  }

  add(...tokens) {
    for (const token of tokens) if (token) this.tokens.add(token);
  }

  remove(...tokens) {
    for (const token of tokens) this.tokens.delete(token);
  }

  toggle(token, force) {
    if (force) this.add(token);
    else this.remove(token);
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
    this.dataset = {};
    this.attributes = new Map();
    this.eventListeners = new Map();
    this.classList = new FakeClassList();
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
    this.type = "";
    this.title = "";
    this.tabIndex = 0;
    this.style = {};
    this._className = "";
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

  get isConnected() {
    return Boolean(this.parentNode);
  }

  append(...children) {
    for (const child of children.filter(Boolean)) {
      child.parentNode = this;
      child.ownerDocument = this.ownerDocument;
      this.children.push(child);
    }
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  addEventListener(type, handler) {
    const handlers = this.eventListeners.get(type) || [];
    handlers.push(handler);
    this.eventListeners.set(type, handlers);
  }

  click() {
    for (const handler of this.eventListeners.get("click") || []) {
      handler({ target: this, currentTarget: this });
    }
  }

  matches(selector) {
    if (selector.startsWith(".")) {
      return this.classList.contains(selector.slice(1));
    }
    const dataMatch = selector.match(/^\[data-([a-z0-9-]+)(?:=['"]?([^'"\]]+)['"]?)?\]$/iu);
    if (dataMatch) {
      const key = dataMatch[1].replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
      return dataMatch[2] == null ? key in this.dataset : this.dataset[key] === dataMatch[2];
    }
    return false;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const selectors = String(selector || "").split(",").map((part) => part.trim()).filter(Boolean);
    const result = [];
    const visit = (node) => {
      for (const child of node.children || []) {
        if (selectors.some((item) => child.matches(item))) result.push(child);
        visit(child);
      }
    };
    visit(this);
    return result;
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (node.matches?.(selector)) return node;
      node = node.parentNode;
    }
    return null;
  }
}

class FakeDocument {
  constructor() {
    this.body = this.createElement("body");
  }

  createElement(tagName) {
    const element = new FakeElement(tagName);
    element.ownerDocument = this;
    return element;
  }

  createTextNode(text) {
    const node = this.createElement("#text");
    node.textContent = String(text);
    return node;
  }

  createDocumentFragment() {
    return this.createElement("#fragment");
  }

  addEventListener() {}
}

function setupDocument() {
  const document = new FakeDocument();
  globalThis.document = document;
  globalThis.window = {};
  globalThis.HTMLElement = FakeElement;
  globalThis.HTMLButtonElement = FakeElement;
  return document;
}

afterEach(() => {
  globalThis.document = originalDocument;
  globalThis.window = originalWindow;
  globalThis.HTMLElement = originalHTMLElement;
  globalThis.HTMLButtonElement = originalHTMLButtonElement;
});

describe("building detail, production and recipe UI modules", () => {
  it("renders building detail with a mock building and without building data", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "1:factory" });

    renderBuildingDetailPanel({
      shell,
      title: "Továrna",
      badge: "Výroba",
      levelLabel: "L3",
      name: "Továrna",
      meta: "District 1",
      stats: [{ label: "Čisté / hod", value: "$120" }],
      mechanics: [{ label: "Výstup", value: "Metal Parts" }],
      collect: { visible: true, enabled: true, title: "Vybrat připravený výstup" },
      upgrade: { disabled: false, title: "Upgrade na L4" },
      actions: []
    });

    expect(shell.hidden).toBe(false);
    expect(shell.querySelector("[data-district-building-detail-title]").textContent).toBe("Továrna");
    expect(shell.querySelector("[data-district-building-detail-stats]").children[0].children[0].textContent).toBe("Čisté / hod");
    expect(shell.querySelector("[data-district-building-detail-collect]").classList.contains("is-empty")).toBe(false);

    renderBuildingDetailPanel({
      shell,
      title: "Továrna",
      collect: { visible: true, enabled: false, title: "Zatím není co vybrat" },
      upgrade: { disabled: true, title: "" },
      stats: [],
      mechanics: [],
      actions: []
    });

    const emptyCollectButton = shell.querySelector("[data-district-building-detail-collect]");
    expect(emptyCollectButton.disabled).toBe(true);
    expect(emptyCollectButton.classList.contains("is-empty")).toBe(true);

    expect(() => renderBuildingDetailPanel(null)).not.toThrow();
    expect(() => renderBuildingDetailPanel({ shell, stats: [], mechanics: [], actions: [] })).not.toThrow();
  });

  it("renders production outputs and empty production panels", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const outputs = renderProductionOutputs([{ itemId: "metalParts", label: "Metal Parts", amount: 2 }], { mount });

    expect(outputs.children[0].children[0].textContent).toBe("Metal Parts");
    expect(outputs.children[0].children[1].textContent).toBe("2");

    expect(renderProductionPanel({ mount, recipes: [] })).toBe(true);
    expect(mount.children[0].textContent).toBe("Bez produkce.");
  });

  it("renders recipe requirements with enough and missing resources", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const requirements = renderRecipeRequirements(
      { inputs: { chemicals: 2, biomass: 3 } },
      { chemicals: 4, biomass: 1 },
      { mount, getResourceLabel: (itemId) => itemId }
    );

    expect(requirements.children[0].children[1].textContent).toBe("4/2");
    expect(requirements.children[1].children[1].textContent).toBe("1/3");
  });

  it("calls craft and collect callbacks from buttons", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const onCraft = vi.fn();
    const onCollect = vi.fn();

    renderCraftButton({ id: "stim" }, { onCraft }, { mount }).click();
    renderCollectProductionButton({ status: "ready" }, { onCollect }, { mount }).click();

    expect(onCraft).toHaveBeenCalledOnce();
    expect(onCollect).toHaveBeenCalledOnce();
  });

  it("renders recipe cards for enough and insufficient materials", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const recipe = {
      name: "Stim Pack",
      inputs: { chemicals: 1 },
      output: { inventory: "materials", itemId: "stim-pack", amount: 1 },
      durationMs: 1000
    };

    const enabled = renderRecipeCard({
      buildingName: "pharmacy",
      recipeId: "stim",
      recipe,
      inputAmounts: { chemicals: 2 },
      maxBatches: 2,
      canStart: true
    }, {}, { mount });
    const disabled = renderRecipeCard({
      buildingName: "pharmacy",
      recipeId: "stim",
      recipe,
      inputAmounts: { chemicals: 0 },
      maxBatches: 0,
      canStart: false
    }, {}, { mount });

    expect(enabled.querySelector(".pharmacy-slot__btn--start").disabled).toBe(false);
    expect(disabled.querySelector(".pharmacy-slot__btn--start").disabled).toBe(true);
    expect(renderRecipeList([{ buildingName: "pharmacy", recipeId: "stim", recipe }], {}, { mount }).children).toHaveLength(1);
  });

  it("missing DOM containers do not crash", () => {
    setupDocument();

    expect(renderProductionPanel({ mount: null, recipes: [] })).toBe(false);
    expect(ensureBuildingDetailPanel(null)).toBe(null);
  });
});
