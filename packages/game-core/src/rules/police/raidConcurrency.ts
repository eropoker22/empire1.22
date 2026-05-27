import type { CoreGameState } from "../../entities";
import { getOpenPendingRaids } from "./raidTriggerHelpers";
import type { resolvePoliceConfig } from "./policeConfig";

export const countOpenPendingRaids = (policeStatesById: CoreGameState["policeStatesById"]): number =>
  Object.values(policeStatesById).reduce(
    (total, policeState) => total + getOpenPendingRaids(policeState).length,
    0
  );

export const resolveMaxConcurrentRaidsForPhase = (
  config: ReturnType<typeof resolvePoliceConfig>,
  phaseId: "day" | "night"
): number => {
  const configured = config.maxConcurrentRaidsByPhase?.[phaseId];
  return Math.max(0, Math.floor(Number(configured ?? config.maxPendingRaidsPerPlayer ?? 1)));
};
