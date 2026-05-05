import { describe, expect, it, vi } from "vitest";
import {
  closeMarketPanel,
  openMarketPanel,
  renderBlackMarketPanel,
  renderMarketEmptyState,
  renderMarketPanel,
  renderPlayerMarketPanel,
  setMarketFeedback
} from "../../page-assets/js/app/ui/marketPanel.js";

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

  toggle(token, force) {
    const shouldAdd = force === undefined ? !this.tokens.has(token) : Boolean(force);
    if (shouldAdd) {
      this.tokens.add(token);
    } else {
      this.tokens.delete(token);
    }
    return shouldAdd;
  }

  toString() {
    return Array.from(this.tokens).join(" ");
  }
}

class FakeElement {
  constructor(tagName = "div", ownerDocument = null) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = new FakeClassList();
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.value = "";
    this.type = "";
    this.title = "";
    this.style = {
      values: new Map(),
      setProperty: (name, value) => this.style.values.set(name, String(value))
    };
  }

  set className(value) {
    this.classList = new FakeClassList();
    String(value || "")
      .split(/\s+/u)
      .filter(Boolean)
      .forEach((token) => this.classList.add(token));
  }

  get className() {
    return this.classList.toString();
  }

  append(...children) {
    for (const child of children) {
      child.parentNode = this;
      this.children.push(child);
      if (this.tagName === "SELECT" && !this.value && child.value !== undefined) {
        this.value = child.value;
      }
    }
  }

  appendChild(child) {
    this.append(child);
    return child;
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }

  addEventListener(name, listener) {
    if (!this.listeners.has(name)) {
      this.listeners.set(name, []);
    }
    this.listeners.get(name).push(listener);
  }

  dispatch(name) {
    for (const listener of this.listeners.get(name) || []) {
      listener({ target: this, preventDefault() {} });
    }
  }
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(tagName, this);
  }
}

function findByClass(element, className) {
  if (element.classList?.contains(className)) {
    return element;
  }

  for (const child of element.children || []) {
    const found = findByClass(child, className);
    if (found) return found;
  }

  return null;
}

const createContainer = () => {
  const document = new FakeDocument();
  return new FakeElement("div", document);
};

const marketItem = {
  inventory: "materials",
  itemId: "chemicals",
  resourceColor: "chemicals",
  rowMode: "normal",
  name: "Chemicals",
  metaLabel: "Máš 2 ks · Stock 10/20 ks · platba clean cash",
  priceLabel: "Nákup 120$ · výkup 90$",
  trendDirection: "up",
  trendLabel: "▲ +10$",
  stockPercent: 50,
  stockLabel: "Stock 10/20 ks"
};

describe("market panel renderer", () => {
  it("renders market items and buy/sell callbacks", () => {
    const container = createContainer();
    const onBuyItem = vi.fn();
    const onSellItem = vi.fn();

    expect(renderMarketPanel(container, { items: [marketItem] }, {
      getTradeState: () => ({
        buyDisabled: false,
        sellDisabled: false,
        buyTitle: "Koupit z marketu.",
        sellTitle: "Prodat do marketu.",
        totalLabel: "Celkem 120$ · prodej 90$"
      }),
      onBuyItem,
      onSellItem
    })).toBe(true);

    expect(findByClass(container, "market-popup-row__name").textContent).toBe("Chemicals");
    expect(findByClass(container, "market-popup-row__total").textContent).toBe("Celkem 120$ · prodej 90$");

    findByClass(container, "market-popup-row__buy").dispatch("click");
    findByClass(container, "market-popup-row__sell").dispatch("click");

    expect(onBuyItem).toHaveBeenCalledWith(expect.objectContaining({ itemId: "chemicals" }), 1, expect.any(Function));
    expect(onSellItem).toHaveBeenCalledWith(expect.objectContaining({ itemId: "chemicals" }), 1, expect.any(Function));
  });

  it("renders black market rows with risk text", () => {
    const container = createContainer();

    renderBlackMarketPanel(container, {
      items: [{ ...marketItem, rowMode: "black", trendDirection: "flat", trendLabel: "• beze změny" }]
    }, {
      getTradeState: () => ({
        buyDisabled: false,
        sellDisabled: true,
        buyTitle: "Black market risk: +3 heat (nízké).",
        sellTitle: "Nemáš dost kusů ve skladu.",
        totalLabel: "Celkem 300$ · prodej 120$ · +3 heat"
      })
    });

    expect(container.children[0].dataset.marketRowMode).toBe("black");
    expect(findByClass(container, "market-popup-row__total").textContent).toContain("+3 heat");
  });

  it("renders empty state and handles missing containers", () => {
    const container = createContainer();

    expect(renderMarketEmptyState(container, "Market je prázdný.")).toBe(true);
    expect(container.children[0].textContent).toBe("Market je prázdný.");
    expect(renderMarketPanel(null, { items: [marketItem] })).toBe(false);
  });

  it("renders player market listings and sell form callbacks", () => {
    const container = createContainer();
    const onCreateListing = vi.fn();
    const onBuyListing = vi.fn();

    renderPlayerMarketPanel(container, {
      sellableItems: [{ inventory: "materials", itemId: "chemicals", name: "Chemicals", amount: 4 }],
      ownListingCount: 0,
      ownListingLimit: 4,
      listings: [{
        id: "listing-1",
        isOwn: false,
        sellerName: "Dealer",
        inventory: "materials",
        itemId: "chemicals",
        itemName: "Chemicals",
        amount: 2,
        unitPrice: 150,
        total: 300,
        currency: "cleanMoney",
        expiresAt: Date.now() + 600000,
        title: "Koupit nabídku od hráče na tomto serveru."
      }]
    }, {
      getSuggestedUnitPrice: () => 125,
      onCreateListing,
      onBuyListing
    });

    findByClass(container, "market-player-sell-button").dispatch("click");
    findByClass(container, "market-player-listing__buy").dispatch("click");

    expect(onCreateListing).toHaveBeenCalledWith(expect.objectContaining({
      requestedAmount: 1,
      unitPrice: 125,
      currency: "cleanMoney"
    }));
    expect(onBuyListing).toHaveBeenCalledWith(expect.objectContaining({ id: "listing-1" }));
  });

  it("opens, closes, and renders feedback without crashing", () => {
    const popup = createContainer();
    const feedback = createContainer();

    expect(openMarketPanel(popup)).toBe(true);
    expect(popup.hidden).toBe(false);
    expect(closeMarketPanel(popup)).toBe(true);
    expect(popup.hidden).toBe(true);
    expect(setMarketFeedback(feedback, "success", "Hotovo")).toBe(true);
    expect(feedback.hidden).toBe(false);
    expect(feedback.dataset.marketFeedbackTone).toBe("success");
    expect(feedback.textContent).toBe("Hotovo");
  });
});
