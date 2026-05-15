import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { FACTION_CATALOG } from "../../packages/game-config/src/legacy-page/faction-config.js";
import {
  getFactionActionForPlayer
} from "../../page-assets/js/app/faction-actions-runtime.js";

describe("legacy faction compatibility bridge", () => {
  it("keeps legacy page preview values inside the free-mode scale", () => {
    for (const faction of Object.values(FACTION_CATALOG)) {
      expect(faction.startingPackage.cleanMoney).toBeLessThanOrEqual(2000);
      expect(faction.startingPackage.dirtyMoney).toBeLessThanOrEqual(600);
      expect(faction.startingPackage.influence).toBeLessThanOrEqual(20);
      expect(faction.startingPackage.heat).toBeLessThanOrEqual(8);
    }
  });

  it("does not render fake active faction execution", () => {
    const source = readFileSync("page-assets/js/app/faction-actions-runtime.js", "utf8");
    const action = getFactionActionForPlayer({
      getItem: () => JSON.stringify({ registration: { factionId: "kartel" } })
    });

    expect(action.effect).toContain("Aktivní schopnost zatím není core-backed");
    expect(source).not.toContain("Spustit akci");
    expect(source).not.toContain("spuštěno");
  });
});
