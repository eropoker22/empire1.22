import { runFreeBrMatrixReports } from "./simulation";
import type { FreeBrScenarioName } from "./types";

declare const process: {
  argv: string[];
};

const args = parseArgs(process.argv.slice(2));
const seed = stringArg(args.seed, "matrix");
const hours = numberArg(args.hours, 168);
const runs = numberArg(args.runs, 1);
const startRun = numberArg(args.startRun, 1);
const scenario = stringArg(args.scenario, "canonical-20p") as FreeBrScenarioName;

const reports = runFreeBrMatrixReports({
  seed,
  hours,
  runs,
  startRun,
  scenarios: [scenario],
  auditLevel: "matrix"
});

console.log(JSON.stringify(reports));

function parseArgs(argv: string[]): Record<string, string | boolean> {
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
}

function stringArg(value: string | boolean | undefined, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function numberArg(value: string | boolean | undefined, fallback: number): number {
  const parsed = typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
