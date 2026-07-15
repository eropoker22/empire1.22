import type { GameCoreContext } from "../engine/context";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import {
  calculateEffectiveDefenseAfterGrenades,
  calculateReducedAttackPowerFromTowers,
  consumeTacticalGrid,
  getPlayerTacticalGridMultiplier
} from "../rules";

export interface TacticalGridCombatResolution {
  attackerPlayerId: string;
  defenderPlayerId: string | null;
  isValidPvpCombat: boolean;
  didResolveActualPvpCombat: boolean;
  effectiveAttackPower: number;
  effectiveDefensePower: number;
  report: {
    attackerApplied: boolean;
    defenderApplied: boolean;
    multiplier: number;
  };
  attackPayload: {
    attackPowerAfterTacticalGrid: number;
    defensePowerAfterTacticalGrid: number;
  };
  eventPayload: {
    tacticalGridAttackerMultiplier: number;
    tacticalGridDefenderMultiplier: number;
  };
}

export const resolveTacticalGridCombat = (
  state: CoreGameState,
  attackerPlayerId: string,
  defenderPlayerId: string | null,
  attackPower: number,
  defensePower: number,
  towerCount: number,
  grenadeCount: number,
  didResolveActualPvpCombat: boolean
): TacticalGridCombatResolution => {
  const isValidPvpCombat = Boolean(
    didResolveActualPvpCombat
    && defenderPlayerId
    && defenderPlayerId !== attackerPlayerId
    && state.playersById[defenderPlayerId]
  );
  const attackerMultiplier = isValidPvpCombat
    ? getPlayerTacticalGridMultiplier(state, attackerPlayerId)
    : 1;
  const defenderMultiplier = isValidPvpCombat
    ? getPlayerTacticalGridMultiplier(state, defenderPlayerId)
    : 1;
  const tacticalAttackPower = Math.max(0, Math.round(attackPower * attackerMultiplier));
  const tacticalDefensePower = Math.max(0, Math.round(defensePower * defenderMultiplier));

  return {
    attackerPlayerId,
    defenderPlayerId,
    isValidPvpCombat,
    didResolveActualPvpCombat,
    effectiveAttackPower: calculateReducedAttackPowerFromTowers(tacticalAttackPower, towerCount),
    effectiveDefensePower: calculateEffectiveDefenseAfterGrenades(tacticalDefensePower, grenadeCount),
    report: {
      attackerApplied: attackerMultiplier > 1,
      defenderApplied: defenderMultiplier > 1,
      multiplier: Math.max(attackerMultiplier, defenderMultiplier)
    },
    attackPayload: {
      attackPowerAfterTacticalGrid: tacticalAttackPower,
      defensePowerAfterTacticalGrid: tacticalDefensePower
    },
    eventPayload: {
      tacticalGridAttackerMultiplier: attackerMultiplier,
      tacticalGridDefenderMultiplier: defenderMultiplier
    }
  };
};

export const consumeTacticalGridCombat = (
  state: CoreGameState,
  resolution: TacticalGridCombatResolution,
  combatId: string,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[] } => {
  if (!resolution.didResolveActualPvpCombat || !resolution.isValidPvpCombat) {
    return { nextState: state, events: [] };
  }
  const attacker = consumeTacticalGrid(
    state,
    resolution.attackerPlayerId,
    combatId,
    "attacker",
    context
  );
  const defender = consumeTacticalGrid(
    attacker.nextState,
    resolution.defenderPlayerId,
    combatId,
    "defender",
    context
  );
  return { nextState: defender.nextState, events: [...attacker.events, ...defender.events] };
};
