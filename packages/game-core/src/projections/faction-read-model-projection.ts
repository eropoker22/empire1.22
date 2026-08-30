import type { FactionReadModel } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import { resolvePlayerFaction } from "../rules/factions/factionRules";

export const createFactionReadModel = (
  state: CoreGameState,
  playerId: string,
  context?: GameCoreContext
): FactionReadModel | null => {
  if (!context) return null;
  const definition = resolvePlayerFaction(state, playerId, context);
  if (!definition) return null;

  return {
    factionId: definition.id,
    name: definition.name,
    tagline: definition.tagline,
    playstyleSummary: definition.playstyleSummary,
    strengths: [...definition.strengths],
    weaknesses: [...definition.weaknesses],
    activePassiveEffects: [...definition.passiveEffectSummary],
    plannedPassiveEffects: [...(definition.plannedPassiveEffectSummary ?? [])],
    passiveModifiers: { ...definition.passiveModifiers },
    startingPackageSummary: [],
    specialAction: definition.specialAction ? { ...definition.specialAction } : undefined,
    uiTheme: { ...definition.uiTheme }
  };
};
