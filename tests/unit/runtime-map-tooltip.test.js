import { describe, expect, it } from "vitest";
import {
  hideDistrictTooltip,
  renderDistrictTooltip,
  renderDistrictTooltipGossip,
  updateDistrictTooltipPosition
} from "../../page-assets/js/app/map/mapTooltip.js";

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
}

class FakeElement {
  constructor(tagName = "div", ownerDocument = null) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.classList = new FakeClassList();
    this.textContent = "";
    this.hidden = false;
    this.offsetWidth = 84;
    this.offsetHeight = 52;
    this.style = { transform: "" };
  }

  set className(value) {
    this.classList = new FakeClassList();
    String(value || "").split(/\s+/u).filter(Boolean).forEach((token) => this.classList.add(token));
  }

  append(...children) {
    for (const child of children) {
      child.ownerDocument = this.ownerDocument;
      this.children.push(child);
    }
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(tagName, this);
  }
}

const createElement = (document, tagName = "div") => document.createElement(tagName);

describe("map tooltip UI", () => {
  it("renders and hides district tooltip without crashing", () => {
    const document = new FakeDocument();
    const tooltip = createElement(document);
    const value = createElement(document);
    const type = createElement(document);
    const gossip = createElement(document);

    const result = renderDistrictTooltip({
      idLabel: "7",
      typeLabel: "TY",
      gossipEntries: [{ intelLevel: "verified", text: "Viděno u skladu." }]
    }, {
      pointerX: 40,
      pointerY: 30
    }, {
      tooltip,
      value,
      type,
      gossip,
      viewportRect: { width: 300, height: 200 },
      tooltipSize: { width: 84, height: 52 }
    });

    expect(result.visible).toBe(true);
    expect(tooltip.hidden).toBe(false);
    expect(value.textContent).toBe("7");
    expect(type.textContent).toBe("TY");
    expect(gossip.children[1].children[0].children[0].textContent).toBe("OVĚŘENO");
    expect(tooltip.style.transform).toContain("translate(");

    expect(hideDistrictTooltip({ tooltip, gossip })).toBe(false);
    expect(tooltip.hidden).toBe(true);
    expect(gossip.children).toHaveLength(0);
  });

  it("renders empty gossip and handles missing containers", () => {
    const document = new FakeDocument();
    const gossip = createElement(document);

    expect(renderDistrictTooltipGossip(gossip, [])).toBe(true);
    expect(gossip.children[1].children[0].textContent).toBe("Zatím bez drbů.");
    expect(renderDistrictTooltip(null, {}, {})).toMatchObject({ visible: false });
    expect(updateDistrictTooltipPosition({}, {})).toBeNull();
  });
});
