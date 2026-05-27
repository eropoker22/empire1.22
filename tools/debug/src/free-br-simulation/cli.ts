import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { formatEventJsonl } from "./audit-log";
import { formatFreeBrMarkdownReport, formatFreeBrMatrixMarkdownReport, toStableJson } from "./report";
import { parseScenarioList } from "./scenarios";
import { runFreeBrMatrix, runFreeBrSimulation } from "./simulation";
import type { FreeBrMatrixReport, FreeBrScenarioName, FreeBrSimulationReport } from "./types";

declare const process: {
  argv: string[];
  exitCode?: number;
};

export interface FreeBrCliResult {
  report?: FreeBrSimulationReport;
  matrix?: FreeBrMatrixReport;
  writtenFiles: string[];
  stdout: string;
}

export interface FreeBrCliIo {
  writeFiles?: boolean;
  stdout?: (message: string) => void;
}

const DEFAULT_MARKDOWN_OUT = "docs/balance/free-br-canonical-simulation-report.md";
const DEFAULT_JSON_OUT = "docs/balance/free-br-canonical-simulation-report.json";
const DEFAULT_EVENTS_OUT = "docs/balance/free-br-canonical-simulation-events.jsonl";
const DEFAULT_MATRIX_OUT = "docs/balance/free-br-canonical-simulation-matrix.md";

export const runFreeBrCli = async (argv: string[], io: FreeBrCliIo = {}): Promise<FreeBrCliResult> => {
  const args = parseArgs(argv);
  const writeFiles = io.writeFiles ?? true;
  const hours = numberArg(args.hours, 168);
  const runs = numberArg(args.runs, args.matrix ? 50 : 1);
  const seed = stringArg(args.seed, args.matrix ? "matrix" : "123");
  const scenario = stringArg(args.scenario, "canonical-20p") as FreeBrScenarioName;
  const writtenFiles: string[] = [];

  if (args.matrix) {
    const scenarios = args.scenarios ? parseScenarioList(String(args.scenarios)) : [scenario];
    const matrix = runFreeBrMatrix({ seed, hours, runs, scenarios });
    const out = stringArg(args.out, DEFAULT_MATRIX_OUT);
    if (writeFiles) {
      await writeFile(out, formatFreeBrMatrixMarkdownReport(matrix));
      writtenFiles.push(out);
    }
    const stdout = [
      `Free BR matrix complete: ${matrix.scenarioNames.join(", ")} x ${matrix.runs} runs`,
      `Average duration: ${matrix.averageMatchDuration}h`,
      `Final Lockdown wins: ${Math.round(matrix.finalLockdownWinRate * 100)}%`,
      `Timeout without winner: ${Math.round(matrix.timeoutWithoutWinnerChance * 100)}%`,
      writeFiles ? `Wrote ${out}` : ""
    ].filter(Boolean).join("\n");
    io.stdout?.(stdout);
    return { matrix, writtenFiles, stdout };
  }

  const report = runFreeBrSimulation({ seed, hours, scenario, runs });
  const markdownOut = args.out && !args.json ? stringArg(args.out, DEFAULT_MARKDOWN_OUT) : DEFAULT_MARKDOWN_OUT;
  const jsonOut = args.out && args.json && !args.markdown ? stringArg(args.out, DEFAULT_JSON_OUT) : DEFAULT_JSON_OUT;

  if (writeFiles) {
    if (args.markdown || !args.json) {
      await writeFile(markdownOut, formatFreeBrMarkdownReport(report));
      writtenFiles.push(markdownOut);
    }
    if (args.json || !args.markdown) {
      await writeFile(jsonOut, toStableJson(report));
      writtenFiles.push(jsonOut);
    }
    await writeFile(DEFAULT_EVENTS_OUT, formatEventJsonl(report.events));
    writtenFiles.push(DEFAULT_EVENTS_OUT);
  }

  const stdout = [
    `Free BR canonical simulation complete: seed=${report.summary.seed}, scenario=${report.summary.scenario}`,
    `Winner: ${report.summary.winner ?? "none"} (${report.summary.winReason})`,
    `Final Top 3: ${report.summary.finalTop3.map((entry) => `${entry.rank}. ${entry.playerId} (${Math.round(entry.score)})`).join(", ") || "none"}`,
    `Final Lockdown: start=${report.summary.finalLockdownStartedAtHour ?? "n/a"}h, end=${report.summary.finalLockdownEndedAtHour ?? "n/a"}h, paused=${report.summary.finalLockdownPausedHours}h`,
    `Top 8: ${report.players.filter((player) => player.finalPlacement <= 8).map((player) => player.playerId).join(", ")}`,
    `Attacks: ${report.summary.totalAttacks}, occupations: ${report.summary.occupiedNeutralDistricts}, spies: ${report.summary.totalSpyActions}`,
    `Building actions: ${report.summary.totalBuildingActions}, craft: ${report.summary.totalCraftActions}, police raids: ${report.summary.totalPoliceRaids}`,
    writeFiles ? `Wrote ${writtenFiles.join(", ")}` : ""
  ].filter(Boolean).join("\n");
  io.stdout?.(stdout);
  return { report, writtenFiles, stdout };
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
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

await runFreeBrCli(process.argv.slice(2), { stdout: (message) => console.log(message) })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
