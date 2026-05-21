import type { DistrictId, ServerInstanceId } from "@empire/shared-types";
import { createEmptyPacingReport } from "./pacing-report";
import { createZeroFinalReport } from "./timeline";
import type { FreeModeSharedCitySimulationCounters, FreeModeSharedCitySimulationResult } from "./types";

export const createEmptySimulationResult = (
  instanceId: ServerInstanceId,
  counters: FreeModeSharedCitySimulationCounters
): FreeModeSharedCitySimulationResult => {
  const final = { ...createZeroFinalReport(), ...counters };
  return {
    report: {
      ...final,
      roundsPlayed: 0,
      perRound: [],
      final,
      kpi: {
        hardPassed: false,
        hardAssertions: [],
        softWarnings: [],
        actionAcceptanceRate: 0,
        turnsWithoutValidActionRate: 0,
        spyToAttackRatio: 0
      },
      pacing: createEmptyPacingReport("custom")
    },
    finalStateSummary: {
      instanceId,
      playerCount: 0,
      districtCount: 0,
      tick: 0,
      connectedMap: true,
      uniqueHomeDistricts: 0,
      homeDistrictIds: [] as DistrictId[]
    },
    errorsByCode: counters.errorsByCode
  };
};
