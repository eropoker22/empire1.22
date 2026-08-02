import { describe, expect, it } from "vitest";
import { freeModeSchoolConfig } from "../../../packages/game-config/src/public/free-mode-school-config";
import type { CoreGameState } from "../../../packages/game-core/src/entities/game-state";
import { createSupportBuildingStats } from "../../../packages/game-core/src/projections/district-building-support-stats";

describe("district building support stats", () => {
  it("preserves the canonical school population rate precision", () => {
    const building = {
      id: "building:district-1:school:1",
      serverInstanceId: "instance:test",
      districtId: "district:1",
      ownerPlayerId: "player:1",
      buildingTypeId: "school",
      level: 1,
      status: "active",
      processing: null,
      actionCooldowns: {},
      metadata: {
        school: {
          storedStudents: 0,
          lastUpdatedTick: 0,
          wasFull: false
        }
      },
      startedAt: null,
      completedAt: null,
      version: 1
    } as unknown as CoreGameState["buildingsById"][string];
    const state = {
      root: { tick: 0 },
      buildingsById: { [building.id]: building }
    } as unknown as CoreGameState;

    const stats = createSupportBuildingStats({
      definition: undefined,
      state,
      district: {} as CoreGameState["districtsById"][string],
      building,
      playerId: "player:1",
      playerBalances: {},
      schoolConfig: freeModeSchoolConfig,
      tick: 0,
      tickRateMs: 5_000
    });

    expect(stats?.find((stat) => stat.label === "Populace / min")?.value).toBe("0.55");
  });
});
