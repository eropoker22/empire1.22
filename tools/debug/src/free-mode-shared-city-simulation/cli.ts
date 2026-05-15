import { runFreeModeSimulation } from "./runFreeModeSimulation";
import { isSimulationBotProfile, parseBotProfileList } from "./bot-profiles";
import { formatScenarioMatrixReport } from "./matrix-report";
import { resolveScenarioNames, runFreeModeScenarioMatrix } from "./scenarios";

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
  console.log(formatScenarioMatrixReport(matrix));
} else {
  const result = await runFreeModeSimulation({
    playerCount: parseNumber(options.players ?? options.playerCount),
    rounds: parseNumber(options.rounds),
    ticksPerRound: parseNumber(options.ticksPerRound),
    instanceId: typeof options.instance === "string" ? options.instance : undefined,
    includeInvalidProbe: options.includeInvalidProbe === "true",
    botProfile: typeof options.botProfile === "string" && isSimulationBotProfile(options.botProfile)
      ? options.botProfile
      : undefined,
    botProfileRotation: parseBotProfileList(typeof options.botProfiles === "string" ? options.botProfiles : undefined)
  });

  console.log(JSON.stringify(result.report, null, 2));
}
