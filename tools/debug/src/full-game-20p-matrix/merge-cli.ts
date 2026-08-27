import { promises as fs } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadFullGameReports } from "./artifact-loader";
import { buildFullGameMatrixReport, formatFullGameMarkdown } from "./report";
import { FULL_GAME_SCENARIOS, type FullGameScenario } from "./types";

declare const process: { argv: string[]; exitCode?: number };

const args = parseArgs(process.argv.slice(2));
const runsRoot = resolve(String(args.runs ?? "artifacts/simulation/full-game-runs"));
const artifactRoot = resolve(String(args.out ?? "artifacts/simulation/full-game"));
const games = await loadFullGameReports(runsRoot);
const requiredSeeds = parseSeeds(args.seeds || "1..10");
const requiredScenarios = parseScenarios(args.scenarios || FULL_GAME_SCENARIOS.join(","));
const report = buildFullGameMatrixReport(games, { requiredSeeds, requiredScenarios });
await writeJson(join(artifactRoot, "summary.json"), games[0] ?? null);
await writeJson(join(artifactRoot, "matrix-summary.json"), report);
await writeJson(join(artifactRoot, "coverage.json"), report.actionCoverage);
await writeJson(join(artifactRoot, "faction-matrix.json"), report.factionMatrix);
await writeJson(join(artifactRoot, "archetype-matrix.json"), report.archetypeMatrix);
await writeJson(join(artifactRoot, "failures.json"), report.games
  .filter((game) => !game.passed)
  .map((game) => ({ seed: game.seed, scenario: game.scenario, failureCodes: game.failureCodes, errors: game.errors })));
await fs.writeFile(join(artifactRoot, "FULL_GAME_MATRIX_REPORT.md"), formatFullGameMarkdown(report), "utf8");
console.log(`MATRIX VERDICT: ${report.verdict}; merged games=${games.length}; artifacts=${artifactRoot}`);
if (report.verdict === "FAIL" || games.length === 0) process.exitCode = 1;

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv: string[]): Record<string, string> {
  return Object.fromEntries(argv.flatMap((raw) => {
    if (!raw.startsWith("--")) return [];
    const [key, value = ""] = raw.slice(2).split("=", 2);
    return [[key, value]];
  }));
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
