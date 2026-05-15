import { describe, expect, it } from "vitest";
import { runFreeModeSimulation } from "@empire/tools-debug";

describe("free-mode shared city simulation harness", () => {
  it("runs a deterministic 20-player shared-city playtest through load, submit, and tick flow", async () => {
    const result = await runFreeModeSimulation({
      instanceId: "instance:test:free-shared-city-sim",
      playerCount: 20,
      rounds: 6,
      ticksPerRound: 3
    });
    const report = result.report;

    expect(report.playerCount).toBe(20);
    expect(report.uniqueHomeDistricts).toBe(20);
    expect(result.finalStateSummary.homeDistrictIds).toHaveLength(20);
    expect(report.districtCount).toBe(28);
    expect(report.connectedMap).toBe(true);
    expect(report.tickCount).toBe(18);
    expect(report.crashedInstances).toBe(0);
    expect(report.actionsAttempted).toBeGreaterThan(0);
    expect(report.actionsAccepted).toBeGreaterThan(0);
    expect(report.acceptedActionsByType["spy-district"] ?? 0).toBeGreaterThan(0);
    expect((report.acceptedActionsByType["attack-district"] ?? 0) + (report.acceptedActionsByType["spy-district"] ?? 0)).toBeGreaterThan(0);
    expect(report.spyReportsCreated + report.battleReportsCreated).toBeGreaterThan(0);
    expect(report.cityFeedEventsCreated).toBeGreaterThan(0);
    expect(report.activePlayers).toBe(20);
    expect(report.topPlayersByScore.length).toBeGreaterThan(0);
    expect(report.averageHeat).toBeGreaterThanOrEqual(0);
  });

  it("records rejected actions without crashing the simulation report", async () => {
    const result = await runFreeModeSimulation({
      instanceId: "instance:test:free-shared-city-sim-errors",
      playerCount: 2,
      rounds: 1,
      ticksPerRound: 1,
      includeInvalidProbe: true
    });

    expect(result.report.actionsRejected).toBeGreaterThan(0);
    expect(result.report.errorsByCode.spy_target_not_found).toBeGreaterThan(0);
    expect(result.report.crashedInstances).toBe(0);
    expect(result.report.connectedMap).toBe(true);
  });

  it("returns stable headline metrics for the same deterministic options", async () => {
    const options = {
      instanceId: "instance:test:free-shared-city-sim-deterministic",
      playerCount: 20,
      rounds: 4,
      ticksPerRound: 2
    };
    const first = await runFreeModeSimulation(options);
    const second = await runFreeModeSimulation(options);

    expect(pickDeterministicMetrics(second.report)).toEqual(pickDeterministicMetrics(first.report));
  });
});

const pickDeterministicMetrics = (report: Awaited<ReturnType<typeof runFreeModeSimulation>>["report"]) => ({
  playerCount: report.playerCount,
  districtCount: report.districtCount,
  tickCount: report.tickCount,
  actionsAttempted: report.actionsAttempted,
  actionsAccepted: report.actionsAccepted,
  actionsRejected: report.actionsRejected,
  errorsByCode: report.errorsByCode,
  spyReportsCreated: report.spyReportsCreated,
  battleReportsCreated: report.battleReportsCreated,
  cityFeedEventsCreated: report.cityFeedEventsCreated,
  topPlayersByScore: report.topPlayersByScore
});
