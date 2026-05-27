import { describe, expect, it } from "vitest";
import { runFreeBrMatrix, runFreeBrSimulation } from "@empire/tools-debug/free-br-simulation";

const compactSummary = (seed: string) => {
  const report = runFreeBrSimulation({ seed, hours: 12, scenario: "canonical-20p" });
  return {
    summary: report.summary,
    eliminations: report.eliminations.map((entry) => ({
      tick: entry.tick,
      playerId: entry.eliminatedPlayerId,
      neutralizedDistricts: entry.neutralizedDistricts
    })),
    topEight: report.players.filter((player) => player.finalPlacement <= 8).map((player) => player.playerId),
    firstEvents: report.events.slice(0, 20).map((event) => ({
      tick: event.tick,
      playerId: event.playerId,
      actionType: event.actionType,
      result: event.result,
      targetDistrictId: event.targetDistrictId ?? null
    }))
  };
};

describe("canonical Free BR simulation", () => {
  it("is deterministic for a fixed seed and still varies across seeds", () => {
    expect(compactSummary("deterministic-seed")).toEqual(compactSummary("deterministic-seed"));
    expect(compactSummary("deterministic-seed")).not.toEqual(compactSummary("different-seed"));
  });

  it("creates the canonical 20-player, 161-district world with 8 downtown districts", () => {
    const report = runFreeBrSimulation({ seed: "world-test", hours: 1 });

    expect(report.configSnapshot.players).toBe(20);
    expect(report.configSnapshot.districts).toBe(161);
    expect(report.configSnapshot.downtownDistricts).toBe(8);
    expect(report.players).toHaveLength(20);
    expect(report.players.every((player) => player.controlledDistrictsOverTime[0]?.districts === 1)).toBe(true);
  });

  it("runs Free BR eliminations with quiet hours, top-8 stop, and defeated-player neutrality", () => {
    const report = runFreeBrSimulation({ seed: "elimination-test", hours: 48 });
    const interval = report.configSnapshot.eliminationIntervalTicks;

    expect(report.eliminations.length).toBeGreaterThan(0);
    expect(report.eliminations[0]?.tick).toBeGreaterThanOrEqual(report.configSnapshot.firstEliminationTick);
    expect(report.summary.finalActivePlayers).toBeGreaterThanOrEqual(report.configSnapshot.topStop);
    expect(report.summary.totalNeutralizedDistrictsAfterEliminations).toBeGreaterThan(0);

    for (let index = 1; index < report.eliminations.length; index += 1) {
      expect(report.eliminations[index].tick - report.eliminations[index - 1].tick).toBeGreaterThanOrEqual(interval);
    }

    for (const elimination of report.eliminations) {
      const laterAction = report.events.find((event) =>
        event.playerId === elimination.eliminatedPlayerId
        && event.tick > elimination.tick
        && event.actionType !== "elimination"
      );
      expect(laterAction).toBeUndefined();
      expect(elimination.neutralizedDistricts).toBeGreaterThanOrEqual(0);
    }
  });

  it("simulates alliances without exceeding max Free BR alliance size", () => {
    const report = runFreeBrSimulation({ seed: "alliance-test", hours: 48, scenario: "alliance-heavy" });

    expect(report.alliances.formed).toBeGreaterThan(0);
    expect(report.alliances.largestAlliance.size).toBeLessThanOrEqual(4);
    expect(report.alliances.records.every((alliance) => alliance.members.length <= 4)).toBe(true);
    expect(report.alliances.records.every((alliance) => alliance.createdAtTick >= 0)).toBe(true);
  });

  it("exposes the required audit surfaces", () => {
    const report = runFreeBrSimulation({ seed: "metrics-test", hours: 12 });

    expect(report.players.length).toBe(20);
    expect(report.factions.length).toBeGreaterThan(0);
    expect(report.strategies.length).toBeGreaterThan(0);
    expect(report.districts.heatHotspots.length).toBeGreaterThan(0);
    expect(report.timeline.length).toBeGreaterThan(0);
    expect(report.alliances.records).toBeDefined();
    expect(report.police.raidsByPlayer).toBeDefined();
    expect(report.downtown.ownerTimeline.length).toBeGreaterThan(0);
    expect(report.events.length).toBeGreaterThan(0);
  });

  it("aggregates a small scenario matrix", () => {
    const matrix = runFreeBrMatrix({
      seed: "matrix-test",
      hours: 12,
      runs: 1,
      scenarios: ["canonical-20p", "downtown-rush"]
    });

    expect(matrix.scenarioNames).toEqual(["canonical-20p", "downtown-rush"]);
    expect(matrix.summaries).toHaveLength(2);
    expect(Object.keys(matrix.byFaction).length).toBeGreaterThan(0);
    expect(Object.keys(matrix.byStrategy).length).toBeGreaterThan(0);
    expect(matrix.averageAttacksPerMatch).toBeGreaterThan(0);
  });
});
