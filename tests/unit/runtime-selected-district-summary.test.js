import { describe, expect, it } from "vitest";
import {
  clearSelectedDistrictSummary,
  renderNoDistrictSelected,
  renderSelectedDistrictSummary
} from "../../page-assets/js/app/ui/selectedDistrictSummary.js";

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
    if (shouldAdd) this.tokens.add(token);
    else this.tokens.delete(token);
  }
}

class FakeElement {
  constructor() {
    this.textContent = "";
    this.src = "";
    this.hidden = false;
    this.parentElement = null;
    this.parentNode = null;
    this.dataset = {};
    this.attributes = new Map();
    this.tabIndex = 0;
    this.title = "";
    this.classList = new FakeClassList();
    this.style = {
      values: new Map(),
      setProperty(name, value) {
        this.values.set(name, String(value));
      }
    };
  }

  append(child) {
    child.parentElement = this;
    child.parentNode = this;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
}

const createElements = () => {
  const ownerAvatarWrap = new FakeElement();
  const ownerAvatar = new FakeElement();
  ownerAvatarWrap.append(ownerAvatar);
  return {
    title: new FakeElement(),
    type: new FakeElement(),
    owner: new FakeElement(),
    ownerMeta: new FakeElement(),
    ownerAvatar,
    ownerAvatarWrap,
    ownerAvatarFallback: new FakeElement(),
    card: new FakeElement()
  };
};

describe("selected district summary UI", () => {
  it("renders selected district summary and avatar background", () => {
    const elements = createElements();
    expect(renderSelectedDistrictSummary({
      title: "District 4",
      typeLabel: "Rezidence",
      ownerLabel: "TY",
      ownerMeta: "Syndicate · Tvůj profil",
      ownerAvatarSrc: "../avatar.png",
      ownerAvatarEmpty: false,
      ownerFallback: "TY",
      ownerAvatarBackgroundUrl: "../avatar.png"
    }, { elements })).toBe(true);

    expect(elements.title.textContent).toBe("District 4");
    expect(elements.type.textContent).toBe("Rezidence");
    expect(elements.owner.textContent).toBe("TY");
    expect(elements.ownerAvatar.src).toBe("../avatar.png");
    expect(elements.ownerAvatarFallback.hidden).toBe(true);
    expect(elements.ownerAvatarFallback.textContent).toBe("");
    expect(elements.ownerAvatarWrap.classList.contains("is-clickable")).toBe(true);
    expect(elements.ownerAvatarWrap.dataset.districtOwnerAvatarOpen).toBe("true");
    expect(elements.ownerAvatarWrap.dataset.districtOwnerAvatarSrc).toBe("../avatar.png");
    expect(elements.ownerAvatarWrap.dataset.districtOwnerAvatarName).toBe("TY");
    expect(elements.ownerAvatarWrap.tabIndex).toBe(0);
    expect(elements.card.classList.contains("district-owner-bg-active")).toBe(true);

    renderSelectedDistrictSummary({
      title: "District 5",
      typeLabel: "Rezidence",
      ownerLabel: "Neobsazeno",
      ownerMeta: "Bez aktivního vlastníka",
      ownerFallback: "Neobsazeno"
    }, { elements });

    expect(elements.ownerAvatarWrap.classList.contains("is-clickable")).toBe(false);
    expect(elements.ownerAvatarWrap.dataset.districtOwnerAvatarOpen).toBe("false");
    expect(elements.ownerAvatarWrap.tabIndex).toBe(-1);

    renderSelectedDistrictSummary({
      title: "District 6",
      typeLabel: "Rezidence",
      ownerLabel: "Neobsazeno",
      ownerMeta: "Bez aktivního vlastníka",
      ownerAvatarHidden: false,
      ownerFallback: ""
    }, { elements });

    expect(elements.ownerAvatarWrap.classList.contains("is-owner-hidden")).toBe(false);
    expect(elements.ownerAvatarFallback.hidden).toBe(true);
    expect(elements.ownerAvatarFallback.textContent).toBe("");
  });

  it("renders no-district state and handles null view model", () => {
    const elements = createElements();
    expect(renderNoDistrictSelected({ elements })).toBe(true);
    expect(elements.owner.textContent).toBe("Bez výběru");

    expect(renderSelectedDistrictSummary(null, { elements })).toBe(true);
    expect(elements.type.textContent).toBe("Vyber district");

    expect(clearSelectedDistrictSummary({ elements })).toBe(true);
    expect(elements.ownerAvatarFallback.hidden).toBe(false);
    expect(elements.ownerAvatarFallback.textContent).toBe("?");
  });

  it("hides owner avatar fallback for unrevealed districts", () => {
    const elements = createElements();
    renderSelectedDistrictSummary({
      title: "District 7",
      typeLabel: "Neznámý sektor",
      ownerLabel: "Neobsazeno",
      ownerMeta: "Bez aktivního vlastníka",
      ownerAvatarHidden: true,
      ownerFallback: ""
    }, { elements });

    expect(elements.ownerAvatarWrap.classList.contains("is-clickable")).toBe(false);
    expect(elements.ownerAvatarWrap.classList.contains("is-owner-hidden")).toBe(true);
    expect(elements.ownerAvatarFallback.hidden).toBe(true);
    expect(elements.ownerAvatarFallback.textContent).toBe("");
  });
});
