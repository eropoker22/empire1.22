import { runFreeModeSimulation } from "./runFreeModeSimulation";

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

const result = await runFreeModeSimulation({
  playerCount: parseNumber(options.players ?? options.playerCount),
  rounds: parseNumber(options.rounds),
  ticksPerRound: parseNumber(options.ticksPerRound),
  instanceId: typeof options.instance === "string" ? options.instance : undefined,
  includeInvalidProbe: options.includeInvalidProbe === "true"
});

console.log(JSON.stringify(result.report, null, 2));
