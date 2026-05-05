import { describe, expect, it, vi } from "vitest";
import {
  escapeModalHtml,
  renderActionResultRows,
  renderSimpleResultModal
} from "../../page-assets/js/app/ui/resultModalPanel.js";

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
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.ownerDocument = null;
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.textContent = "";
    this.innerHTML = "";
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

  matches(selector) {
    if (selector.startsWith("#")) {
      return this.id === selector.slice(1);
    }
    if (selector.startsWith(".")) {
      return this.classList.contains(selector.slice(1));
    }
    return false;
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

function createSimpleResultFixture() {
  const document = new FakeDocument();
  const root = document.createElement("main");
  const modal = createElement(document, "div", { id: "spy-result-modal", className: "hidden" });
  const content = createElement(document, "section", { id: "spy-result-modal-content", className: "is-major-fail" });
  const title = createElement(document, "h3", { id: "spy-result-modal-title" });
  const summary = createElement(document, "p", { id: "spy-result-modal-summary" });
  const details = createElement(document, "div", { id: "spy-result-modal-details" });

  document.append(root);
  root.append(modal);
  modal.append(content);
  content.append(title, summary, details);

  return { root, modal, content, title, summary, details };
}

describe("result modal panel helpers", () => {
  it("escapes modal row HTML and preserves nowrap rows", () => {
    const container = { innerHTML: "" };

    renderActionResultRows(container, [
      { label: "<Cíl>", value: "District & 7" },
      { label: "Čas", value: "\"20s\"", nowrap: true },
      { label: "Prázdné", value: null }
    ]);

    expect(container.innerHTML).toContain("&lt;Cíl&gt;");
    expect(container.innerHTML).toContain("District &amp; 7");
    expect(container.innerHTML).toContain("&quot;20s&quot;");
    expect(container.innerHTML).toContain("modal__nowrap-value");
    expect(container.innerHTML).not.toContain("Prázdné");
  });

  it("renders a simple result modal without changing payload decisions", () => {
    const fixture = createSimpleResultFixture();

    expect(renderSimpleResultModal(fixture.root, {
      tone: "is-success",
      title: "Výsledek špehování",
      summary: "Špeh se vrátil.",
      rows: [
        { label: "Cíl", value: "District 3" },
        { label: "Intel", value: "Získán" }
      ]
    }, {
      modalSelector: "#spy-result-modal",
      contentSelector: "#spy-result-modal-content",
      titleSelector: "#spy-result-modal-title",
      summarySelector: "#spy-result-modal-summary",
      detailsSelector: "#spy-result-modal-details",
      toneClasses: ["is-success", "is-medium-fail", "is-major-fail"],
      fallbackTone: "is-major-fail",
      defaultTitle: "Výsledek špehování"
    })).toBe(true);

    expect(fixture.modal.classList.contains("hidden")).toBe(false);
    expect(fixture.content.classList.contains("is-major-fail")).toBe(false);
    expect(fixture.content.classList.contains("is-success")).toBe(true);
    expect(fixture.title.textContent).toBe("Výsledek špehování");
    expect(fixture.summary.textContent).toBe("Špeh se vrátil.");
    expect(fixture.details.innerHTML).toContain("District 3");
    expect(fixture.details.innerHTML).toContain("Získán");
  });

  it("warns and returns false when required modal elements are missing", () => {
    const root = new FakeElement("main");
    const warn = vi.fn();

    expect(renderSimpleResultModal(root, { title: "Výsledek" }, {
      modalSelector: "#missing-modal",
      contentSelector: "#missing-content",
      titleSelector: "#missing-title",
      summarySelector: "#missing-summary",
      detailsSelector: "#missing-details"
    }, { console: { warn } })).toBe(false);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Result modal is missing required elements"));
  });

  it("exposes the same HTML escaping used by legacy result rows", () => {
    expect(escapeModalHtml("<>&\"'")).toBe("&lt;&gt;&amp;&quot;&#39;");
  });
});
