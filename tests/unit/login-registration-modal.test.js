// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { bindLoginRegistrationModal } from "../../page-assets/js/app/login-registration-modal.js";

const mount = () => {
  document.body.innerHTML = `
    <button type="button" data-login-registration-open>Založit gang</button>
    <div data-login-registration-overlay hidden aria-hidden="true">
      <button type="button" data-login-registration-close>Backdrop</button>
      <section role="dialog" tabindex="-1">
        <button type="button" data-login-registration-close>Zavřít</button>
        <input id="nickname">
        <button type="submit">Potvrdit</button>
      </section>
    </div>`;
  return {
    opener: document.querySelector("[data-login-registration-open]"),
    overlay: document.querySelector("[data-login-registration-overlay]"),
    backdrop: document.querySelector("[data-login-registration-overlay] > [data-login-registration-close]")
  };
};

describe("login registration modal", () => {
  beforeEach(() => {
    document.body.className = "";
    document.body.replaceChildren();
  });

  it("opens as a separate dialog and restores focus after Escape", () => {
    const onOpen = vi.fn();
    const { opener, overlay } = mount();
    bindLoginRegistrationModal({ onOpen });

    opener.focus();
    opener.click();
    expect(overlay.hidden).toBe(false);
    expect(document.body.classList.contains("login-registration-open")).toBe(true);
    expect(document.activeElement?.id).toBe("nickname");
    expect(onOpen).toHaveBeenCalledTimes(1);

    overlay.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(overlay.hidden).toBe(true);
    expect(document.body.classList.contains("login-registration-open")).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it("closes from the backdrop and does not bind twice", () => {
    const { opener, overlay, backdrop } = mount();
    const first = bindLoginRegistrationModal();
    const second = bindLoginRegistrationModal();
    expect(second).toBe(first);

    opener.click();
    backdrop.click();
    expect(overlay.hidden).toBe(true);
    expect(document.activeElement).toBe(opener);
  });
});
