import { describe, expect, it, vi } from "vitest";
import { renderBattleReport as renderBattleReportPanel } from "../../page-assets/js/app/ui/battleReportPanel.js";
import { renderBattleReport } from "../../page-assets/js/app/runtime.js";

class FakeClassList {
  constructor() {
    this.tokens = new Set();
  }

  add(...tokens) {
    for (const token of tokens) {
      if (token) {
        this.tokens.add(token);
      }
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
    if (shouldAdd) {
      this.tokens.add(token);
    } else {
      this.tokens.delete(token);
    }
    return shouldAdd;
  }
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.ownerDocument = null;
    this.attributes = new Map();
    this.dataset = {};
    this.classList = new FakeClassList();
    this.textContent = "";
    this.nodeType = 1;
  }

  append(...children) {
    for (const child of children) {
      this.appendChild(child);
    }
  }

  appendChild(child) {
    child.parentNode = this;
    child.ownerDocument = this.ownerDocument;
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    const stringValue = String(value);
    this.attributes.set(name, stringValue);
    if (name === "id") {
      this.id = stringValue;
    }
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  matches(selector) {
    if (selector.startsWith("#")) {
      return this.id === selector.slice(1);
    }
    if (selector.startsWith(".")) {
      return this.classList.contains(selector.slice(1));
    }
    return false;
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (current.matches?.(selector)) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (element) => {
      for (const child of element.children) {
        if (child.matches(selector)) {
          matches.push(child);
        }
        visit(child);
      }
    };
    visit(this);
    return matches;
  }
}

class FakeDocument extends FakeElement {
  constructor() {
    super("#document");
    this.nodeType = 9;
    this.ownerDocument = this;
  }

  createElement(tagName) {
    const element = new FakeElement(tagName);
    element.ownerDocument = this;
    return element;
  }
}

function createElement(document, tagName, { id, className = "" } = {}) {
  const element = document.createElement(tagName);
  if (id) {
    element.setAttribute("id", id);
  }
  for (const token of className.split(/\s+/u).filter(Boolean)) {
    element.classList.add(token);
  }
  return element;
}

function appendStatRow(document, stats, labelId, valueId) {
  const row = createElement(document, "div", { className: "modal__row attack-result-modal__stat" });
  const label = createElement(document, "span", { id: labelId });
  const value = createElement(document, "strong", { id: valueId });
  row.append(label, value);
  stats.append(row);
  return { row, label, value };
}

function createBattleReportFixture() {
  const document = new FakeDocument();
  const root = document.createElement("main");
  const modal = createElement(document, "div", { id: "attack-result-modal", className: "modal hidden" });
  const content = createElement(document, "div", { id: "attack-result-modal-content", className: "modal__content attack-result-modal__content is-failure" });
  const title = createElement(document, "h3", { id: "attack-result-modal-title" });
  const badge = createElement(document, "span", { id: "attack-result-modal-badge" });
  const summary = createElement(document, "p", { id: "attack-result-modal-summary" });
  const stats = createElement(document, "div", { id: "attack-result-modal-stats" });

  document.append(root);
  root.append(modal);
  modal.append(content);
  content.append(title, badge, summary, stats);

  const target = appendStatRow(document, stats, "attack-result-modal-label-target", "attack-result-modal-nickname");
  const attack = appendStatRow(document, stats, "attack-result-modal-label-attack", "attack-result-modal-faction");
  const defense = appendStatRow(document, stats, "attack-result-modal-label-defense", "attack-result-modal-alliance");
  const attackLoss = appendStatRow(document, stats, "attack-result-modal-label-attack-losses", "attack-result-modal-weapons");
  const defenseLoss = appendStatRow(document, stats, "attack-result-modal-label-defense-losses", "attack-result-modal-power");
  const state = appendStatRow(document, stats, "attack-result-modal-label-state", "attack-result-modal-members");
  const duration = appendStatRow(document, stats, "attack-result-modal-label-duration", "attack-result-modal-duration");

  return {
    root,
    modal,
    content,
    title,
    badge,
    summary,
    target,
    attack,
    defense,
    attackLoss,
    defenseLoss,
    state,
    duration
  };
}

describe("battle report panel rendering", () => {
  it("renders a successful attack report", () => {
    const fixture = createBattleReportFixture();

    expect(renderBattleReportPanel(fixture.root, {
      tone: "is-total-success",
      title: "TOTÁLNÍ ÚSPĚCH",
      badge: "District je tvůj",
      summary: "District padl.",
      districtName: "District 12",
      attackPower: 240,
      defensePower: 120,
      attackerLossesLabel: "10%",
      defenderLossesLabel: "100%",
      districtStateValue: "Obsazený",
      durationValue: "20s",
      showDefensePower: true
    })).toBe(true);

    expect(fixture.modal.classList.contains("hidden")).toBe(false);
    expect(fixture.content.classList.contains("is-total-success")).toBe(true);
    expect(fixture.title.textContent).toBe("TOTÁLNÍ ÚSPĚCH");
    expect(fixture.badge.textContent).toBe("District je tvůj");
    expect(fixture.target.value.textContent).toBe("District 12");
    expect(fixture.attack.value.textContent).toBe("240");
    expect(fixture.defense.value.textContent).toBe("120");
    expect(fixture.attackLoss.value.textContent).toBe("10%");
    expect(fixture.defenseLoss.value.textContent).toBe("100%");
    expect(fixture.state.value.textContent).toBe("Obsazený");
    expect(fixture.duration.value.textContent).toBe("20s");
  });

  it("renders a failed attack report and hides defense power when requested", () => {
    const fixture = createBattleReportFixture();

    renderBattleReportPanel(fixture.root, {
      tone: "is-total-success",
      title: "TOTÁLNÍ ÚSPĚCH",
      districtName: "District 4",
      showDefensePower: true
    });
    renderBattleReportPanel(fixture.root, {
      tone: "is-failure",
      title: "NEÚSPĚCH",
      badge: "Útok odražen",
      summary: "Útok nevyšel.",
      districtName: "District 4",
      attackPower: 80,
      defensePower: 150,
      attackerLossesLabel: "35%",
      defenderLossesLabel: "15%",
      districtStateValue: "Stojí",
      durationValue: "20s",
      showDefensePower: false
    });

    expect(fixture.content.classList.contains("is-total-success")).toBe(false);
    expect(fixture.content.classList.contains("is-failure")).toBe(true);
    expect(fixture.title.textContent).toBe("NEÚSPĚCH");
    expect(fixture.defense.value.textContent).toBe("-");
    expect(fixture.defense.row.classList.contains("hidden")).toBe(true);
  });

  it("renders a pyrrhic result report through the runtime facade", () => {
    const fixture = createBattleReportFixture();

    expect(renderBattleReport(fixture.root, {
      tone: "is-pyrrhic-victory",
      title: "PYRRHOVO VÍTĚZSTVÍ",
      badge: "Obrana zničená",
      summary: "Vyhráli jste draze.",
      districtName: "District 9",
      attackPower: 160,
      defensePower: 158,
      attackerLossesLabel: "50%",
      defenderLossesLabel: "100%",
      districtStateValue: "Stojí",
      durationValue: "20s",
      showDefensePower: true
    })).toBe(true);

    expect(fixture.content.classList.contains("is-pyrrhic-victory")).toBe(true);
    expect(fixture.title.textContent).toBe("PYRRHOVO VÍTĚZSTVÍ");
    expect(fixture.state.value.textContent).toBe("Stojí");
  });

  it("renders report text that includes a police warning", () => {
    const fixture = createBattleReportFixture();

    renderBattleReportPanel(fixture.root, {
      tone: "is-failure",
      title: "NEÚSPĚCH",
      badge: "Police warning",
      summary: "Policejní hlídky zachytily hluk po útoku.",
      districtName: "District 2",
      attackerLossesLabel: "20%",
      defenderLossesLabel: "5%",
      districtStateValue: "Stojí",
      durationValue: "20s"
    });

    expect(fixture.badge.textContent).toBe("Police warning");
    expect(fixture.summary.textContent).toBe("Policejní hlídky zachytily hluk po útoku.");
  });

  it("does not throw when the battle report container is missing", () => {
    const document = new FakeDocument();
    const root = document.createElement("main");
    const warn = vi.fn();
    document.append(root);

    expect(() => renderBattleReportPanel(root, { title: "NEÚSPĚCH" }, { console: { warn } })).not.toThrow();
    expect(renderBattleReportPanel(root, { title: "NEÚSPĚCH" }, { console: { warn } })).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Battle report modal is missing required elements"));
  });
});
