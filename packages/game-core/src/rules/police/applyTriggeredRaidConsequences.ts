import type { CoreGameState } from "../../entities";
import type { CoreEvent } from "../../events";
import { CORE_EVENT_TYPES, createEvent } from "../../events";
import type { GameCoreContext } from "../../engine/context";
import type { RaidTriggerDecision } from "./raidTriggerTypes";
import { resolvePoliceConfig } from "./policeConfig";
import { applyRaidConsequences } from "./raidConsequences";

export const applyTriggeredRaidConsequences = (state: CoreGameState, decisions: RaidTriggerDecision[], context?: GameCoreContext) => {
  let nextState = state;
  const events: CoreEvent[] = [];
  const config = resolvePoliceConfig(context);
  for (const decision of decisions) {
    if (decision.type !== "pending_raid_created") continue;
    const player = nextState.playersById[decision.playerId];
    const raid = nextState.policeStatesById[player.policeStateId]?.pendingRaids?.find((entry) => entry.raidId === decision.raidId);
    if (!raid || config.autoResolveExpiredPendingRaids === false) continue;
    const applied = applyRaidConsequences(nextState, raid, context, { keepRaidOpen: true, preservePlayerHeat: true });
    nextState = applied.nextState;
    if (applied.applied) events.push(createEvent(CORE_EVENT_TYPES.policeRaidResolved, {
      ...applied.result, playerId: player.id, targetDistrictId: raid.targetDistrictId, phase: "active"
    }));
  }
  return { nextState, events };
};
