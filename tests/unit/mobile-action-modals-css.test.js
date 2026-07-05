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

  it("keeps the onboarding launch button attached to the leaderboard row on mobile", () => {
    expect(mobileRuntime).toContain('const leaderboardLaunchRow = leaderboardCard?.closest(".leaderboard-launch-row");');
    expect(mobileRuntime).toContain("const leaderboardBlock = leaderboardLaunchRow || leaderboardCard;");
    expect(mobileRuntime).toContain('const streetNewsAnchor = documentObj.getElementById("mobile-alliance-card-anchor");');
    expect(mobileRuntime).toContain("moveElementAfterAnchor(streetNewsAnchor, allianceChatCard);");
    expect(mobileRuntime).toContain("moveElementAfterAnchor(allianceChatCard, globalChatCard);");
    expect(mobileRuntime).toContain("moveElementAfterAnchor(globalChatCard, leaderboardBlock);");
    expect(mobileRuntime).not.toContain("moveElementAfterAnchor(globalChatCard, leaderboardCard);");
    for (const stylesheet of [css, clientCss]) {
      expect(stylesheet).toContain(".leaderboard-launch-row,\n  #leaderboard-card");
      expect(stylesheet).toContain(".leaderboard-launch-row #leaderboard-card");
      expect(stylesheet).toContain("grid-column: auto !important;");
      expect(stylesheet).toContain(".leaderboard-launch-row #onboarding-launch-button");
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
    expect(onboardingCss).toContain("inset: auto 12px calc(76px + env(safe-area-inset-bottom, 0px)) 12px;");
    expect(onboardingCss).toContain("max-height: min(64dvh, calc(100dvh - 148px));");
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
      expect(stylesheet).toContain("html body.game-modal-scroll-locked .district-popup-shell:not([hidden]) .district-popup-card");
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
    }
    for (const stylesheet of [mainCss, clientMainCss]) {
      expect(stylesheet).not.toContain("Final stable page background: opening game cards must not visually change the page behind them.");
      expect(stylesheet).not.toContain("Final stable card backdrop: opening cards must not dim or shift the page behind them.");
      expect(stylesheet).not.toContain("visibility: visible !important;\n  opacity: 1 !important;\n  filter: none !important;\n  transform: none !important;");
      expect(stylesheet).toContain("--district-mobile-resource-clearance: 0px;");
      expect(stylesheet).toContain("--mobile-overlay-top-offset: 0px !important;");
      expect(stylesheet).not.toContain("is-district-popup-resource-visible");
      expect(stylesheet).not.toContain("game-modal-scroll-locked:has(.district-popup-shell:not([hidden]))");
      expect(stylesheet).toContain("html body.game-body.game-modal-scroll-locked #game-header");
      expect(stylesheet).toContain("visibility: hidden !important;");
      expect(stylesheet).toContain("opacity: 0 !important;");
      expect(stylesheet).toContain("padding-top: var(--district-mobile-resource-clearance, 0px) !important;");
    }
    expect(mobileRuntime).toContain('const MOBILE_OVERLAY_SELECTOR = [');
    expect(mobileRuntime).toContain('".district-popup-shell",');
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
      expect(source).toContain("body.style.width = isViewportWidthScrollLock");
      expect(source).toContain("!isViewportWidthScrollLock && scrollbarWidth > 0");
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
      expect(source).toContain("const existingIndex = overlayStack.findLastIndex");
      expect(source).toContain("const hadEntry = index >= 0;");
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
});
