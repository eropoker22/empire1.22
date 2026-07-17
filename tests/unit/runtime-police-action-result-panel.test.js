import { describe, expect, it, vi } from "vitest";
import { renderPoliceRaidImpactDetails } from "../../page-assets/js/app/police-raid-modal.js";
import { renderPoliceActionResultPanel } from "../../page-assets/js/app/ui/policeActionResultPanel.js";

class FakeClassList {
  constructor() { this.tokens = new Set(); }
  add(...tokens) { for (const token of tokens) this.tokens.add(token); }
  remove(...tokens) { for (const token of tokens) this.tokens.delete(token); }
  contains(token) { return this.tokens.has(token); }
}

class FakeElement {
  constructor(queries = {}) {
    this.children = [];
    this.classList = new FakeClassList();
    this.attributes = new Map();
    this.textContent = "";
    this.innerHTML = "";
    this.hidden = false;
    this.style = {};
    this.queries = queries;
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  querySelectorAll() {
    return [];
  }
  querySelector(selector) {
    if (typeof this.queries === "function") {
      return this.queries(selector);
    }
    return this.queries[selector] || null;
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
    expect(nodes["#badge"].hidden).toBe(false);
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

  it("renders owned raid impact as a compact player-facing card", () => {
    const container = new FakeElement();
    const rendered = renderPoliceRaidImpactDetails(container, {
      tone: "is-owned-district-raid-alert",
      title: "Dopady razie",
      badge: "",
      summary: "Policie zasáhla tvůj district. Zkontroluj dopady a počkej na konec razie."
    }, [
      { label: "District", value: "District 2" },
      { label: "Vlastník", value: "TY" },
      { label: "Typ razie", value: "! Total" },
      { label: "Doba razie", value: "60s" },
      { label: "Konec za", value: "30s" },
      { label: "Income na 1h", value: "-20%" },
      { label: "Zákaz akcí", value: "Aktivní" },
      { label: "Zabavené zbraně", value: "2" }
    ]);

    expect(rendered).toBe(true);
    expect(container.innerHTML).toContain("data-police-raid-impact-open");
    expect(container.innerHTML).toContain("data-police-raid-impact-detail");
    expect(container.innerHTML).toContain("Policejní zásah");
    expect(container.innerHTML).toContain("Dopad");
    expect(container.innerHTML).toContain("Zabaveno");
    expect(container.innerHTML).toContain("Zobrazit ztráty a blokace");
    expect(container.innerHTML).toContain("Přišel jsi o");
    expect(container.innerHTML).toContain("Blokované akce");
    expect(container.innerHTML).toContain("Co ti policie vzala a zablokovala");
    expect(container.innerHTML).toContain("Zabavené zbraně");
    expect(container.innerHTML).toContain("Zákaz akcí");
    expect(container.innerHTML).not.toContain("<strong>Dopady razie</strong>");
    expect(container.innerHTML).not.toContain("Razie • Total • 2/6");
    expect(container.innerHTML).not.toContain("Vlastník");
    expect(container.innerHTML).not.toContain("Doba razie");
    expect(container.innerHTML).not.toContain("Police / Raid");
    expect(container.innerHTML).not.toContain("Zabaveno teď");
  });

  it("hides the badge row for owned district raid alerts", () => {
    const nodes = Object.fromEntries(Object.values(selectors).map((selector) => [selector, new FakeElement()]));
    const actions = new FakeElement();
    nodes["#content"].queries[".attack-result-modal__actions"] = actions;

    const result = renderPoliceActionResultPanel(new FakeRoot(nodes), {
      tone: "is-tier-2 is-owned-district-raid-alert",
      title: "Dopady razie",
      badge: "Razie • Zatýkací vlna • 2/6",
      summary: "Policie zasáhla tvůj district.",
      rows: []
    }, {
      selectors,
      renderPoliceRaidImpactDetails: () => true
    });

    expect(result.ok).toBe(true);
    expect(nodes["#badge"].textContent).toBe("");
    expect(nodes["#badge"].hidden).toBe(true);
    expect(nodes["#badge"].attributes.get("aria-hidden")).toBe("true");
    expect(nodes["#badge"].style.display).toBe("none");
    expect(actions.hidden).toBe(true);
    expect(actions.attributes.get("aria-hidden")).toBe("true");
    expect(actions.style.display).toBe("none");
  });

  it("hides empty chrome for compact active-attack status", () => {
    const nodes = Object.fromEntries(Object.values(selectors).map((selector) => [selector, new FakeElement()]));

    const result = renderPoliceActionResultPanel(new FakeRoot(nodes), {
      tone: "is-district-attack-warning",
      title: "Probíhá útok",
      hideBadge: true,
      hideSummary: true,
      rows: [{ label: "Útočník", value: "Player 1" }]
    }, { selectors });

    expect(result.ok).toBe(true);
    expect(nodes["#badge"].hidden).toBe(true);
    expect(nodes["#summary"].hidden).toBe(true);
    expect(nodes["#summary"].style.display).toBe("none");
  });

  it("keeps the raid detail window open across live rerenders", () => {
    const existingDetail = new FakeElement();
    existingDetail.hidden = false;
    existingDetail.classList.add("is-open");
    const rerenderedDetail = new FakeElement();
    let detailLookupCount = 0;
    const container = new FakeElement((selector) => {
      if (selector !== "[data-police-raid-impact-detail]") {
        return null;
      }
      detailLookupCount += 1;
      return detailLookupCount === 1 ? existingDetail : rerenderedDetail;
    });

    renderPoliceRaidImpactDetails(container, {
      tone: "is-owned-district-raid-alert",
      title: "Dopady razie",
      summary: "Policie zasáhla tvůj district."
    }, [
      { label: "District", value: "District 2" },
      { label: "Zákaz akcí", value: "Aktivní" }
    ]);

    expect(rerenderedDetail.hidden).toBe(false);
    expect(rerenderedDetail.classList.contains("is-open")).toBe(true);
    expect(rerenderedDetail.attributes.get("aria-hidden")).toBe("false");
  });
});
