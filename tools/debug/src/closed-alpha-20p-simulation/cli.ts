import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import {
  formatClosedAlphaAggregateDiagnosticsMarkdown,
  formatClosedAlphaAggregateMarkdownReport,
  formatClosedAlphaDiagnosticsMarkdown,
  formatClosedAlphaMarkdownReport,
  runClosedAlpha20PlayerSimulationMatrix,
  runClosedAlpha20PlayerSimulation,
  toStableJson,
  type ClosedAlphaAggregateReport,
  type ClosedAlphaSimulationReport,
  type SimulationScenario
} from "./simulation";

declare const console: {
  log: (message?: unknown) => void;
  error: (message?: unknown) => void;
};

declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exitCode?: number;
};

export interface ClosedAlpha20pCliResult {
  report?: ClosedAlphaSimulationReport;
  aggregate?: ClosedAlphaAggregateReport;
  jsonReportPath: string;
  markdownReportPath: string;
  diagnosticsReportPath: string;
  stdout: string;
}

const DEFAULT_REPORT_DIR = "artifacts/simulation";
const REPORT_BASENAME = "20-player-mixed-simulation.report";
const AGGREGATE_BASENAME = "20-player-mixed-simulation.aggregate";
const DIAGNOSTICS_BASENAME = "20-player-mixed-simulation.diagnostics";

export const runClosedAlpha20pCli = async (argv: string[]): Promise<ClosedAlpha20pCliResult> => {
  const args = parseArgs(argv);
  const seed = stringArg(args.seed, process.env.SIM_SEED ?? "empire-closed-alpha-20p");
  const steps = numberArg(args.steps, numberEnv("SIM_STEPS", 500));
  const playerCount = numberArg(args.players, numberEnv("SIM_PLAYERS", 20));
  const scenario = scenarioArg(args.scenario, process.env.SIM_SCENARIO ?? "mixed");
  const reportDir = stringArg(args.reportDir ?? args["report-dir"], process.env.SIM_REPORT_DIR ?? DEFAULT_REPORT_DIR);
  const seedList = parseSeedList(stringArg(args.seedList ?? args["seed-list"], process.env.SIM_SEED_LIST ?? ""));
  const seedCount = numberArg(args.seeds, numberEnv("SIM_SEEDS", seedList.length > 0 ? seedList.length : 1));
  const isMatrix = seedList.length > 0 || seedCount > 1;

  if (isMatrix) {
    const jsonReportPath = join(reportDir, `${AGGREGATE_BASENAME}.json`);
    const markdownReportPath = join(reportDir, `${AGGREGATE_BASENAME}.md`);
    const diagnosticsReportPath = join(reportDir, `${DIAGNOSTICS_BASENAME}.md`);
    const aggregate = await runClosedAlpha20PlayerSimulationMatrix({
      seed,
      steps,
      playerCount,
      scenario,
      seeds: seedCount,
      seedList: seedList.length ? seedList : undefined
    });

    await writeFile(jsonReportPath, toStableJson(aggregate));
    await writeFile(markdownReportPath, formatClosedAlphaAggregateMarkdownReport(aggregate));
    await writeFile(diagnosticsReportPath, formatClosedAlphaAggregateDiagnosticsMarkdown(aggregate));

    const stdout = [
      `${aggregate.passed ? "PASS" : "FAIL"} 20-player mixed-behavior closed-alpha aggregate simulation`,
      `seeds=${aggregate.config.seeds.length}`,
      `scenario=${aggregate.config.scenario}`,
      `steps=${aggregate.config.steps}`,
      `pass=${aggregate.runtime.passCount}, fail=${aggregate.runtime.failCount}`,
      `avgCommands=${aggregate.metrics.totalCommands?.average ?? 0}, avgRejectedRate=${(((aggregate.metrics.rejectedRate?.average ?? 0) * 100)).toFixed(1)}%`,
      `avgAttacks=${aggregate.metrics.attacks?.average ?? 0}, avgSpying=${aggregate.metrics.spyActions?.average ?? 0}, avgSpyToAttack=${(((aggregate.metrics.spyToAttackConversionRate?.average ?? 0) * 100)).toFixed(1)}%`,
      `avgBountyCreated=${aggregate.metrics.bountyCreated?.average ?? 0}, avgBountyClaimed=${aggregate.metrics.bountyClaimed?.average ?? 0}`,
      `avgActiveAlliances=${aggregate.metrics.activeAlliances?.average ?? 0}, avgUnusedSpecials=${aggregate.metrics.unusedSpecialActionCount?.average ?? 0}`,
      `JSON report: ${jsonReportPath}`,
      `Markdown report: ${markdownReportPath}`,
      `Diagnostics report: ${diagnosticsReportPath}`
    ].join("\n");

    console.log(stdout);
    if (!aggregate.passed) process.exitCode = 1;
    return {
      aggregate,
      jsonReportPath,
      markdownReportPath,
      diagnosticsReportPath,
      stdout
    };
  }

  const jsonReportPath = join(reportDir, `${REPORT_BASENAME}.json`);
  const markdownReportPath = join(reportDir, `${REPORT_BASENAME}.md`);
  const diagnosticsReportPath = join(reportDir, `${DIAGNOSTICS_BASENAME}.md`);

  const report = await runClosedAlpha20PlayerSimulation({
    seed,
    steps,
    playerCount,
    scenario
  });

  await writeFile(jsonReportPath, toStableJson(report));
  await writeFile(markdownReportPath, formatClosedAlphaMarkdownReport(report));
  await writeFile(diagnosticsReportPath, formatClosedAlphaDiagnosticsMarkdown(report));

  const stdout = [
    `${report.passed ? "PASS" : "FAIL"} 20-player mixed-behavior closed-alpha simulation`,
    `seed=${report.config.seed}`,
    `scenario=${report.config.scenario}`,
    `steps=${report.config.steps}`,
    `players=${report.players.length}`,
    `factions=${report.factions.availableFactionCount}, maxFactionOccurrence=${report.factions.maxOccurrence}`,
    `commands=${report.metrics.commands.totalSubmitted}, accepted=${report.metrics.commands.successful}, rejected=${report.metrics.commands.rejected}, errors=${report.metrics.commands.errors}`,
    `skippedNotReady=${report.diagnostics.actionReadiness.skippedNotReadyActions}, plannerAvoidableRejects=${report.diagnostics.actionReadiness.plannerAvoidableRejects}, trueServerRejects=${report.diagnostics.actionReadiness.trueServerRejects}`,
    `attacks=${report.metrics.combat.attacks}, spying=${report.metrics.spying.actions}, alliances=${report.metrics.alliances.createRequests + report.metrics.alliances.joinRequests + report.metrics.alliances.invitesSent}`,
    `bounty=${report.metrics.bounty.created}, buildingSpecials=${report.metrics.buildings.specialActions}, cooldownViolations=${report.metrics.buildings.cooldownViolations}`,
    `policeRaids=${report.diagnostics.policeRaids.triggered}, pendingRaids=${report.diagnostics.policeRaids.pendingFinal}`,
    `invariantViolations=${report.invariantViolations.length}, warnings=${report.warnings.length}`,
    `JSON report: ${jsonReportPath}`,
    `Markdown report: ${markdownReportPath}`,
    `Diagnostics report: ${diagnosticsReportPath}`
  ].join("\n");

  console.log(stdout);
  if (!report.passed) {
    process.exitCode = 1;
  }

  return {
    report,
    jsonReportPath,
    markdownReportPath,
    diagnosticsReportPath,
    stdout
  };
};

const parseArgs = (argv: string[]): Record<string, string | boolean> => {
  const result: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      result[key] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      result[key] = next;
      index += 1;
      continue;
    }
    result[key] = true;
  }
  return result;
};

const writeFile = async (path: string, content: string): Promise<void> => {
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, content, "utf8");
};

const stringArg = (value: string | boolean | undefined, fallback: string): string =>
  typeof value === "string" && value.length > 0 ? value : fallback;

const numberArg = (value: string | boolean | undefined, fallback: number): number => {
  const parsed = typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const numberEnv = (key: string, fallback: number): number => {
  const parsed = Number(process.env[key]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const parseSeedList = (value: string): string[] =>
  value.split(",").map((entry) => entry.trim()).filter(Boolean);

const scenarioArg = (value: string | boolean | undefined, fallback: string): SimulationScenario => {
  const raw = stringArg(value, fallback);
  return raw === "conflict-fixture" || raw === "special-coverage" ? raw : "mixed";
};

await runClosedAlpha20pCli(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
