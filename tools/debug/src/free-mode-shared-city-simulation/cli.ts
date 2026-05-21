import { runFreeModeSimulation } from "./runFreeModeSimulation";
import { isSimulationBotProfile, parseBotProfileList } from "./bot-profiles";
import { formatScenarioMatrixReport } from "./matrix-report";
import { formatPacingReport } from "./pacing-report-format";
import { resolveScenario, resolveScenarioNames, runFreeModeScenarioMatrix } from "./scenarios";

declare const process: {
  argv: string[];
};

const options = Object.fromEntries(
  process.argv.slice(2).map((entry: string) => {
    const [key, value = "true"] = entry.replace(/^--/, "").split("=");
    return [key, value];
  })
);

const parseNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

if (options.matrix === "true") {
  const matrix = await runFreeModeScenarioMatrix(
    resolveScenarioNames(typeof options.scenarios === "string" ? options.scenarios : undefined)
  );
  console.log(options.json === "true"
    ? JSON.stringify(matrix, null, 2)
    : formatScenarioMatrixReport(matrix));
} else {
  const scenario = resolveScenario(typeof options.scenario === "string" ? options.scenario : undefined);
  const durationMinutes = parseNumber(options["duration-minutes"] ?? options.durationMinutes);
  const playerCount = parseNumber(options.players ?? options.playerCount);
  const rounds = parseNumber(options.rounds);
  const ticksPerRound = parseNumber(options.ticksPerRound);
  const result = await runFreeModeSimulation({
    ...scenario?.options,
    scenarioName: scenario?.name,
    playerCount: playerCount ?? scenario?.options.playerCount,
    rounds: rounds ?? scenario?.options.rounds,
    ticksPerRound: ticksPerRound ?? scenario?.options.ticksPerRound,
    durationMinutes: durationMinutes ?? scenario?.options.durationMinutes,
    instanceId: typeof options.instance === "string" ? options.instance : undefined,
    seed: typeof options.seed === "string" ? options.seed : undefined,
    includeInvalidProbe: options.includeInvalidProbe === "true",
    botProfile: typeof options.botProfile === "string" && isSimulationBotProfile(options.botProfile)
      ? options.botProfile
      : scenario?.options.botProfile,
    botProfileRotation: parseBotProfileList(typeof options.botProfiles === "string" ? options.botProfiles : undefined) ?? scenario?.options.botProfileRotation
  });

  if (options.json === "true") {
    console.log(JSON.stringify(result.report, null, 2));
  } else {
    console.log(formatPacingReport(result.report.pacing));
  }
}
