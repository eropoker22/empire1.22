import { describe, expect, it } from "vitest";
import {
  createAuthoritativeIncomeTickDelta,
  createAuthoritativeStoredPopulationTickDelta,
  floatingDeltaMatches
} from "../e2e/helpers/authoritativeIncomeEvidence.js";

describe("authoritative hosted income evidence", () => {
  it("calculates exact expected and actual deltas across a multi-tick gap", () => {
    const previous = createSample({
      currentTick: 10,
      stateVersion: 20,
      cleanCash: 100,
      dirtyCash: 50,
      heat: 2,
      influence: 3,
      chemicals: 7,
      lastSnapshotAt: "2026-07-31T10:00:00.000Z"
    });
    const current = createSample({
      currentTick: 13,
      stateVersion: 23,
      cleanCash: 103.6000000000001,
      dirtyCash: 51.5,
      heat: 2.0300000000000002,
      influence: 3.015,
      chemicals: 7,
      lastSnapshotAt: "2026-07-31T10:00:15.000Z"
    });

    const delta = createAuthoritativeIncomeTickDelta(
      previous,
      current,
      ["chemicals"]
    );

    expect(delta).toMatchObject({
      fromTick: 10,
      toTick: 13,
      tick: 3,
      rateBasis: {
        projectionBasis: "next-authoritative-economy-tick",
        fromTick: 10,
        toTick: 11,
        tickRateMs: 5_000,
        stableAcrossGap: true
      },
      expectedPerTick: {
        cleanCash: 1.2,
        dirtyCash: 0.5,
        population: 0,
        materials: {
          chemicals: 0
        },
        districtHeat: 0.01,
        districtInfluence: 0.005
      },
      expectedNet: {
        cleanCash: 3.5999999999999996,
        dirtyCash: 1.5,
        population: 0,
        materials: {
          chemicals: 0
        },
        districtHeat: 0.03,
        districtInfluence: 0.015
      },
      exactNetMatch: {
        cleanCash: true,
        dirtyCash: true,
        population: true,
        materials: {
          chemicals: true
        },
        districtHeat: true,
        districtInfluence: true
      },
      populationSourceEvidence: {
        sources: [],
        summary: "Pasivní populace: 0 / h · žádný zdroj v districtu"
      },
      exactUiRateMatch: {
        cleanCash: true,
        dirtyCash: true,
        districtInfluence: true
      },
      lastSnapshotAtMs: 15_000
    });
    expect(delta.uiDisplayedPerHour).toMatchObject({
      buildingCount: 1,
      cleanCash: 432,
      dirtyCash: 180,
      districtHeat: 7.2,
      districtInfluence: 3.6
    });
  });

  it("uses floating tolerance only for fractional authoritative metrics", () => {
    expect(floatingDeltaMatches(6.899999999999636, 6.9)).toBe(true);
    expect(floatingDeltaMatches(6.89, 6.9)).toBe(false);

    const previous = createSample({
      currentTick: 20,
      stateVersion: 30,
      cleanCash: 200,
      dirtyCash: 80,
      heat: 4,
      influence: 6,
      chemicals: 9,
      lastSnapshotAt: "2026-07-31T11:00:00.000Z"
    });
    const current = createSample({
      currentTick: 21,
      stateVersion: 31,
      cleanCash: 201.2,
      dirtyCash: 80.5,
      heat: 4.01,
      influence: 6.005,
      chemicals: 10,
      lastSnapshotAt: "2026-07-31T11:00:05.000Z"
    });

    const delta = createAuthoritativeIncomeTickDelta(
      previous,
      current,
      ["chemicals"]
    );

    expect(delta.exactNetMatch.cleanCash).toBe(true);
    expect(delta.exactNetMatch.materials.chemicals).toBe(false);
  });

  it("proves canonical population storage growth across authoritative ticks", () => {
    const previousSource = {
      sourceId: "building:district:91:convenience_store:0:stored-population",
      buildingId: "building:district:91:convenience_store:0",
      buildingTypeId: "convenience_store",
      target: "building-storage",
      amountPerTick: 5 / 72,
      storedAmount: 10,
      capacity: 50
    };
    const currentSource = {
      ...previousSource,
      storedAmount: 10 + (5 / 72) * 3
    };

    const delta = createAuthoritativeStoredPopulationTickDelta(
      previousSource,
      currentSource,
      3
    );

    expect(delta).toMatchObject({
      sourceId: previousSource.sourceId,
      buildingId: previousSource.buildingId,
      buildingTypeId: "convenience_store",
      target: "building-storage",
      tickGap: 3,
      amountPerTick: 5 / 72,
      capacity: 50,
      previousStoredAmount: 10,
      exactStoredMatch: true
    });
    expect(delta.expectedStoredDelta).toBeCloseTo((5 / 72) * 3, 12);
    expect(delta.actualStoredDelta).toBeCloseTo((5 / 72) * 3, 12);
  });
});

function createSample({
  currentTick,
  stateVersion,
  cleanCash,
  dirtyCash,
  heat,
  influence,
  chemicals,
  lastSnapshotAt
}) {
  const economyRates = {
    basis: "next-authoritative-economy-tick",
    tickRateMs: 5_000,
    fromTick: currentTick,
    toTick: currentTick + 1,
    playerBalancePerTick: {
      cash: 1.2,
      "dirty-cash": 0.5,
      population: 0,
      chemicals: 0
    },
    playerBalancePerHour: {
      cash: 864,
      "dirty-cash": 360,
      population: 0,
      chemicals: 0
    },
    selectedDistrict: {
      districtId: "district:1",
      cleanCashPerTick: 1.2,
      dirtyCashPerTick: 0.5,
      cleanCashPerHour: 864,
      dirtyCashPerHour: 360,
      heatPerTick: 0.01,
      influencePerTick: 0.005,
      heatPerHour: 7.2,
      influencePerHour: 3.6,
      passivePopulationSources: [],
      passivePopulationSourceSummary:
        "Pasivní populace: 0 / h · žádný zdroj v districtu"
    }
  };
  return {
    currentTick,
    rootTick: currentTick,
    stateVersion,
    player: {
      cleanCash,
      dirtyCash,
      population: 50,
      resourceBalances: {
        cash: cleanCash,
        "dirty-cash": dirtyCash,
        population: 50,
        chemicals
      },
      district: {
        heat,
        influence
      },
      economyRates,
      buildingPresentationRates: [
        {
          buildingId: "building:1",
          buildingTypeId: "restaurant",
          status: "active",
          passive: {
            cleanPerHour: 432,
            dirtyPerHour: 180,
            heatPerDay: 172.8,
            influencePerDay: 86.4
          }
        }
      ],
      visibleDistrictRates: {
        cleanCash: 864,
        dirtyCash: 360,
        influence: 3.6
      }
    },
    admin: {
      lastSnapshot: {
        lastSnapshotAt
      }
    }
  };
}
