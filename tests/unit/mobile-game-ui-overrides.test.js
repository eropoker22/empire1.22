import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n/gu, "\n");

describe("mobile game UI overrides", () => {
  const css = read("page-assets/css/styles.css");
  const html = read("pages/game.html");
  const runtime = read("page-assets/js/app/runtime.js");

  it("keeps Buildings transparent black and production buildings full-height only on phones", () => {
    const mobileBlock = css.slice(css.lastIndexOf("@media (max-width: 720px)"));

    expect(mobileBlock).toContain("#buildings-modal.buildings-popup-shell:not([hidden]) .buildings-popup-card.buildings-modal__content");
    expect(mobileBlock).toContain("rgba(5, 9, 15, 0.86)");
    expect(mobileBlock).toContain(".pharmacy-popup-shell");
    expect(mobileBlock).toContain(".druglab-popup-shell");
    expect(mobileBlock).toContain(".factory-popup-shell");
    expect(mobileBlock).toContain(".armory-popup-shell");
    expect(mobileBlock).toContain("height: var(--mobile-locked-vh, 100svh) !important;");
  });

  it("keeps spy resources visible and factory metric values right-aligned", () => {
    expect(css).toContain(":has(#spy-confirm-modal:not(.hidden):not([hidden])) .game-resource-strip");
    expect(css).toContain("--spy-confirm-window-safe-top");
    expect(css).toContain(".factory-popup-card.building-detail-modal__content .factory-slot .drug-production-slot__metrics");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr)) !important;");
    expect(css).toContain(".factory-slot .drug-production-slot__metric:not(.drug-production-slot__metric--supplies)");
    expect(css).toContain("justify-content: space-between !important;");
    expect(css).toContain("margin-left: auto !important;");
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
  });

  it("lays out the mobile gang profile as three compact stats and two full rows", () => {
    expect(css).toContain("#profile-gang-card.right-panel-card .profile-row--members");
    expect(css).toContain("#profile-gang-card.right-panel-card .profile-row--wanted");
    expect(css).toContain("#profile-gang-card.right-panel-card .profile-row--districts");
    expect(css).toContain("grid-column: 1 / -1 !important;");
    expect(css).toContain("grid-template-rows: auto minmax(18px, auto) !important;");
  });

  it("removes source and chance rows from occupation info windows", () => {
    const resultStart = runtime.indexOf("const occupyResultPayload = {");
    const resultEnd = runtime.indexOf("syncBuildingActionSource(root", resultStart);
    const occupyResult = runtime.slice(resultStart, resultEnd);

    expect(occupyResult).not.toContain('label: "Zdroj"');
    expect(occupyResult).not.toContain('label: "Šance"');
    expect(html).not.toContain("data-occupy-confirm-source");
  });
});
