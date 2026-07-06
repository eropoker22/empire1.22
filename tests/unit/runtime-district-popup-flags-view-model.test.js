import { describe, expect, it } from "vitest";
import { buildDistrictPopupFlagsViewModel } from "../../page-assets/js/app/map/districtPopupFlagsViewModel.js";

describe("district popup flags view model", () => {
  it("returns destroyed district flags", () => {
    expect(buildDistrictPopupFlagsViewModel({ isDestroyed: true })).toEqual([
      { label: "Totální destrukce", tone: "danger" },
      { label: "Nikdo", tone: "muted" },
      { label: "Nepoužitelný", tone: "danger" }
    ]);
  });

  it("builds owned district flags", () => {
    expect(buildDistrictPopupFlagsViewModel({
      isOwnedByCurrentPlayer: true,
      ownerLabel: "TY",
      adjacentOwnedCount: 2,
      hasKnownDefense: true,
      canOccupyAfterSpy: false
    })).toEqual([
      { label: "Tvůj", tone: "good" },
      { label: "Napojený: 2", tone: "good" },
      { label: "Obrana známá", tone: "neutral" },
      { label: "Obsazení nepřipravené", tone: "muted" }
    ]);
  });

  it("builds free and enemy district flags", () => {
    expect(buildDistrictPopupFlagsViewModel({
      ownerLabel: "Neobsazeno",
      adjacentOwnedCount: 0,
      hasKnownDefense: false,
      canOccupyAfterSpy: true
    })[0]).toEqual({ label: "Volný", tone: "neutral" });

    expect(buildDistrictPopupFlagsViewModel({
      ownerLabel: "Cizí hráč",
      adjacentOwnedCount: 0,
      hasKnownDefense: false,
      canOccupyAfterSpy: false
    })[0]).toEqual({ label: "Cizí", tone: "warning" });
  });

  it("adds police, occupy and trap flags when present", () => {
    expect(buildDistrictPopupFlagsViewModel({
      ownerLabel: "Cizí hráč",
      activePoliceAction: { id: "raid" },
      isOccupying: true,
      hasTrapHere: true
    })).toEqual([
      { label: "Obsazován", tone: "warning" },
      { label: "Bez napojení", tone: "muted" },
      { label: "Obrana skrytá", tone: "muted" },
      { label: "Policejní akce", tone: "danger" },
      { label: "Obsazování běží", tone: "warning" },
      { label: "Toxická past", tone: "danger" }
    ]);
  });

  it("marks downtown occupation as locked before final lockdown", () => {
    expect(buildDistrictPopupFlagsViewModel({
      ownerLabel: "Neobsazeno",
      adjacentOwnedCount: 1,
      hasKnownDefense: false,
      canOccupyAfterSpy: true,
      isDowntownOccupationLocked: true
    })).toContainEqual({ label: "Downtown uzavřený", tone: "warning" });
  });
});
