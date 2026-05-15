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
      for (const exportName of requiredFacadeExports) {
        expect(runtime[exportName]).toBeDefined();
      }

      expect(renderUiSource).toContain('from "./runtime.js"');
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

  it("keeps destroyed district popup reduced to a single message", () => {
    const runtimeSource = read("page-assets/js/app/runtime.js");
    const districtCssSource = read("page-assets/css/styles-district.css");

    expect(runtimeSource).toContain("setDestroyedDistrictPopupMode(true)");
    expect(runtimeSource).toContain('notice.textContent = enabled ? "District zničen" : "";');
    expect(runtimeSource).toContain("return;");
    expect(districtCssSource).toContain('.district-popup-card[data-district-destroyed="true"] .district-popup-body > :not(.district-popup-destroyed-only)');
    expect(districtCssSource).toContain(".district-popup-destroyed-only");
  });
});
