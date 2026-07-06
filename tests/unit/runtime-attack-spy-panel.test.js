import { describe, expect, it, vi } from "vitest";
import {
  closeAttackPanel,
  openAttackPanel,
  renderAttackConfirmPanel,
  renderAttackPanel,
  renderAttackProgress
} from "../../page-assets/js/app/ui/attackPanel.js";
import {
  closeSpyPanel,
  openSpyPanel,
  renderSpyPanel,
  renderSpyWarningPanel
} from "../../page-assets/js/app/ui/spyPanel.js";

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
    this.max = "";
    this.title = "";
    this.src = "";
    this.alt = "";
    this.innerHTML = "";
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

  replaceChildren(...children) {
    this.children = [];
    this.value = "";
    this.append(...children);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
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

function createElement(tagName = "div", ownerDocument = new FakeDocument()) {
  return new FakeElement(tagName, ownerDocument);
}

function createRoot(selectorMap) {
  return {
    querySelector(selector) {
      return selectorMap[selector] || null;
    }
  };
}

describe("attack and spy panel renderers", () => {
  it("renders attack setup panel and attack progress", () => {
    const document = new FakeDocument();
    const title = createElement("h2", document);
    const sourceSelect = createElement("select", document);
    const availablePopulation = createElement("span", document);
    const requiredPopulation = createElement("span", document);
    const estimatedPower = createElement("span", document);
    const status = createElement("span", document);
    const confirmButton = createElement("button", document);
    const card = createElement("section", document);
    const imageElement = createElement("img", document);
    const labelElement = createElement("strong", document);
    const ownedBat = createElement("span", document);
    ownedBat.dataset.attackOwned = "bat";
    const batInput = createElement("input", document);
    batInput.dataset.attackWeaponInput = "bat";

    expect(renderAttackPanel({
      targetDistrictId: 7,
      sourceDistrictIds: [2],
      weaponInventory: { bat: 3 },
      atmosphereMeta: { typeKey: "downtown", label: "Downtown", imagePath: "img/downtown.webp" }
    }, {}, {
      elements: {
        card,
        imageElement,
        labelElement,
        title,
        sourceSelect,
        availablePopulation,
        requiredPopulation,
        estimatedPower,
        status,
        ownedElements: [ownedBat],
        weaponInputs: [batInput],
        confirmButton
      }
    })).toBe(true);

    expect(title.textContent).toBe("District 7");
    expect(sourceSelect.disabled).toBe(false);
    expect(sourceSelect.value).toBe("2");
    expect(ownedBat.textContent).toBe("3");
    expect(batInput.max).toBe("3");
    expect(card.dataset.districtType).toBe("downtown");
    expect(imageElement.src).toBe("img/downtown.webp");
    expect(imageElement.dataset.atmosphereImagePath).toBe("img/downtown.webp");
    expect(labelElement.textContent).toBe("Downtown");

    renderAttackProgress({
      availablePopulation: 12,
      totalResidents: 2,
      totalPower: 80,
      status: "Připraveno",
      canConfirm: true
    }, {
      elements: { availablePopulation, requiredPopulation, estimatedPower, status, confirmButton }
    });

    expect(availablePopulation.textContent).toBe("12");
    expect(requiredPopulation.textContent).toBe("2");
    expect(estimatedPower.textContent).toBe("80");
    expect(status.textContent).toBe("Připraveno");
    expect(confirmButton.disabled).toBe(false);
  });

  it("renders attack confirm panel and delegates confirm callback", () => {
    const confirmButton = createElement("button");
    const onConfirmAttack = vi.fn();

    renderAttackConfirmPanel({
      targetDistrictId: 8,
      sourceLabel: "District 2",
      totalResidents: 3,
      attackPower: 120,
      scenarioLabel: "Úspěch",
      durationLabel: "25s",
      note: "Výzbroj: Baseballová pálka x3.",
      canConfirm: true
    }, {
      onConfirmAttack
    }, {
      elements: {
        title: createElement("span"),
        source: createElement("span"),
        members: createElement("span"),
        power: createElement("span"),
        scenario: createElement("span"),
        duration: createElement("span"),
        note: createElement("span"),
        confirmButton
      }
    });

    confirmButton.dispatch("click");
    expect(onConfirmAttack).toHaveBeenCalledWith(expect.objectContaining({ targetDistrictId: 8 }), expect.any(Object));
  });

  it("renders spy panel and delegates confirm callback", () => {
    const confirmButton = createElement("button");
    const onConfirmSpy = vi.fn();
    const title = createElement("span");
    const source = createElement("span");
    const available = createElement("span");
    const duration = createElement("span");
    const note = createElement("span");

    expect(renderSpyPanel({
      targetDistrictId: 9,
      sourceLabel: "District 4",
      availableSpies: 2,
      durationLabel: "30s",
      note: "Částečný úspěch odhalí typ distriktu.",
      canConfirm: true
    }, {
      onConfirmSpy
    }, {
      elements: { title, source, available, duration, note, confirmButton }
    })).toBe(true);

    expect(title.textContent).toBe("District 9");
    expect(source.textContent).toBe("District 4");
    expect(available.textContent).toBe("2");
    expect(duration.textContent).toBe("30s");
    expect(confirmButton.disabled).toBe(false);

    confirmButton.dispatch("click");
    expect(onConfirmSpy).toHaveBeenCalledWith(expect.objectContaining({ targetDistrictId: 9 }), expect.any(Object));
  });

  it("renders spy warning panel and handles missing DOM without crashing", () => {
    const modal = createElement("div");
    modal.className = "hidden";
    const content = createElement("div");
    const title = createElement("h3");
    const badge = createElement("span");
    const summary = createElement("p");
    const details = createElement("div");
    const root = createRoot({
      "#spy-warning-modal": modal,
      "#spy-warning-modal-content": content,
      "#spy-warning-modal-title": title,
      "#spy-warning-modal-badge": badge,
      "#spy-warning-modal-summary": summary,
      "#spy-warning-modal-details": details
    });

    expect(renderSpyWarningPanel(root, {
      districtName: "District 12",
      detectedAtLabel: "12:30",
      attackerNick: "Nick",
      attackerGang: "Gang",
      attackerAlliance: "Aliance",
      summary: "Špeh byl odhalen."
    })).toBe(true);

    expect(modal.classList.contains("hidden")).toBe(false);
    expect(details.innerHTML).toContain("District 12");
    expect(renderAttackPanel({}, {}, { elements: {} })).toBe(false);
    expect(openAttackPanel(null, {})).toBe(false);
    expect(closeSpyPanel({})).toBe(false);
  });

  it("opens and closes attack and spy popups", () => {
    const attackPopup = createElement("div");
    const spyPopup = createElement("div");

    expect(openAttackPanel(null, { popup: attackPopup })).toBe(true);
    expect(attackPopup.hidden).toBe(false);
    expect(closeAttackPanel({ popup: attackPopup })).toBe(true);
    expect(attackPopup.hidden).toBe(true);

    expect(openSpyPanel(null, { popup: spyPopup })).toBe(true);
    expect(spyPopup.hidden).toBe(false);
    expect(closeSpyPanel({ popup: spyPopup })).toBe(true);
    expect(spyPopup.hidden).toBe(true);
  });
});
