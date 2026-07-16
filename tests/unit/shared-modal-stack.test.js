// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  bindSharedModal,
  closeSharedModal,
  getSharedModalStackSize,
  openSharedModal
} from "../../page-assets/js/app/ui/sharedModalStack.js";

const createModal = (id) => {
  const modal = document.createElement("div");
  modal.id = id;
  modal.hidden = true;
  modal.innerHTML = `<div data-shared-modal-close></div><section role="dialog" aria-modal="false"><button data-first>První</button><button data-last>Poslední</button></section>`;
  document.body.append(modal);
  bindSharedModal(modal);
  return modal;
};

afterEach(() => {
  document.querySelectorAll("[role='dialog']").forEach((dialog) => closeSharedModal(dialog.parentElement));
  document.body.innerHTML = "";
  document.body.className = "";
});

describe("shared modal stack", () => {
  it("keeps one active aria-modal layer and restores focus and scroll state", () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const parent = createModal("parent");
    const child = createModal("child");

    openSharedModal(parent, { trigger });
    openSharedModal(child, { trigger: parent.querySelector("[data-first]") });

    expect(getSharedModalStackSize()).toBe(2);
    expect(parent.getAttribute("aria-modal")).toBe("false");
    expect(child.getAttribute("aria-modal")).toBe("true");
    expect(document.body.classList.contains("shared-modal-open")).toBe(true);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(child.hidden).toBe(true);
    expect(parent.hidden).toBe(false);
    expect(parent.getAttribute("aria-modal")).toBe("true");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(parent.hidden).toBe(true);
    expect(getSharedModalStackSize()).toBe(0);
    expect(document.body.classList.contains("shared-modal-open")).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it("cycles focus inside the top layer", () => {
    const modal = createModal("focus");
    openSharedModal(modal);
    const first = modal.querySelector("[data-first]");
    const last = modal.querySelector("[data-last]");
    last.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(first);
    first.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(last);
  });
});
