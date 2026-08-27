import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { buildFullGameMatrixReport, formatFullGameMarkdown } from "./report";
import { runFullGameSimulation } from "./simulation";
import { FULL_GAME_SCENARIOS, type FullGameScenario } from "./types";

declare const process: { argv: string[]; exitCode?: number; env?: Record<string, string | undefined> };

async function writeJson(file: string, value: unknown) {
  await fs.mkdir(dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const args = parseArgs(process.argv.slice(2));
const artifactRoot = resolve(String(args.out ?? "artifacts/simulation/full-game"));
const matrix = args.matrix === true;
const verbose = args.verbose === true;
const seeds = matrix
  ? parseSeeds(String(args.seeds ?? "1,2,3,4,5,6,7,8,9,10"))
  : [String(args.seed ?? 1)];
const scenarios = matrix
  ? parseScenarios(String(args.scenarios ?? FULL_GAME_SCENARIOS.join(",")))
  : [String(args.scenario ?? "balanced-city") as FullGameScenario];
const games = [];
const sourceRevision = await resolveSourceRevision();

for (let index = 0; index < seeds.length; index += 1) {
  const seed = seeds[index]!;
  const scenario = scenarios[index % scenarios.length]!;
  console.log(`Starting full-game seed=${seed} scenario=${scenario}`);
  try {
    const report = await runFullGameSimulation({ seed, scenario, verbose, sourceRevision });
    games.push(report);
    await writeJson(join(artifactRoot, "games", seed, "summary.json"), report);
    if (!report.passed) await writeJson(join(artifactRoot, "games", seed, "failure-trace.json"), {
      seed, scenario, failureCodes: report.failureCodes, trace: report.traceTail
    });
    console.log(`Finished seed=${seed}: ${report.passed ? "PASS" : "FAIL"}; winner=${report.winnerId ?? "none"}; ticks=${report.durationTicks}`);
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(`Infrastructure failure seed=${seed}: ${message}`);
    process.exitCode = 1;
  }
}

const report = buildFullGameMatrixReport(games, { requiredSeeds: seeds, requiredScenarios: [...new Set(scenarios)] });
await fs.mkdir(artifactRoot, { recursive: true });
await writeJson(join(artifactRoot, "summary.json"), games[0] ?? null);
await writeJson(join(artifactRoot, "matrix-summary.json"), report);
await writeJson(join(artifactRoot, "coverage.json"), report.actionCoverage);
await writeJson(join(artifactRoot, "faction-matrix.json"), report.factionMatrix);
await writeJson(join(artifactRoot, "archetype-matrix.json"), report.archetypeMatrix);
await writeJson(join(artifactRoot, "failures.json"), report.games.filter((game) => !game.passed).map((game) => ({ seed: game.seed, scenario: game.scenario, failureCodes: game.failureCodes, errors: game.errors })));
await fs.writeFile(join(artifactRoot, "FULL_GAME_MATRIX_REPORT.md"), formatFullGameMarkdown(report), "utf8");
console.log(`MATRIX VERDICT: ${report.verdict}; games=${games.length}; artifacts=${artifactRoot}`);
if (report.verdict === "FAIL" || games.length !== seeds.length) process.exitCode = 1;

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index]!;
    if (!raw.startsWith("--")) continue;
    const [key, inline] = raw.slice(2).split("=", 2);
    if (inline !== undefined) result[key] = inline;
    else if (argv[index + 1] && !argv[index + 1]!.startsWith("--")) result[key] = argv[++index]!;
    else result[key] = true;
  }
  return result;
}

function parseSeeds(value: string): string[] {
  const range = /^(\d+)\.\.(\d+)$/u.exec(value.trim());
  if (range) return Array.from({ length: Number(range[2]) - Number(range[1]) + 1 }, (_, index) => String(Number(range[1]) + index));
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function parseScenarios(value: string): FullGameScenario[] {
  const requested = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  const invalid = requested.filter((entry) => !FULL_GAME_SCENARIOS.includes(entry as FullGameScenario));
  if (invalid.length) throw new Error(`Unknown full-game scenarios: ${invalid.join(", ")}`);
  return requested as FullGameScenario[];
}

async function resolveSourceRevision(): Promise<string> {
  const bundle = await fs.readFile(resolve(process.argv[1]!), "utf8");
  const bundleHash = createHash("sha256").update(bundle).digest("hex");
  if (process.env?.EMPIRE_BUILD_SHA) return `${process.env.EMPIRE_BUILD_SHA}+bundle:${bundleHash}`;
  try {
    const head = (await runGit(["rev-parse", "HEAD"])).trim();
    return `${head}+bundle:${bundleHash}`;
  } catch {
    return `working-tree-unresolved+bundle:${bundleHash}`;
  }
}

function runGit(args: string[]): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    execFile("git", args, { maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolvePromise(stdout);
    });
  });
}
