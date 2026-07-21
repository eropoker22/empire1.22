import { afterEach, describe, expect, it } from "vitest";
import {
  renderHeatBadge,
  renderHeatJournalList,
  renderWantedFeedback,
  renderWantedPanel,
  resolveHeatBadgePoliceThreat
} from "../../page-assets/js/app/ui/wantedPanel.js";

const originalDocument = globalThis.document;

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
    this.classList = new FakeClassList();
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
    this.title = "";
    this.attributes = new Map();
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
    this.children.push(...children.filter(Boolean));
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
}

function setupDocument() {
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName)
  };
}

afterEach(() => {
  globalThis.document = originalDocument;
});

describe("wanted panel UI module", () => {
  it("does not crash with missing DOM mounts", () => {
    expect(() => renderHeatBadge(null, {})).not.toThrow();
    expect(() => renderWantedPanel(null, {})).not.toThrow();
    expect(() => renderWantedFeedback(null, "warning", "missing")).not.toThrow();
    expect(() => renderHeatJournalList(null, null)).not.toThrow();
  });

  it("renders heat badge stars and wanted panel mock state", () => {
    setupDocument();
    const heatButton = new FakeElement("button");
    const starContainer = new FakeElement("div");
    const stars = [new FakeElement("span"), new FakeElement("span"), new FakeElement("span")];
    const mounts = {
      popupHeat: new FakeElement(),
      popupLevel: new FakeElement(),
      popupTier: new FakeElement(),
      popupDescription: new FakeElement(),
      popupProtection: new FakeElement(),
      popupAuditRisk: new FakeElement(),
      popupLevels: new FakeElement(),
      popupRiseList: new FakeElement(),
      popupFallList: new FakeElement(),
      dirtyActionButton: new FakeElement("button"),
      cleanActionButton: new FakeElement("button"),
      influenceActionButton: new FakeElement("button")
    };

    const viewModel = {
      heat: 82,
      levelId: 3,
      levelLabel: "Tier 3",
      title: "Známý problém",
      description: "Častější kontroly.",
      protectionLabel: "Bez ochrany",
      auditRiskPct: 30,
      levels: [
        { id: 1, label: "Tier 1", title: "Nízký heat", effect: "nízké riziko" },
        { id: 3, label: "Tier 3", title: "Známý problém", effect: "zásahy", active: true }
      ],
      riseEntries: [{ type: "rise", amount: 12, reason: "Black market", createdAt: new Date(Date.now() - 60_000).toISOString() }],
      fallEntries: [],
      dirtyActionDisabled: true,
      cleanActionDisabled: false,
      influenceActionDisabled: true
    };

    renderHeatBadge(viewModel, { heatButton, starContainer, stars });
    renderWantedPanel(viewModel, { mounts });

    expect(heatButton.textContent).toBe("82");
    expect(starContainer.attributes.get("aria-label")).toBe("Heat 82 · Známý problém");
    expect(stars[0].classList.contains("is-active")).toBe(true);
    expect(stars[2].classList.contains("is-active")).toBe(true);
    expect(mounts.popupTier.classList.contains("wanted-popup-title--stars")).toBe(true);
    expect(mounts.popupTier.children[0].classList.contains("wanted-popup-stars")).toBe(true);
    expect(mounts.popupTier.children[0].children).toHaveLength(6);
    expect(mounts.popupTier.children[0].children[0].textContent).toBe("★");
    expect(mounts.popupTier.children[0].children[2].classList.contains("is-active")).toBe(true);
    expect(mounts.popupTier.children[0].children[3].classList.contains("is-active")).toBe(false);
    expect(mounts.popupTier.children[1].textContent).toBe("Známý problém");
    expect(mounts.popupAuditRisk.textContent).toBe("30 %");
    expect(mounts.popupLevels.children).toHaveLength(2);
    expect(mounts.popupLevels.children[0].children[0].children[0].classList.contains("wanted-popup-stars")).toBe(true);
    expect(mounts.popupRiseList.children[0].children[0].textContent).toBe("Black market");
    expect(mounts.popupFallList.children[0].textContent).toBe("Zatím bez nových důvodů poklesu.");
    expect(mounts.dirtyActionButton.disabled).toBe(true);
    expect(mounts.cleanActionButton.disabled).toBe(false);
    expect(mounts.influenceActionButton.disabled).toBe(true);
  });

  it("marks gang profile stars neon when police action threatens the player", () => {
    const heatButton = new FakeElement("button");
    const starContainer = new FakeElement("div");
    const stars = [new FakeElement("span"), new FakeElement("span"), new FakeElement("span")];

    const viewModel = {
      heat: 118,
      levelId: 2,
      label: "Tier 3",
      title: "Raid risk",
      policeFeedback: {
        riskKey: "high",
        pendingRaid: { raidId: "raid:1", status: "pending" }
      }
    };

    renderHeatBadge(viewModel, { heatButton, starContainer, stars });

    expect(resolveHeatBadgePoliceThreat(viewModel)).toBe(true);
    expect(starContainer.classList.contains("is-police-threat")).toBe(true);
    expect(starContainer.attributes.get("data-police-threat")).toBe("true");
    expect(starContainer.attributes.get("aria-label")).toContain("Hrozí policejní akce");
    expect(heatButton.title).toContain("Hrozí policejní akce");
    expect(stars[0].classList.contains("is-police-threat")).toBe(true);
    expect(stars[1].classList.contains("is-police-threat")).toBe(true);
    expect(stars[2].classList.contains("is-police-threat")).toBe(false);
  });
});
