import { describe, expect, it, vi } from "vitest";
import { renderPoliceActionResultPanel } from "../../page-assets/js/app/ui/policeActionResultPanel.js";

class FakeClassList {
  constructor() { this.tokens = new Set(); }
  add(...tokens) { for (const token of tokens) this.tokens.add(token); }
  remove(...tokens) { for (const token of tokens) this.tokens.delete(token); }
  contains(token) { return this.tokens.has(token); }
}

class FakeElement {
  constructor() {
    this.children = [];
    this.classList = new FakeClassList();
    this.textContent = "";
    this.innerHTML = "";
  }
  querySelectorAll() {
    return [];
  }
}

class FakeRoot {
  constructor(nodes = {}) {
    this.nodes = nodes;
  }
  querySelector(selector) {
    return this.nodes[selector] || null;
  }
}

const selectors = {
  modal: "#modal",
  content: "#content",
  title: "#title",
  badge: "#badge",
  summary: "#summary",
  details: "#details"
};

describe("police action result panel", () => {
  it("returns falsey result when required DOM is missing", () => {
    expect(renderPoliceActionResultPanel(new FakeRoot(), {}, { selectors }).ok).toBe(false);
  });

  it("renders static police result payload", () => {
    const nodes = Object.fromEntries(Object.values(selectors).map((selector) => [selector, new FakeElement()]));
    nodes["#modal"].classList.add("hidden");
    const renderImpact = vi.fn(() => false);

    const result = renderPoliceActionResultPanel(new FakeRoot(nodes), {
      title: "Policejní akce",
      badge: "Raid",
      summary: "Zásah proběhl.",
      tone: "is-tier-3",
      rows: [{ label: "Heat", value: "12" }]
    }, {
      selectors,
      renderPoliceRaidImpactDetails: renderImpact
    });

    expect(result.ok).toBe(true);
    expect(nodes["#content"].classList.contains("is-tier-3")).toBe(true);
    expect(nodes["#title"].textContent).toBe("Policejní akce");
    expect(nodes["#badge"].textContent).toBe("Raid");
    expect(nodes["#summary"].textContent).toBe("Zásah proběhl.");
    expect(nodes["#details"].innerHTML).toContain("Heat");
    expect(nodes["#modal"].classList.contains("hidden")).toBe(false);
    expect(renderImpact).toHaveBeenCalledTimes(1);
  });

  it("renders live city event rows", () => {
    const nodes = Object.fromEntries(Object.values(selectors).map((selector) => [selector, new FakeElement()]));
    const result = renderPoliceActionResultPanel(new FakeRoot(nodes), {
      liveRowsKind: "city_event",
      title: "Event",
      endsAt: Date.now() + 2000,
      successRate: 55,
      gains: ["Cash"],
      risk: "Střední"
    }, {
      selectors,
      formatDurationLabel: () => "2s"
    });

    expect(result.ok).toBe(true);
    expect(result.hasLiveRows).toBe(true);
    expect(nodes["#details"].innerHTML).toContain("Zbývá");
    expect(nodes["#details"].innerHTML).toContain("2s");
  });
});
