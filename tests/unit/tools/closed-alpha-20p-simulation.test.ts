import { describe, expect, it } from "vitest";
import {
  formatClosedAlphaAggregateDiagnosticsMarkdown,
  formatClosedAlphaAggregateMarkdownReport,
  formatClosedAlphaDiagnosticsMarkdown,
  runClosedAlpha20PlayerSimulation,
  runClosedAlpha20PlayerSimulationMatrix,
  toStableJson,
  type ClosedAlphaSimulationReport,
  type ResourceSummary
} from "@empire/tools-debug/closed-alpha-20p-simulation";

const isExpectedStart = (resources: ResourceSummary): boolean =>
  resources.cleanCash === 5000
  && resources.dirtyCash === 1000
  && resources.influence === 0
  && resources.heat === 0
  && resources.materials === 0;

const compactDeterministicSurface = (report: ClosedAlphaSimulationReport) => ({
  passed: report.passed,
  scenario: report.config.scenario,
  factions: report.factions,
  players: report.players.map((player) => ({
    id: player.id,
    factionId: player.factionId,
    behavior: player.behavior,
    activityBand: player.activityBand,
    activityRate: player.activityRate,
    riskTolerance: player.riskTolerance,
    targetPreference: player.targetPreference,
    homeDistrictId: player.homeDistrictId
  })),
  commandTypes: report.metrics.commands.byType,
  rejectedByCode: report.metrics.commands.rejectedByCode,
  readiness: {
    skipped: report.diagnostics.actionReadiness.skippedNotReadyActions,
    plannerAvoidableRejects: report.diagnostics.actionReadiness.plannerAvoidableRejects,
    trueServerRejects: report.diagnostics.actionReadiness.trueServerRejects,
    skipReasons: report.diagnostics.actionReadiness.skipReasons
  },
  attacks: report.metrics.combat.attacks,
  spying: report.metrics.spying.actions,
  alliances: {
    createRequests: report.metrics.alliances.createRequests,
    joinRequests: report.metrics.alliances.joinRequests,
    invitesSent: report.metrics.alliances.invitesSent,
    acceptedInvites: report.metrics.alliances.acceptedInvites
  },
  bounty: {
    created: report.metrics.bounty.created,
    claimed: report.metrics.bounty.claimed,
    totalValue: report.metrics.bounty.totalValue
  },
  buildings: {
    specials: report.metrics.buildings.specialActions,
    upgrades: report.metrics.buildings.upgrades,
    coverageAccepted: report.diagnostics.buildingSpecialCoverage.acceptedSpecialActions,
    coverageRejected: report.diagnostics.buildingSpecialCoverage.rejectedSpecialActions
  },
  followUps: {
    created: report.diagnostics.spyFollowUpQueue.opportunitiesCreated,
    submitted: report.diagnostics.spyFollowUpQueue.attacksSubmitted,
    blocked: report.diagnostics.spyFollowUpQueue.blockedReasons
  },
  policeRaids: {
    dayLimit: report.diagnostics.policeRaids.dayLimit,
    nightLimit: report.diagnostics.policeRaids.nightLimit,
    triggered: report.diagnostics.policeRaids.triggered,
    pendingFinal: report.diagnostics.policeRaids.pendingFinal
  },
  finalResources: report.finalResources,
  invariantViolations: report.invariantViolations,
  errors: report.errors
});

const compactAggregateDeterministicSurface = (aggregate: Awaited<ReturnType<typeof runClosedAlpha20PlayerSimulationMatrix>>) => ({
  passed: aggregate.passed,
  config: aggregate.config,
  metrics: aggregate.metrics,
  runSummaries: aggregate.runSummaries,
  rejectedCommandAggregate: aggregate.rejectedCommandAggregate,
  diagnostics: aggregate.diagnostics,
  topBehaviorStyles: aggregate.topBehaviorStyles,
  topFactions: aggregate.topFactions,
  reportSurfaces: aggregate.reports.map(compactDeterministicSurface)
});

describe("20-player closed-alpha authoritative simulation", () => {
  it("spawns 20 players with faction caps and exact starting resources", async () => {
    const report = await runClosedAlpha20PlayerSimulation({
      seed: "unit-20p",
      steps: 12,
      playerCount: 20
    });

    expect(report.players).toHaveLength(20);
    expect(report.config.scenario).toBe("mixed");
    expect(report.factions.maxOccurrence).toBeLessThanOrEqual(3);
    expect(Object.values(report.initialResources).every(isExpectedStart)).toBe(true);
    expect(report.runtime.completed).toBe(true);
    expect(report.metrics.commands.totalSubmitted).toBeGreaterThan(0);
    expect(report.diagnostics.actionReadiness.submittedCommands).toBe(report.metrics.commands.totalSubmitted);
    expect(report.diagnostics.policeRaids.dayLimit).toBe(2);
    expect(report.diagnostics.policeRaids.nightLimit).toBe(1);
    expect(report.invariantViolations).toEqual([]);
  });

  it("is deterministic for a fixed seed on the audited surfaces", async () => {
    const first = await runClosedAlpha20PlayerSimulation({
      seed: "deterministic-20p",
      steps: 8,
      playerCount: 20
    });
    const second = await runClosedAlpha20PlayerSimulation({
      seed: "deterministic-20p",
      steps: 8,
      playerCount: 20
    });

    expect(compactDeterministicSurface(first)).toEqual(compactDeterministicSurface(second));
  });

  it("can vary across different seeds", async () => {
    const first = await runClosedAlpha20PlayerSimulation({
      seed: "variance-a",
      steps: 8,
      playerCount: 20
    });
    const second = await runClosedAlpha20PlayerSimulation({
      seed: "variance-b",
      steps: 8,
      playerCount: 20
    });

    expect(compactDeterministicSurface(first)).not.toEqual(compactDeterministicSurface(second));
  });

  it("reports diagnostics even when alliances or attacks are sparse", async () => {
    const report = await runClosedAlpha20PlayerSimulation({
      seed: "diagnostics-20p",
      steps: 12,
      playerCount: 20
    });
    const markdown = formatClosedAlphaDiagnosticsMarkdown(report);

    expect(report.diagnostics.rejectedCommands.topReasons).toBeDefined();
    expect(report.diagnostics.actionReadiness.skipReasons).toBeDefined();
    expect(report.diagnostics.alliance.readinessTimeline).toBeDefined();
    expect(report.diagnostics.alliance.allianceCreateSkippedNotEnoughInfluence).toBeGreaterThanOrEqual(0);
    expect(report.diagnostics.conflict.spyToAttackConversionRate).toBeGreaterThanOrEqual(0);
    expect(report.diagnostics.spyFollowUpQueue.opportunitiesCreated).toBeGreaterThanOrEqual(0);
    expect(report.diagnostics.bountyOpportunityFunnel.bountyCreated).toBeGreaterThanOrEqual(0);
    expect(report.diagnostics.buildingSpecialCoverage.actions.length).toBeGreaterThan(0);
    expect(report.diagnostics.snowball.wealthTimeline.length).toBeGreaterThan(0);
    expect(report.diagnostics.snowball.topIncomeSourcesOverall).toBeDefined();
    expect(JSON.parse(toStableJson(report)).name).toBe("20-player mixed-behavior closed-alpha simulation");
    expect(markdown).toContain("## Action readiness summary");
    expect(markdown).toContain("## Rejected command breakdown");
    expect(markdown).toContain("## Spy follow-up queue");
    expect(markdown).toContain("## Building special action coverage");
    expect(markdown).toContain("## Police raids");
  });

  it("does not submit create-alliance before the 40 influence readiness gate", async () => {
    const report = await runClosedAlpha20PlayerSimulation({
      seed: "alliance-readiness-20p",
      steps: 40,
      playerCount: 20
    });

    expect(report.metrics.commands.rejectedByCode.ALLIANCE_CREATE_INSUFFICIENT_INFLUENCE ?? 0).toBe(0);
    expect(report.diagnostics.alliance.requiredInfluence).toBe(40);
    expect(report.diagnostics.alliance.allianceCreateSkippedNotEnoughInfluence).toBeGreaterThanOrEqual(0);
  });

  it("runs the conflict fixture scenario with explicit conflict diagnostics", async () => {
    const report = await runClosedAlpha20PlayerSimulation({
      seed: "conflict-fixture-unit",
      steps: 24,
      playerCount: 20,
      scenario: "conflict-fixture"
    });
    const markdown = formatClosedAlphaDiagnosticsMarkdown(report);

    expect(report.config.scenario).toBe("conflict-fixture");
    expect(report.players).toHaveLength(20);
    expect(report.diagnostics.conflict.attackPrimaryIntentions).toBeGreaterThanOrEqual(0);
    expect(report.diagnostics.conflict.plannedAttackFailureReasons).toBeDefined();
    expect(report.diagnostics.conflict.spyAuthorizationsCreated).toBeGreaterThanOrEqual(0);
    expect(markdown).toContain("## Conflict fixture result");
    expect(report.invariantViolations).toEqual([]);
  });

  it("runs the special coverage scenario and reports special action coverage fields", async () => {
    const report = await runClosedAlpha20PlayerSimulation({
      seed: "special-coverage-unit",
      steps: 24,
      playerCount: 20,
      scenario: "special-coverage"
    });
    const markdown = formatClosedAlphaDiagnosticsMarkdown(report);

    expect(report.config.scenario).toBe("special-coverage");
    expect(report.diagnostics.buildingSpecialCoverage.totalConfigured).toBeGreaterThan(0);
    expect(report.diagnostics.buildingSpecialCoverage.reachableSpecialActions).toBeGreaterThan(0);
    expect(report.diagnostics.buildingSpecialCoverage.submittedSpecialActions).toBeGreaterThanOrEqual(0);
    expect(markdown).toContain("## Building special coverage mode");
    expect(report.invariantViolations).toEqual([]);
  });

  it("runs a deterministic multi-seed aggregate report with diagnostics", async () => {
    const aggregate = await runClosedAlpha20PlayerSimulationMatrix({
      seedList: ["matrix-a", "matrix-b"],
      steps: 10,
      playerCount: 20
    });
    const second = await runClosedAlpha20PlayerSimulationMatrix({
      seedList: ["matrix-a", "matrix-b"],
      steps: 10,
      playerCount: 20
    });
    const markdown = formatClosedAlphaAggregateMarkdownReport(aggregate);
    const diagnosticsMarkdown = formatClosedAlphaAggregateDiagnosticsMarkdown(aggregate);

    expect(aggregate.config.seeds).toEqual(["matrix-a", "matrix-b"]);
    expect(aggregate.config.scenario).toBe("mixed");
    expect(aggregate.runSummaries).toHaveLength(2);
    expect(aggregate.metrics.totalCommands.average).toBeGreaterThan(0);
    expect(aggregate.metrics.rejectedRate.average).toBeGreaterThanOrEqual(0);
    expect(aggregate.rejectedCommandAggregate.topReasons).toBeDefined();
    expect(aggregate.diagnostics.actionReadiness.skippedNotReadyActions.average).toBeGreaterThanOrEqual(0);
    expect(aggregate.diagnostics.alliance.totalRejectedAllianceCommands).toBeGreaterThanOrEqual(0);
    expect(aggregate.diagnostics.conflict.spyToAttackConversionRate.average).toBeGreaterThanOrEqual(0);
    expect(aggregate.diagnostics.buildingSpecialCoverage.actions.length).toBeGreaterThan(0);
    expect(aggregate.diagnostics.policeRaids.dayLimit).toBe(2);
    expect(aggregate.diagnostics.policeRaids.nightLimit).toBe(1);
    expect(aggregate.diagnostics.boost.standaloneCommandFound).toBe(false);
    expect(aggregate.reports.every((report) => report.diagnostics.alliance)).toBe(true);
    expect(aggregate.reports.every((report) => report.diagnostics.conflict)).toBe(true);
    expect(aggregate.reports.every((report) => report.diagnostics.snowball.wealthTimeline.length > 0)).toBe(true);
    expect(JSON.parse(toStableJson(aggregate)).name).toBe("20-player mixed-behavior closed-alpha aggregate simulation");
    expect(markdown).toContain("## Aggregate metrics");
    expect(diagnosticsMarkdown).toContain("## Action readiness summary");
    expect(diagnosticsMarkdown).toContain("## Boost audit");
    expect(compactAggregateDeterministicSurface(aggregate)).toEqual(compactAggregateDeterministicSurface(second));
  });
});
