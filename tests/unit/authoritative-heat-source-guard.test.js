import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("authoritative Heat source guard", () => {
  it("keeps active hosted surfaces on the canonical player Heat selector", () => {
    const runtime = read("page-assets/js/app/runtime.js");
    const resolvedGangState = runtime.slice(
      runtime.indexOf("function getResolvedGangState()"),
      runtime.indexOf("function setStoredGangState", runtime.indexOf("function getResolvedGangState()"))
    );
    const wanted = read("page-assets/js/app/runtime/gangWantedStatusRuntime.js");
    const police = read("page-assets/js/app/runtime/policeHeatBridge.js");
    const playerSelector = read("apps/client/src/selectors/player-view-model.ts");
    const buildingPresentation = read("page-assets/js/app/runtime/buildingPresentationAdapters.js");
    const topBar = read("apps/client/src/ui/top-bar/top-bar-shell.ts");
    const mapRenderer = read("apps/client/src/map/map-renderer.ts");
    const districtPanel = read("apps/client/src/features/district-panel/index.ts");

    expect(resolvedGangState).toContain("selectAuthoritativePlayerHeat(serverPlayer)");
    expect(resolvedGangState).not.toContain("totalHeat");
    expect(wanted).toContain("selectAuthoritativePlayerHeat(player)");
    expect(police).toContain("selectAuthoritativePlayerHeat(coreModel)");
    expect(playerSelector).toContain("selectAuthoritativePlayerHeat(view)");
    expect(buildingPresentation).toContain("selectAuthoritativePlayerHeat(readModel)");
    expect(buildingPresentation).not.toContain("readModel?.player?.police?.heat");
    expect(topBar).toContain("Heat ${escapeHtml(police.heatLabel)}");
    expect(topBar).toContain("Hledanost ${escapeHtml(police.wantedLevelLabel)}");
    expect(mapRenderer).toContain("Heat distriktu:");
    expect(districtPanel).toContain(">Heat distriktu</span>");
  });

  it("does not restore numeric gang Heat before hosted hydration", () => {
    const registered = read("page-assets/js/app/runtime/registeredPlayerStateRuntime.js");

    expect(registered).toContain('gangState.available === false');
    expect(registered).not.toContain("gangState.heat ?? 0");
  });
});
