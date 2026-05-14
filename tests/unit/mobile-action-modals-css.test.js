import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("mobile action modal CSS", () => {
  const css = readFileSync(resolve(root, "page-assets/css/styles-mobile-fixes.css"), "utf8");
  const clientCss = readFileSync(resolve(root, "client/page-assets/css/styles-mobile-fixes.css"), "utf8");
  const mobileRuntime = readFileSync(resolve(root, "page-assets/js/app/mobile-layout-runtime.js"), "utf8");

  it("keeps action result dialogs compact on mobile", () => {
    expect(css).toContain("Compact mobile action/result modals");
    expect(css).toContain("html body .spy-result-modal__details");
    expect(css).toContain("html body .attack-result-modal__stats");
    expect(css).toContain("html body .police-action-result-modal__details");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr)) !important;");
    expect(css).toContain("max-height: calc(100dvh - 16px) !important;");
  });

  it("keeps robbery setup short enough for mobile", () => {
    expect(css).toContain("html body .robbery-setup-popup-card");
    expect(css).toContain("html body .robbery-setup-popup-card .district-modal-hero");
    expect(css).toContain("html body .robbery-setup-popup-card .attack-setup-popup-body");
    expect(css).toContain("html body .robbery-setup-popup-card .attack-setup-popup-actions");
    expect(css).toContain("position: sticky !important;");
  });

  it("keeps mobile confirmation colors action-specific", () => {
    expect(css).toContain("html body #spy-confirm-modal-confirm");
    expect(css).toContain("html body #raid-confirm-modal-confirm");
    expect(css).toContain("html body #attack-confirm-modal-confirm");
    expect(css).toContain("html body #trap-confirm-modal-confirm");
    expect(css).toContain("html body #occupy-confirm-modal-confirm");
    expect(css).toContain("rgba(251, 191, 36");
    expect(css).toContain("rgba(34, 211, 238");
    expect(css).toContain("rgba(248, 113, 113");
  });

  it("hides the mobile topbar while popup cards are open without moving layout", () => {
    for (const stylesheet of [css, clientCss]) {
      expect(stylesheet).not.toContain("--mobile-topbar-offset: 0px !important;");
      expect(stylesheet).toContain("--mobile-overlay-card-top: max(var(--mobile-overlay-top-offset, 72px), 72px);");
      expect(stylesheet).toContain("--game-mobile-bg-height: var(--mobile-locked-vh, 100svh);");
      expect(stylesheet).toContain("@supports (height: 100lvh)");
      expect(stylesheet).not.toContain("body.game-modal-scroll-locked::before");
      expect(stylesheet).toContain("body.game-modal-scroll-locked .game-topbar");
      expect(stylesheet).toContain("body.game-modal-scroll-locked .game-resource-strip");
      expect(stylesheet).toContain("visibility: hidden !important;");
      expect(stylesheet).toContain("opacity: 0 !important;");
      expect(stylesheet).toContain("body.game-modal-scroll-locked .robbery-setup-popup-shell");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked #spy-confirm-modal");
      expect(stylesheet).toContain("padding-top: calc(var(--mobile-overlay-card-top) + var(--mobile-overlay-card-gap)) !important;");
      expect(stylesheet).toContain("max-height: calc(100dvh - var(--mobile-overlay-card-top) - 18px - env(safe-area-inset-bottom)) !important;");
      expect(stylesheet).toContain("Hard guard: large mobile windows must never open under the resource strip.");
      expect(stylesheet).toContain("--mobile-overlay-available-height: calc(");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked #buildings-modal.buildings-popup-shell:not([hidden])");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked .wanted-popup-shell:not([hidden]) .wanted-popup-card");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked .armory-popup-shell:not([hidden]) .armory-popup-card.building-detail-modal__content");
      expect(stylesheet).toContain("top: auto !important;");
      expect(stylesheet).toContain("height: var(--mobile-overlay-available-height) !important;");
      expect(stylesheet).toContain("top: calc(var(--mobile-overlay-card-top) + var(--mobile-overlay-card-gap)) !important;");
    }
    expect(mobileRuntime).toContain('const MOBILE_BODY_FREEZE_EXEMPT_SELECTOR = ".district-popup-shell";');
    expect(mobileRuntime).toContain('root.style.setProperty("--mobile-overlay-top-offset", `${topbarOffset}px`);');
  });
});
