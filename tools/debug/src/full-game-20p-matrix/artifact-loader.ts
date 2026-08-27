import { promises as fs } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { FullGameReport, FullGameScenario } from "./types";
import { FULL_GAME_SCENARIOS } from "./types";

export const loadFullGameReportFile = async (file: string): Promise<FullGameReport> => {
  const parsed = JSON.parse(await fs.readFile(file, "utf8")) as unknown;
  if (!isRecord(parsed)) throw new Error(`Full-game artifact is not an object: ${file}`);
  if (typeof parsed.seed !== "string" || !parsed.seed) throw new Error(`Full-game artifact has no seed: ${file}`);
  if (!FULL_GAME_SCENARIOS.includes(parsed.scenario as FullGameScenario)) throw new Error(`Full-game artifact has invalid scenario: ${file}`);
  if (!isRecord(parsed.actionCoverage)) throw new Error(`Full-game artifact has no raw action coverage: ${file}`);
  if (!Array.isArray(parsed.players)) throw new Error(`Full-game artifact has no raw player metrics: ${file}`);
  if (!Array.isArray(parsed.invariantViolations) || !Array.isArray(parsed.unexpectedErrors)) {
    throw new Error(`Full-game artifact has no invariant/exception metrics: ${file}`);
  }
  return parsed as unknown as FullGameReport;
};

export const loadFullGameReports = async (runsRoot: string): Promise<FullGameReport[]> => {
  const runDirectories = (await readdir(runsRoot))
    .sort((left, right) => numericSuffix(left) - numericSuffix(right) || left.localeCompare(right));
  const games: FullGameReport[] = [];
  for (const runDirectory of runDirectories) {
    const gamesDirectory = join(runsRoot, runDirectory, "games");
    const seedDirectories = await readdir(gamesDirectory).catch(() => []);
    for (const seedDirectory of seedDirectories) {
      games.push(await loadFullGameReportFile(join(gamesDirectory, seedDirectory, "summary.json")));
    }
  }
  return games.sort((left, right) => Number(left.seed) - Number(right.seed) || left.seed.localeCompare(right.seed));
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const numericSuffix = (value: string): number => {
  const match = /(\d+)$/u.exec(value);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};
