import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("page-assets/js/app/city-events-runtime.js", "utf8");

describe("local City Events runtime hardening", () => {
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
    expect(source).toContain("MĚSTSKÝ ČAS · další okno");
    expect(source).toContain("if (wasHidden)");
    expect(source).not.toContain("Demo event");
  });

  it("uses canonical generated definitions and deterministic outcomes", () => {
    expect(source).toContain("CITY_EVENT_CONFIG.definitions");
    expect(source).toContain("hashCityEventSeed");
    expect(source).not.toContain("Math.random");
    expect(source).not.toContain("durationMin:");
  });
});
