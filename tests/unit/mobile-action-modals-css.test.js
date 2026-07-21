import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readText = (path) => readFileSync(resolve(root, path), "utf8").replace(/\r\n/g, "\n");

describe("mobile action modal CSS", () => {
  const css = readText("page-assets/css/styles-mobile-fixes.css");
  const clientCss = readText("client/page-assets/css/styles-mobile-fixes.css");
  const mainCss = readText("page-assets/css/styles.css");
  const clientMainCss = readText("client/page-assets/css/styles.css");
  const popupCss = readText("page-assets/css/styles-popups.css");
  const clientPopupCss = readText("client/page-assets/css/styles-popups.css");
  const buildingModalCss = readText("page-assets/css/styles-building-modals.css");
  const clientBuildingModalCss = readText("client/page-assets/css/styles-building-modals.css");
  const gameHtml = readText("pages/game.html");
  const clientGameHtml = readText("client/pages/game.html");
  const actionCss = readText("page-assets/css/styles-action-results.css");
  const clientActionCss = readText("client/page-assets/css/styles-action-results.css");
  const districtCss = readText("page-assets/css/styles-district.css");
  const clientDistrictCss = readText("client/page-assets/css/styles-district.css");
  const mobileRuntime = readText("page-assets/js/app/mobile-layout-runtime.js");
  const overlayState = readText("apps/client/src/modals/overlay-state.ts");
  const gameplaySliceClient = readText("page-assets/js/client-assets/gameplay-slice-client.js");
  const clientGameplaySliceClient = readText("client/page-assets/js/client-assets/gameplay-slice-client.js");
  const modalScrollLock = readText("page-assets/js/app/ui/modalScrollLock.js");
  const clientModalScrollLock = readText("client/page-assets/js/app/ui/modalScrollLock.js");
  const legacyOverlayCoordinator = readText("page-assets/js/app/ui/legacyOverlayCoordinator.js");
  const clientLegacyOverlayCoordinator = readText("client/page-assets/js/app/ui/legacyOverlayCoordinator.js");
  const modalHelpers = readText("page-assets/js/app/ui/modalHelpers.js");
  const clientModalHelpers = readText("client/page-assets/js/app/ui/modalHelpers.js");
  const districtPopupModalHelpers = readText("page-assets/js/app/ui/districtPopupModalHelpers.js");
  const clientDistrictPopupModalHelpers = readText("client/page-assets/js/app/ui/districtPopupModalHelpers.js");
  const buildingsPopupRuntime = readText("page-assets/js/app/runtime/buildingsPopupRuntime.js");
  const clientBuildingsPopupRuntime = readText("client/page-assets/js/app/runtime/buildingsPopupRuntime.js");
  const runtimeSource = readText("page-assets/js/app/runtime.js");
  const clientRuntimeSource = readText("client/page-assets/js/app/runtime.js");
  const onboardingCss = readText("page-assets/css/styles-onboarding.css");
  const cityEventsCss = readText("page-assets/css/styles-city-events.css");
  const clientCityEventsCss = readText("client/page-assets/css/styles-city-events.css");

  it("keeps action result dialogs compact on mobile", () => {
    expect(css).toContain("Compact mobile action/result modals");
    expect(css).toContain("html body .spy-result-modal__details");
    expect(css).toContain("html body .attack-result-modal__stats");
    expect(css).toContain("html body .police-action-result-modal__details");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr)) !important;");
    expect(css).toContain("max-height: calc(100dvh - 16px) !important;");
  });

  it("keeps district building effects as desktop pill chips instead of full-width rows", () => {
    expect(buildingModalCss).toContain(".district-building-detail-card .building-info-card__effects,");
    expect(buildingModalCss).toContain("display: flex !important;");
    expect(buildingModalCss).toContain("flex-wrap: wrap !important;");
    expect(buildingModalCss).toContain(".factory-popup-card.building-detail-modal__content .building-info-card__effects {\n  border: 0 !important;");
    expect(buildingModalCss).toContain("padding: 0 !important;");
    expect(buildingModalCss).toContain(".district-building-detail-card .district-building-detail-effect-cell,");
    expect(buildingModalCss).toContain("flex: 0 1 auto !important;");
    expect(buildingModalCss).toContain("width: auto !important;");
    expect(buildingModalCss).toContain("border-radius: 999px;");
    expect(buildingModalCss).not.toContain('data-building-mechanics-type="clinic"] .district-building-detail-card .district-building-detail-effect-cell {\n    width: 100%;');
  });

  it("stacks garage effect chips vertically on desktop and mobile", () => {
    expect(buildingModalCss).toContain('.district-building-detail-shell[data-building-mechanics-type="garage"] .district-building-detail-card .building-info-card__effects');
    expect(buildingModalCss).toContain("flex-direction: column !important;");
    expect(buildingModalCss).toContain("flex-wrap: nowrap !important;");
    expect(buildingModalCss).toContain("border: 0 !important;");
    expect(buildingModalCss).toContain("background: transparent !important;");
    expect(buildingModalCss).toContain("box-shadow: none !important;");
    expect(buildingModalCss).toContain("row-gap: 26px;");
    expect(buildingModalCss).toContain("row-gap: 38px;");
    expect(buildingModalCss).toContain("column-gap: 0;");
    expect(buildingModalCss).toContain("margin-top: 6px;");
    expect(buildingModalCss).toContain("margin-bottom: 6px;");
    expect(buildingModalCss).toContain('.district-building-detail-shell[data-building-mechanics-type="garage"] .district-building-detail-card .district-building-detail-effect-cell');
    expect(buildingModalCss).toContain("width: auto !important;");
    expect(buildingModalCss).toContain("align-self: center;");
  });

  it("stacks apartment block effect chips vertically without changing other cards", () => {
    expect(buildingModalCss).toContain('.district-building-detail-shell[data-building-mechanics-type="apartment-block"] .district-building-detail-card .building-info-card__effects {\n    display: flex !important;');
    expect(buildingModalCss).toContain("flex-direction: column !important;");
    expect(buildingModalCss).toContain("flex-wrap: nowrap !important;");
    expect(buildingModalCss).toContain("row-gap: 18px;");
    expect(clientBuildingModalCss).toContain('.district-building-detail-shell[data-building-mechanics-type="apartment-block"] .district-building-detail-card .building-info-card__effects {\n    display: flex !important;');
    expect(mainCss).toContain('html body.game-body .district-building-detail-shell[data-building-mechanics-type="apartment-block"] .district-building-detail-card .building-info-card__effects {\n    display: flex !important;');
    expect(mainCss).toContain("row-gap: 18px !important;");
    expect(clientMainCss).toContain('html body.game-body .district-building-detail-shell[data-building-mechanics-type="apartment-block"] .district-building-detail-card .building-info-card__effects {\n    display: flex !important;');
  });

  it("stacks clinic effect chips vertically", () => {
    expect(buildingModalCss).toContain('.district-building-detail-shell[data-building-mechanics-type="clinic"] .district-building-detail-card .building-info-card__effects');
    expect(buildingModalCss).toContain("flex-direction: column !important;");
    expect(buildingModalCss).toContain("flex-wrap: nowrap !important;");
    expect(buildingModalCss).toContain('.district-building-detail-shell[data-building-mechanics-type="clinic"] .district-building-detail-card .district-building-detail-effect-cell');
    expect(buildingModalCss).toContain("align-self: center;");
    expect(buildingModalCss).toContain('.district-building-detail-shell[data-building-mechanics-type="clinic"] .district-building-detail-card .building-info-card__effects {\n    row-gap: 18px;');
    expect(clientBuildingModalCss).toContain('.district-building-detail-shell[data-building-mechanics-type="clinic"] .district-building-detail-card .building-info-card__effects {\n    row-gap: 18px;');
    expect(mainCss).toContain('html body.game-body .district-building-detail-shell[data-building-mechanics-type="clinic"] .district-building-detail-card .building-info-card__effects {\n    row-gap: 28px !important;');
    expect(clientMainCss).toContain('html body.game-body .district-building-detail-shell[data-building-mechanics-type="clinic"] .district-building-detail-card .building-info-card__effects {\n    row-gap: 28px !important;');
  });

  it("stacks clinic mechanics vertically on desktop", () => {
    expect(buildingModalCss).toContain('.district-building-detail-shell[data-building-mechanics-type="clinic"] .district-building-detail-mechanics {\n    display: grid;');
    expect(buildingModalCss).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(buildingModalCss).toContain("row-gap: 18px;");
    expect(clientBuildingModalCss).toContain('.district-building-detail-shell[data-building-mechanics-type="clinic"] .district-building-detail-mechanics {\n    display: grid;');
    expect(mainCss).toContain('html body.game-body .district-building-detail-shell[data-building-mechanics-type="clinic"] .district-building-detail-mechanics {\n    display: grid !important;');
    expect(clientMainCss).toContain('html body.game-body .district-building-detail-shell[data-building-mechanics-type="clinic"] .district-building-detail-mechanics {\n    display: grid !important;');
  });

  it("stacks recruitment center effect chips and removes the empty single-panel strip", () => {
    expect(buildingModalCss).toContain('.district-building-detail-shell[data-building-mechanics-type="recruitment-center"] .district-building-detail-card .building-info-card__effects');
    expect(buildingModalCss).toContain('.district-building-detail-shell[data-building-mechanics-type="recruitment-center"] .district-building-detail-card .district-building-detail-effect-cell');
    expect(buildingModalCss).toContain('align-items: center;');
    expect(buildingModalCss).toContain('width: auto !important;');
    expect(clientBuildingModalCss).toContain('.district-building-detail-shell[data-building-mechanics-type="recruitment-center"] .district-building-detail-card .building-info-card__effects');
    expect(buildingModalCss).toContain(".armory-slot__strength-bonus");
    for (const stylesheet of [mainCss, clientMainCss]) {
      expect(stylesheet).toContain('html body.game-body .district-building-detail-shell[data-building-mechanics-type="recruitment-center"] .district-building-detail-card .building-info-card__effects');
      expect(stylesheet).toContain('row-gap: 34px !important;');
      expect(stylesheet).toContain('max-width: min(100%, 320px) !important;');
      expect(stylesheet).toContain('html body.game-body .district-building-detail-shell[data-building-mechanics-type="recruitment-center"].is-building-detail-single-panel .district-building-detail-card .district-building-detail-panel--merged');
      expect(stylesheet).toContain('html body.game-body .district-building-detail-shell[data-building-mechanics-type="recruitment-center"].is-building-detail-single-panel .district-building-detail-panel--merged [data-district-building-detail-action-section]');
      expect(stylesheet).toContain("Final district building detail hidden-strip guard");
    }
  });

  it("keeps clinic special action section at the bottom on desktop", () => {
    expect(buildingModalCss).toContain('.district-building-detail-shell[data-building-mechanics-type="clinic"] .district-building-detail-card [data-district-building-detail-action-section] {');
    expect(buildingModalCss).toContain("order: 150;");
    expect(buildingModalCss).toContain("margin-top: auto;");
    expect(buildingModalCss).toContain("padding-top: 18px;");
    for (const stylesheet of [mainCss, clientMainCss]) {
      expect(stylesheet).toContain("html body.game-body .district-building-detail-shell.is-building-detail-single-panel .district-building-detail-card .district-building-detail-body");
      expect(stylesheet).toContain("grid-template-rows: minmax(0, 1fr) !important;");
      expect(stylesheet).toContain("html body.game-body .district-building-detail-shell.is-building-detail-single-panel .district-building-detail-card .district-building-detail-panel");
      expect(stylesheet).toContain("flex: 1 1 auto !important;");
      expect(stylesheet).toContain("html body.game-body .district-building-detail-card [data-district-building-detail-action-section]");
      expect(stylesheet).toContain("padding-top: 52px !important;");
      expect(stylesheet).toContain("padding-bottom: 0 !important;");
      expect(stylesheet).toContain("margin-bottom: 0 !important;");
      expect(stylesheet).toContain("html body.game-body .district-building-detail-shell.is-building-detail-single-panel .district-building-detail-card .district-building-detail-panel--merged");
      expect(stylesheet).toContain('html body.game-body .district-building-detail-shell[data-building-mechanics-type="clinic"].is-building-detail-single-panel .district-building-detail-card .district-building-detail-panel--merged');
      expect(stylesheet).toContain("border: 0 !important;");
      expect(stylesheet).toContain("background: transparent !important;");
      expect(stylesheet).toContain("box-shadow: none !important;");
      expect(stylesheet).toContain("padding: 8px 8px 0 !important;");
      expect(stylesheet).toContain('html body.game-body .district-building-detail-shell[data-building-mechanics-type="clinic"].is-building-detail-single-panel .district-building-detail-card [data-district-building-detail-action-section]');
      expect(stylesheet).toContain("padding-top: 20px !important;");
    }
  });

  it("keeps robbery setup short enough for mobile", () => {
    expect(css).toContain("html body .robbery-setup-popup-card");
    expect(css).toContain("html body .robbery-setup-popup-card .district-modal-hero");
    expect(css).toContain("html body .robbery-setup-popup-card .attack-setup-popup-body");
    expect(css).toContain("html body .robbery-setup-popup-card .attack-setup-popup-actions");
    expect(css).toContain("html body .robbery-setup-popup-card .attack-setup-popup-row:nth-child(2)");
    expect(css).not.toContain("html body .robbery-setup-popup-card .attack-setup-popup-row:nth-child(3),");
    expect(css).toContain("html body .robbery-setup-popup-card .attack-setup-popup-stepper:has([data-robbery-member-input])");
    expect(css).toContain("grid-template-columns: 34px minmax(66px, 1fr) 34px !important;");
    expect(css).toContain("height: 32px !important;");
    expect(css).toContain("position: sticky !important;");
  });

  it("keeps mobile district action windows below the resource bar", () => {
    for (const stylesheet of [css, clientCss]) {
      expect(stylesheet).toContain("Final mobile district action window topbar guard.");
      expect(stylesheet).toContain("--district-window-safe-top: calc(var(--mobile-overlay-top-offset, var(--mobile-topbar-offset, 72px)) + 8px);");
      expect(stylesheet).toContain("--district-window-safe-height: calc(var(--mobile-locked-vh, 100svh) - var(--district-window-safe-top) - var(--district-window-safe-bottom));");
      expect(stylesheet).toContain("html body.game-body:not(.game-modal-scroll-locked) .district-popup-shell[data-district-popup]:not([hidden])");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked .attack-setup-popup-shell:not([hidden])");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked .robbery-setup-popup-shell:not([hidden])");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked #spy-confirm-modal:not(.hidden):not([hidden])");
      expect(stylesheet).toContain("html body #attack-result-modal:not(.hidden):not([hidden])");
      expect(stylesheet).toContain("html body #police-action-result-modal:not(.hidden):not([hidden])");
      expect(stylesheet).toContain("padding: var(--district-window-safe-top) 8px var(--district-window-safe-bottom) !important;");
      expect(stylesheet).toContain("max-height: var(--district-window-safe-height) !important;");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked .district-popup-shell[data-mobile-position=\"raised\"]:not([hidden])");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked .district-popup-shell[data-overview-enabled=\"true\"]:not([hidden])");
      expect(stylesheet).toContain("Final mobile occupy confirmation resource bar visibility guard.");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(#occupy-confirm-modal:not(.hidden):not([hidden])) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(.district-popup-shell:not([hidden])):has(#occupy-confirm-modal:not(.hidden):not([hidden])) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked.is-mobile-topbar-condensed:has(.district-popup-shell:not([hidden])):has(#occupy-confirm-modal:not(.hidden):not([hidden])) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(.district-popup-shell:not([hidden])):has(#occupy-confirm-modal:not(.hidden):not([hidden])) .game-resource-strip > *");
      expect(stylesheet).toContain("Final mobile trap confirmation resource bar visibility guard.");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(#trap-confirm-modal:not(.hidden):not([hidden])) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(.district-popup-shell:not([hidden])):has(#trap-confirm-modal:not(.hidden):not([hidden])) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked.is-mobile-topbar-condensed:has(.district-popup-shell:not([hidden])):has(#trap-confirm-modal:not(.hidden):not([hidden])) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(.district-popup-shell:not([hidden])):has(#trap-confirm-modal:not(.hidden):not([hidden])) .game-resource-strip > *");
      expect(stylesheet).toContain("Final mobile robbery confirmation resource bar visibility guard.");
      expect(stylesheet).toContain("--robbery-confirm-window-safe-top: calc(var(--mobile-overlay-top-offset, var(--mobile-topbar-offset, 72px)) + 8px);");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(#raid-confirm-modal:not(.hidden):not([hidden])) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(.district-popup-shell:not([hidden])):has(#raid-confirm-modal:not(.hidden):not([hidden])) .game-resource-strip");
      expect(stylesheet).toContain("html body #raid-confirm-modal:not(.hidden):not([hidden]),");
      expect(stylesheet).toContain("padding: var(--robbery-confirm-window-safe-top) 8px var(--robbery-confirm-window-safe-bottom) !important;");
      expect(stylesheet).toContain("max-height: var(--robbery-confirm-window-safe-height) !important;");
      expect(stylesheet).toContain("Absolute final mobile robbery confirmation placement guard.");
      expect(stylesheet).toContain("--robbery-setup-window-safe-top-final: calc(max(var(--mobile-overlay-top-offset, 0px), var(--mobile-topbar-offset, 72px)) + 10px);");
      expect(stylesheet).toContain("--robbery-setup-window-safe-height-final: calc(var(--mobile-locked-vh, 100svh) - var(--robbery-setup-window-safe-top-final) - var(--robbery-setup-window-safe-bottom-final));");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(.robbery-setup-popup-shell:not([hidden])) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(.district-popup-shell:not([hidden])):has(.robbery-setup-popup-shell:not([hidden])) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(.robbery-setup-popup-shell:not([hidden])) > #game-header");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(.robbery-setup-popup-shell:not([hidden])) > .game-topbar");
      expect(stylesheet).toContain("z-index: 26050 !important;");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(.robbery-setup-popup-shell:not([hidden])) .game-topbar-inner");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(.robbery-setup-popup-shell:not([hidden])) .game-resource-strip > .resource-pill");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(.robbery-setup-popup-shell:not([hidden])) .game-resource-strip > .game-toolbar-button");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked .robbery-setup-popup-shell:not([hidden])");
      expect(stylesheet).toContain("padding: var(--robbery-setup-window-safe-top-final) 8px var(--robbery-setup-window-safe-bottom-final) !important;");
      expect(stylesheet).toContain("max-height: var(--robbery-setup-window-safe-height-final) !important;");
      expect(stylesheet).toContain("--robbery-confirm-window-safe-top-final: calc(max(var(--mobile-overlay-top-offset, 0px), var(--mobile-topbar-offset, 72px)) + 10px);");
      expect(stylesheet).toContain("padding: var(--robbery-confirm-window-safe-top-final) 8px var(--robbery-confirm-window-safe-bottom-final) !important;");
      expect(stylesheet).toContain("max-height: var(--robbery-confirm-window-safe-height-final) !important;");
    }
    for (const stylesheet of [mainCss, clientMainCss]) {
      expect(stylesheet).toContain("Final mobile occupy confirmation resource bar visibility guard.");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(#occupy-confirm-modal:not(.hidden):not([hidden])) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(.district-popup-shell:not([hidden])):has(#occupy-confirm-modal:not(.hidden):not([hidden])) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked.is-mobile-topbar-condensed:has(.district-popup-shell:not([hidden])):has(#occupy-confirm-modal:not(.hidden):not([hidden])) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(.district-popup-shell:not([hidden])):has(#occupy-confirm-modal:not(.hidden):not([hidden])) .game-resource-strip > *");
      expect(stylesheet).toContain("Final mobile trap confirmation resource bar visibility guard.");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(#trap-confirm-modal:not(.hidden):not([hidden])) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(.district-popup-shell:not([hidden])):has(#trap-confirm-modal:not(.hidden):not([hidden])) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked.is-mobile-topbar-condensed:has(.district-popup-shell:not([hidden])):has(#trap-confirm-modal:not(.hidden):not([hidden])) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(.district-popup-shell:not([hidden])):has(#trap-confirm-modal:not(.hidden):not([hidden])) .game-resource-strip > *");
      expect(stylesheet).toContain("Final mobile robbery confirmation resource bar visibility guard.");
      expect(stylesheet).toContain("--robbery-confirm-window-safe-top: calc(var(--mobile-overlay-top-offset, var(--mobile-topbar-offset, 72px)) + 8px);");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(#raid-confirm-modal:not(.hidden):not([hidden])) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(.district-popup-shell:not([hidden])):has(#raid-confirm-modal:not(.hidden):not([hidden])) .game-resource-strip");
      expect(stylesheet).toContain("html body #raid-confirm-modal:not(.hidden):not([hidden]),");
      expect(stylesheet).toContain("padding: var(--robbery-confirm-window-safe-top) 8px var(--robbery-confirm-window-safe-bottom) !important;");
      expect(stylesheet).toContain("max-height: var(--robbery-confirm-window-safe-height) !important;");
      expect(stylesheet).toContain("Absolute final mobile robbery confirmation placement guard.");
      expect(stylesheet).toContain("--robbery-confirm-window-safe-top-final: calc(max(var(--mobile-overlay-top-offset, 0px), var(--mobile-topbar-offset, 72px)) + 10px);");
      expect(stylesheet).toContain("padding: var(--robbery-confirm-window-safe-top-final) 8px var(--robbery-confirm-window-safe-bottom-final) !important;");
      expect(stylesheet).toContain("max-height: var(--robbery-confirm-window-safe-height-final) !important;");
    }
  });

  it("keeps desktop modal topbar content fixed and visible after scrolling", () => {
    for (const stylesheet of [mainCss, clientMainCss]) {
      expect(stylesheet).toContain("Final desktop modal topbar content guard.");
      expect(stylesheet).toContain("@media (min-width: 721px)");
      expect(stylesheet).toContain("html.game-modal-scroll-locked body.game-body::before");
      expect(stylesheet).toContain("transform: none !important;");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked > .game-topbar,\n  html body.game-body.alliance-modal-open > .game-topbar");
      expect(stylesheet).toContain("position: fixed !important;");
      expect(stylesheet).toContain("top: 0 !important;");
      expect(stylesheet).toContain("z-index: 26050 !important;");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked > .game-shell,\n  html body.game-body.alliance-modal-open > .game-shell");
      expect(stylesheet).toContain("margin-top: var(--modal-topbar-reserve, 52px) !important;");
      expect(stylesheet).not.toContain("padding-top: var(--modal-topbar-reserve, 52px) !important;");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked .game-topbar-inner");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked .game-topbar-controls");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked .game-resource-strip > .resource-pill");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked .game-resource-strip > .game-toolbar-button");
      expect(stylesheet).toContain("display: flex !important;");
      expect(stylesheet).toContain("display: inline-flex !important;");
      const guard = stylesheet.slice(stylesheet.indexOf("Final desktop modal topbar content guard."));
      const resourcePillRuleStart = guard.indexOf("html body.game-body.game-modal-scroll-locked .game-resource-strip > .resource-pill");
      const resourcePillRuleEnd = guard.indexOf("html body.game-body.game-modal-scroll-locked .game-resource-strip > .game-toolbar-button");
      expect(resourcePillRuleStart).toBeGreaterThanOrEqual(0);
      expect(resourcePillRuleEnd).toBeGreaterThan(resourcePillRuleStart);
      expect(guard.slice(resourcePillRuleStart, resourcePillRuleEnd)).not.toContain("display:");
    }
    for (const source of [overlayState, gameplaySliceClient, clientGameplaySliceClient]) {
      expect(source).toContain('const LOCKED_SCROLL_Y_CSS_VAR = "--modal-scroll-lock-y";');
      expect(source).toContain('const LOCKED_TOPBAR_RESERVE_CSS_VAR = "--modal-topbar-reserve";');
      expect(source).toContain("scrollLockY:");
      expect(source).toContain("topbarReserve:");
      expect(source).toContain("getCurrentTopbarReserveHeight");
      expect(source).toContain("root.style.setProperty(LOCKED_SCROLL_Y_CSS_VAR, `${scrollPosition.y}px`);");
      expect(source).toContain("root.style.setProperty(LOCKED_TOPBAR_RESERVE_CSS_VAR, `${getCurrentTopbarReserveHeight() || 52}px`);");
      expect(source).toContain("if (isViewportWidthScrollLock) {");
      expect(source).toContain("root.style.overflow = \"hidden\";");
      expect(source).toContain("body.style.position = \"fixed\";");
      expect(source).toContain("root.style.removeProperty(LOCKED_SCROLL_Y_CSS_VAR);");
      expect(source).toContain("root.style.removeProperty(LOCKED_TOPBAR_RESERVE_CSS_VAR);");
    }
  });

  it("keeps unknown district atmosphere text out of the popup hero header", () => {
    for (const source of [runtimeSource, readText("client/page-assets/js/app/runtime.js")]) {
      expect(source).toContain("const isAtmosphereLocked = atmosphereMeta.typeKey === \"unknown\";");
      expect(source).toContain("labelElement.hidden = isAtmosphereLocked;");
      expect(source).toContain("labelElement.textContent = isAtmosphereLocked ? \"\" : atmosphereMeta.label;");
      expect(source).toContain("moodElement.hidden = isAtmosphereLocked;");
      expect(source).toContain("moodElement.textContent = isAtmosphereLocked ? \"\" : atmosphereMeta.mood;");
    }
  });

  it("keeps district owner avatars opening above district popups", () => {
    for (const source of [districtPopupModalHelpers, clientDistrictPopupModalHelpers]) {
      expect(source).toContain("lightbox.classList.add(\"avatar-lightbox--district-owner\");");
      expect(source).toContain("lightbox.classList.remove(\"avatar-lightbox--district-owner\");");
      expect(source).toContain("event.stopImmediatePropagation?.();");
      expect(source).toContain("}, true);");
    }

    for (const stylesheet of [districtCss, clientDistrictCss]) {
      expect(stylesheet).toContain("#alliance-member-lightbox.avatar-lightbox.avatar-lightbox--district-owner:not(.hidden)");
      expect(stylesheet).toContain("z-index: 26000;");
      expect(stylesheet).toContain("background: rgba(1, 5, 12, 0.22);");
      expect(stylesheet).toContain("width: min(430px, calc(100vw - 28px));");
      expect(stylesheet).toContain("object-fit: cover;");
      expect(stylesheet).toContain("background: rgba(0, 0, 0, 0.62);");
      expect(stylesheet).toContain("max-width: calc(100% - 68px);");
      expect(stylesheet).toContain(".avatar-lightbox__legend-bio");
      expect(stylesheet).toContain("display: none;");
    }

    for (const stylesheet of [css, clientCss]) {
      expect(stylesheet).toContain("Final mobile district owner avatar lightbox top-layer guard.");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked #alliance-member-lightbox.avatar-lightbox.avatar-lightbox--district-owner:not(.hidden)");
      expect(stylesheet).toContain("z-index: 26000 !important;");
      expect(stylesheet).toContain("background: transparent !important;");
      expect(stylesheet).toContain("html body.game-body:has(#alliance-member-lightbox.avatar-lightbox.avatar-lightbox--district-owner:not(.hidden)) .game-topbar");
      expect(stylesheet).toContain("html body.game-body:has(#alliance-member-lightbox.avatar-lightbox.avatar-lightbox--district-owner:not(.hidden)) .game-resource-strip");
      expect(stylesheet).toContain("visibility: hidden !important;");
      expect(stylesheet).toContain("width: min(430px, calc(100vw - 16px)) !important;");
      expect(stylesheet).toContain("object-fit: cover !important;");
      expect(stylesheet).toContain("background: rgba(0, 0, 0, 0.62) !important;");
    }
  });

  it("keeps hidden district owner rows single-column on mobile", () => {
    for (const stylesheet of [districtCss, clientDistrictCss]) {
      expect(stylesheet).toContain(".district-popup-owner-card:has(.district-popup-owner-avatar-wrap.is-owner-hidden) {\n  grid-template-columns: minmax(0, 1fr);\n  min-height: auto;\n}");
      expect(stylesheet).toContain(".district-popup-owner-card:has(.district-popup-owner-avatar-wrap.is-owner-hidden) .district-popup-owner-copy {\n  grid-column: 1 / -1;\n}");
    }

    for (const stylesheet of [css, clientCss]) {
      expect(stylesheet).toContain(".district-popup-owner-card:has(.district-popup-owner-avatar-wrap.is-owner-hidden) {\n    grid-template-columns: minmax(0, 1fr) !important;\n    min-height: auto !important;\n  }");
      expect(stylesheet).toContain(".district-popup-owner-card:has(.district-popup-owner-avatar-wrap.is-owner-hidden) .district-popup-owner-copy {\n    grid-column: 1 / -1 !important;\n  }");
    }
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

  it("keeps spy and robbery action confirmation rows compact", () => {
    expect(gameHtml).toContain('class="modal__body spy-confirm-modal__body district-action-confirm-popup-body spy-confirm-popup-body"');
    expect(gameHtml).not.toContain("data-spy-confirm-source");
    expect(gameHtml).not.toContain("spy-confirm-popup-row--source");
    expect(gameHtml).not.toContain('class="attack-setup-popup-row">Zdroj <span><strong data-spy-confirm-source>');
    expect(gameHtml).toContain('class="attack-setup-popup-row robbery-setup-popup-row--status"');
    expect(gameHtml).toContain('class="attack-setup-popup-row robbery-setup-popup-row--members"');
    expect(gameHtml).toContain('class="attack-setup-popup-select robbery-setup-popup-source-fallback"');
    expect(gameHtml).not.toContain("robbery-setup-popup-row--source");
    expect(gameHtml).toContain("data-robbery-available-members");
    expect(gameHtml).not.toContain("data-robbery-available-spies");
    expect(actionCss).toContain("#spy-confirm-modal .spy-confirm-popup-body");
    expect(actionCss).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(css).toContain("html body #spy-confirm-modal .spy-confirm-popup-body");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr)) !important;");
    expect(css).toContain("html body .robbery-setup-popup-card .robbery-setup-popup-row--status");
    expect(css).toContain("html body .robbery-setup-popup-card .robbery-setup-popup-row--members");
    expect(districtCss).toContain("grid-template-columns: 34px minmax(54px, 1fr) 34px;");
    expect(districtCss).toContain("min-width: 136px;");
    expect(districtCss).toContain("width: 34px;");
  });

  it("keeps action names out of confirmation atmosphere headers", () => {
    for (const html of [gameHtml, clientGameHtml]) {
      expect(html).not.toContain('<span class="attack-setup-popup-eyebrow">Potvrdit útok</span>');
      expect(html).not.toContain('<span class="attack-setup-popup-eyebrow">Potvrdit Vykrást district</span>');
      expect(html).not.toContain('<span class="attack-setup-popup-eyebrow">Potvrdit past</span>');
      expect(html).not.toContain('<span class="attack-setup-popup-eyebrow">Potvrdit špehování</span>');
      expect(html).not.toContain('<span class="attack-setup-popup-eyebrow">Potvrdit obsazení</span>');
      expect(html).toContain('data-attack-confirm-atmosphere-label');
      expect(html).toContain('data-robbery-confirm-atmosphere-label');
      expect(html).toContain('data-trap-confirm-atmosphere-label');
      expect(html).toContain('data-spy-confirm-atmosphere-label');
      expect(html).toContain('data-occupy-confirm-atmosphere-label');
    }
  });

  it("keeps nested action windows layered above their parent popups", () => {
    for (const stylesheet of [mainCss, clientMainCss]) {
      expect(stylesheet).toContain("Final layered popup guard: child windows opened from another popup must always sit above their parent.");
      expect(stylesheet).toContain(".district-popup-shell[data-district-popup]:not([hidden])");
      expect(stylesheet).toContain("#buildings-modal.buildings-popup-shell:not([hidden])");
      expect(stylesheet).toContain("#events-modal:not(.hidden):not([hidden])");
      expect(stylesheet).toContain(".attack-setup-popup-shell:not([hidden])");
      expect(stylesheet).toContain(".robbery-setup-popup-shell:not([hidden])");
      expect(stylesheet).toContain(".defense-setup-popup-shell:not([hidden])");
      expect(stylesheet).toContain("#event-detail-modal:not(.hidden):not([hidden])");
      expect(stylesheet).toContain("#spy-confirm-modal:not(.hidden):not([hidden])");
      expect(stylesheet).toContain("#raid-confirm-modal:not(.hidden):not([hidden])");
      expect(stylesheet).toContain("z-index: 22000 !important;");
      expect(stylesheet).toContain("z-index: 23500 !important;");
      expect(stylesheet).toContain("z-index: 24000 !important;");
      expect(stylesheet).toContain("isolation: isolate !important;");
    }
  });

  it("keeps full apartment block building cell visibly animated", () => {
    const apartmentFullBlock = mainCss.slice(
      mainCss.indexOf(".buildings-popup__building--type.is-apartment-full"),
      mainCss.indexOf("html body #buildings-modal.buildings-popup-shell:not([hidden]) .buildings-popup__building-grid--names")
    );

    expect(apartmentFullBlock).toContain("animation: buildings-apartment-full-pulse 2.4s ease-in-out infinite !important;");
    expect(apartmentFullBlock).toContain("inset: 0 !important;");
    expect(apartmentFullBlock).toContain("animation: buildings-apartment-full-cell-blink 2.4s ease-in-out infinite !important;");
    expect(apartmentFullBlock).toContain("animation: buildings-apartment-full-text-blink 2.4s ease-in-out infinite !important;");
    expect(apartmentFullBlock).not.toContain("opacity: 0.08 !important;");
    expect(apartmentFullBlock).not.toContain("opacity: 0.12 !important;");
    expect(apartmentFullBlock).not.toContain("prefers-reduced-motion");
    expect(apartmentFullBlock).not.toContain("animation: none");
  });

  it("uses the same pulsing building cell for ready clinic stabilization and full schools", () => {
    for (const stylesheet of [mainCss, clientMainCss]) {
      const readyClinicBlock = stylesheet.slice(
        stylesheet.indexOf(".buildings-popup__building--type.is-apartment-full"),
        stylesheet.indexOf("html body #buildings-modal.buildings-popup-shell:not([hidden]) .buildings-popup__building-grid--names")
      );

      expect(readyClinicBlock).toContain(".buildings-popup__building--type.is-clinic-stabilization-ready");
      expect(readyClinicBlock).toContain(".buildings-popup__building--type.is-school-full");
      expect(readyClinicBlock).toContain("animation: buildings-apartment-full-pulse 2.4s ease-in-out infinite !important;");
      expect(readyClinicBlock).toContain("animation: buildings-apartment-full-cell-blink 2.4s ease-in-out infinite !important;");
      expect(readyClinicBlock).toContain("animation: buildings-apartment-full-text-blink 2.4s ease-in-out infinite !important;");
    }
  });

  it("keeps district type tabs softly pulsing when any building inside is pulsing", () => {
    for (const stylesheet of [mainCss, clientMainCss]) {
      expect(stylesheet).toContain(".buildings-popup__type-btn.has-building-pulse:not(:disabled)");
      expect(stylesheet).toContain(".buildings-popup__type-btn.has-building-pulse:not(:disabled) .buildings-popup__type-pulse");
      expect(stylesheet).toContain("animation: buildings-zone-icon-pulse 2.2s ease-in-out infinite !important;");
      expect(stylesheet).toContain("@keyframes buildings-zone-icon-pulse");
      expect(stylesheet).not.toContain("animation: buildings-zone-soft-pulse 3.8s ease-in-out infinite !important;");
    }
  });

  it("stores district building detail state by shared building type", () => {
    expect(runtimeSource).toContain('const SHARED_DISTRICT_BUILDING_DETAIL_KEY_PREFIX = "__shared:";');
    expect(runtimeSource).toContain("function getSharedDistrictBuildingDetailStorageKey");
    expect(runtimeSource).toContain('return `${SHARED_DISTRICT_BUILDING_DETAIL_KEY_PREFIX}${lookupKey || "building"}`;');
    expect(runtimeSource).toContain("return getSharedDistrictBuildingDetailStorageKey(lookupKey);");
    expect(runtimeSource).toContain("function getLegacyDistrictBuildingDetailEntry");
    expect(runtimeSource).toContain("function mergeLegacyDistrictBuildingDetailEntries");
    expect(runtimeSource).toContain("!key.startsWith(SHARED_DISTRICT_BUILDING_DETAIL_KEY_PREFIX)");
    expect(runtimeSource).toContain("function resetOwnedApartmentBlockPopulationEntries");
    expect(runtimeSource).toContain("resetOwnedApartmentBlockPopulationEntries(context.district, mechanics.apartmentCapacity);");

    const collectFunctionIndex = runtimeSource.indexOf("function collectDistrictBuildingDetailOutput");
    const apartmentCollectBlock = runtimeSource.slice(
      runtimeSource.indexOf("if (mechanics.mechanicsType === \"apartment-block\")", collectFunctionIndex),
      runtimeSource.indexOf("if (mechanics.mechanicsType === \"school\")", collectFunctionIndex)
    );
    expect(apartmentCollectBlock).toContain("const remainingPopulation = 0;");
    expect(apartmentCollectBlock).not.toContain("storedPopulation: remainingPopulation");
  });

  it("pulses apartment block chips only on full capacity, not regular collect readiness", () => {
    for (const source of [runtimeSource, clientRuntimeSource]) {
      const apartmentPulsePredicate = source.slice(
        source.indexOf("isApartmentBlockFull({ district, baseName } = {})"),
        source.indexOf("isClinicStabilizationReady", source.indexOf("isApartmentBlockFull({ district, baseName } = {})"))
      );

      expect(apartmentPulsePredicate).toContain("Boolean(mechanics.apartmentIsFull)");
      expect(apartmentPulsePredicate).not.toContain("mechanics.canCollect");
    }
  });

  it("pulses school chips only on full capacity", () => {
    for (const source of [runtimeSource, clientRuntimeSource]) {
      const schoolPulsePredicate = source.slice(
        source.indexOf("isSchoolFull({ district, baseName } = {})"),
        source.indexOf("isClinicStabilizationReady", source.indexOf("isSchoolFull({ district, baseName } = {})"))
      );

      expect(schoolPulsePredicate).toContain("Boolean(mechanics.schoolIsFull)");
      expect(schoolPulsePredicate).not.toContain("mechanics.canCollect");
    }
  });

  it("keeps blocked action confirmations grey with red missing-value cells", () => {
    expect(actionCss).toContain('.district-action-confirm-popup-body [data-validation-state="error"]');
    expect(actionCss).toContain('.attack-setup-popup-body [data-validation-state="error"]');
    expect(actionCss).toContain('#spy-confirm-modal-confirm:disabled');
    expect(actionCss).toContain('#raid-confirm-modal-confirm:disabled');
    expect(actionCss).toContain('#occupy-confirm-modal-confirm:disabled');
    expect(actionCss).toContain('#attack-confirm-modal-confirm:disabled');
    expect(actionCss).toContain(".attack-setup-popup-confirm:disabled");
    expect(actionCss).toContain("rgba(71, 85, 105, 0.7)");
    expect(css).toContain("html body #spy-confirm-modal-confirm:disabled");
    expect(css).toContain("html body #attack-confirm-modal-confirm:disabled");
    expect(css).toContain("html body .attack-setup-popup-confirm:disabled");
  });

  it("keeps district popup windows transparent enough to reveal the map", () => {
    for (const stylesheet of [districtCss, clientDistrictCss]) {
      expect(stylesheet).toContain("Final district popup transparency pass.");
      expect(stylesheet).not.toContain("Otevřít fotku");
      expect(stylesheet).toContain("rgba(3, 8, 16, 0.18)");
      expect(stylesheet).toContain("rgba(7, 13, 24, 0.14)");
      expect(stylesheet).toContain("backdrop-filter: blur(18px) saturate(142%);");
      expect(stylesheet).toContain(".district-popup-buildings__chip--trap");
      expect(stylesheet).toContain("display: inline-grid;");
      expect(stylesheet).toContain("width: auto;");
      expect(stylesheet).toContain("min-width: 96px;");
      expect(stylesheet).toContain("border-color: rgba(34, 197, 94, 0.56);");
      expect(stylesheet).toContain(".district-popup-buildings__chip-kind--passive");
      expect(stylesheet).toContain("color: rgba(226, 232, 240, 0.88);");
      expect(stylesheet).toContain(".district-popup-buildings__chip-kind--action");
      expect(stylesheet).toContain("color: rgba(250, 204, 21, 0.95);");
      expect(stylesheet).toContain(".district-popup-buildings__chip-kind--production");
      expect(stylesheet).toContain("font-size: 0.34rem;");
      expect(stylesheet).toContain("letter-spacing: 0;");
      expect(stylesheet).toContain(".district-popup-buildings__trap-meta");
      expect(stylesheet).toContain("color: #facc15;");
    }

    for (const stylesheet of [css, clientCss]) {
      expect(stylesheet).toContain("Final mobile district popup transparency pass.");
      expect(stylesheet).toContain("rgba(3, 8, 16, 0.16) !important;");
      expect(stylesheet).toContain("rgba(7, 13, 24, 0.12) !important;");
      expect(stylesheet).toContain("rgba(4, 9, 16, 0.18) !important;");
    }
  });

  it("keeps action confirmation atmosphere visible and close icons intact", () => {
    for (const stylesheet of [actionCss, clientActionCss]) {
      expect(stylesheet).toContain("Final action modal atmosphere and close-button guard.");
      expect(stylesheet).toContain("Final transparency pass for robbery result and spy confirmation cards.");
      expect(stylesheet).toContain("html body .attack-setup-popup-card .district-modal-hero__image");
      expect(stylesheet).toContain("html body .district-action-confirm-popup-card .district-modal-hero__image");
      expect(stylesheet).toContain("html body #raid-result-modal .spy-result-modal__content");
      expect(stylesheet).toContain("html body #spy-confirm-modal .spy-confirm-popup-card");
      expect(stylesheet).toContain("rgba(5, 6, 14, 0.2) !important;");
      expect(stylesheet).toContain("rgba(5, 10, 18, 0.34) !important;");
      expect(stylesheet).toContain("opacity: 0.92 !important;");
      expect(stylesheet).toContain("filter: saturate(1.12) brightness(0.86) contrast(1.04) !important;");
      expect(stylesheet).toContain("linear-gradient(180deg, rgba(2, 6, 18, 0.02), rgba(2, 6, 18, 0.24) 48%, rgba(2, 6, 18, 0.64)) !important;");
      expect(stylesheet).toContain("html body .attack-setup-popup-card .attack-setup-popup-close::before");
      expect(stylesheet).toContain("html body .district-action-confirm-popup-card .attack-setup-popup-close::after");
      expect(stylesheet).toContain("position: absolute !important;\n  inset: auto !important;\n  top: 50% !important;\n  left: 50% !important;");
      expect(stylesheet).toContain("width: 14px !important;");
      expect(stylesheet).toContain("Final action-specific neon close buttons for action confirmation cards.");
      expect(stylesheet).toContain("--action-close-rgb: var(--result-accent-rgb, var(--district-action-rgb, var(--district-accent-rgb, 103, 232, 249)));");
      expect(stylesheet).toContain("width: 22px !important;");
      expect(stylesheet).toContain("height: 22px !important;");
      expect(stylesheet).toContain("border-color: rgba(var(--action-close-rgb), 0.72) !important;");
      expect(stylesheet).toContain("color: rgba(var(--action-close-secondary-rgb), 0.98) !important;");
      expect(stylesheet).toContain("width: 9px !important;");
      expect(stylesheet).toContain("height: 1.5px !important;");
      expect(stylesheet).toContain("transform: translate(-50%, -50%) rotate(45deg) !important;");
      expect(stylesheet).toContain("transform: translate(-50%, -50%) rotate(-45deg) !important;");
    }

    for (const stylesheet of [mainCss, clientMainCss]) {
      expect(stylesheet).toContain("Final loaded action-modal visual guard: atmosphere remains visible and close icons stay intact.");
      expect(stylesheet).toContain("Final loaded action-specific neon close guard for confirmation cards.");
      expect(stylesheet).toContain("Final loaded transparency guard for robbery result and spy confirmation cards.");
      expect(stylesheet).toContain("html body.game-body .attack-setup-popup-card .district-modal-hero__image");
      expect(stylesheet).toContain("html body.game-body #raid-result-modal .spy-result-modal__content");
      expect(stylesheet).toContain("html body.game-body #spy-confirm-modal .spy-confirm-popup-card");
      expect(stylesheet).toContain("html body.game-body .district-action-confirm-popup-card .attack-setup-popup-close::before");
      expect(stylesheet).toContain("position: absolute !important;\n  inset: auto !important;\n  top: 50% !important;\n  left: 50% !important;");
      expect(stylesheet).toContain("border-color: rgba(var(--action-close-rgb), 0.72) !important;");
      expect(stylesheet).toContain("width: 9px !important;");
      expect(stylesheet).toContain("transform: translate(-50%, -50%) rotate(-45deg) !important;");
    }
  });

  it("keeps police raid impact card compact and readable", () => {
    for (const stylesheet of [actionCss, clientActionCss]) {
      expect(stylesheet).toContain("Final police raid impact readability pass.");
      expect(stylesheet).toContain(".police-action-result-modal__content.is-owned-district-raid-alert");
      expect(stylesheet).toContain("width: min(680px, 94vw);");
      expect(stylesheet).toContain(".police-raid-impact__hero");
      expect(stylesheet).toContain("grid-template-columns: minmax(0, 1fr) minmax(132px, 0.34fr);");
      expect(stylesheet).toContain("appearance: none;");
      expect(stylesheet).toContain("justify-items: center;");
      expect(stylesheet).toContain("text-align: center;");
      expect(stylesheet).toContain(".police-raid-impact__hero > div");
      expect(stylesheet).toContain("grid-column: 1 / -1;");
      expect(stylesheet).toContain("justify-self: center;");
      expect(stylesheet).toContain("width: min(100%, 52ch);");
      expect(stylesheet).toContain("margin-inline: auto;");
      expect(stylesheet).toContain(".police-raid-impact__hero small");
      expect(stylesheet).toContain("justify-content: center;");
      expect(stylesheet).toContain(".police-raid-impact-detail.is-open");
      expect(stylesheet).toContain(".police-raid-impact-detail__cells");
      expect(stylesheet).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
      expect(stylesheet).toContain(".police-raid-impact__overview article");
      expect(stylesheet).toContain("min-height: 58px;");
      expect(stylesheet).toContain(".police-raid-impact__row strong");
      expect(stylesheet).toContain("overflow-wrap: anywhere;");
      expect(stylesheet).toContain(".police-action-result-modal__content.is-owned-district-raid-alert .attack-result-modal__actions");
      expect(stylesheet).toContain(".police-action-result-modal__content.is-owned-district-raid-alert .police-action-result-modal__badge");
      expect(stylesheet).toContain("display: none !important;");
      expect(stylesheet).toContain("width: 0 !important;");
      expect(stylesheet).toContain("height: 0 !important;");
    }

    for (const stylesheet of [css, clientCss]) {
      expect(stylesheet).toContain("html body .police-action-result-modal__content.is-owned-district-raid-alert");
      expect(stylesheet).toContain("width: min(430px, calc(100vw - 16px)) !important;");
      expect(stylesheet).toContain("html body .police-raid-impact__overview");
      expect(stylesheet).toContain("grid-template-columns: repeat(3, minmax(0, 1fr)) !important;");
      expect(stylesheet).toContain("html body .police-raid-impact__grid");
      expect(stylesheet).toContain("grid-template-columns: repeat(2, minmax(0, 1fr)) !important;");
      expect(stylesheet).toContain("font-size: 0.68rem !important;");
      expect(stylesheet).toContain("width: min(390px, calc(100vw - 18px)) !important;");
      expect(stylesheet).toContain("justify-items: stretch !important;");
      expect(stylesheet).toContain("align-items: stretch !important;");
      expect(stylesheet).toContain("justify-self: stretch !important;");
      expect(stylesheet).toContain("box-sizing: border-box !important;");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked #police-action-result-modal:not(.hidden):not([hidden]) .police-action-result-modal__content.is-owned-district-raid-alert .police-raid-impact__overview");
      expect(stylesheet).toContain("grid-template-columns: minmax(0, 1fr) !important;");
      expect(stylesheet).toContain("html body .police-raid-impact-detail__card");
      expect(stylesheet).toContain("width: min(390px, calc(100vw - 20px)) !important;");
      expect(stylesheet).toContain("html body .police-raid-impact-detail__cells");
      expect(stylesheet).toContain("Final emergency mobile police raid layout guard: cells must span the full card.");
      expect(stylesheet).toContain("max-width: calc(100vw - 16px) !important;");
      expect(stylesheet).toContain("police-action-result-modal__details");
      expect(stylesheet).toContain("police-action-result-modal__details > .police-raid-impact");
      expect(stylesheet).toContain("display: flex !important;");
      expect(stylesheet).toContain("flex-direction: column !important;");
      expect(stylesheet).toContain("grid-template-columns: none !important;");
      expect(stylesheet).toContain("grid-column: 1 / -1 !important;");
      expect(stylesheet).toContain("html body .police-raid-impact-detail__cells > *");
      expect(stylesheet).toContain("flex: 0 0 auto !important;");
      expect(stylesheet).toContain("margin-left: 0 !important;");
      expect(stylesheet).toContain("html body #police-action-result-modal:not(.hidden):not([hidden]) .police-action-result-modal__content.is-owned-district-raid-alert .modal__header");
      expect(stylesheet).toContain("justify-content: center !important;");
      expect(stylesheet).toContain("html body #police-action-result-modal:not(.hidden):not([hidden]) .police-action-result-modal__content.is-owned-district-raid-alert #police-action-result-modal-close");
      expect(stylesheet).toContain("font-size: 0 !important;");
      expect(stylesheet).toContain("#police-action-result-modal-close::before");
      expect(stylesheet).toContain("#police-action-result-modal-close::after");
      expect(stylesheet).toContain("transform: translate(-50%, -50%) rotate(45deg) !important;");
      expect(stylesheet).toContain("transform: translate(-50%, -50%) rotate(-45deg) !important;");
      expect(stylesheet).toContain("text-align: center !important;");
      expect(stylesheet).toContain("Final mobile police raid close-button size guard.");
      expect(stylesheet).toContain("html body .police-raid-impact-detail__close");
      expect(stylesheet).toContain("width: 22px !important;");
      expect(stylesheet).toContain("height: 22px !important;");
      expect(stylesheet).toContain("font-size: 0.72rem !important;");
      expect(stylesheet).toContain("width: 8px !important;");
      expect(stylesheet).toContain("height: 1.25px !important;");
    }
  });

  it("keeps attack result details compact and split into two columns", () => {
    for (const stylesheet of [actionCss, clientActionCss]) {
      expect(stylesheet).toContain(".attack-result-modal__content {\n  width: min(620px, 94vw);");
      expect(stylesheet).toContain("#attack-result-modal .attack-result-modal__stats");
      expect(stylesheet).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
      expect(stylesheet).toContain("#attack-result-modal .attack-result-modal__stats .modal__row strong");
      expect(stylesheet).toContain("overflow-wrap: anywhere;");
    }

    for (const stylesheet of [css, clientCss]) {
      expect(stylesheet).toContain("html body #attack-result-modal:not(.hidden):not([hidden]) .modal__content");
      expect(stylesheet).toContain("width: min(560px, calc(100vw - 28px)) !important;");
      expect(stylesheet).toContain("max-height: min(72dvh, 600px) !important;");
    }
  });

  it("keeps robbery result details split into two columns", () => {
    for (const stylesheet of [actionCss, clientActionCss]) {
      expect(stylesheet).toContain("#raid-result-modal .spy-result-modal__details");
      expect(stylesheet).toContain("#raid-result-modal .spy-result-modal__details .modal__row");
      expect(stylesheet).toContain("#raid-result-modal .spy-result-modal__details .modal__row strong");
      expect(stylesheet).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
      expect(stylesheet).toContain("grid-template-columns: 1fr;");
      expect(stylesheet).toContain("overflow-wrap: anywhere;");
    }

    for (const stylesheet of [css, clientCss]) {
      expect(stylesheet).toContain("html body #raid-result-modal:not(.hidden):not([hidden]) .spy-result-modal__details");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked #raid-result-modal:not(.hidden):not([hidden]) .spy-result-modal__details");
      expect(stylesheet).toContain("grid-template-columns: repeat(2, minmax(0, 1fr)) !important;");
      expect(stylesheet).toContain("html body #raid-result-modal:not(.hidden):not([hidden]) .spy-result-modal__details .modal__row");
      expect(stylesheet).toContain("grid-template-columns: 1fr !important;");
    }
  });

  it("swaps the alliance and leaderboard launch positions on desktop and mobile", () => {
    expect(mobileRuntime).toContain('const leaderboardLaunchRow = leaderboardCard?.closest(".leaderboard-launch-row");');
    expect(mobileRuntime).toContain("const leaderboardBlock = leaderboardLaunchRow || leaderboardCard;");
    expect(mobileRuntime).toContain('const streetNewsAnchor = documentObj.getElementById("mobile-alliance-card-anchor");');
    expect(mobileRuntime).toContain("moveElementAfterAnchor(streetNewsAnchor, leaderboardBlock);");
    expect(mobileRuntime).toContain("moveElementAfterAnchor(leaderboardBlock, globalChatCard);");
    expect(mobileRuntime).toContain("moveElementAfterAnchor(globalChatCard, allianceChatCard);");
    expect(mobileRuntime).toContain("moveElementAfterAnchor(leaderboardAnchor, allianceChatCard);");
    expect(mobileRuntime).toContain("moveElementAfterAnchor(allianceChatAnchor, leaderboardBlock);");
    expect(mobileRuntime).not.toContain("moveElementAfterAnchor(globalChatCard, leaderboardCard);");
    for (const stylesheet of [css, clientCss]) {
      expect(stylesheet).toContain(".leaderboard-launch-row,\n  #leaderboard-card");
      expect(stylesheet).toContain(".leaderboard-launch-row #leaderboard-card");
      expect(stylesheet).toContain("grid-column: auto !important;");
      expect(stylesheet).not.toContain(".leaderboard-launch-row #onboarding-launch-button");
      expect(stylesheet).toContain("padding-bottom: 0 !important;");
    }
  });

  it("keeps mobile district action buttons on desktop action skins", () => {
    for (const stylesheet of [mainCss, clientMainCss]) {
      expect(stylesheet).toContain("Final mobile desktop parity: district action buttons use desktop action skins.");
      expect(stylesheet).toContain("html body.game-body .district-popup-action[data-district-action-id]");
      expect(stylesheet).toContain("min-height: 46px !important;");
      expect(stylesheet).toContain("border-radius: 7px !important;");
      expect(stylesheet).toContain("linear-gradient(135deg, rgba(120, 53, 15, 0.96), rgba(161, 98, 7, 0.9)) !important;");
      expect(stylesheet).toContain("linear-gradient(135deg, rgba(8, 47, 73, 0.96), rgba(15, 118, 110, 0.9)) !important;");
      expect(stylesheet).toContain("linear-gradient(135deg, rgba(136, 19, 55, 0.96), rgba(64, 8, 24, 0.92)) !important;");
      expect(stylesheet).toContain("linear-gradient(135deg, rgba(127, 29, 29, 0.96), rgba(24, 24, 27, 0.94)) !important;");
      expect(stylesheet).toContain('html body.game-body .district-popup-action[data-district-action-id="trap"][data-district-trap-state="active"]');
      expect(stylesheet).toContain("--district-action-rgb: 148, 163, 184;");
      expect(stylesheet).toContain("linear-gradient(135deg, rgba(71, 85, 105, 0.58), rgba(15, 23, 42, 0.72))");
    }
  });

  it("pins district action countdowns to the desktop button corner", () => {
    for (const stylesheet of [districtCss, clientDistrictCss]) {
      expect(stylesheet).toContain(".district-popup-action__sub.district-popup-action__countdown");
      expect(stylesheet).toContain("position: absolute !important;");
      expect(stylesheet).toContain("right: 7px !important;");
      expect(stylesheet).toContain("bottom: 5px !important;");
      expect(stylesheet).toContain("left: auto !important;");
      expect(stylesheet).toContain("top: auto !important;");
      expect(stylesheet).toContain("text-align: right;");
      expect(stylesheet).toContain("white-space: nowrap;");
      expect(stylesheet).toContain("transform: none !important;");
    }
  });

  it("keeps armory info power values on the same row as weapon names", () => {
    for (const html of [gameHtml, clientGameHtml]) {
      expect(html).toContain('class="pharmacy-info-output__head"');
      expect(html).toContain('class="pharmacy-info-output-column pharmacy-info-output-column--attack"');
      expect(html).toContain('class="pharmacy-info-output-column pharmacy-info-output-column--defense"');
      expect(html).toContain('<span class="pharmacy-info-output__power"><span>Síla útoku:</span><strong>5</strong></span>');
      expect(html).toContain('<span class="pharmacy-info-output__power"><span>Síla obrany:</span><strong>20</strong></span>');
    }

    for (const stylesheet of [buildingModalCss, clientBuildingModalCss]) {
      expect(stylesheet).toContain(".pharmacy-info-output__head");
      expect(stylesheet).toContain("justify-content: space-between;");
      expect(stylesheet).toContain(".pharmacy-info-output__power strong");
      expect(stylesheet).toContain(".pharmacy-info-output__power > span");
      expect(stylesheet).toContain("font-size: 6.2px !important;");
      expect(stylesheet).toContain("font-size: 1.32em !important;");
      expect(stylesheet).toContain(".pharmacy-info-output-column");
      expect(stylesheet).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
      expect(stylesheet).toContain(".armory-popup-card.building-detail-modal__content .building-tech-popup-stat-card:nth-child(3)");
      expect(stylesheet).toContain("border-color: rgba(251, 191, 36, 0.36);");
    }
  });

  it("keeps the storage close button inside the defense inventory block", () => {
    for (const html of [gameHtml, clientGameHtml]) {
      expect(html).toContain('<h3 class="storage-popup-subtitle storage-popup-subtitle--with-close">');
      expect(html).toContain('<span>Obrana</span>');
      expect(html).toContain('<button type="button" class="button storage-popup-close" data-storage-popup-close aria-label="Zavřít sklad">✕</button>');
      expect(html).not.toContain('<div class="storage-popup-heading">\n            <span class="storage-popup-eyebrow">Sklad</span>\n            <button type="button" class="button storage-popup-close"');
    }

    for (const stylesheet of [popupCss, clientPopupCss]) {
      expect(stylesheet).toContain(".storage-popup-subtitle--with-close");
      expect(stylesheet).toContain(".storage-popup-subtitle--with-close .storage-popup-close");
      expect(stylesheet).toContain("position: absolute;");
      expect(stylesheet).toContain("width: 22px;");
    }

    for (const stylesheet of [css, clientCss]) {
      expect(stylesheet).toContain("Storage modal: keep close control inside the Defense block header.");
      expect(stylesheet).toContain("html body .storage-popup-shell[data-storage-popup] .storage-popup-grid");
      expect(stylesheet).toContain("padding-right: 0 !important;");
      expect(stylesheet).toContain("html body .storage-popup-shell[data-storage-popup] .storage-popup-subtitle--with-close .storage-popup-close");
      expect(stylesheet).toContain("position: absolute !important;");
      expect(stylesheet).toContain("margin: 0 !important;");
      expect(stylesheet).toContain("width: 17px !important;");
      expect(stylesheet).toContain("font-size: 13px !important;");
      expect(stylesheet).toContain("line-height: 0.92 !important;");
    }
  });

  it("keeps mobile City Events tappable above onboarding and modal scroll lock", () => {
    expect(onboardingCss).toContain("inset: auto max(12px, env(safe-area-inset-right, 0px)) calc(72px + env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px));");
    expect(onboardingCss).toContain("max-height: min(42dvh, calc(100dvh - 132px));");
    expect(onboardingCss).toContain("max-height: max(72px, calc(42dvh - 138px));");
    expect(mobileRuntime).toContain('const cityEventsAnchor = documentObj.getElementById("city-events-card-anchor");');
    expect(mobileRuntime).toContain("moveElementAfterAnchor(cityEventsAnchor, cityEventsCard);");
    for (const stylesheet of [css, clientCss]) {
      expect(stylesheet).toContain("body.game-modal-scroll-locked #events-modal");
      expect(stylesheet).toContain("body.game-modal-scroll-locked #event-detail-modal");
      expect(stylesheet).toContain("#events-modal .modal__close,\n  #event-detail-modal .modal__close");
      expect(stylesheet).toContain("position: static !important;");
      expect(stylesheet).toContain("z-index: 9700 !important;");
      expect(stylesheet).toContain("z-index: 9710 !important;");
    }
    for (const stylesheet of [cityEventsCss, clientCityEventsCss]) {
      expect(stylesheet).toContain("#events-modal:not(.hidden)");
      expect(stylesheet).toContain("#event-detail-modal:not(.hidden)");
      expect(stylesheet).toContain("display: grid;");
      expect(stylesheet).toContain("#events-modal .events-modal__content");
      expect(stylesheet).toContain("#events-modal .events-modal__content > .modal__header");
      expect(stylesheet).toContain("#event-detail-modal .event-detail-modal__content > .modal__header");
      expect(stylesheet).toContain("justify-content: space-between;");
      expect(stylesheet).toContain("#events-modal .modal__close {\n  position: static;");
      expect(stylesheet).toContain("#event-detail-modal .modal__close {\n  position: static;");
      expect(stylesheet).toContain("transform: translate(-50%, -50%);");
      expect(stylesheet).toContain("max-height: min(84vh, 760px);");
    }
  });

  it("keeps the mobile page visually stable while popup cards are open", () => {
    for (const stylesheet of [css, clientCss]) {
      expect(stylesheet).not.toContain("--mobile-topbar-offset: 0px !important;");
      expect(stylesheet).toContain("body.game-body.game-modal-scroll-locked");
      expect(stylesheet).toContain("height: auto !important;");
      expect(stylesheet).toContain("min-height: var(--game-mobile-bg-height, 100svh) !important;");
      expect(stylesheet).toContain("--mobile-overlay-card-top: max(env(safe-area-inset-top), 0px);");
      expect(stylesheet).toContain("--mobile-overlay-card-gap: 6px;");
      expect(stylesheet).toContain("--game-mobile-bg-height: var(--mobile-locked-vh, 100svh);");
      expect(stylesheet).toContain("@supports (height: 100lvh)");
      expect(stylesheet).not.toContain("body.game-modal-scroll-locked::before");
      expect(stylesheet).toContain("body.game-modal-scroll-locked .game-topbar");
      expect(stylesheet).toContain("body.game-modal-scroll-locked .game-resource-strip");
      expect(stylesheet).toContain("visibility: hidden !important;");
      expect(stylesheet).toContain("opacity: 0 !important;");
      expect(stylesheet).toContain("Mobile overlay backdrop stability: keep the real page visible behind game cards.");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked .district-popup-shell:not([hidden]) > .district-popup-backdrop");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked .pharmacy-popup-shell:not([hidden]) > .pharmacy-popup-backdrop");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked .storage-popup-shell:not([hidden]) > .storage-popup-backdrop");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked #events-modal:not(.hidden) > .modal__backdrop");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked #buildings-modal.buildings-popup-shell:not([hidden]) > .buildings-popup-backdrop");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked .market-popup-shell:not([hidden]) > .market-popup-backdrop");
      expect(stylesheet).toContain("background: transparent !important;");
      expect(stylesheet).toContain("backdrop-filter: none !important;");
      expect(stylesheet).toContain("filter: none !important;");
      expect(stylesheet).not.toContain("Final stable page background: opening game cards must not visually change the page behind them.");
      expect(stylesheet).not.toContain("Final stable card backdrop: opening cards must not dim or shift the page behind them.");
      expect(stylesheet).not.toContain("visibility: visible !important;\n  opacity: 1 !important;\n  filter: none !important;\n  transform: none !important;");
      expect(stylesheet).toContain("body.game-modal-scroll-locked .robbery-setup-popup-shell");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked #spy-confirm-modal");
      expect(stylesheet).toContain("padding-top: calc(var(--mobile-overlay-card-top) + var(--mobile-overlay-card-gap)) !important;");
      expect(stylesheet).toContain("max-height: calc(100dvh - var(--mobile-overlay-card-top) - 18px - env(safe-area-inset-bottom)) !important;");
      expect(stylesheet).toContain("Hard guard: large mobile windows must open from the top of the phone viewport.");
      expect(stylesheet).toContain("--mobile-overlay-available-height: calc(");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked #buildings-modal.buildings-popup-shell:not([hidden])");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked .district-popup-shell:not([hidden])");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked .market-popup-shell:not([hidden])");
      expect(stylesheet).toContain("body.game-modal-scroll-locked .district-building-detail-shell:not([hidden])");
      expect(stylesheet).toContain("z-index: 12150 !important;");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked .district-popup-shell:not([hidden]) .district-popup-card");
      expect(stylesheet).toContain('html body.game-modal-scroll-locked .district-popup-shell[data-overview-enabled="true"]:not([hidden])');
      expect(stylesheet).toContain("--district-popup-mobile-lower-top: clamp(96px, 24svh, 172px);");
      expect(stylesheet).toContain("--district-popup-overview-top: calc(var(--mobile-topbar-offset, 72px) + 18px);");
      expect(stylesheet).toContain("padding: var(--district-popup-overview-top) 8px var(--district-popup-overview-bottom) !important;");
      expect(stylesheet).toContain("max-height: calc(var(--mobile-locked-vh, 100svh) - var(--district-popup-overview-top) - var(--district-popup-overview-bottom)) !important;");
      expect(stylesheet).toContain("--district-popup-mobile-top: clamp(86px, 24svh, 168px);");
      expect(stylesheet).toContain('.district-popup-shell[data-district-popup][data-mobile-position="raised"]:not([hidden])');
      expect(stylesheet).toContain("--district-popup-mobile-raised-top: max(24px, calc(var(--mobile-topbar-offset, 72px) - 34px));");
      expect(stylesheet).toContain("padding-top: var(--district-popup-mobile-raised-top) !important;");
      expect(stylesheet).toContain("animation-name: districtPopupMobileCenterIn !important;");
      expect(stylesheet).toContain("@keyframes districtPopupMobileCenterIn");
      expect(stylesheet).toContain("transform-origin: center center !important;");
      expect(stylesheet).toContain("transform: scale(0.94);");
      expect(stylesheet).toContain("transform: scale(1.015);");
      expect(stylesheet).toContain("transform: scale(1);");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked .market-popup-shell:not([hidden]) .market-popup-card");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked .wanted-popup-shell:not([hidden]) .wanted-popup-card");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked .armory-popup-shell:not([hidden]) .armory-popup-card.building-detail-modal__content");
      expect(stylesheet).toContain("top: auto !important;");
      expect(stylesheet).toContain("height: var(--mobile-overlay-available-height) !important;");
      expect(stylesheet).toContain("top: calc(var(--mobile-overlay-card-top) + var(--mobile-overlay-card-gap)) !important;");
      expect(stylesheet).toContain("Final hard override: mobile Buildings cards must receive taps");
      expect(stylesheet).toContain("[data-buildings-open-building-name]");
      expect(stylesheet).toContain("touch-action: manipulation !important;");
      expect(stylesheet).toContain("Final hard override: mobile faction action modal stays centered vertically");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked #faction-actions-modal.faction-actions-modal:not(.hidden)");
      expect(stylesheet).toContain("align-items: center !important;");
      expect(stylesheet).toContain("Final override: action result and key confirmation dialogs stay centered in the viewport.");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked #spy-confirm-modal:not(.hidden)");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked #raid-confirm-modal:not(.hidden)");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked #occupy-confirm-modal:not(.hidden)");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked #attack-result-modal:not(.hidden)");
      expect(stylesheet).toContain("Final hard override: mobile police raid result opens exactly in the viewport center.");
      expect(stylesheet).toContain("html body.game-modal-scroll-locked #police-action-result-modal:not(.hidden):not([hidden])");
      expect(stylesheet).toContain("place-items: center !important;");
      expect(stylesheet).toContain("height: var(--mobile-locked-vh, 100dvh) !important;");
      expect(stylesheet).toContain("Final mobile police raid impact topbar visibility guard.");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(#police-action-result-modal:not(.hidden):not([hidden]) .police-action-result-modal__content.is-owned-district-raid-alert) #game-header");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(#police-action-result-modal:not(.hidden):not([hidden]) .police-action-result-modal__content.is-owned-district-raid-alert) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked.is-mobile-topbar-condensed:has(#police-action-result-modal:not(.hidden):not([hidden]) .police-action-result-modal__content.is-owned-district-raid-alert) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(.police-raid-impact-detail.is-open) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(#police-action-result-modal:not(.hidden):not([hidden]) .police-action-result-modal__content.is-owned-district-raid-alert) .game-resource-strip > *");
    }
    for (const stylesheet of [mainCss, clientMainCss]) {
      expect(stylesheet).not.toContain("Final stable page background: opening game cards must not visually change the page behind them.");
      expect(stylesheet).not.toContain("Final stable card backdrop: opening cards must not dim or shift the page behind them.");
      expect(stylesheet).not.toContain("visibility: visible !important;\n  opacity: 1 !important;\n  filter: none !important;\n  transform: none !important;");
      expect(stylesheet).toContain(".district-popup-shell[data-district-popup]:not([hidden]) .district-popup-card");
      expect(stylesheet).toContain("#buildings-modal.buildings-popup-shell:not([hidden]) .buildings-popup-card");
      expect(stylesheet).toContain("animation: mobile-modal-center-pop-in 220ms var(--motion-modal-ease, cubic-bezier(0.22, 1, 0.36, 1)) both !important;");
      expect(stylesheet).toContain("--district-mobile-resource-clearance: 0px;");
      expect(stylesheet).toContain("--mobile-overlay-top-offset: 0px !important;");
      expect(stylesheet).not.toContain("is-district-popup-resource-visible");
      expect(stylesheet).toContain("game-modal-scroll-locked:has(.district-popup-shell:not([hidden]))");
      expect(stylesheet).toContain("game-modal-scroll-locked:has(.district-popup-shell:not([hidden])):has(:is(");
      expect(stylesheet).toContain("#attack-confirm-modal:not(.hidden):not([hidden])");
      expect(stylesheet).toContain("#trap-confirm-modal:not(.hidden):not([hidden])");
      expect(stylesheet).toContain("z-index: 23000 !important;");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked #game-header");
      expect(stylesheet).toContain("visibility: hidden !important;");
      expect(stylesheet).toContain("opacity: 0 !important;");
      expect(stylesheet).toContain("Final mobile action confirmation layout: keep topbar visible and start cards below it.");
      expect(stylesheet).toContain("Final mobile action modal topbar layer override.");
      expect(stylesheet).toContain("game-modal-scroll-locked:has(:is(");
      expect(stylesheet).toContain(".attack-setup-popup-shell:not([hidden])");
      expect(stylesheet).toContain(".attack-setup-popup-shell:not(.robbery-setup-popup-shell):not([hidden])");
      expect(stylesheet).toContain(".robbery-setup-popup-shell:not([hidden])");
      expect(stylesheet).toContain("z-index: 24050 !important;");
      expect(stylesheet).toContain(".game-topbar .resource-pill");
      expect(stylesheet).toContain(".game-topbar .game-toolbar-button");
      expect(stylesheet).toContain(".game-resource-strip > *");
      expect(stylesheet).toContain("visibility: visible !important;");
      expect(stylesheet).toContain("Final mobile police raid impact topbar visibility guard.");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(#police-action-result-modal:not(.hidden):not([hidden]) .police-action-result-modal__content.is-owned-district-raid-alert) #game-header");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(#police-action-result-modal:not(.hidden):not([hidden]) .police-action-result-modal__content.is-owned-district-raid-alert) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked.is-mobile-topbar-condensed:has(#police-action-result-modal:not(.hidden):not([hidden]) .police-action-result-modal__content.is-owned-district-raid-alert) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(.police-raid-impact-detail.is-open) .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked:has(#police-action-result-modal:not(.hidden):not([hidden]) .police-action-result-modal__content.is-owned-district-raid-alert) .game-resource-strip > *");
      expect(stylesheet).toContain("--action-confirm-mobile-top-offset: var(--mobile-topbar-offset, 72px);");
      expect(stylesheet).toContain("padding: var(--action-confirm-mobile-top-offset) 10px max(10px, env(safe-area-inset-bottom)) !important;");
      expect(stylesheet).toContain("align-items: flex-start !important;");
      expect(stylesheet).toContain("html body.game-body .district-popup-action--countdown");
      expect(stylesheet).toContain("html body.game-body .district-popup-action__countdown");
      expect(stylesheet).toContain("color: #facc15 !important;");
      expect(stylesheet).toContain("right: 7px !important;");
      expect(stylesheet).toContain("bottom: 5px !important;");
      expect(stylesheet).toContain("html body.game-body .district-popup-action--countdown:disabled");
      expect(stylesheet).toContain("place-items: center !important;");
      expect(stylesheet).toContain("html body.game-body .district-popup-action--countdown .district-popup-action__label");
      expect(stylesheet).toContain("text-align: center !important;");
      expect(stylesheet).toContain("padding-bottom: 9px !important;");
      expect(stylesheet).toContain("padding: 0 8px !important;");
      expect(stylesheet).toContain("transform: none !important;");
      expect(stylesheet).toContain("html body.game-body .district-popup-action[data-district-action-id].district-popup-action--countdown");
      expect(stylesheet).toContain("padding-top: var(--district-mobile-resource-clearance, 0px) !important;");
    }
    expect(mobileRuntime).toContain('const MOBILE_OVERLAY_SELECTOR = [');
    expect(mobileRuntime).toContain('".district-popup-shell",');
    expect(mobileRuntime).toContain('const MOBILE_SCROLL_THROUGH_OVERLAY_SELECTOR = ".district-popup-shell[data-district-popup]";');
    expect(mobileRuntime).toContain("const hasOpenOverlay = openOverlays.some((element) => !isScrollThroughOverlay(element));");
    expect(mobileRuntime).toContain('".elimination-ai-panel",');
    expect(mobileRuntime).toContain('".elimination-result-popup",');
    expect(mobileRuntime).toContain('root.style.setProperty("--mobile-overlay-top-offset", `${topbarOffset}px`);');
    expect(mobileRuntime).toContain('import { isModalScrollLocked } from "./ui/modalScrollLock.js";');
    expect(mobileRuntime).toContain("if (isModalScrollLocked(documentObj)) {");
    expect(mobileRuntime).toContain('root.classList.add("game-modal-scroll-locked");');
    expect(mobileRuntime).toContain('documentObj.body.classList.add("game-modal-scroll-locked");');
    expect(mobileRuntime).toContain('root.classList.toggle("game-modal-scroll-locked", hasOpenOverlay);');
    expect(mobileRuntime).toContain('documentObj.body.classList.toggle("game-modal-scroll-locked", hasOpenOverlay);');
    expect(mobileRuntime).not.toContain("let lastKnownScrollY = getScrollY();");
    expect(mobileRuntime).not.toContain("let lockedScrollY = null;");
    expect(mobileRuntime).not.toContain("const lockPageScroll = () => {");
    expect(mobileRuntime).not.toContain("const getLockedBodyScrollY = () => {");
    expect(mobileRuntime).not.toContain('documentObj.body.style.position = "fixed"');
    expect(mobileRuntime).not.toContain("getLockedBodyScrollY() || 0");
    expect(mobileRuntime).not.toContain("const restorePageScroll = (nextScrollY) => {");
    expect(mobileRuntime).not.toContain("const restoreScrollPosition = () => {");
    expect(mobileRuntime).not.toContain("root.scrollTop = nextScrollY;");
    expect(mobileRuntime).not.toContain("documentObj.body.scrollTop = nextScrollY;");
    expect(mobileRuntime).not.toContain("windowObj.requestAnimationFrame(() => windowObj.requestAnimationFrame(restoreScrollPosition));");
    expect(mobileRuntime).not.toContain("windowObj.setTimeout(restoreScrollPosition, 180);");
  });

  it("keeps open mobile card modals out of the game page layout", () => {
    for (const stylesheet of [mainCss, clientMainCss]) {
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked #game-header,\n  html body.game-body.game-modal-scroll-locked .game-topbar,\n  html body.game-body.game-modal-scroll-locked .game-resource-strip");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked.is-mobile-topbar-condensed .game-resource-strip");
      expect(stylesheet).toContain("visibility: hidden !important;\n    opacity: 0 !important;");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked .game-shell > .modal:not(.hidden):not([hidden])");
      expect(stylesheet).toContain("position: fixed !important;\n    inset: 0 !important;");
      expect(stylesheet).toContain("min-height: var(--mobile-locked-vh, 100svh) !important;");
      expect(stylesheet).toContain("height: var(--mobile-locked-vh, 100svh) !important;");
      expect(stylesheet).toContain("contain: layout paint !important;");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked .game-shell > .modal:not(.hidden):not([hidden]) > .modal__backdrop");
      expect(stylesheet).toContain("position: absolute !important;\n    inset: 0 !important;");
    }
    for (const stylesheet of [buildingModalCss, clientBuildingModalCss]) {
      expect(stylesheet).toContain(".district-building-detail-shell:not([hidden])");
      expect(stylesheet).toContain("z-index: 12150;");
    }
  });

  it("keeps wanted police help above storage and heat popup layers", () => {
    for (const stylesheet of [mainCss, clientMainCss]) {
      expect(stylesheet).toContain("Final demo modal layer: wanted police help must stay above storage/heat popup cards.");
      expect(stylesheet).toContain("html body.game-body .wanted-popup-shell:not([hidden])");
      expect(stylesheet).toContain("z-index: 21000 !important;");
      expect(stylesheet).toContain("html body.game-body .wanted-popup-shell:not([hidden]) .wanted-popup-card");
      expect(stylesheet).toContain("z-index: 21010 !important;");
      expect(stylesheet).toContain("html body.game-body .wanted-popup-shell:not([hidden]) > .wanted-popup-police-window");
      expect(stylesheet).toContain("z-index: 21020 !important;");
      expect(stylesheet).toContain("html body.game-body .storage-popup-shell[data-storage-popup]:not([hidden])");
      expect(stylesheet).toContain("z-index: 50000 !important;");
    }
  });

  it("keeps onboarding below critical action and police modal layers", () => {
    expect(onboardingCss).toContain("Empire Streets layer scale: base UI < onboarding < action/result modals < police critical < emergency.");
    expect(onboardingCss).toContain("--empire-z-onboarding-highlight: 9380;");
    expect(onboardingCss).toContain("--empire-z-onboarding-panel: 9400;");
    expect(onboardingCss).toContain("--empire-z-action-confirmation: 19000;");
    expect(onboardingCss).toContain("--empire-z-action-result: 20000;");
    expect(onboardingCss).toContain("--empire-z-police-critical: 21000;");
    expect(onboardingCss).toContain("--empire-z-emergency: 23000;");
    expect(onboardingCss).toContain("--onboarding-z-panel: 9400;");
    expect(onboardingCss).toContain("--onboarding-z-highlight: 9380;");
    expect(actionCss).toContain("z-index: 19000;");
    expect(mainCss).toContain("z-index: 21000 !important;");
    expect(mainCss).toContain("z-index: 23000 !important;");
  });

  it("keeps onboarding motion subtle and reduced-motion safe", () => {
    expect(onboardingCss).toContain("@keyframes onboardingPanelIn");
    expect(onboardingCss).toContain("@keyframes onboardingSheetIn");
    expect(onboardingCss).toContain("@keyframes onboardingSignalPulse");
    expect(onboardingCss).toContain("@keyframes onboardingProgressShimmer");
    expect(onboardingCss).toContain("@keyframes onboardingStepGlow");
    expect(onboardingCss).toContain("@keyframes onboardingMapDistrictPulse");
    expect(onboardingCss).toContain("animation-name: onboardingSheetIn;");
    expect(onboardingCss).toContain(".empire-onboarding__signal");
    expect(onboardingCss).toContain(".empire-onboarding__progress-fill::after");
    expect(onboardingCss).toContain("animation: onboardingProgressShimmer 2.6s ease-in-out infinite;");
    expect(onboardingCss).toContain("grid-template-columns: minmax(84px, 0.8fr) minmax(72px, 0.72fr) minmax(116px, 1.16fr);");
    expect(onboardingCss).toContain(".empire-onboarding__button--back");
    expect(onboardingCss).toContain("grid-template-columns: minmax(76px, 0.82fr) minmax(68px, 0.72fr) minmax(104px, 1.12fr);");
    expect(onboardingCss).toContain('.empire-onboarding[data-onboarding-step="attack-order"]');
    expect(onboardingCss).toMatch(/\.empire-onboarding-highlight \{[\s\S]*pointer-events: none;/u);
    expect(onboardingCss).toMatch(/\.empire-onboarding-map-highlight-layer \{[\s\S]*pointer-events: none;/u);
    expect(onboardingCss).toMatch(/\.empire-onboarding-map-highlight \{[\s\S]*pointer-events: none;/u);
    expect(onboardingCss).toContain(".empire-onboarding-map-highlight__glow");
    expect(onboardingCss).toContain(".empire-onboarding-map-highlight__line");
    expect(onboardingCss).not.toContain(".empire-onboarding-map-highlight::before");
    expect(onboardingCss).toContain('html[data-onboarding-map-mode="zoom-out"] .map-viewport');
    expect(onboardingCss).toMatch(/\.empire-onboarding-backdrop \{[\s\S]*pointer-events: none;/u);
    expect(onboardingCss).toMatch(/\.empire-onboarding-backdrop \{[\s\S]*touch-action: pan-x pan-y;/u);
    expect(onboardingCss).toMatch(/\.empire-onboarding-backdrop\.is-focus \{[\s\S]*pointer-events: auto;[\s\S]*touch-action: none;/u);
    expect(onboardingCss).toMatch(/\.empire-onboarding-backdrop\.is-focus\.is-cutout \{[\s\S]*background: transparent;[\s\S]*pointer-events: none;/u);
    expect(onboardingCss).toContain(".empire-onboarding-backdrop__mask");
    expect(onboardingCss).toContain(".is-onboarding-focus-target");
    expect(onboardingCss).toContain("z-index: calc(var(--onboarding-z-backdrop) + 10) !important;");
    expect(onboardingCss).toContain("#game-gang-panel-mount.is-onboarding-focus-target");
    expect(onboardingCss).toContain("#profile-gang-card.is-onboarding-focus-target");
    expect(onboardingCss).toContain('html[data-onboarding-step="building-action"] body.game-body #profile-gang-card.is-onboarding-focus-target');
    expect(onboardingCss).toContain("z-index: calc(var(--onboarding-z-backdrop) + 12) !important;");
    expect(onboardingCss).toContain("#game-rail-left.is-onboarding-focus-target");
    expect(onboardingCss).toContain("#game-left-nav.is-onboarding-focus-target");
    expect(onboardingCss).toContain('html[data-onboarding-step="heat-police"] body.game-body #game-left-nav > :not(#city-events-card):not(#buildings-card):not(#market-card):not(#building-shortcut-grid)');
    expect(onboardingCss).toContain("#city-events-card.is-onboarding-focus-target");
    expect(onboardingCss).toContain("#buildings-card.is-onboarding-focus-target");
    expect(onboardingCss).toContain("#market-card.is-onboarding-focus-target");
    expect(onboardingCss).toContain("#building-shortcut-grid.is-onboarding-focus-target");
    expect(onboardingCss).toContain("#city-events-card.is-onboarding-focus-target #city-events-open");
    expect(onboardingCss).toContain("#buildings-card.is-onboarding-focus-target [data-buildings-popup-open]");
    expect(onboardingCss).toContain("#market-card.is-onboarding-focus-target [data-market-popup-open]");
    expect(onboardingCss).toContain("#building-shortcut-grid.is-onboarding-focus-target .building-shortcut-button");
    expect(onboardingCss).toContain("#profile-gang-card .gang-profile-row.is-onboarding-focus-target");
    expect(onboardingCss).toContain("#profile-gang-card .gang-profile-stars.is-onboarding-focus-target");
    expect(onboardingCss).toContain("@media (min-width: 901px)");
    expect(onboardingCss).toContain('.empire-onboarding[data-onboarding-step="your-district"]');
    expect(onboardingCss).toContain('.empire-onboarding[data-onboarding-step="building-action"]');
    expect(onboardingCss).toContain('.empire-onboarding[data-onboarding-step="spy"]');
    expect(onboardingCss).toContain('.empire-onboarding[data-onboarding-step="heat-police"]');
    expect(onboardingCss).toContain('inset: max(8px, env(safe-area-inset-top, 0px)) max(10px, env(safe-area-inset-right, 0px)) auto max(10px, env(safe-area-inset-left, 0px));');
    expect(onboardingCss).toContain('@media (max-width: 720px)');
    expect(onboardingCss).toContain('inset: auto max(10px, env(safe-area-inset-right, 0px)) max(8px, env(safe-area-inset-bottom, 0px)) max(10px, env(safe-area-inset-left, 0px));');
    expect(onboardingCss).toContain("max-height: min(42dvh, calc(100dvh - 96px));");
    expect(onboardingCss).toContain('html[data-onboarding-step="building-action"] body.game-body #game-gang-panel-mount');
    expect(onboardingCss).toContain('body.game-body[data-onboarding-step="building-action"] #profile-gang-card');
    expect(onboardingCss).toContain("margin-bottom: calc(42dvh + 24px) !important;");
    expect(onboardingCss).toContain('.empire-onboarding[data-onboarding-scroll="page"]');
    expect(onboardingCss).toContain('.empire-onboarding[data-onboarding-scroll="guided"]');
    expect(onboardingCss).not.toContain("0 0 0 9999px");
    expect(onboardingCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(onboardingCss).toContain(".empire-onboarding__signal::before,");
    expect(onboardingCss).toContain(".empire-onboarding__progress-fill::after,");
    expect(onboardingCss).toContain(".empire-onboarding-highlight,");
    expect(onboardingCss).toContain(".empire-onboarding-map-highlight-layer,");
    expect(onboardingCss).toContain(".empire-onboarding-map-highlight,");
    expect(onboardingCss).toContain(".empire-onboarding-map-highlight__glow,");
    expect(onboardingCss).toContain("animation: none !important;");
    expect(onboardingCss).toContain("transition: none !important;");
  });

  it("restores page scroll after closing every mobile overlay coordinator", () => {
    for (const source of [overlayState, gameplaySliceClient, clientGameplaySliceClient]) {
      expect(source).toContain("const getScrollPosition");
      expect(source).toContain("const restorePageScroll");
      expect(source).toContain("const schedulePageScrollRestore");
      expect(source).toContain("lockedPageScroll");
      expect(source).toContain("EmpireModalScrollLock");
      expect(source).toContain("document.documentElement.scrollLeft = scrollX;");
      expect(source).toContain("document.documentElement.scrollTop = scrollY;");
      expect(source).toContain("document.body.scrollLeft = scrollX;");
      expect(source).toContain("document.body.scrollTop = scrollY;");
      expect(source).toContain("restore, 80");
      expect(source).toContain('body.style.position = "fixed"');
      expect(source).toContain("body.style.top = `-${scrollPosition.y}px`");
      expect(source).toContain("body.style.left = `-${scrollPosition.x}px`");
      expect(source).toContain("MOBILE_SCROLL_LOCK_MEDIA");
      expect(source).toContain("shouldUseViewportWidthLock");
      expect(source).toContain("getCurrentLayoutLockWidth");
      expect(source).toContain("isViewportWidthScrollLock");
      expect(source).toContain("if (isViewportWidthScrollLock) {");
      expect(source).toContain("body.style.width = lockedLayoutWidth > 0");
      expect(source).not.toContain("!isViewportWidthScrollLock && scrollbarWidth > 0");
      expect(source).not.toContain("const scrollbarWidth");
      expect(source).toContain('root.style.setProperty("scrollbar-gutter", "stable")');
      expect(source).toContain("body.style.paddingRight");
      expect(source).not.toContain("let lockedPageScrollY");
      expect(source).not.toContain("window.setTimeout?.(restore, 180);");
    }
    expect(overlayState).toContain("const MODAL_SCROLL_LOCK_OWNER = Symbol");
    expect(overlayState).toContain('openOverlayEntry("generic", MODAL_SCROLL_LOCK_OWNER);');
    expect(overlayState).toContain("closeOverlayEntry(\"modal scroll lock released\", MODAL_SCROLL_LOCK_OWNER)");

    for (const source of [modalScrollLock, clientModalScrollLock]) {
      expect(source).toContain("function getModalScrollLock()");
      expect(source).toContain("window.EmpireModalScrollLock");
      expect(source).toContain("export function lockModalScroll(owner)");
      expect(source).toContain("return Boolean(getModalScrollLock()?.lock?.(owner));");
      expect(source).toContain("return Boolean(getModalScrollLock()?.unlock?.(owner));");
      expect(source).toContain("return Boolean(getModalScrollLock()?.isLocked?.(owner));");
      expect(source).not.toContain("new WeakMap");
      expect(source).not.toContain("body.style.position");
      expect(source).not.toContain("body.style.top");
      expect(source).not.toContain("body.style.left");
      expect(source).not.toContain("body.style.paddingRight");
      expect(source).not.toContain("document.documentElement.scrollTop");
      expect(source).not.toContain("lockedPageScroll");
    }

    for (const source of [legacyOverlayCoordinator, clientLegacyOverlayCoordinator]) {
      expect(source).toContain('import { lockModalScroll, unlockModalScroll } from "./modalScrollLock.js";');
      expect(source).not.toContain('body?.style?.position === "fixed"');
      expect(source).not.toContain("lockedScrollY || 0");
      expect(source).not.toContain("let lockedPageScrollY = null;");
      expect(source).not.toContain("function getScrollY(view, body)");
      expect(source).toContain("lockModalScroll(element?.ownerDocument || undefined);");
      expect(source).toContain("unlockModalScroll(element?.ownerDocument || undefined);");
      expect(source).toContain("restoreFocusOnClose: options.restoreFocusOnClose !== false");
      expect(source).toContain("options.restoreFocus !== false && entry?.restoreFocusOnClose !== false");
      expect(source).toContain("options.skipFocus !== true");
      expect(source).toContain("lockScroll: options.lockScroll !== false");
      expect(source).toContain("function hasScrollLockingOverlay()");
      expect(source).toContain("const existingIndex = overlayStack.findLastIndex");
      expect(source).toContain("const hadEntry = index >= 0;");
      expect(source).toContain("const unlockedByPrune = pruneClosedOverlays();");
      expect(source).toContain("if (!unlockedByPrune && hadEntry && entry?.lockScroll !== false && !hasScrollLockingOverlay())");
    }

    for (const source of [modalHelpers, clientModalHelpers]) {
      expect(source).toContain("export function hideElement(element, options = {})");
      expect(source).toContain("closeOverlay(element, options);");
      expect(source).toContain("export function hideElements(elements = [], options = {})");
      expect(source).toContain("hideElement(element, options)");
    }

    for (const source of [districtPopupModalHelpers, clientDistrictPopupModalHelpers]) {
      expect(source).not.toContain("DISTRICT_POPUP_RESOURCE_VISIBLE_CLASS");
      expect(source).not.toContain("setDistrictResourceTopbarVisible");
      expect(source).not.toContain("is-district-popup-resource-visible");
      expect(source).toContain("restoreFocusOnClose: false");
      expect(source).toContain("skipFocus: true");
      expect(source).toContain("lockScroll: !shouldAllowMainDistrictBackgroundScroll(element)");
      expect(source).toContain("bindMobileDistrictPopupBackgroundScroll(element)");
      expect(source).toContain("openOverlay(element, {");
      expect(source).toContain("element.hidden = false;");
      expect(source).toContain("element.hidden = true;");
      expect(source).toContain("closeOverlay(element, { restoreFocus: false });");
      expect(source).toContain("changed = hideDistrictPopupModal(element) || changed;");
    }

    for (const source of [buildingsPopupRuntime, clientBuildingsPopupRuntime]) {
      expect(source).toContain("closeOverlay(elements.buildingsPopup, { restoreFocus: false });");
      expect(source).toContain("openOverlay(elements.buildingsPopup, { type: \"modal\", ariaModal: true, restoreFocusOnClose: false });");
    }
  });

  it("keeps the mobile player profile below the visible resource bar", () => {
    expect(mainCss).toContain("Keep the player profile and active attack status compact without covering mobile resources.");
    expect(mainCss).toContain(":has(.player-popup-shell:not([hidden])) #game-header");
    expect(mainCss).toContain(":has(.player-popup-shell:not([hidden])) .game-resource-strip");
    expect(mainCss).toContain("padding: calc(var(--mobile-overlay-top-offset, var(--mobile-topbar-offset, 72px)) + 8px) 8px max(8px, env(safe-area-inset-bottom)) !important;");
    expect(mainCss).toContain("grid-template-columns: repeat(3, minmax(0, 1fr)) !important;");
    expect(mainCss).toContain("#police-action-result-modal-close::before");
    expect(mainCss).toContain("width: 18px !important;");
  });
});
