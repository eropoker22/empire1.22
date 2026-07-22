import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const root = process.cwd();
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");

describe("runtime main UI flow smoke guard", () => {
  it("keeps the boot path, critical anchors, and runtime facade wired together", async () => {
    const html = read("pages/game.html");
    const renderUiSource = read("page-assets/js/app/render-ui.js");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const runtime = await import("../../page-assets/js/app/runtime.js");
      const requiredAnchors = [
        'id="game-root"',
        'data-page="game"',
        'data-map-viewport',
        'data-map-canvas',
        'data-district-canvas',
        'data-player-profile-open',
        'data-player-popup',
        'data-player-popup-close',
        'data-topbar-clean-money',
        'data-topbar-dirty-money',
        'data-topbar-influence',
        'data-district-popup',
        'data-district-popup-buildings-list',
        'data-buildings-popup-open',
        'data-buildings-popup',
        'data-buildings-popup-detail',
        'data-building-action-feed',
        'data-spy-toast',
        'data-attack-toast',
        'data-attack-setup-popup',
        'data-spy-confirm-popup',
        'data-wanted-popup',
        'data-storage-popup'
      ];
      const requiredFacadeExports = [
        "bootstrapPage",
        "initRuntime",
        "refreshAllUi",
        "bindPlayerProfilePopup",
        "bindDistrictCanvas",
        "bindBuildingActionStatus",
        "bindStoragePopup",
        "bindSpyMissions",
        "bindAttackOrders",
        "renderResourcesPanel",
        "renderBattleReport",
        "showToast",
        "createDistrictGeometry",
        "getDistrictAtPoint"
      ];

      for (const marker of requiredAnchors) {
        expect(html).toContain(marker);
      }
      expect(html).toContain('data-gameplay-slice-polling="true"');
      expect(html).toContain('data-gameplay-slice-polling-interval-ms="5000"');
      for (const exportName of requiredFacadeExports) {
        expect(runtime[exportName]).toBeDefined();
      }

      expect(renderUiSource).toMatch(/from "\.\/runtime\.js(?:\?[^"]*)?"/u);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  }, 10000);

  it("keeps each extracted module importable for the core UI smoke path", async () => {
    const [
      geometry,
      buildingDisplayData,
      notifications,
      resourcesPanel,
      battleReportPanel,
      legacyStorage
    ] = await Promise.all([
      import("../../page-assets/js/app/map/mapGeometry.js"),
      import("../../page-assets/js/app/runtime/buildingDisplayData.js"),
      import("../../page-assets/js/app/ui/notifications.js"),
      import("../../page-assets/js/app/ui/resourcesPanel.js"),
      import("../../page-assets/js/app/ui/battleReportPanel.js"),
      import("../../page-assets/js/app/persistence/legacyStorage.js")
    ]);

    expect(geometry.createDistrictGeometry(1600, 980).districts).toHaveLength(161);
    expect(buildingDisplayData.DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME.Autosalon.length).toBeGreaterThan(0);
    expect(notifications.showToast).toBeTypeOf("function");
    expect(resourcesPanel.updateTopbarResources).toBeTypeOf("function");
    expect(battleReportPanel.renderBattleReport).toBeTypeOf("function");
    expect(legacyStorage.getStorageKey).toBeTypeOf("function");
  });

  it("does not reset persisted local-demo state during normal runtime initialization", () => {
    const runtimeSource = read("page-assets/js/app/runtime.js");
    const initRuntimeStart = runtimeSource.indexOf("function initRuntime(root = getDefaultRuntimeRoot()) {");
    const bootstrapPageStart = runtimeSource.indexOf("function bootstrapPage() {");
    const initRuntimeSource = runtimeSource.slice(initRuntimeStart, bootstrapPageStart);

    expect(initRuntimeStart).toBeGreaterThan(-1);
    expect(bootstrapPageStart).toBeGreaterThan(initRuntimeStart);
    expect(initRuntimeSource).not.toContain("forceGameHtmlRefreshLivePhase(resolvedRoot);");
    expect(initRuntimeSource).not.toContain("applyDevOnlyOnboardingStartState(resolvedRoot);");
    expect(initRuntimeSource).not.toContain("devOnlyDemoResetVersion");
  });

  it("keeps destroyed district popup reduced to a single message", () => {
    const runtimeSource = read("page-assets/js/app/runtime.js");
    const districtCssSource = read("page-assets/css/styles-district.css");

    expect(runtimeSource).toContain("setDestroyedDistrictPopupMode(true)");
    expect(runtimeSource).toContain("popup.dataset.overviewEnabled = isDistrictPopupOverviewEnabled ? \"true\" : \"false\";");
    expect(runtimeSource).toContain('notice.textContent = enabled ? "District zničen" : "";');
    expect(runtimeSource).toContain("return;");
    expect(districtCssSource).toContain('.district-popup-card[data-district-destroyed="true"] .district-popup-body > :not(.district-popup-destroyed-only)');
    expect(districtCssSource).toContain(".district-popup-destroyed-only");
  });

  it("opens only the police raid information window for districts under raid", () => {
    const runtimeSource = read("page-assets/js/app/runtime.js");
    const clientRuntimeSource = read("client/page-assets/js/app/runtime.js");

    for (const source of [runtimeSource, clientRuntimeSource]) {
      expect(source).toContain("const openPoliceRaidOnlyForDistrict = (district, policeAction = null) => {");
      expect(source).toMatch(/closePopup\(\);\r?\n    hideTooltip\(\);/u);
      expect(source).toContain('queueOrOpenResultModal(root, "police", {');
      expect(source).toContain("const appendStoredOwnedPoliceRaidAlert = () => {");
      expect(source).toContain('root.dataset.ownedPoliceRaidAlertOpened === "true"');
      expect(source).toContain("createOwnedDistrictPoliceRaidAlertPayload(district, activeOwnedPoliceAction)");
      expect(source).toContain("appendBuildingActionResultEntry(root, \"police\", payload, {");
      expect(source).toContain('title: "Probíhá policejní razie"');
      expect(source).toContain("scheduleStoredOwnedPoliceRaidAlert();");
      expect(source).toContain("return openPoliceRaidOnlyForDistrict(district, activePoliceAction);");
      expect(source).toMatch(/event\.stopPropagation\?\.\(\);\r?\n        openPoliceRaidOnlyForDistrict\(district, activePoliceAction\);\r?\n        return;/u);

      const clickBranchIndex = source.indexOf("const activePoliceAction = getDistrictPoliceAction(district.id);", source.indexOf('viewport.addEventListener("click"'));
      const openPopupIndex = source.indexOf("openPopup(district);", clickBranchIndex);
      const raidOnlyIndex = source.indexOf("openPoliceRaidOnlyForDistrict(district, activePoliceAction);", clickBranchIndex);

      expect(clickBranchIndex).toBeGreaterThan(-1);
      expect(raidOnlyIndex).toBeGreaterThan(clickBranchIndex);
      expect(openPopupIndex).toBeGreaterThan(raidOnlyIndex);
    }
  });

  it("feeds active district action countdowns into the popup action hub", () => {
    const runtimeSource = read("page-assets/js/app/runtime.js");
    const clientRuntimeSource = read("client/page-assets/js/app/runtime.js");

    for (const source of [runtimeSource, clientRuntimeSource]) {
      expect(source).toContain("const formatActionCountdownLabel = (remainingMs) => {");
      expect(source).toContain('return `Zbývá ${minutes}:${String(seconds).padStart(2, "0")}`;');
      expect(source).toContain("const getDistrictActionCountdowns = (districtId) => ({");
      expect(source).toContain('attack: findActiveActionCountdown(getStoredAttackOrders(), districtId, "resolveAt")');
      expect(source).toContain('occupy: findActiveActionCountdown(getStoredOccupyOrders(), districtId, "resolveAt")');
      expect(source).toContain('rob: findActiveActionCountdown(getStoredRobberyOrders(), districtId, "resolveAt")');
      expect(source).toContain('spy: findActiveActionCountdown(getResolvedSpyState().missions, districtId, "returnAt")');
      expect(source).toContain("const actionCountdowns = getDistrictActionCountdowns(district.id);");
      expect(source).toMatch(/resolvedActions,\r?\n\s+actionCountdowns,\r?\n\s+trapControlState/u);
    }
  });

  it("keeps the Buildings card closed on every game.html refresh", () => {
    for (const sourcePath of ["page-assets/js/app/runtime.js", "client/page-assets/js/app/runtime.js"]) {
      const source = read(sourcePath);

      expect(source).toMatch(/const shouldAutoOpenBuildingsPopupOnRefresh = \(\) => \{\r?\n    return false;\r?\n  \};/u);
      expect(source).not.toContain('const requested = params.get("openBuildings") || params.get("buildingsPopup") || "";');
      expect(source).not.toContain('return !resolveDevBuildingCardAutoOpenKey();');
    }
  });

  it("keeps foreign discovered district buildings from opening details", () => {
    const runtimeSource = read("page-assets/js/app/runtime.js");
    const clientRuntimeSource = read("client/page-assets/js/app/runtime.js");

    for (const source of [runtimeSource, clientRuntimeSource]) {
      const buildingsClickIndex = source.indexOf('popupBuildingsList.addEventListener("click"');
      const ownershipGuardIndex = source.indexOf("const currentPlayerOwnedDistrictIds = getCurrentPlayerOwnedDistrictIds(interactionState);", buildingsClickIndex);
      const openDetailIndex = source.indexOf("openDistrictBuildingDetail(selectedDistrict", buildingsClickIndex);

      expect(buildingsClickIndex).toBeGreaterThan(-1);
      expect(ownershipGuardIndex).toBeGreaterThan(buildingsClickIndex);
      expect(openDetailIndex).toBeGreaterThan(ownershipGuardIndex);
      expect(source).toContain('chipButton.dataset.districtBuildingInteractive === "false"');
    }
  });

  it("marks actionable mobile district popups for the raised phone position", () => {
    const runtimeSource = read("page-assets/js/app/runtime.js");
    const mobileCssSource = read("page-assets/css/styles-mobile-fixes.css");

    expect(runtimeSource).toContain('popup.dataset.mobilePosition = normalizedMode;');
    expect(runtimeSource).toContain('popupCard.dataset.mobilePosition = normalizedMode;');
    expect(runtimeSource).toContain('const hasEnabledDistrictAction = resolvedActions.some((action) => action.enabled);');
    expect(runtimeSource).toContain('isOwnedByCurrentPlayer || hasEnabledDistrictAction ? "raised" : "default"');
    expect(mobileCssSource).toContain('.district-popup-shell[data-district-popup][data-mobile-position="raised"]:not([hidden])');
    expect(mobileCssSource).toContain('--district-popup-mobile-raised-top: max(24px, calc(var(--mobile-topbar-offset, 72px) - 34px));');
    expect(mobileCssSource).toContain('padding-top: var(--district-popup-mobile-raised-top) !important;');
  });

  it("starts the trap move lock from every trap placement or move", () => {
    const runtimeSource = read("page-assets/js/app/runtime.js");
    const clientRuntimeSource = read("client/page-assets/js/app/runtime.js");

    for (const source of [runtimeSource, clientRuntimeSource]) {
      expect(source).toContain("const trapActionTimestamp = new Date().toISOString();");
      expect(source).toContain("armedAt: trapActionTimestamp");
      expect(source).toContain("movedAt: trapActionTimestamp");
      expect(source).not.toContain("armedAt: nextTrapState[selectedDistrict.id]?.armedAt || new Date().toISOString()");
    }
  });
});
