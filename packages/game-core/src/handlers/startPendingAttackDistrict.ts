import type { AttackDistrictCommand, PendingDistrictActionOperation } from "@empire/shared-types";
import type { GameCoreContext } from "../engine/context";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";
import type { CoreEvent } from "../events";
import {
  applyDayNightAttackDurationTicks,
  createSourceConflictLockKey,
  MAJOR_OFFENSE_COOLDOWN_KEY,
  resolveAttackDurationGuardrailTicks,
  resolveAttackDurationTicks
} from "../rules";
import { applyFactionCooldownTicks, getFactionPassiveModifiers } from "../rules/factions/factionRules";
import { resolveAttackWeaponLoadout, validateAttack } from "../validation";
import { applyAttackWeaponLosses, writeAttackWeaponInventory } from "./attackWeaponInventory";
import { applyCarDealerCooldownReductionTicks } from "./carDealerBuildingActions";
import { resolveCityHallNightPatrolPressure } from "./cityHallBuildingActions";
import { startPendingDistrictAction } from "./pendingDistrictActionShared";

export const handleAttackDistrict = (
  state: CoreGameState,
  command: AttackDistrictCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const errors = validateAttack(state, command, context);
  if (errors.length > 0) return { nextState: state, events: [], errors };
  const attacker = state.playersById[command.playerId];
  const targetDistrict = state.districtsById[command.payload.districtId];
  const sourceDistrictId = command.payload.sourceDistrictId!;
  const attackSelection = resolveAttackWeaponLoadout(state, attacker, command);
  const reservedAttackLoadout = attackSelection.loadout;
  const availableInventory = applyAttackWeaponLosses(attackSelection.inventory, reservedAttackLoadout);
  const durationTicks = resolveAttackPreparationDurationTicks(state, attacker.id, targetDistrict.id, context);
  const operation: PendingDistrictActionOperation = {
    id: `district-action-operation:${command.id}`,
    operationType: "attack",
    command,
    playerId: attacker.id,
    sourceDistrictId,
    targetDistrictId: targetDistrict.id,
    targetOwnerPlayerId: targetDistrict.ownerPlayerId ?? null,
    issuedAtTick: state.root.tick,
    resolveAtTick: state.root.tick + durationTicks,
    reservedAttackLoadout,
    cooldownKeys: [
      "attack:global",
      `attack:source:${sourceDistrictId}`,
      MAJOR_OFFENSE_COOLDOWN_KEY,
      createSourceConflictLockKey(sourceDistrictId)
    ],
    version: 1
  };
  const stateWithReservedAttackLoadout: CoreGameState = {
    ...state,
    playersById: {
      ...state.playersById,
      [attacker.id]: { ...attacker, attackLoadout: availableInventory }
    },
    resourceStatesById: writeAttackWeaponInventory(state, attacker, availableInventory)
  };
  return { nextState: startPendingDistrictAction(stateWithReservedAttackLoadout, operation), events: [], errors: [] };
};

export const resolveAttackPreparationDurationTicks = (
  state: CoreGameState,
  playerId: string,
  targetDistrictId: string,
  context: GameCoreContext
): number => {
  const targetDistrict = state.districtsById[targetDistrictId];
  const factionModifiers = getFactionPassiveModifiers(state, playerId, context);
  const cityHallNightPatrol = resolveCityHallNightPatrolPressure({ state, context, targetDistrict, tick: state.root.tick });
  return Math.max(
    resolveAttackDurationGuardrailTicks(context),
    Math.ceil(applyFactionCooldownTicks(
      applyDayNightAttackDurationTicks(applyCarDealerCooldownReductionTicks({
        baseTicks: resolveAttackDurationTicks(context),
        state,
        playerId,
        config: context.config.balance.carDealer,
        garageConfig: context.config.balance.garage,
        category: "attackPreparation"
      }), state, context),
      "attack",
      factionModifiers
    ) * cityHallNightPatrol.durationMultiplier)
  );
};
