import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const root = process.cwd();
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");

const gameHtml = () => read("pages/game.html");
const appSource = () => read("page-assets/js/app.js");
const renderUiSource = () => read("page-assets/js/app/render-ui.js");
const runtimeSource = () => read("page-assets/js/app/runtime.js");

describe("runtime refactor guard", () => {
  it("keeps the canonical module load path intact", () => {
    expect(gameHtml()).toMatch(/type="module" src="\.\.\/page-assets\/js\/app\.js(?:\?[^"]*)?"/u);
    expect(gameHtml()).not.toContain('src="../page-assets/js/app/runtime.js"');
    expect(appSource()).toContain('from "./app/render-ui.js"');
    expect(renderUiSource()).toContain('from "./runtime.js"');
  });

  it("does not introduce inline HTML event handlers for the game shell", () => {
    const inlineHandlers = Array.from(gameHtml().matchAll(/\s(on[a-z]+)=/giu)).map((match) => match[1]);
    expect(inlineHandlers).toEqual([]);
  });

  it("keeps critical game DOM anchors available", () => {
    const html = gameHtml();
    const requiredMarkers = [
      'id="game-root"',
      'data-page="game"',
      'data-mount-role="map"',
      "data-map-viewport",
      "data-map-canvas",
      "data-district-canvas",
      "data-player-profile-open",
      "data-player-popup",
      "data-player-popup-close",
      "data-buildings-popup-open",
      "data-buildings-popup",
      "data-buildings-popup-close",
      "data-buildings-popup-types",
      "data-buildings-popup-detail",
      "data-building-action-feed",
      "data-topbar-clean-money",
      "data-topbar-dirty-money",
      "data-topbar-influence",
      "data-storage-popup-open",
      "data-nav-settings",
      "data-nav-logout"
    ];

    for (const marker of requiredMarkers) {
      expect(html).toContain(marker);
    }
  });

  it("imports the runtime facade without critical console errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const renderUi = await import("../../page-assets/js/app/render-ui.js");
      const runtime = await import("../../page-assets/js/app/runtime.js");
      const requiredRenderUiExports = [
        "PAGE_ROOT_SELECTOR",
        "bootstrapPage",
        "bindDistrictCanvas",
        "bindPlayerProfilePopup",
        "bindBuildingActionStatus",
        "bindStoragePopup",
        "bindMarketPopup",
        "bindGangWantedStatus",
        "bindSpyMissions",
        "bindAttackOrders",
        "bindArmoryPopup",
        "bindDrugLabPopup",
        "bindFactoryPopup",
        "bindPharmacyPopup",
        "showSpyToast",
        "showAttackToast",
        "showRobberyToast"
      ];
      const requiredRuntimeExports = [
        ...requiredRenderUiExports,
        "bindRobberyOrders",
        "clearNotifications",
        "completeAttackOrder",
        "completeRobberyOrder",
        "completeSpyMission",
        "renderBattleReport",
        "renderResourcesPanel",
        "renderStorageList",
        "showError",
        "showSuccess",
        "showToast",
        "showWarning",
        "updateTopbarResources"
      ];

      for (const exportName of requiredRenderUiExports) {
        expect(renderUi[exportName]).toBeDefined();
      }
      for (const exportName of requiredRuntimeExports) {
        expect(runtime[exportName]).toBeDefined();
      }
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  }, 10000);

  it("keeps profile popup and building panel binding contracts in runtime", () => {
    const source = runtimeSource();
    const marketPopupSource = read("page-assets/js/app/runtime/marketPopupRuntime.js");
    const buildingsPopupSource = read("page-assets/js/app/runtime/buildingsPopupRuntime.js");
    expect(source).toContain("createRuntimePopupBinders");
    expect(source).toContain("createMarketPopupRuntime");
    expect(marketPopupSource).toContain('openButton.addEventListener("click", openPopup);');
    expect(source).toContain("createBuildingsPopupRuntime");
    expect(source).toContain("function bindDistrictCanvas(root)");
    expect(source).toContain('buildingsPopupOpenButton.addEventListener("click", openBuildingsPopup);');
    expect(source).toContain("const bindBuildingsPopupTap = (mount, handler) =>");
    expect(source).toContain("if (nextType !== activeBuildingsDistrictType)");
    expect(buildingsPopupSource).toContain("elements.buildingsPopup.hidden = false;");
    expect(buildingsPopupSource).toContain("elements.buildingsPopup.hidden = true;");
  });

  it("keeps required legacy window bridge names present", () => {
    const source = [
      runtimeSource(),
      read("page-assets/js/app/alliance-runtime.js"),
      read("page-assets/js/app/bounty-runtime.js"),
      read("page-assets/js/app/boost-runtime.js"),
      read("page-assets/js/client-assets/gameplay-slice-client.js"),
      read("page-assets/js/admin-assets/admin-slice-demo.js")
    ].join("\n");

    const requiredGlobals = [
      "window.empireStreetsPage",
      "window.empireStreetsDistrictState",
      "window.empireStreetsAllianceState",
      "window.empireStreetsBountyState",
      "window.Empire",
      "window.Empire.Map",
      "window.Empire.openBountyModalShortcut",
      "window.EmpireGameplaySliceClient",
      "window.EmpireAdminSliceDemo"
    ];

    for (const globalName of requiredGlobals) {
      expect(source).toContain(globalName);
    }
  });

  it("blocks legacy authoritative robbery and defense mutations when server slice is ready", () => {
    const source = runtimeSource();

    expect(source).toContain("function isServerAuthoritativeGameplayRuntimeReady()");
    expect(source).toContain("getGameplayExecutionMode({");
    expect(source).toContain("selectedMode === GAMEPLAY_EXECUTION_MODES.serverAuthoritative");
    expect(source).not.toContain('document.body?.dataset?.gameplayRuntime === "server-authoritative-ready"');
    expect(source).toContain("latestGameplaySliceReadModel?.player?.playerId");
    expect(source).toContain("Legacy lokální robbery výsledek je vypnutý.");
    expect(source).toContain("Legacy lokální defense loadout je vypnutý.");
  });
});
