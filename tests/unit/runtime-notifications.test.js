import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearNotifications,
  renderNotificationList,
  showError,
  showInfo,
  showSuccess,
  showToast,
  showWarning
} from "../../page-assets/js/app/ui/notifications.js";
import { showSpyToast } from "../../page-assets/js/app/runtime.js";

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

  toString() {
    return Array.from(this.tokens).join(" ");
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
    this.hidden = false;
    this.textContent = "";
    this.offsetWidth = 0;
    this.nodeType = 1;
  }

  set className(value) {
    this.classList = new FakeClassList();
    String(value || "")
      .split(/\s+/u)
      .filter(Boolean)
      .forEach((token) => this.classList.add(token));
  }

  get className() {
    return this.classList.toString();
  }

  setAttribute(name, value) {
    const stringValue = String(value);
    this.attributes.set(name, stringValue);

    if (name === "id") {
      this.id = stringValue;
    }

    if (name.startsWith("data-")) {
      const datasetName = name
        .slice(5)
        .replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
      this.dataset[datasetName] = stringValue;
    }
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  append(child) {
    this.appendChild(child);
  }

  appendChild(child) {
    child.parentNode = this;
    child.ownerDocument = this.ownerDocument;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parentNode = null;
    }
    return child;
  }

  remove() {
    this.parentNode?.removeChild(this);
  }

  matches(selector) {
    if (selector.startsWith("#")) {
      return this.id === selector.slice(1);
    }

    if (selector.startsWith(".")) {
      return this.classList.contains(selector.slice(1));
    }

    const dataAttribute = selector.match(/^\[data-([a-z0-9-]+)(?:="([^"]+)")?\]$/iu);
    if (dataAttribute) {
      const attributeName = `data-${dataAttribute[1]}`;
      if (!this.attributes.has(attributeName)) {
        return false;
      }
      return dataAttribute[2] === undefined || this.attributes.get(attributeName) === dataAttribute[2];
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
    this.nodeType = 9;
    this.ownerDocument = this;
  }

  createElement(tagName) {
    const element = new FakeElement(tagName);
    element.ownerDocument = this;
    return element;
  }
}

const originalWindow = globalThis.window;

afterEach(() => {
  if (originalWindow === undefined) {
    delete globalThis.window;
    return;
  }

  globalThis.window = originalWindow;
});

function createNotificationFixture() {
  const document = new FakeDocument();
  const root = document.createElement("main");
  const container = document.createElement("div");

  document.append(root);
  container.setAttribute("data-mount-role", "notifications");
  root.append(container);

  return { document, root, container };
}

describe("runtime notifications", () => {
  it("does not throw when a toast container is missing", () => {
    const document = new FakeDocument();
    const root = document.createElement("main");
    document.append(root);

    expect(() => showToast("Missing container", "info", { root })).not.toThrow();
    expect(showToast("Missing container", "info", { root })).toBeNull();
  });

  it("renders a visible dynamic notification with text", () => {
    const { root, container } = createNotificationFixture();

    const toast = showToast("Action finished", "success", { root, durationMs: 0 });

    expect(toast).not.toBeNull();
    expect(toast.textContent).toBe("Action finished");
    expect(toast.hidden).toBe(false);
    expect(toast.classList.contains("runtime-notification")).toBe(true);
    expect(toast.classList.contains("runtime-notification--success")).toBe(true);
    expect(toast.getAttribute("role")).toBe("status");
    expect(container.children).toContain(toast);
  });

  it("keeps success, error, and warning helpers wired to showToast", () => {
    const { root } = createNotificationFixture();

    expect(showSuccess("Saved", { root, durationMs: 0 })?.classList.contains("runtime-notification--success")).toBe(true);
    expect(showError("Failed", { root, durationMs: 0 })?.getAttribute("role")).toBe("alert");
    expect(showWarning("Careful", { root, durationMs: 0 })?.classList.contains("runtime-notification--warning")).toBe(true);
  });

  it("renders info notifications and notification lists", () => {
    const { root, container } = createNotificationFixture();

    expect(showInfo("Info", { root, durationMs: 0 })?.textContent).toBe("Info");

    const rendered = renderNotificationList([
      "Plain",
      { message: "Warning", type: "warning" }
    ], { root, durationMs: 0 });

    expect(rendered).toHaveLength(2);
    expect(container.children.map((child) => child.textContent)).toEqual(["Plain", "Warning"]);
  });

  it("clears dynamic notifications", () => {
    const { root, container } = createNotificationFixture();

    showToast("One", "info", { root, durationMs: 0 });
    showToast("Two", "warning", { root, durationMs: 0 });

    expect(container.querySelectorAll("[data-runtime-notification]")).toHaveLength(2);
    expect(clearNotifications({ root })).toBe(2);
    expect(container.querySelectorAll("[data-runtime-notification]")).toHaveLength(0);
  });

  it("keeps the existing runtime spy toast call site working", () => {
    const setTimeout = vi.fn(() => 1001);
    const clearTimeout = vi.fn();
    globalThis.window = { setTimeout, clearTimeout };

    const document = new FakeDocument();
    const root = document.createElement("main");
    const toast = document.createElement("div");
    document.append(root);
    toast.hidden = true;
    toast.setAttribute("data-spy-toast", "");
    root.append(toast);

    expect(showSpyToast(root)).toBe(toast);
    expect(toast.hidden).toBe(false);
    expect(toast.classList.contains("is-visible")).toBe(true);
    expect(setTimeout).toHaveBeenCalledTimes(1);
  });
});
