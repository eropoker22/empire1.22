import type { FactionReadModel, FactionStartingPackage } from "@empire/shared-types";
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
    startingPackageSummary: summarizeStartingPackage(definition.startingPackage),
    uiTheme: { ...definition.uiTheme }
  };
};

const summarizeStartingPackage = (pack: FactionStartingPackage): string[] => {
  const summary: string[] = [];
  if (pack.cash) summary.push(`Clean cash +${pack.cash}`);
  if (pack.dirtyCash) summary.push(`Dirty cash +${pack.dirtyCash}`);
  for (const [resourceKey, amount] of Object.entries(pack.resources ?? {})) {
    if (Number(amount) > 0) summary.push(`${resourceKey} +${amount}`);
  }
  for (const [weaponId, amount] of Object.entries(pack.attackLoadout ?? {})) {
    if (Number(amount) > 0) summary.push(`${weaponId} +${amount}`);
  }
  for (const [weaponId, amount] of Object.entries(pack.defenseLoadout ?? {})) {
    if (Number(amount) > 0) summary.push(`${weaponId} +${amount}`);
  }
  if (pack.initialInfluence) summary.push(`Influence +${pack.initialInfluence}`);
  if (pack.initialHeat) summary.push(`Heat +${pack.initialHeat}`);
  return summary;
};
