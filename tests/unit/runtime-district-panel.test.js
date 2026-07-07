import { describe, expect, it } from "vitest";
import {
  renderDistrictActionPanel,
  renderDistrictBuildingList,
  renderDistrictFlags,
  renderDistrictMetricSummary,
  renderDistrictSummaryPanel
} from "../../page-assets/js/app/ui/districtPanel.js";

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
    if (shouldAdd) this.tokens.add(token);
    else this.tokens.delete(token);
    return shouldAdd;
  }
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.ownerDocument = null;
    this.dataset = {};
    this.style = {
      values: new Map(),
      display: "",
      setProperty(name, value) {
        this.values.set(name, String(value));
      }
    };
    this.classList = new FakeClassList();
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
    this.type = "";
    this.title = "";
    this.src = "";
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
    this[name] = String(value);
  }
}

class FakeDocument {
  createElement(tagName) {
    const element = new FakeElement(tagName);
    element.ownerDocument = this;
    return element;
  }
}

function createElement(document, tagName = "div") {
  return document.createElement(tagName);
}

describe("district panel rendering", () => {
  it("renders owned, foreign, and unowned district summaries", () => {
    const document = new FakeDocument();
    const elements = {
      title: createElement(document, "h3"),
      type: createElement(document, "span"),
      owner: createElement(document, "strong"),
      ownerMeta: createElement(document, "span"),
      ownerAvatar: createElement(document, "img"),
      ownerAvatarFallback: createElement(document, "span"),
      card: createElement(document, "article")
    };

    renderDistrictSummaryPanel(elements, {
      title: "District 7",
      typeLabel: "Rezidence",
      ownerLabel: "Ty",
      ownerMeta: "Frakce · Tvůj profil",
      ownerAvatarSrc: "../img/avatar.png",
      ownerAvatarEmpty: false,
      ownerFallback: "Ty",
      ownerAvatarBackgroundUrl: "../img/avatar.png"
    });

    expect(elements.title.textContent).toBe("District 7");
    expect(elements.type.textContent).toBe("Rezidence");
    expect(elements.owner.textContent).toBe("Ty");
    expect(elements.ownerAvatar.src).toBe("../img/avatar.png");
    expect(elements.card.classList.contains("district-owner-bg-active")).toBe(true);

    renderDistrictSummaryPanel(elements, {
      title: "District 8",
      typeLabel: "Komerce",
      ownerLabel: "Cizí gang",
      ownerMeta: "Hráč 2",
      ownerFallback: "Cizí gang"
    });

    expect(elements.owner.textContent).toBe("Cizí gang");
    expect(elements.ownerAvatarFallback.textContent).toBe("C");
    expect(elements.card.classList.contains("district-owner-bg-active")).toBe(false);

    renderDistrictSummaryPanel(elements, {
      title: "District 9",
      typeLabel: "Skryto",
      ownerLabel: "Neobsazeno",
      ownerMeta: "Bez aktivního vlastníka",
      ownerFallback: "Neobsazeno"
    });

    expect(elements.owner.textContent).toBe("Neobsazeno");
    expect(elements.ownerMeta.textContent).toBe("Bez aktivního vlastníka");
  });

  it("renders district metrics and flags safely", () => {
    const document = new FakeDocument();
    const flags = createElement(document);

    renderDistrictMetricSummary({
      defense: createElement(document),
      defensePower: createElement(document),
      residents: createElement(document),
      income: createElement(document),
      heat: createElement(document),
      influence: createElement(document)
    }, {
      defenseLabel: "Žádná",
      defensePowerLabel: "0",
      residentsLabel: "12",
      incomeLabel: "$120/h",
      heatLabel: "+2/den",
      influenceLabel: "+1/h"
    });

    renderDistrictFlags(flags, [
      { label: "Tvůj", tone: "good" },
      { label: "Policejní akce", tone: "danger" }
    ]);

    expect(flags.children).toHaveLength(2);
    expect(flags.children[0].textContent).toBe("Tvůj");
    expect(flags.children[1].classList.contains("district-popup-flag--danger")).toBe(true);
  });

  it("renders empty, hidden, and populated district building lists", () => {
    const document = new FakeDocument();
    const section = createElement(document);
    const meta = createElement(document);
    const list = createElement(document);

    renderDistrictBuildingList({ section, meta, list }, {
      metaText: "Nezjištěno",
      emptyText: "Bez spy nebo vlastnictví zatím nevíš, jaké budovy jsou v tomto distriktu."
    });

    expect(section.hidden).toBe(false);
    expect(meta.textContent).toBe("Nezjištěno");
    expect(list.children[0].classList.contains("district-popup-buildings__empty")).toBe(true);

    renderDistrictBuildingList({ section, meta, list }, {
      metaText: "",
      buildings: [
        { name: "Autosalon", label: "Autosalon", displayName: "Neon Cars" },
        { name: "Lékárna", displayName: "Noční Lékárna", kindLabel: "Výroba" }
      ],
      trap: { visible: true, label: "Toxická past", meta: "59:59" }
    });

    expect(meta.textContent).toBe("");
    expect(list.children).toHaveLength(3);
    expect(list.children[0].dataset.districtBuildingName).toBe("Autosalon");
    expect(list.children[0].dataset.districtBuildingDisplayName).toBe("Neon Cars");
    expect(list.children[0].children[0].textContent).toBe("Autosalon");
    expect(list.children[0].title).toBe("Autosalon");
    expect(list.children[1].children[0].textContent).toBe("Noční Lékárna");
    expect(list.children[1].children[1].textContent).toBe("Výroba");
    expect(list.children[1].dataset.districtBuildingKind).toBe("Výroba");
    expect(list.children[2].classList.contains("district-popup-buildings__chip--trap")).toBe(true);
    expect(list.children[2].dataset.districtBuildingTrap).toBe("active");
    expect(list.children[2].children[1].textContent).toBe("59:59");
  });

  it("renders district action buttons and police lock state", () => {
    const document = new FakeDocument();
    const section = createElement(document);
    const head = createElement(document);
    const mount = createElement(document);

    renderDistrictActionPanel({ section, head, mount }, {
      hidden: false,
      headHidden: true,
      actions: [
        { id: "spy", label: "Špehovat", enabled: true },
        { id: "trap", label: "Toxická past", enabled: false, stacked: true, trapState: "cooldown", subtitle: "20s cooldown", reason: "Přesun pasti je v cooldownu." }
      ]
    });

    expect(section.hidden).toBe(false);
    expect(head.hidden).toBe(true);
    expect(mount.children).toHaveLength(2);
    expect(mount.children[0].children[0].dataset.districtActionId).toBe("spy");
    expect(mount.children[1].children[0].disabled).toBe(true);
    expect(mount.children[1].children[0].dataset.districtTrapState).toBe("cooldown");

    renderDistrictActionPanel({ section, head, mount }, {
      hidden: false,
      policeMessage: "District je právě pod policejní akcí."
    });

    expect(mount.children).toHaveLength(1);
    expect(mount.children[0].children[0].textContent).toBe("District je právě pod policejní akcí.");

    renderDistrictActionPanel({ section, head, mount }, {
      hidden: false,
      statusMessage: "District 4 je obsazován."
    });

    expect(mount.children).toHaveLength(1);
    expect(mount.children[0].children[0].textContent).toBe("District 4 je obsazován.");

    renderDistrictActionPanel({ section, head, mount }, {
      hidden: false,
      noticeMessage: "Downtown je uzavřený.",
      actions: [{ id: "rob", label: "Vykrást district", enabled: true }]
    });

    expect(mount.children).toHaveLength(2);
    expect(mount.children[0].children[0].textContent).toBe("Downtown je uzavřený.");
    expect(mount.children[1].children[0].dataset.districtActionId).toBe("rob");
  });
});
