import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("page-assets/js/app/city-events-runtime.js", "utf8");

describe("City Events runtime authority", () => {
  it("keeps rewards storage-safe and preserves overflow for a later claim", () => {
    expect(source).toContain("applyInventoryOutput");
    expect(source).toContain("pendingRewards");
    expect(source).toContain("claimPendingCityEventRewards");
    expect(source).not.toContain("inventory.weapons.pistol =");
    expect(source).not.toContain("inventory.drugs[\"ghost-serum\"] =");
  });

  it("applies the outcome-specific Heat and reuses the shared countdown ticker", () => {
    expect(source).toContain("addGangHeat(root, resolvedHeat");
    expect(source).toContain("bindSharedCountdown");
    expect(source).not.toContain("window.setInterval");
    expect(source).not.toContain("countdownTimerId");
  });

  it("labels the feature as local and does not reopen an already open detail overlay", () => {
    expect(source).toContain("Lokální zakázka");
    expect(source).toContain("MĚSTSKÝ ČAS · další úkoly");
    expect(source).toContain("if (wasHidden)");
    expect(source).not.toContain("Demo event");
  });

  it("keeps local offers visible only for a three-hour city window", () => {
    expect(source).toContain("const LOCAL_CITY_EVENT_VISIBLE_MINUTES = 3 * 60;");
    expect(source).toContain("const available = current.distance < LOCAL_CITY_EVENT_VISIBLE_MINUTES;");
    expect(source).toContain("Další úkoly přijdou v");
  });

  it("uses canonical generated definitions and deterministic outcomes", () => {
    expect(source).toContain("CITY_EVENT_CONFIG.definitions");
    expect(source).toContain("hashCityEventSeed");
    expect(source).not.toContain("Math.random");
    expect(source).not.toContain("durationMin:");
  });

  it("renders the authoritative server projection and submits intent-only commands", () => {
    expect(source).toContain("getServerGameplaySliceReadModel()?.player?.cityEvents");
    expect(source).toContain('submitServerCityEventCommand({ action: "start", id: selectedEventTask.offerId })');
    expect(source).toContain('submitServerCityEventCommand({ action: "claim", id: claimButton.dataset.cityEventClaim })');
    expect(source).toContain("const available = shouldRunLocalCityEvents() || shouldRunServerCityEvents()");
    expect(source).not.toContain("submitServerCityEventCommand({ action: \"start\", id: selectedEventTask.definitionId");
  });

  it("uses the shared gang influence state for local unlocks", () => {
    expect(source).toContain("getResolvedGangState");
    expect(source).toContain("getStoredPreviewSession()?.gang?.influence");
    expect(source).toContain("function getCurrentPlayerInfluenceValue(root)");
    expect(source).toContain("let nextInfluence = getCurrentPlayerInfluenceValue(root);");
  });

  it("keeps local outcome mutation behind the explicit local execution-mode timer", () => {
    expect(source).toContain("if (!shouldRunLocalCityEvents() || unbindLifecycleTicker || document.hidden) return;");
    expect(source).toContain("if (shouldRunServerCityEvents()) {");
    expect(source).not.toContain("if (!shouldRunServerCityEvents()) startCityEventRun");
  });
});
