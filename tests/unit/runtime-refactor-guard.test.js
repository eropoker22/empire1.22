import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");

const gameHtml = () => read("pages/game.html");
const appSource = () => read("page-assets/js/app.js");
const renderUiSource = () => read("page-assets/js/app/render-ui.js");
const localDemoAdapterSource = () => read("page-assets/js/app/runtime/localDemoLegacyBootstrap.js");
const runtimeSource = () => read("page-assets/js/app/runtime.js");
const factoryPopupRuntimeSource = () => read("page-assets/js/app/runtime/factoryPopupRuntime.js");
const productionBuildingPopupRuntimeSource = () => read("page-assets/js/app/runtime/productionBuildingPopupRuntime.js");
const recipePanelSource = () => read("page-assets/js/app/ui/recipePanel.js");
const serverCommandAuthorityGuardSource = () => read("page-assets/js/app/runtime/serverCommandAuthorityGuard.js");

const collectSourceFiles = (relativeDirectory) => {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (/\.(?:html|js|mjs|ts|tsx)$/u.test(entry.name)) {
        files.push(entryPath);
      }
    }
  };

  const directory = resolve(root, relativeDirectory);
  if (existsSync(directory)) visit(directory);
  return files;
};

describe("runtime refactor guard", () => {
  it("keeps the temporary production compatibility rollback explicit", () => {
    expect(gameHtml()).toMatch(/type="module" src="\.\.\/page-assets\/js\/app-entry\.js(?:\?[^"]*)?"/u);
    expect(gameHtml()).not.toContain('src="../page-assets/js/app/runtime.js"');
    expect(appSource()).toMatch(/from "\.\/app\/runtime\.js\?v=[a-z0-9-]+"/u);
    expect(appSource()).toContain("bootstrapPage");
    expect(appSource()).toContain("mountLiveGameplayClient");
    expect(appSource()).not.toContain("serverAuthoritativePageController.js");
    expect(appSource()).not.toContain("render-ui.js");
    expect(renderUiSource()).toContain('from "./runtime/localDemoLegacyBootstrap.js"');
    expect(localDemoAdapterSource()).toMatch(/from "\.\.\/runtime\.js"/u);
  });

  it("keeps active authoritative recipe cards on the canonical renderer", () => {
    const productionSource = productionBuildingPopupRuntimeSource();
    const recipeSource = recipePanelSource();

    expect(productionSource).toContain("getServerProductionRecipeViewModel");
    expect(productionSource).toContain("buildingId: String(building.buildingId");
    expect(productionSource).not.toContain("serverLine: line");
    expect(recipeSource).not.toContain("serverPharmacyRecipeCard.js");
    expect(recipeSource).not.toContain("serverDrugLabRecipeCard.js");
    expect(recipeSource).not.toContain("viewModel.serverLine");
  });

  it("keeps hosted building inputs on the shared visible action path", () => {
    const source = runtimeSource();

    expect(source).toContain("createServerBuildingActionExecutionPresentation");
    expect(source).toContain("actionInput: actionExecution.inputValues");
    expect(source).toContain("submitServerBuildingActionCommandBridge");
    expect(source).toContain("submitCanonicalServerGameplayCommand");
    expect(source).not.toContain("submitServerBuildingSurfaceAction");
    expect(source).not.toContain("handleCanonicalServerGameplaySurfaceAction");
    expect(source).not.toContain("tento sdílený detail zatím nenabízí");
  });

  it("keeps dormant duplicate presentation paths removed", () => {
    const factorySource = factoryPopupRuntimeSource();
    const productionSource = productionBuildingPopupRuntimeSource();
    const removedPaths = [
      "apps/client/src/features/building-panel/building-detail-popup.ts",
      "page-assets/js/app/presentation/serverAuthoritativePageController.js",
      "page-assets/css/styles-server-defeat-notice.css",
      "page-assets/js/app/ui/serverDefeatNoticeController.js",
      "page-assets/js/app/ui/serverDefeatNoticeViewModel.js",
      "page-assets/js/app/ui/serverGameplayBuildingActionController.js",
      "page-assets/js/app/ui/serverGameplayBuildingDetailController.js",
      "page-assets/js/app/ui/serverGameplayBuildingShortcutController.js",
      "page-assets/js/app/ui/serverGameplayDistrictController.js",
      "page-assets/js/app/ui/serverGameplayDistrictEventBindings.js",
      "page-assets/js/app/ui/serverGameplayDistrictSurfaceActionDispatcher.js",
      "page-assets/js/app/ui/serverGameplayLeaderboardController.js",
      "page-assets/js/app/ui/serverGameplayLeaderboardElements.js",
      "page-assets/js/app/ui/serverGameplayLeaderboardView.js",
      "page-assets/js/app/ui/serverGameplayLeaderboardViewModel.js",
      "page-assets/js/app/ui/serverGameplayLobbyController.js",
      "page-assets/js/app/ui/serverGameplayLobbySession.js",
      "page-assets/js/app/ui/serverGameplayMarketCallbacks.js",
      "page-assets/js/app/ui/serverGameplayMarketController.js",
      "page-assets/js/app/ui/serverGameplayMarketViewModel.js",
      "page-assets/js/app/ui/serverGameplayOperationReportFormatting.js",
      "page-assets/js/app/ui/serverGameplayPoliceRaidController.js",
      "page-assets/js/app/ui/serverGameplayProfileController.js",
      "page-assets/js/app/ui/serverGameplayProductionBuildingController.js",
      "page-assets/js/app/ui/serverGameplayProductionBuildingView.js",
      "page-assets/js/app/ui/serverGameplayReportController.js",
      "page-assets/js/app/ui/serverGameplayReportFormatting.js",
      "page-assets/js/app/ui/serverGameplayReportViewModel.js",
      "page-assets/js/app/ui/serverGameplayResourceController.js",
      "page-assets/js/app/ui/serverGameplaySettingsController.js",
      "page-assets/js/app/ui/serverGameplayStatusController.js",
      "page-assets/js/app/ui/serverGameplayStatusViewModel.js",
      "page-assets/js/app/ui/serverGameplayStorageController.js",
      "page-assets/js/app/ui/serverGameplayUiController.js",
      "page-assets/js/app/ui/serverGameplayWantedPoliceController.js",
      "page-assets/js/app/ui/serverGameplayWantedPoliceElements.js",
      "page-assets/js/app/ui/serverGameplayWantedPoliceViewModel.js",
      "page-assets/js/app/ui/serverPharmacyRecipeCard.js",
      "page-assets/js/app/ui/serverDrugLabRecipeCard.js",
      "page-assets/js/app/ui/serverProductionPopupOwnership.js"
    ];

    expect(factorySource).not.toContain("serverProductionPopupOwnership.js");
    expect(factorySource).not.toContain("isServerControllerOwner");
    expect(productionSource).not.toContain("serverProductionPopupOwnership.js");
    expect(productionSource).not.toContain("isServerControllerOwner");
    for (const relativePath of removedPaths) {
      expect(existsSync(resolve(root, relativePath)), relativePath).toBe(false);
    }

    const sourceFiles = [
      "apps/client/src",
      "netlify",
      "page-assets/js",
      "pages",
      "scripts"
    ].flatMap(collectSourceFiles);
    const removedFileNames = removedPaths.map((relativePath) => relativePath.split("/").at(-1));
    const danglingReferences = sourceFiles.flatMap((sourceFile) => {
      const source = readFileSync(sourceFile, "utf8");
      return removedFileNames
        .filter((fileName) => source.includes(fileName))
        .map((fileName) => `${relative(root, sourceFile).replaceAll("\\", "/")} -> ${fileName}`);
    });

    expect(danglingReferences).toEqual([]);
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

  it("imports the explicit local-demo facade without critical console errors", () => {
    const probe = spawnSync(process.execPath, [
      "--input-type=module",
      "--eval",
      `
        const renderUi = await import("./page-assets/js/app/render-ui.js");
        const runtime = await import("./page-assets/js/app/runtime.js");
        process.stdout.write(JSON.stringify({
          renderUi: Object.keys(renderUi),
          runtime: Object.keys(runtime)
        }));
      `
    ], {
      cwd: root,
      encoding: "utf8",
      timeout: 8_000
    });
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

    expect(probe.error).toBeUndefined();
    expect(probe.status).toBe(0);
    expect(probe.stderr).toBe("");
    const moduleExports = JSON.parse(probe.stdout);
    for (const exportName of requiredRenderUiExports) {
      expect(moduleExports.renderUi).toContain(exportName);
    }
    for (const exportName of requiredRuntimeExports) {
      expect(moduleExports.runtime).toContain(exportName);
    }
  });

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
    const authorityGuardSource = serverCommandAuthorityGuardSource();

    expect(source).toContain("function isServerAuthoritativeGameplayRuntimeReady()");
    expect(source).toContain("getGameplayExecutionMode({");
    expect(source).toContain("canSubmitServerGameplayCommand({");
    expect(authorityGuardSource).toContain("options.onboardingSandboxActive !== true");
    expect(authorityGuardSource).toContain("options.executionMode === GAMEPLAY_EXECUTION_MODES.serverAuthoritative");
    expect(source).not.toContain('document.body?.dataset?.gameplayRuntime === "server-authoritative-ready"');
    expect(source).toContain("latestGameplaySliceReadModel?.player?.playerId");
    expect(source).toContain("Legacy lokální robbery výsledek je vypnutý.");
    expect(source).toContain("Legacy lokální defense loadout je vypnutý.");
  });
});
