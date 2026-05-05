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
    this.classList = new FakeClassList();
    this.style = {
      values: new Map(),
      setProperty(name, value) {
        this.values.set(name, String(value));
      }
    };
  }
}

const createElements = () => ({
  title: new FakeElement(),
  type: new FakeElement(),
  owner: new FakeElement(),
  ownerMeta: new FakeElement(),
  ownerAvatar: new FakeElement(),
  ownerAvatarFallback: new FakeElement(),
  card: new FakeElement()
});

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
    expect(elements.ownerAvatarFallback.textContent).toBe("T");
    expect(elements.card.classList.contains("district-owner-bg-active")).toBe(true);
  });

  it("renders no-district state and handles null view model", () => {
    const elements = createElements();
    expect(renderNoDistrictSelected({ elements })).toBe(true);
    expect(elements.owner.textContent).toBe("Bez výběru");

    expect(renderSelectedDistrictSummary(null, { elements })).toBe(true);
    expect(elements.type.textContent).toBe("Vyber district");

    expect(clearSelectedDistrictSummary({ elements })).toBe(true);
    expect(elements.ownerAvatarFallback.textContent).toBe("?");
  });
});
