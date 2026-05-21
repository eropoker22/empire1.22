import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import {
  FREE_MODE_SHARED_CITY_SCENARIOS,
  SIMULATION_BOT_PROFILES,
  getBotProfileForPlayer,
  runFreeModeScenarioMatrix,
  runFreeModeSimulation
} from "@empire/tools-debug";
import { selectSimulationAction } from "../../tools/debug/src/free-mode-shared-city-simulation/action-selection";
import type { GameplaySliceView, PlayerId } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../../apps/server/src/runtime/instance/server-instance-runtime";

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
    expect(report.districtCount).toBe(161);
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
    expect(report.roundsPlayed).toBe(6);
    expect(report.perRound).toHaveLength(6);
    expect(report.final.actionsAccepted).toBe(report.actionsAccepted);
    expect(report.kpi.hardPassed).toBe(true);
    expect(report.profileAssignmentSummary.scout).toBe(20);
    expect(report.actionsByProfile.scout).toBe(report.actionsAttempted);
    expect(report.acceptedActionsByProfile.scout).toBe(report.actionsAccepted);
    expect(report.pacing.resourceBalancesOverTime).toHaveLength(6);
    expect(report.pacing.milestones.firstMeaningfulActionMinute).not.toBeNull();
    expect(report.pacing.heatRaidPressure.maxHeatObserved).toBeGreaterThanOrEqual(report.maxHeat);
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
    expect(result.report.actionsByProfile.scout).toBeGreaterThan(0);
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

  it("returns deterministic pacing diagnostics for a fixed seed", async () => {
    const options = {
      instanceId: "instance:test:free-shared-city-pacing-seed",
      seed: "free-mode-pacing-ci-seed",
      scenarioName: "test-seeded-pacing",
      playerCount: 5,
      durationMinutes: 5,
      ticksPerRound: 12,
      botProfileRotation: [...SIMULATION_BOT_PROFILES]
    };
    const first = await runFreeModeSimulation(options);
    const second = await runFreeModeSimulation(options);

    expect(second.report.pacing).toEqual(first.report.pacing);
    expect(first.report.pacing.resourceBalancesOverTime).toHaveLength(5);
    expect(first.report.pacing.incomePerPhase).toHaveLength(3);
    expect(first.report.pacing.milestones.firstMeaningfulActionMinute).not.toBeNull();
    expect(first.report.pacing.heatRaidPressure.maxHeatObserved).toBeGreaterThanOrEqual(0);
    expect(first.report.pacing.warnings.map((warning) => warning.code)).toEqual(expect.any(Array));
  });

  it("records per-round deltas against the previous round snapshot", async () => {
    const result = await runFreeModeSimulation({
      instanceId: "instance:test:free-shared-city-sim-timeline",
      playerCount: 8,
      rounds: 4,
      ticksPerRound: 3
    });

    let previousSpyReports = 0;
    let previousBattleReports = 0;
    let previousFeedEvents = 0;

    for (const round of result.report.perRound) {
      expect(round.spyReportsDelta).toBe(round.spyReportsTotal - previousSpyReports);
      expect(round.battleReportsDelta).toBe(round.battleReportsTotal - previousBattleReports);
      expect(round.cityFeedEventsDelta).toBe(round.cityFeedEventsTotal - previousFeedEvents);
      previousSpyReports = round.spyReportsTotal;
      previousBattleReports = round.battleReportsTotal;
      previousFeedEvents = round.cityFeedEventsTotal;
    }
  });

  it("runs the scenario matrix and evaluates baseline KPI warnings", async () => {
    const matrix = await runFreeModeScenarioMatrix(["baseline-20p-short", "mixed-factions-20p", "mixed-profiles-20p"]);
    const names = matrix.scenarios.map((entry) => entry.scenario.name);

    expect(names).toEqual(["baseline-20p-short", "mixed-factions-20p", "mixed-profiles-20p"]);
    for (const entry of matrix.scenarios) {
      expect(entry.report).toBeTruthy();
      expect(entry.report.connectedMap).toBe(true);
      expect(entry.report.crashedInstances).toBe(0);
      expect(entry.report.perRound).toHaveLength(expectedRoundCount(entry.scenario.options));
      expect(entry.report.pacing.scenarioName).toBe(entry.scenario.name);
    }

    const baseline = matrix.scenarios.find((entry) => entry.scenario.name === "baseline-20p-short")!;
    expect(baseline.report.playerCount).toBe(20);
    expect(baseline.report.uniqueHomeDistricts).toBe(20);
    expect(baseline.report.kpi.hardPassed).toBe(true);
    expect(baseline.report.kpi.softWarnings.some((warning) => warning.code === "spy-heavy")).toBe(true);

    const mixed = matrix.scenarios.find((entry) => entry.scenario.name === "mixed-factions-20p")!;
    expect(mixed.scenario.options.factionRotation?.length).toBeGreaterThan(1);
    expect(mixed.report.playerCount).toBe(20);

    const mixedProfiles = matrix.scenarios.find((entry) => entry.scenario.name === "mixed-profiles-20p")!;
    expect(mixedProfiles.report.profileAssignmentSummary).toEqual({
      scout: 4,
      aggressor: 4,
      opportunist: 4,
      economy: 4,
      balanced: 4
    });
    expect(mixedProfiles.report.crashedInstances).toBe(0);
    expect(mixedProfiles.report.connectedMap).toBe(true);
  });

  it("exposes the requested 30-60 minute pacing scenario catalog", () => {
    expect(FREE_MODE_SHARED_CITY_SCENARIOS).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: "solo-player-first-30-minutes",
        options: expect.objectContaining({ playerCount: 1, durationMinutes: 30, botProfile: "economy" })
      }),
      expect.objectContaining({
        name: "shared-city-5p",
        options: expect.objectContaining({ playerCount: 5, durationMinutes: 60 })
      }),
      expect.objectContaining({
        name: "shared-city-20p",
        options: expect.objectContaining({ playerCount: 20, durationMinutes: 60 })
      }),
      expect.objectContaining({
        name: "aggressive-conflict-player",
        options: expect.objectContaining({ botProfile: "aggressor", durationMinutes: 45 })
      }),
      expect.objectContaining({
        name: "passive-economy-player",
        options: expect.objectContaining({ botProfile: "economy", durationMinutes: 45 })
      })
    ]));
  });

  it("returns stable headline metrics for the same deterministic scenario matrix", async () => {
    const scenarios = ["small-8p", "low-action-pressure"] as const;
    const first = await runFreeModeScenarioMatrix([...scenarios]);
    const second = await runFreeModeScenarioMatrix([...scenarios]);

    expect(second.scenarios.map((entry) => pickDeterministicMetrics(entry.report)))
      .toEqual(first.scenarios.map((entry) => pickDeterministicMetrics(entry.report)));
  });

  it("selects actions according to deterministic bot profile policies", () => {
    const runtime = createPolicyRuntime();
    const loadView = () => createPolicyView();
    const spiedRoutes = new Set<string>();

    expect(selectSimulationAction(runtime, "player:policy", 1, 0, spiedRoutes, "scout", loadView)?.command.type).toBe("spy-district");
    expect(selectSimulationAction(runtime, "player:policy", 1, 0, spiedRoutes, "aggressor", loadView)?.command.type).toBe("attack-district");
    expect(selectSimulationAction(runtime, "player:policy", 1, 0, spiedRoutes, "economy", loadView)?.command.type).toBe("collect-production");
    expect(selectSimulationAction(runtime, "player:policy", 3, 0, spiedRoutes, "balanced", loadView)?.command.type).toBe("attack-district");
    expect(selectSimulationAction(runtime, "player:policy", 1, 0, spiedRoutes, "balanced", loadView)?.command.type).toBe("spy-district");
    expect(selectSimulationAction(runtime, "player:policy", 2, 0, spiedRoutes, "balanced", loadView)?.command.type).toBe("collect-production");
  });

  it("assigns mixed bot profiles deterministically", () => {
    const assignments = Array.from({ length: 10 }, (_, index) =>
      getBotProfileForPlayer(index, { botProfileRotation: [...SIMULATION_BOT_PROFILES] })
    );

    expect(assignments).toEqual([
      "scout",
      "aggressor",
      "opportunist",
      "economy",
      "balanced",
      "scout",
      "aggressor",
      "opportunist",
      "economy",
      "balanced"
    ]);
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
  topPlayersByScore: report.topPlayersByScore,
  actionsByProfile: report.actionsByProfile,
  acceptedActionsByProfile: report.acceptedActionsByProfile,
  actionsByTypeAndProfile: report.actionsByTypeAndProfile,
  turnsWithoutValidActionByProfile: report.turnsWithoutValidActionByProfile,
  profileAssignmentSummary: report.profileAssignmentSummary,
  roundsPlayed: report.roundsPlayed,
  perRound: report.perRound.map((round) => ({
    round: round.round,
    tickAfterRound: round.tickAfterRound,
    minuteAfterRound: round.minuteAfterRound,
    actionsAttempted: round.actionsAttempted,
    actionsAccepted: round.actionsAccepted,
    actionsRejected: round.actionsRejected,
    spyReportsDelta: round.spyReportsDelta,
    battleReportsDelta: round.battleReportsDelta,
    cityFeedEventsDelta: round.cityFeedEventsDelta,
    resourceDeltaByKey: round.resourceDeltaByKey,
    attackReadyPlayers: round.attackReadyPlayers,
    craftReadyPlayers: round.craftReadyPlayers,
    productionReadyPlayers: round.productionReadyPlayers
  })),
  pacing: {
    milestones: report.pacing.milestones,
    heatRaidPressure: report.pacing.heatRaidPressure,
    bottleneckResources: report.pacing.bottleneckResources,
    warnings: report.pacing.warnings.map((warning) => warning.code)
  },
  kpi: {
    hardPassed: report.kpi.hardPassed,
    softWarnings: report.kpi.softWarnings.map((warning) => warning.code)
  }
});

const expectedRoundCount = (options: typeof FREE_MODE_SHARED_CITY_SCENARIOS[number]["options"]): number => {
  if (typeof options.rounds === "number") return options.rounds;
  if (typeof options.durationMinutes !== "number") return 0;
  const config = resolveModeConfig("free");
  const ticksPerMinute = Math.max(1, Math.round(60000 / config.tickRateMs));
  const ticksPerRound = Math.max(1, Math.floor(options.ticksPerRound ?? ticksPerMinute));
  return Math.ceil(options.durationMinutes * ticksPerMinute / ticksPerRound);
};

const createPolicyRuntime = (): ServerInstanceRuntime => ({
  record: { id: "instance:policy" },
  state: { root: { districtIds: ["district:policy-source"] }, districtsById: { "district:policy-source": { ownerPlayerId: "player:policy" } } }
} as unknown as ServerInstanceRuntime);

const createPolicyView = (): GameplaySliceView => ({
  district: {
    districtId: "district:policy-source",
    spyTargets: [{ districtId: "district:policy-target", name: "Target", ownerPlayerId: null, status: "active", enabled: true, disabledReason: null }],
    attackTargets: [{ districtId: "district:policy-target", name: "Target", ownerPlayerId: null, status: "active", enabled: true, disabledReason: null }],
    occupyTargets: [],
    slots: [
      {
        slotIndex: 0,
        buildingId: "building:policy-production",
        buildingTypeId: "factory",
        status: "active",
        canBuild: false,
        production: { resourceKey: "metal-parts", resourceLabel: "Metal parts", storedAmount: 1, storageCap: 10, amountPerTick: 1, canCollect: true, collectDisabledReason: null },
        processing: null,
        craftOptions: [],
        buildOptions: []
      }
    ]
  }
} as unknown as GameplaySliceView);
