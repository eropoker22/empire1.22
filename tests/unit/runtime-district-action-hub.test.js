import { describe, expect, it, vi } from "vitest";
import {
  clearDistrictActionHub,
  renderDistrictActionButton,
  renderDistrictActionDisabledReason,
  renderDistrictActionHub
} from "../../page-assets/js/app/ui/districtActionHub.js";

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
    this.dataset = {};
    this.listeners = new Map();
    this.classList = new FakeClassList();
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
    this.type = "";
    this.title = "";
    this.style = { display: "" };
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

  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(listener);
  }

  dispatch(name) {
    for (const listener of this.listeners.get(name) || []) {
      listener({ target: this });
    }
  }
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(tagName, this);
  }
}

const createElement = (document, tagName = "div") => document.createElement(tagName);

describe("district action hub", () => {
  it("renders attack/heist/spy/robbery/trap/defense buttons and callbacks", () => {
    const document = new FakeDocument();
    const section = createElement(document);
    const head = createElement(document);
    const mount = createElement(document);
    const onAction = vi.fn();

    expect(renderDistrictActionHub({
      hidden: false,
      headHidden: true,
      actions: [
        { id: "attack", label: "Útok", enabled: true },
        { id: "heist", label: "Vykrást hráče", enabled: true },
        { id: "spy", label: "Špehovat", enabled: true },
        { id: "rob", label: "Vykrást district", enabled: true },
        { id: "trap", label: "Past", enabled: true, stacked: true, trapState: "idle", subtitle: "ready" },
        { id: "defense", label: "Obrana", enabled: true }
      ]
    }, { onAction }, { elements: { section, head, mount } })).toBe(true);

    expect(section.hidden).toBe(false);
    expect(head.hidden).toBe(true);
    expect(mount.children).toHaveLength(6);
    expect(mount.children.map((row) => row.children[0].dataset.districtActionId)).toEqual(["attack", "heist", "spy", "rob", "trap", "defense"]);

    mount.children[0].children[0].dispatch("click");
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: "attack" }));
  });

  it("keeps disabled or callback-less actions from firing", () => {
    const document = new FakeDocument();
    const mount = createElement(document);
    const callback = vi.fn();
    const disabled = renderDistrictActionButton({ id: "spy", label: "Spy", enabled: false }, callback, { mount });
    const missingCallback = renderDistrictActionButton({ id: "attack", label: "Attack", enabled: true }, null, { mount });

    disabled.dispatch("click");
    missingCallback.dispatch("click");

    expect(disabled.disabled).toBe(true);
    expect(missingCallback.disabled).toBe(true);
    expect(callback).not.toHaveBeenCalled();
  });

  it("renders action countdowns under the button label and keeps the action locked", () => {
    const document = new FakeDocument();
    const mount = createElement(document);
    const callback = vi.fn();
    const button = renderDistrictActionButton({
      id: "spy",
      label: "Špehovat",
      enabled: true,
      countdownLabel: "Zbývá 1:25",
      countdownEndsAt: 125000
    }, callback, { mount });

    expect(button.dataset.districtActionId).toBe("spy");
    expect(button.dataset.districtActionCountdown).toBe("true");
    expect(button.dataset.districtActionCountdownEndsAt).toBe("125000");
    expect(button.disabled).toBe(true);
    expect(button.classList.contains("district-popup-action--countdown")).toBe(true);
    expect(button.children).toHaveLength(2);
    expect(button.children[0].textContent).toBe("Špehovat");
    expect(button.children[1].textContent).toBe("Zbývá 1:25");
    expect(button.children[1].classList.contains("district-popup-action__countdown")).toBe(true);
    button.dispatch("click");
    expect(callback).not.toHaveBeenCalled();
  });

  it("renders disabled reasons, police lock and clears safely", () => {
    const document = new FakeDocument();
    const mount = createElement(document);

    const reason = renderDistrictActionDisabledReason("Chybí sousední district.", { mount });
    expect(reason.textContent).toBe("Chybí sousední district.");

    renderDistrictActionHub({ policeMessage: "District je právě pod policejní akcí." }, {}, { mount });
    expect(mount.children[0].children[0].textContent).toBe("District je právě pod policejní akcí.");
    expect(clearDistrictActionHub({ mount })).toBe(true);
    expect(mount.children).toHaveLength(0);
    expect(renderDistrictActionHub({}, {}, {})).toBe(false);
  });
});
