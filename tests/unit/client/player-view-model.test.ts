import { describe, expect, it } from "vitest";
import { createPlayerViewModel } from "../../../apps/client/src/selectors/player-view-model";
import type { PlayerView } from "@empire/shared-types";

const createPlayerView = (heat: number, selectedDistrictHeat: number): PlayerView => ({
  playerId: "player:heat-format",
  instanceId: "instance:test:heat-format",
  mode: "free",
  homeDistrictId: "district:1",
  resourceBalances: {},
  economy: null,
  notifications: [],
  dayNight: null,
  police: {
    heat,
    selectedDistrictHeat,
    wantedLevel: 0,
    wantedLevelLabel: "0 / 5",
    wantedLabel: "0 / 5",
    pendingRaid: null,
    raidConsequenceStatus: "none",
    protection: {
      raidConsequenceMultiplier: 1,
      sources: []
    }
  }
} as unknown as PlayerView);

describe("player police presentation", () => {
  it("rounds fractional authoritative heat instead of leaking raw floating point text", () => {
    const view = createPlayerViewModel(createPlayerView(0.021555555555555555, 1.6));

    expect(view?.police?.heatLabel).toBe("0");
    expect(view?.police?.selectedDistrictHeatLabel).toBe("2");
  });
});
