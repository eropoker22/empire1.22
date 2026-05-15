import type { SimulationActionType, SimulationBotProfile } from "./types";

export const SIMULATION_BOT_PROFILES = [
  "scout",
  "aggressor",
  "opportunist",
  "economy",
  "balanced"
] as const satisfies readonly SimulationBotProfile[];

export const DEFAULT_SIMULATION_BOT_PROFILE: SimulationBotProfile = "scout";

export const isSimulationBotProfile = (value: string): value is SimulationBotProfile =>
  (SIMULATION_BOT_PROFILES as readonly string[]).includes(value);

export const getBotProfileForPlayer = (
  playerIndex: number,
  options: {
    botProfile?: SimulationBotProfile;
    botProfileRotation?: SimulationBotProfile[];
  }
): SimulationBotProfile => {
  const rotation = options.botProfileRotation?.filter(Boolean);
  return rotation?.length
    ? rotation[playerIndex % rotation.length]!
    : options.botProfile ?? DEFAULT_SIMULATION_BOT_PROFILE;
};

export const createActionPolicy = (
  profile: SimulationBotProfile,
  round: number,
  playerIndex: number
): SimulationActionType[] => {
  switch (profile) {
    case "aggressor":
      return ["attack-district", "spy-district", "collect-production"];
    case "opportunist":
      return (round + playerIndex) % 2 === 0
        ? ["attack-district", "spy-district", "collect-production"]
        : ["collect-production", "spy-district", "attack-district"];
    case "economy":
      return ["collect-production", "spy-district", "attack-district"];
    case "balanced":
      return createBalancedPolicy(round);
    case "scout":
    default:
      return round <= 3
        ? ["spy-district", "collect-production", "attack-district"]
        : ["spy-district", "attack-district", "collect-production"];
  }
};

export const parseBotProfileList = (value: string | undefined): SimulationBotProfile[] | undefined => {
  if (!value) return undefined;
  const profiles = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(isSimulationBotProfile);
  return profiles.length > 0 ? profiles : undefined;
};

const createBalancedPolicy = (round: number): SimulationActionType[] => {
  const mod = round % 3;
  if (mod === 0) return ["attack-district", "spy-district", "collect-production"];
  if (mod === 1) return ["spy-district", "attack-district", "collect-production"];
  return ["collect-production", "spy-district", "attack-district"];
};
