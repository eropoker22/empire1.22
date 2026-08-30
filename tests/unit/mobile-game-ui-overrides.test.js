import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n/gu, "\n");

describe("mobile game UI overrides", () => {
  const css = read("page-assets/css/styles.css");
  const buildingCss = read("page-assets/css/styles-building-modals.css");
  const districtCss = read("page-assets/css/styles-district.css");
  const mobileFixes = read("page-assets/css/styles-mobile-fixes.css");
  const html = read("pages/game.html");
  const runtime = read("page-assets/js/app/runtime.js");
  const serverCooldownStreetNews = read("page-assets/js/app/runtime/serverCooldownStreetNews.js");
  const mobileLayoutRuntime = read("page-assets/js/app/mobile-layout-runtime.js");
  const actionResultsCss = read("page-assets/css/styles-action-results.css");
  const bountyCss = read("page-assets/css/styles-bounty.css");
  const rumorInboxRuntime = read("page-assets/js/app/ui/rumorInboxModal.js");

  it("keeps Buildings transparent black and production buildings full-height on phones", () => {
    const mobileBlockStart = css.indexOf("/* Buildings: transparent black mobile glass");
    const mobileBlockEnd = css.indexOf("/* Factory metrics keep each label", mobileBlockStart);
    const mobileBlock = css.slice(mobileBlockStart, mobileBlockEnd);

    expect(mobileBlockStart).toBeGreaterThan(-1);
    expect(mobileBlockEnd).toBeGreaterThan(mobileBlockStart);
    expect(mobileBlock).toContain("#buildings-modal.buildings-popup-shell:not([hidden]) .buildings-popup-card.buildings-modal__content");
    expect(mobileBlock).toContain("rgba(5, 9, 15, 0.86)");
    expect(mobileBlock).toContain(".pharmacy-popup-shell");
    expect(mobileBlock).toContain(".druglab-popup-shell");
    expect(mobileBlock).toContain(".factory-popup-shell");
    expect(mobileBlock).toContain(".armory-popup-shell");
    expect(mobileBlock).toContain("height: var(--mobile-locked-vh, 100svh) !important;");

    const safeAreaStart = css.indexOf("/* Final phone production-building contract");
    const safeAreaBlock = css.slice(safeAreaStart);
    expect(safeAreaStart).toBeGreaterThan(-1);
    expect(safeAreaBlock).toContain("--production-building-phone-top: 0px;");
    expect(safeAreaBlock).toContain("--production-building-phone-bottom: 0px;");
    expect(safeAreaBlock).toContain("background: rgba(1, 4, 10, 0.88) !important;");
    expect(safeAreaBlock).toContain('.district-building-detail-shell[data-building-mechanics-type="drug-lab"]');
    expect(safeAreaBlock).toContain("height: calc(var(--mobile-locked-vh, 100svh) - var(--production-building-phone-top) - var(--production-building-phone-bottom)) !important;");
    expect(safeAreaBlock).toContain("border-radius: 0 !important;");
    expect(safeAreaBlock).toContain("--standard-building-phone-top: max(14px, env(safe-area-inset-top));");
  });

  it("keeps spy resources visible and factory metric values right-aligned", () => {
    expect(css).toContain("game-modal-scroll-locked.game-spy-confirm-open .game-resource-strip");
    expect(css).toContain(":has(#spy-confirm-modal:not(.hidden):not([hidden])) > #game-header");
    expect(css).toContain("game-modal-scroll-locked:has(#spy-confirm-modal:not(.hidden):not([hidden])) > #game-header");
    expect(css).toContain("z-index: 2147482 !important;");
    expect(css).toContain("--spy-resource-bar-height");
    expect(css).toContain("--spy-confirm-window-safe-top");
    const spyResourceLayerStart = css.indexOf("html body.game-body.game-modal-scroll-locked.game-spy-confirm-open :is(");
    const spyResourceLayer = css.slice(spyResourceLayerStart, spyResourceLayerStart + 520);
    expect(spyResourceLayerStart).toBeGreaterThan(-1);
    expect(spyResourceLayer).toContain("z-index: 26050 !important;");
    expect(mobileLayoutRuntime).toContain("const hasOpenSpyConfirm = openOverlays.some((element) => element.id === \"spy-confirm-modal\");");
    expect(mobileLayoutRuntime).toContain("root.classList.toggle(MOBILE_SPY_CONFIRM_OPEN_CLASS, hasOpenSpyConfirm);");
    expect(css).toContain(".factory-popup-card.building-detail-modal__content .factory-slot .drug-production-slot__metrics");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr)) !important;");
    expect(css).toContain(".factory-slot .drug-production-slot__metric:not(.drug-production-slot__metric--supplies)");
    expect(css).toContain("justify-content: space-between !important;");
    expect(css).toContain("margin-left: auto !important;");
    expect(html).toContain('data-spy-confirm-button>Vyslat špeha</button>');
  });

  it("keeps the phone rumor close control clear of compact neon trash actions", () => {
    expect(rumorInboxRuntime).toContain('class="rumor-inbox-trash-icon"');
    expect(rumorInboxRuntime).not.toContain('"rumor-inbox-delete-all", "🗑"');
    expect(actionResultsCss).toContain("grid-template-columns: minmax(0, 1fr) auto auto;");
    expect(actionResultsCss).toContain("right: 58px;");
    expect(actionResultsCss).toContain("--rumor-trash-rgb: 57, 255, 136;");
    expect(actionResultsCss).toContain(".rumor-inbox-message__delete .rumor-inbox-trash-icon");
    expect(rumorInboxRuntime).toContain("const MAX_VISIBLE_RUMORS = 7;");
    expect(actionResultsCss).toContain("--rumor-visible-height");
    expect(actionResultsCss).toContain("scrollbar-width: none;");
  });

  it("renders active bounties as compact two-column contract cards on phones", () => {
    expect(bountyCss).toContain('#bounty-modal[data-bounty-tab="active"] .bounty-board__table tbody tr');
    expect(bountyCss).toContain('"target reward"');
    expect(bountyCss).toContain('"type district"');
    expect(bountyCss).toContain('"status status"');
    expect(bountyCss).toContain("grid-template-columns: minmax(0, 1fr) minmax(92px, 0.42fr);");
    expect(bountyCss).toContain("content: attr(data-label);");
    expect(bountyCss).toContain("overflow-wrap: anywhere;");
    expect(bountyCss).toContain("scrollbar-gutter: stable;");
  });

  it("places faction modifiers beside live action and building values", () => {
    expect(html).toContain('data-faction-passive-inline-context="attack-strength"');
    expect(html).toContain('data-faction-passive-inline-context="spy-success"');
    expect(css).toContain(".faction-passive-inline--action-card");
    expect(css).toContain(".faction-passive-inline--building");
  });

  it("keeps mobile market labels compact and quantity readable", () => {
    expect(html).toContain('data-market-title data-mobile-title="Market"');
    expect(html).toContain('data-market-tab="market" data-mobile-label="Market" role="tab" aria-selected="true">Market</button>');
    expect(css).toContain(".market-popup-row__quantity-controls");
    expect(css).toContain(".market-popup-row__quantity-step");
    expect(css).toContain(".market-popup-row__quantity-wrap");
    expect(css).toContain("display: contents !important;");
    expect(css).toContain(".market-popup-dashboard__chip[data-market-dashboard-tone=\"stock\"] strong");
    expect(css).toContain("color: #facc15 !important;");
    expect(css).toContain("-webkit-text-fill-color: #ffffff !important;");
    expect(mobileFixes).toContain("grid-template-columns: minmax(0, 1fr) 82px !important;");
    expect(mobileFixes).toContain("width: 82px !important;");
    expect(mobileFixes).toContain("text-overflow: ellipsis !important;");
  });

  it("lays out the mobile gang profile as three compact stats and two full rows", () => {
    expect(css).toContain("#profile-gang-card.right-panel-card .profile-row--members");
    expect(css).toContain("#profile-gang-card.right-panel-card .profile-row--wanted");
    expect(css).toContain("#profile-gang-card.right-panel-card .profile-row--districts");
    expect(css).toContain("grid-column: 1 / -1 !important;");
    expect(css).toContain("grid-template-rows: auto minmax(18px, auto) !important;");
  });

  it("keeps district popup close controls out of the mobile action-button positioning rule", () => {
    const actionControlsStart = css.indexOf("/* Mobile action controls");
    const actionControlsEnd = css.indexOf("/* Gang profile", actionControlsStart);
    const actionControls = css.slice(actionControlsStart, actionControlsEnd);

    expect(actionControlsStart).toBeGreaterThan(-1);
    expect(actionControlsEnd).toBeGreaterThan(actionControlsStart);
    expect(actionControls).toContain("button:not(:disabled):not([data-district-popup-close])");
    expect(actionControls).toContain(":not(.district-atmosphere-window__close)");
    expect(actionControls).toContain(":not(.attack-setup-popup-close)");
    expect(actionControls).toContain(":not(.modal__close)");
  });

  it("never renders the district close control above an open atmosphere image", () => {
    expect(districtCss).toContain('.district-popup-card[data-district-atmosphere-open="true"] > .district-popup-close');
    expect(districtCss).toMatch(
      /district-atmosphere-open="true"[^{}]*district-popup-close,[\s\S]*?\{[\s\S]*?display: none !important;/u
    );
  });

  it("does not classify a wide touch-capable desktop as the mobile Buildings layout", () => {
    expect(css).toContain("@media (min-width: 721px) {\n  html body.game-body .district-building-detail-card.building-detail-modal__content");
    expect(css).toContain("@media (max-width: 780px), (max-width: 900px) and (hover: none) and (pointer: coarse)");
    expect(mobileFixes).toContain("@media (max-width: 720px), (max-width: 900px) and (hover: none) and (pointer: coarse)");
    expect(mobileFixes).not.toMatch(
      /@media \(max-width: 720px\), \(hover: none\) and \(pointer: coarse\) \{\s*html body #buildings-modal/u
    );
    expect(buildingCss).toContain("grid-template-columns: repeat(auto-fit, minmax(152px, 1fr));");
  });

  it("removes source and chance rows from occupation info windows", () => {
    const resultStart = runtime.indexOf("const occupyResultPayload = {");
    const resultEnd = runtime.indexOf("syncBuildingActionSource(root", resultStart);
    const occupyResult = runtime.slice(resultStart, resultEnd);

    expect(occupyResult).not.toContain('label: "Zdroj"');
    expect(occupyResult).not.toContain('label: "Šance"');
    expect(html).not.toContain("data-occupy-confirm-source");
  });

  it("keeps restaurant special actions visible on desktop", () => {
    expect(css).toContain('data-building-mechanics-type="restaurant"] .district-building-detail-card.building-detail-modal__content');
    expect(css).toContain("max-height: min(92vh, 920px) !important;");
    expect(css).toContain("overflow-y: auto !important;");
    expect(css).toContain("margin-top: 24px !important;");
  });

  it("adds the current player's active occupation to Street News", () => {
    expect(serverCooldownStreetNews).toContain('new Set(["spy", "robbery", "attack", "occupy"])');
    expect(serverCooldownStreetNews).toContain("effectPlayerId !== playerId");
    expect(runtime).toContain("function collectServerMissionCooldownStreetNewsEntries(now)");
    expect(runtime).toContain(': "Obsazení";');
    expect(runtime).toContain("...collectServerMissionCooldownStreetNewsEntries(now)");
  });
});
