import { describe, expect, it, vi } from "vitest";
import {
  formatBuildingActionCategoryLabels,
  getActionDescription,
  getActionDisabledReason,
  getActionIcon,
  getActionLabel,
  getBuildingActionUi
} from "../../page-assets/js/app/ui/buildingActionUiRegistry.js";
import {
  renderBuildingActionResult
} from "../../page-assets/js/app/ui/buildingActionResultPanel.js";

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
    this.classList = new FakeClassList();
    this.textContent = "";
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
}

class FakeDocument {
  createElement(tagName) {
    const element = new FakeElement(tagName);
    element.ownerDocument = this;
    return element;
  }
}

describe("building action UI registry", () => {
  it("returns labels and metadata for known actions", () => {
    expect(getActionLabel("VIP noc")).toBe("VIP noc");
    expect(getActionIcon("VIP noc")).toBe("VIP");

    const ui = getBuildingActionUi("Otevřít kanál", "Pašovací tunel");
    expect(ui.label).toBe("Otevřít kanál");
    expect(ui.badge).toBe("Tunel");
    expect(ui.buildingType).toBe("Pašovací tunel");
  });

  it("falls back safely for unknown actions and buildings", () => {
    const ui = getBuildingActionUi("custom-action", "neznámá budova");

    expect(ui.label).toBe("custom-action");
    expect(ui.icon).toBe("•");
    expect(ui.badge).toBe("Akce");
    expect(getActionDescription("custom-action")).toBe("Spustí lokální building akci s cooldownem a reportem v informačním panelu.");
  });

  it("keeps disabled reason text outside gameplay decisions", () => {
    expect(getActionDisabledReason({ reason: "Chybí 600 clean cash." })).toBe("Chybí 600 clean cash.");
    expect(getActionDisabledReason({
      cooldownRemainingMs: 1200,
      formatCooldown: () => "2s"
    })).toBe("Akce má cooldown 2s.");
  });

  it("hides unused cooldown categories from UI labels", () => {
    expect(formatBuildingActionCategoryLabels([
      "gangMovement",
      "attackPreparation",
      "resourceTransfer",
      "districtOccupy"
    ])).toBe("příprava útoku · obsazení districtu");
  });
});

describe("building action result panel", () => {
  it("renders success and fail states", () => {
    const document = new FakeDocument();
    const container = document.createElement("div");

    expect(renderBuildingActionResult({
      ok: true,
      title: "Akce hotová",
      summary: "Výnos připsán.",
      rows: [{ label: "Clean", value: "$100", nowrap: true }]
    }, { container })).toBe(true);

    expect(container.children[0].classList.contains("building-action-status__item--success")).toBe(true);
    expect(container.children[0].children[0].children[0].textContent).toBe("Akce hotová");
    expect(container.children[0].children[2].children[0].children[1].textContent).toBe("$100");

    expect(renderBuildingActionResult({
      ok: false,
      title: "Akce selhala",
      summary: "Chybí zdroje."
    }, { container })).toBe(true);

    expect(container.children[0].classList.contains("building-action-status__item--error")).toBe(true);
    expect(container.children[0].children[0].children[1].textContent).toBe("Selhání");
  });

  it("does not crash when the container is missing", () => {
    const onMissingContainer = vi.fn();

    expect(renderBuildingActionResult({ ok: true }, { onMissingContainer })).toBe(false);
    expect(onMissingContainer).toHaveBeenCalledTimes(1);
  });
});
