import { describe, expect, it, vi } from "vitest";
import { buildMapTooltipViewModel } from "../../page-assets/js/app/map/mapTooltipViewModel.js";

describe("map tooltip view model", () => {
  it("returns null for missing or partial district data", () => {
    expect(buildMapTooltipViewModel()).toBeNull();
    expect(buildMapTooltipViewModel({ districtType: "resident" })).toBeNull();
  });

  it("uses current player launch owner label without mutating inputs", () => {
    const launchOwnerByDistrictId = new Map([[7, 1]]);
    const district = { id: 7, districtType: "industrial" };

    expect(buildMapTooltipViewModel(district, {
      gamePhase: "launch",
      launchOwnerByDistrictId
    }, {
      currentPlayerId: 1,
      getDistrictAtmosphereMeta: () => ({ shortLabel: "Industry" })
    })).toEqual({
      id: 7,
      idLabel: "7",
      typeLabel: "TY",
      gossipEntries: []
    });

    expect(Array.from(launchOwnerByDistrictId.entries())).toEqual([[7, 1]]);
  });

  it("uses launch player name for other launch owners", () => {
    expect(buildMapTooltipViewModel({ id: 8 }, {
      gamePhase: "launch",
      launchOwnerByDistrictId: new Map([[8, 2]])
    }, {
      currentPlayerId: 1,
      getLaunchPlayerName: (ownerId) => `Player ${ownerId}`
    }).typeLabel).toBe("Player 2");
  });

  it("reduces destroyed district hover content to one message", () => {
    expect(buildMapTooltipViewModel({ id: 11, districtType: "industrial" }, {
      gamePhase: "live",
      destroyedDistrictIds: new Set([11])
    }, {
      getDistrictAtmosphereMeta: () => ({ shortLabel: "Industry" })
    })).toEqual({
      id: 11,
      idLabel: "District zničen",
      typeLabel: "",
      gossipEntries: [],
      destroyed: true
    });
  });

  it("falls back to atmosphere label and limits gossip entries", () => {
    const ensureDistrictPassiveGossip = vi.fn(() => [
      { intelLevel: "rumor", text: "First" },
      { intelLevel: "verified", text: "Second" },
      { intelLevel: "rumor", text: "Third" }
    ]);

    const viewModel = buildMapTooltipViewModel({ id: 9, districtType: "park" }, {
      gamePhase: "live"
    }, {
      getDistrictAtmosphereMeta: () => ({ shortLabel: "Park" }),
      isDistrictGossipDevOnlyMode: () => true,
      ensureDistrictPassiveGossip
    });

    expect(viewModel.typeLabel).toBe("Park");
    expect(viewModel.gossipEntries).toEqual([
      { intelLevel: "rumor", text: "First" },
      { intelLevel: "verified", text: "Second" }
    ]);
    expect(ensureDistrictPassiveGossip).toHaveBeenCalledTimes(1);
  });
});
