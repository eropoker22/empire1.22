// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { ABOUT_GAME_FACTS, ABOUT_GAME_SECTIONS } from "../../page-assets/js/data/about-game-sections.js";
import { bindLoginAboutModal } from "../../page-assets/js/app/login-about-modal.js";

const pageSource = readFileSync(resolve(process.cwd(), "pages/login.html"), "utf8");
const liveSource = readFileSync(resolve(process.cwd(), "page-assets/js/login-live.js"), "utf8");
const demoSource = readFileSync(resolve(process.cwd(), "page-assets/js/login.js"), "utf8");
const entrySource = readFileSync(resolve(process.cwd(), "page-assets/js/login-entry.js"), "utf8");
const aboutStyles = readFileSync(resolve(process.cwd(), "page-assets/css/styles-login-about.css"), "utf8");

const mountModal = () => {
  document.body.innerHTML = `
    <button type="button" data-login-about-open>O hře</button>
    <div data-login-about-overlay hidden>
      <button type="button" data-login-about-close>Backdrop</button>
      <section role="dialog" tabindex="-1">
        <button type="button" data-login-about-close>Zavřít</button>
        <select data-login-about-select></select>
        <div data-login-about-tabs role="tablist"></div>
        <main data-login-about-content><div data-login-about-panels></div></main>
        <template data-login-about-legacy-story><p>Město sleduje každý tvůj krok.</p></template>
      </section>
    </div>`;
  bindLoginAboutModal();
  return {
    opener: document.querySelector("[data-login-about-open]"),
    overlay: document.querySelector("[data-login-about-overlay]")
  };
};

describe("login about encyclopedia", () => {
  beforeEach(() => {
    document.body.className = "";
    document.body.replaceChildren();
  });

  it("keeps one shared controller in production and explicit local-demo flows", () => {
    expect(entrySource).toContain("isExplicitLocalDemoEnabled");
    expect(liveSource).toContain('from "./app/login-about-modal.js"');
    expect(demoSource).toContain('from "./app/login-about-modal.js"');
    expect(liveSource).toContain("bindLoginAboutModal();");
    expect(demoSource).toContain("bindLoginAboutModal();");
  });

  it("uses canonical public server facts and honest planned statuses", () => {
    expect(ABOUT_GAME_FACTS).toMatchObject({ maxPlayers: 20, districtCount: 161, downtownCount: 8, warOpen: false });
    const market = ABOUT_GAME_SECTIONS.find((section) => section.id === "market");
    expect(market?.status).toBe("Částečně aktivní");
    expect(market?.chips).toContain("Lobby market: připravuje se");
    expect(ABOUT_GAME_SECTIONS.find((section) => section.id === "war-mode")?.status).toBe("Připravuje se");
  });

  it.each([
    ["overview", "Přehled"],
    ["attack", "Útok"],
    ["trap", "Past"],
    ["bounty", "Bounty"],
    ["purge", "Očista"]
  ])("contains a separate %s tab and panel", (id, label) => {
    const { overlay } = mountModal();
    expect(overlay.querySelector(`[data-login-about-tab="${id}"]`)?.textContent).toContain(label);
    expect(overlay.querySelector(`[data-login-about-panel="${id}"]`)?.getAttribute("aria-labelledby")).toBe(`login-about-tab-${id}`);
  });

  it("switches panels, supports arrows and restores focus after Escape", () => {
    const { opener, overlay } = mountModal();
    opener.focus();
    opener.click();
    expect(overlay.hidden).toBe(false);
    expect(document.body.classList.contains("login-modal-open")).toBe(true);

    const overviewTab = overlay.querySelector('[data-login-about-tab="overview"]');
    const attackTab = overlay.querySelector('[data-login-about-tab="attack"]');
    attackTab.click();
    expect(attackTab.getAttribute("aria-selected")).toBe("true");
    expect(overlay.querySelector('[data-login-about-panel="overview"]').hidden).toBe(true);
    expect(overlay.querySelector('[data-login-about-panel="attack"]').hidden).toBe(false);

    attackTab.focus();
    attackTab.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(overviewTab.getAttribute("aria-selected")).toBe("false");
    overlay.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(overlay.hidden).toBe(true);
    expect(document.activeElement).toBe(opener);
  });

  it("traps Tab inside the dialog and preserves the last selected section", () => {
    const { opener, overlay } = mountModal();
    bindLoginAboutModal();
    expect(overlay.dataset.loginAboutControllerBound).toBe("true");
    opener.click();
    const attackTab = overlay.querySelector('[data-login-about-tab="attack"]');
    attackTab.click();
    attackTab.focus();
    attackTab.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    const finalTab = overlay.querySelector('[data-login-about-tab="final-lockdown"]');
    expect(finalTab.getAttribute("aria-selected")).toBe("true");
    finalTab.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(overlay.querySelector("[role='dialog'] [data-login-about-close]"));
    overlay.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    opener.click();
    expect(finalTab.getAttribute("aria-selected")).toBe("true");
  });

  it("closes from the backdrop and keeps the original story in the overview", () => {
    const { opener, overlay } = mountModal();
    opener.click();
    expect(overlay.querySelector('[data-login-about-panel="overview"]')?.textContent).toContain("Město sleduje každý tvůj krok.");
    overlay.querySelector("[data-login-about-close]").click();
    expect(overlay.hidden).toBe(true);
  });

  it("preserves the original copy and responsive accessibility rules", () => {
    expect(pageSource).toContain("Neon se odráží v mokrém asfaltu");
    expect(pageSource).toContain("Město sleduje každý tvůj krok.");
    expect(pageSource).toContain('role="dialog" aria-modal="true"');
    expect(pageSource).toContain('role="tablist"');
    expect(aboutStyles).toContain("@media (max-width: 780px)");
    expect(aboutStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(aboutStyles).toContain("overflow: hidden;");
  });
});
