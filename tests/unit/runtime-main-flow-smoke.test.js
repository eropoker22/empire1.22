import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const root = process.cwd();
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");
const [
  runtime,
  geometry,
  buildingDisplayData,
  notifications,
  resourcesPanel,
  battleReportPanel,
  legacyStorage,
  { GAMEPLAY_EXECUTION_MODES }
] = await Promise.all([
  import("../../page-assets/js/app/runtime.js"),
  import("../../page-assets/js/app/map/mapGeometry.js"),
  import("../../page-assets/js/app/runtime/buildingDisplayData.js"),
  import("../../page-assets/js/app/ui/notifications.js"),
  import("../../page-assets/js/app/ui/resourcesPanel.js"),
  import("../../page-assets/js/app/ui/battleReportPanel.js"),
  import("../../page-assets/js/app/persistence/legacyStorage.js"),
  import("../../page-assets/js/app/runtime/gameplayExecutionMode.js")
]);

describe("runtime main UI flow smoke guard", () => {
  it("keeps the boot path, critical anchors, and runtime facade wired together", () => {
    const html = read("pages/game.html");
    const appSource = read("page-assets/js/app.js");
    const localDemoFacade = read("page-assets/js/app/render-ui.js");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
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
        "destroyRuntime",
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
      expect(html).not.toContain("data-gameplay-slice-polling-interval-ms");
      expect(read("apps/client/src/browser/gameplay-slice-timing.ts"))
        .toContain("GAMEPLAY_SLICE_STABLE_POLL_INTERVAL_MS = 10_000");
      for (const exportName of requiredFacadeExports) {
        expect(runtime[exportName]).toBeDefined();
      }

      expect(appSource).toMatch(/from "\.\/app\/runtime\.js\?v=[a-z0-9-]+"/u);
      expect(appSource).toContain("bootstrapPage");
      expect(appSource).toContain("mountLiveGameplayClient");
      expect(localDemoFacade).toContain('from "./runtime/localDemoLegacyBootstrap.js"');
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  }, 10000);

  it("keeps each extracted module importable for the core UI smoke path", () => {
    expect(geometry.createDistrictGeometry(1600, 980).districts).toHaveLength(161);
    expect(buildingDisplayData.DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME.Autosalon.length).toBeGreaterThan(0);
    expect(notifications.showToast).toBeTypeOf("function");
    expect(resourcesPanel.updateTopbarResources).toBeTypeOf("function");
    expect(battleReportPanel.renderBattleReport).toBeTypeOf("function");
    expect(legacyStorage.getStorageKey).toBeTypeOf("function");
  });

  it("fails closed instead of opening local building UI for a cold hosted slice", () => {
    const {
      dispatchBuildingDetailOpenByAuthority,
      resolveBuildingRuntimeExecutionMode,
      selectBuildingPresentationByAuthority
    } = runtime;
    const district = { id: 7 };
    const getLocalDemoPresentation = vi.fn(() => ({ source: "local-demo" }));
    const getServerAuthoritativePresentation = vi.fn(() => ({ source: "server-authoritative" }));
    const openLocalDemo = vi.fn(() => true);
    const openServerAuthoritative = vi.fn(() => true);
    const onUnavailable = vi.fn();

    expect(resolveBuildingRuntimeExecutionMode({
      executionMode: GAMEPLAY_EXECUTION_MODES.serverAuthoritative,
      serverReady: false
    })).toBe(GAMEPLAY_EXECUTION_MODES.unavailable);
    expect(selectBuildingPresentationByAuthority({
      executionMode: GAMEPLAY_EXECUTION_MODES.serverAuthoritative,
      serverReady: false,
      district,
      getLocalDemoPresentation,
      getServerAuthoritativePresentation
    })).toBeNull();
    expect(dispatchBuildingDetailOpenByAuthority({
      executionMode: GAMEPLAY_EXECUTION_MODES.serverAuthoritative,
      serverReady: false,
      openLocalDemo,
      openServerAuthoritative,
      onUnavailable
    })).toBe(false);
    expect(getLocalDemoPresentation).not.toHaveBeenCalled();
    expect(getServerAuthoritativePresentation).not.toHaveBeenCalled();
    expect(openLocalDemo).not.toHaveBeenCalled();
    expect(openServerAuthoritative).not.toHaveBeenCalled();
    expect(onUnavailable).toHaveBeenCalledOnce();

    expect(selectBuildingPresentationByAuthority({
      executionMode: GAMEPLAY_EXECUTION_MODES.localDemo,
      serverReady: false,
      district,
      getLocalDemoPresentation,
      getServerAuthoritativePresentation
    })).toEqual({ source: "local-demo" });
    expect(getLocalDemoPresentation).toHaveBeenCalledWith(district);

    expect(dispatchBuildingDetailOpenByAuthority({
      executionMode: GAMEPLAY_EXECUTION_MODES.serverAuthoritative,
      serverReady: true,
      openLocalDemo,
      openServerAuthoritative,
      onUnavailable
    })).toBe(true);
    expect(openServerAuthoritative).toHaveBeenCalledOnce();
    expect(openLocalDemo).not.toHaveBeenCalled();
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

    for (const source of [runtimeSource]) {
      expect(source).toContain("const openPoliceRaidOnlyForDistrict = (district, policeAction = null) => {");
      expect(source).toMatch(/closePopup\(\);\r?\n    hideTooltip\(\);/u);
      expect(source).toContain('queueOrOpenResultModal(root, "police", {');
      expect(source).toContain("const appendStoredOwnedPoliceRaidAlert = () => {");
      expect(source).toContain('root.dataset.ownedPoliceRaidAlertOpened === "true"');
      expect(source).toContain("createOwnedDistrictPoliceRaidAlertPayload(district, activeOwnedPoliceAction)");
      expect(source).toContain("appendBuildingActionResultEntry(root, \"police\", payload, {");
      expect(source).toContain('title: "Dopady razie"');
      expect(source).toContain('summary: "Policie zasáhla tvůj district."');
      expect(source).not.toContain("formatStoredPoliceRaidStreetNewsLosses");
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

    for (const source of [runtimeSource]) {
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
    for (const sourcePath of ["page-assets/js/app/runtime.js"]) {
      const source = read(sourcePath);

      expect(source).toMatch(/const shouldAutoOpenBuildingsPopupOnRefresh = \(\) => \{\r?\n    return false;\r?\n  \};/u);
      expect(source).not.toContain('const requested = params.get("openBuildings") || params.get("buildingsPopup") || "";');
      expect(source).not.toContain('return !resolveDevBuildingCardAutoOpenKey();');
    }
  });

  it("keeps foreign discovered district buildings from opening details", () => {
    const runtimeSource = read("page-assets/js/app/runtime.js");

    for (const source of [runtimeSource]) {
      const buildingsClickIndex = source.indexOf('popupBuildingsList.addEventListener("click"');
      const ownershipGuardIndex = source.indexOf("const serverAuthoritativePresentation = getCurrentGameplayExecutionMode()", buildingsClickIndex);
      const openDetailIndex = source.indexOf("openDistrictBuildingDetail(selectedDistrict", buildingsClickIndex);

      expect(buildingsClickIndex).toBeGreaterThan(-1);
      expect(ownershipGuardIndex).toBeGreaterThan(buildingsClickIndex);
      expect(openDetailIndex).toBeGreaterThan(ownershipGuardIndex);
      expect(source).toContain(
        "=== GAMEPLAY_EXECUTION_MODES.serverAuthoritative"
      );
      expect(source).toContain(
        '? chipButton.dataset.districtBuildingInteractive === "true"'
      );
      expect(source).toContain('chipButton.dataset.districtBuildingInteractive === "false"');
      const presentBuildingDetailIndex = source.indexOf("const presentDistrictBuildingDetail =");
      const genericHandoffCloseIndex = source.indexOf(
        "? { preserveDistrictSelection: true }",
        presentBuildingDetailIndex
      );
      const productionHandoffCloseIndex = source.indexOf(
        "suppressMapInput: false",
        genericHandoffCloseIndex
      );
      const buildingPopupOpenIndex = source.indexOf(
        "openProductionBuildingPopup(root, popupTarget.openerId, openRequest)",
        productionHandoffCloseIndex
      );
      const buildingPopupObserveIndex = source.indexOf(
        "observeProductionPopupOpening(opening",
        buildingPopupOpenIndex
      );
      expect(presentBuildingDetailIndex).toBeGreaterThan(-1);
      expect(genericHandoffCloseIndex).toBeGreaterThan(presentBuildingDetailIndex);
      expect(productionHandoffCloseIndex).toBeGreaterThan(genericHandoffCloseIndex);
      expect(buildingPopupOpenIndex).toBeGreaterThan(productionHandoffCloseIndex);
      expect(buildingPopupObserveIndex).toBeGreaterThan(buildingPopupOpenIndex);
      expect(source.slice(presentBuildingDetailIndex, buildingPopupOpenIndex)).not.toContain("openButton.click();");
      expect(source.slice(presentBuildingDetailIndex, buildingPopupOpenIndex)).toContain("serverTarget:");
      expect(source.slice(buildingPopupOpenIndex, buildingPopupObserveIndex)).toContain("restoreDistrictPopup();");
      expect(source.slice(buildingPopupObserveIndex)).toContain("onDeclined: () =>");
      expect(source.slice(buildingPopupObserveIndex)).toContain("onRejected: () =>");
      expect(source).toContain("if (!opened && popup && districtPopupHiddenForHandoff)");
      expect(source).toContain("showDistrictPopupModal(popup);");
    }
  });

  it("guards every building detail presenter before any local renderer can run", () => {
    const runtimeSource = read("page-assets/js/app/runtime.js");
    const presenterStart = runtimeSource.indexOf(
      "const presentDistrictBuildingDetail ="
    );
    const presenterEnd = runtimeSource.indexOf(
      "let openDistrictBuildingDetail =",
      presenterStart
    );
    const presenterSource = runtimeSource.slice(presenterStart, presenterEnd);
    const unavailableGuardIndex = presenterSource.indexOf(
      "buildingExecutionMode === GAMEPLAY_EXECUTION_MODES.unavailable"
    );
    const localRendererIndex = presenterSource.indexOf(
      "openGenericDistrictBuildingDetail("
    );

    expect(presenterStart).toBeGreaterThan(-1);
    expect(presenterEnd).toBeGreaterThan(presenterStart);
    expect(unavailableGuardIndex).toBeGreaterThan(-1);
    expect(localRendererIndex).toBeGreaterThan(unavailableGuardIndex);
    expect(runtimeSource).not.toMatch(
      /if \(!isServerAuthoritativeGameplayRuntimeReady\(\)\) \{\r?\n\s+return presentDistrictBuildingDetail/u
    );
  });

  it("keeps local building cards on the shared renderer with VIP lounge and City Hall parity", () => {
    for (const sourcePath of [
      "page-assets/js/app/runtime.js",
      "client/page-assets/js/app/runtime.js"
    ]) {
      const runtimeSource = read(sourcePath);
      const economyStart = runtimeSource.indexOf("function getDistrictEconomySnapshot(");
      const economyEnd = runtimeSource.indexOf("function getCurrentPlayerStartPhaseSourceSnapshot(", economyStart);
      const detailStart = runtimeSource.indexOf("function resolveDistrictBuildingDetailMechanics(");
      const detailEnd = runtimeSource.indexOf("const RUNTIME_PASSIVE_PRODUCTION_SYNC_INTERVAL_MS", detailStart);
      const presenterStart = runtimeSource.indexOf("function openGenericDistrictBuildingDetail(");
      const presenterEnd = runtimeSource.indexOf("function getServerDistrictBuildingDetailPopupKey(", presenterStart);

      expect(economyStart, sourcePath).toBeGreaterThan(-1);
      expect(economyEnd, sourcePath).toBeGreaterThan(economyStart);
      expect(detailStart, sourcePath).toBeGreaterThan(-1);
      expect(detailEnd, sourcePath).toBeGreaterThan(detailStart);
      expect(presenterStart, sourcePath).toBeGreaterThan(-1);
      expect(presenterEnd, sourcePath).toBeGreaterThan(presenterStart);
      expect(runtimeSource.slice(economyStart, economyEnd)).toContain(
        "getCityHallInfluenceGenerationMultiplier()"
      );
      expect(runtimeSource.slice(economyStart, economyEnd)).toContain(
        "const vipLoungeNetwork = resolveVipLoungeNetworkTier();"
      );
      expect(runtimeSource.slice(economyStart, economyEnd)).toContain(
        "if (!isActiveBuilding(building))"
      );
      expect(runtimeSource.slice(economyStart, economyEnd)).toContain(
        "vipLoungeTier?.incomeMultiplier"
      );
      expect(runtimeSource.slice(economyStart, economyEnd)).toContain(
        "vipLoungeTier?.heatMultiplier"
      );
      expect(runtimeSource.slice(economyStart, economyEnd)).toContain(
        "vipLoungeTier?.influenceMultiplier"
      );
      expect(runtimeSource.slice(detailStart, detailEnd)).toContain(
        "getCityHallAdjustedDailyInfluence("
      );
      expect(runtimeSource.slice(detailStart, detailEnd)).toContain(
        "const vipLoungeNetwork = mechanicsType === \"vip-lounge\" ? resolveVipLoungeNetworkTier(ownedVipLounges) : null;"
      );
      expect(runtimeSource.slice(detailStart, detailEnd)).toContain(
        "vipLoungeNetwork?.heatMultiplier"
      );
      expect(runtimeSource.slice(detailStart, detailEnd)).toContain(
        "mechanicsType === \"vip-lounge\" ? 2 : 1"
      );
      expect(runtimeSource.slice(detailStart, detailEnd)).toContain(
        "vipLoungeNetwork?.influenceMultiplier"
      );
      expect(runtimeSource.slice(detailStart, detailEnd)).toContain(
        "multiplier: mechanicsType === \"vip-lounge\" ? 1 : multiplier"
      );
      expect(runtimeSource.slice(presenterStart, presenterEnd)).not.toContain(
        "data-district-building-detail-info"
      );
      expect(runtimeSource.slice(presenterStart, presenterEnd)).not.toContain(
        "renderDistrictBuildingInfoSection"
      );
      expect(runtimeSource).not.toContain("function renderDistrictBuildingInfoSection(");
      expect(runtimeSource).not.toContain("createBuildingDetailInfoViewModel");
    }

    for (const sourcePath of [
      "page-assets/js/app/ui/buildingDetailPanel.js",
      "client/page-assets/js/app/ui/buildingDetailPanel.js"
    ]) {
      const panelSource = read(sourcePath);
      expect(panelSource).toContain('intro.dataset.districtBuildingDetailInlineInfo = "true";');
      expect(panelSource).not.toContain('intro.dataset.districtBuildingDetailInfo = "true";');
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

    for (const source of [runtimeSource]) {
      expect(source).toContain("const trapActionTimestamp = new Date().toISOString();");
      expect(source).toContain("armedAt: trapActionTimestamp");
      expect(source).toContain("movedAt: trapActionTimestamp");
      expect(source).not.toContain("armedAt: nextTrapState[selectedDistrict.id]?.armedAt || new Date().toISOString()");
    }
  });
});
