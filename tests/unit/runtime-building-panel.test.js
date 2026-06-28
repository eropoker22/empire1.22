import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBuildingDetailMechanicRow,
  createBuildingDetailStat,
  renderBuildingActionRows,
  renderBuildingsPopupDetail,
  renderBuildingsPopupTypes
} from "../../page-assets/js/app/ui/buildingPanel.js";

const originalDocument = globalThis.document;

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
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.ownerDocument = null;
    this.dataset = {};
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.eventListeners = new Map();
    this.textContent = "";
    this.disabled = false;
    this.type = "";
    this.title = "";
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

  append(...children) {
    for (const child of children) {
      child.parentNode = this;
      child.ownerDocument = this.ownerDocument;
      this.children.push(child);
    }
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
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
}

class FakeDocument {
  createElement(tagName) {
    const element = new FakeElement(tagName);
    element.ownerDocument = this;
    return element;
  }
}

function setupDocument() {
  const document = new FakeDocument();
  globalThis.document = document;
  return document;
}

afterEach(() => {
  globalThis.document = originalDocument;
});

describe("building panel rendering", () => {
  it("renders building popup type tabs", () => {
    const document = setupDocument();
    const mount = document.createElement("div");

    renderBuildingsPopupTypes(mount, {
      types: [
        { typeKey: "resident", label: "Rezidence", meta: "2 districtů", active: true },
        { typeKey: "economy", label: "Komerce", meta: "Bez vlastního districtu", active: false, disabled: true }
      ]
    });

    expect(mount.children).toHaveLength(3);
    expect(mount.children[0].dataset.buildingsDistrictType).toBe("resident");
    expect(mount.children[0].classList.contains("is-active")).toBe(true);
    expect(mount.children[1].children[1].textContent).toBe("Bez vlastního districtu");
    expect(mount.children[1].disabled).toBe(true);
    expect(mount.children[1].classList.contains("is-locked")).toBe(true);
    expect(mount.children[1].dataset.buildingsDistrictType).toBeUndefined();
    expect(mount.children[2].classList.contains("buildings-popup__mobile-type-caption")).toBe(true);
  });

  it("renders building popup detail for empty and populated states", () => {
    const document = setupDocument();
    const mount = document.createElement("div");

    renderBuildingsPopupDetail(mount, {
      title: "Vyber typ districtu",
      emptyText: "Po výběru typu uvidíš budovy."
    });

    expect(mount.children[0].children[0].textContent).toBe("Vyber typ districtu");
    expect(mount.children[0].children[1].classList.contains("buildings-popup__empty")).toBe(true);

    renderBuildingsPopupDetail(mount, {
      selectedType: "economy",
      title: "Komerční districty",
      copy: "LIVE fáze zobrazuje všechny budovy vybraného typu districtu, jako by byly tvoje.",
      baseTypes: [
        { baseName: "Autosalon", count: 2 },
        { baseName: "Fitness Club", count: 1 }
      ],
      activeBaseName: "Autosalon",
      entries: [
        { baseName: "Autosalon", displayName: "Neon Cars", districtId: 12, districtLabel: "District 12", isOwnedByCurrentPlayer: true },
        { baseName: "Autosalon", displayName: "Enemy Cars", districtId: 13, districtLabel: "District 13", isOwnedByCurrentPlayer: false }
      ]
    });

    const card = mount.children[0];
    expect(card.dataset.buildingDistrictType).toBe("economy");
    expect(card.children[2].children[0].children[0].dataset.buildingsSelectBaseName).toBe("Autosalon");
    expect(card.children[4].children[0].children[0].dataset.buildingsOpenBuildingDistrictId).toBe("12");
    expect(card.children[4].children[0].children[1].disabled).toBe(true);
    expect(card.children[4].children[0].children[1].classList.contains("buildings-popup__building--locked")).toBe(true);
    expect(card.children[4].children[0].children[1].dataset.buildingsOpenBuildingDistrictId).toBeUndefined();
  });

  it("renders building detail stats and mechanics rows", () => {
    setupDocument();

    const stat = createBuildingDetailStat("Heat / min", "+0.030");
    const mechanic = createBuildingDetailMechanicRow("Cooldown", "20s");

    expect(stat.classList.contains("building-info-card__stat")).toBe(true);
    expect(stat.children[0].textContent).toBe("Heat / min");
    expect(stat.children[1].textContent).toBe("+0.030");
    expect(mechanic.classList.contains("district-building-detail-mechanic-row")).toBe(true);
    expect(mechanic.children[1].textContent).toBe("20s");
  });

  it("renders action rows with disabled cooldown state and callback support", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const onRunAction = vi.fn();

    renderBuildingActionRows(mount, [
      {
        index: 0,
        title: "Otevřít kanál",
        description: "Cena 800 dirty.",
        cooldownLabel: "Cooldown: 18m 00s",
        disabled: true
      },
      {
        index: 1,
        title: "Vybrat dávku",
        description: "Přesune dirty cash.",
        cooldownLabel: "Cooldown: 0s",
        disabled: false
      }
    ], { onRunAction });

    expect(mount.children).toHaveLength(2);
    expect(mount.children[0].disabled).toBe(true);
    expect(mount.children[0].children[2].textContent).toBe("Cooldown: 18m 00s");
    expect(mount.children[1].dataset.districtBuildingDetailActionIndex).toBe("1");

    mount.children[1].click();
    expect(onRunAction).toHaveBeenCalledWith(1, expect.objectContaining({ title: "Vybrat dávku" }));
  });

  it("renders a building without actions as an empty action container", () => {
    const document = setupDocument();
    const mount = document.createElement("div");

    renderBuildingActionRows(mount, []);

    expect(mount.children).toHaveLength(0);
  });
});
