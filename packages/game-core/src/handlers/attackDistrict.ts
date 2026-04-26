import type {
  AttackDistrictCommand,
  AttackWeaponId
} from "@empire/shared-types";
import type { GameCoreContext } from "../engine/context";
import type { CoreGameState } from "../entities";
import { createEvent, CORE_EVENT_TYPES } from "../events";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import {
  calculateBaseDefensePower,
  calculateBazookaTotalDestructionBonusPercent,
  calculateEffectiveDefenseAfterGrenades,
  calculateGrenadeDefenseIgnorePercent,
  calculateReducedAttackPowerFromTowers,
  calculateSmgComboBonus,
  calculateTotalAttackPower,
  calculateTowerAttackReductionPercent,
  resolveTrap
} from "../rules";
import { validateAttack } from "../validation";
import {
  createBattleReportNotifications,
  createPlayerCooldownState,
  markDestroyedDistrictBuildings,
  reassignCapturedDistrictBuildings
} from "./attackDistrictHelpers";
import { deterministicUnitInterval } from "../utils/math";

/**
 * Responsibility: Orchestrates one authoritative district attack command.
 * Belongs here: attack validation, trap trigger handling, and battle report creation.
 * Does not belong here: transport delivery or UI-side prediction.
 */
export const handleAttackDistrict = (
  state: CoreGameState,
  command: AttackDistrictCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const errors = validateAttack(state, command);

  if (errors.length > 0) {
    return {
      nextState: state,
      events: [],
      errors
    };
  }

  const attacker = state.playersById[command.playerId];
  const targetDistrict = state.districtsById[command.payload.districtId];
  const activeTrap = Object.values(state.trapsById).find(
    (trap) => trap.districtId === targetDistrict.id && trap.status === "active"
  );
  const trapResolution = activeTrap
    ? resolveTrap({
        attackLoadout: attacker.attackLoadout,
        trapAttackLosses: context.config.balance.conflict?.trapAttackLosses ?? 1
      })
    : {
        losses: {} as Partial<Record<AttackWeaponId, number>>,
        nextLoadout: { ...attacker.attackLoadout },
        blocked: false
      };
  const effectiveLoadout = trapResolution.nextLoadout;
  const grenadeCount = effectiveLoadout.grenade ?? 0;
  const bazookaCount = effectiveLoadout.bazooka ?? 0;
  const towerCount = targetDistrict.defenseLoadout["defense-tower"] ?? 0;
  const baseAttackPower = calculateTotalAttackPower(attacker.attackLoadout);
  const trapAdjustedAttackPower = calculateTotalAttackPower(effectiveLoadout);
  const defensePower = calculateBaseDefensePower(targetDistrict.defenseLoadout);
  const effectiveAttackPower = calculateReducedAttackPowerFromTowers(trapAdjustedAttackPower, towerCount);
  const effectiveDefensePower = calculateEffectiveDefenseAfterGrenades(defensePower, grenadeCount);
  const catastropheRoll = deterministicUnitInterval(
    `${state.serverInstance.worldSeed}:attack:catastrophe:${command.playerId}:${targetDistrict.id}:${state.root.tick}:${command.id}`
  );
  const catastropheChance = Math.max(0, Math.min(1, Number(context.config.balance.conflict?.catastropheChance ?? 0)));
  const districtDestroyed = !trapResolution.blocked && catastropheRoll < catastropheChance;
  const attackSucceeded = !districtDestroyed && !trapResolution.blocked && effectiveAttackPower > effectiveDefensePower;
  const battleResult = trapResolution.blocked
    ? "blocked"
    : districtDestroyed
      ? "catastrophe"
      : attackSucceeded
      ? "success"
      : "failure";
  const currentCooldownState = state.cooldownStatesById[attacker.cooldownStateId] ?? createPlayerCooldownState(attacker.id, attacker.cooldownStateId);
  const attackCooldownKey = `attack:${targetDistrict.id}`;
  const notificationEntries = createBattleReportNotifications({
    command,
    attackerPlayerId: attacker.id,
    defenderPlayerId: targetDistrict.ownerPlayerId,
    targetDistrict,
    result: battleResult,
    districtCaptured: attackSucceeded,
    districtDestroyed,
    trapTriggered: Boolean(activeTrap),
    attackerLosses: trapResolution.losses,
    tick: state.root.tick
  });
  const attackerReport = notificationEntries[0];
  const defenderReport = notificationEntries[1] ?? null;
  const notificationIds = notificationEntries.map((notification) => notification.id);
  const nextBuildingsById = districtDestroyed
    ? markDestroyedDistrictBuildings(state, targetDistrict.buildingIds)
    : attackSucceeded
    ? reassignCapturedDistrictBuildings(state, targetDistrict.buildingIds, command.playerId)
    : state.buildingsById;

  const nextState: CoreGameState = {
    ...state,
    playersById: {
      ...state.playersById,
      [attacker.id]: {
        ...attacker,
        attackLoadout: effectiveLoadout,
        lastActionAt: command.issuedAt,
        version: attacker.version + 1
      }
    },
    districtsById: {
      ...state.districtsById,
      [targetDistrict.id]: {
        ...targetDistrict,
        ownerPlayerId: districtDestroyed
          ? null
          : attackSucceeded
            ? command.playerId
            : targetDistrict.ownerPlayerId,
        controllerAllianceId: districtDestroyed
          ? null
          : attackSucceeded
            ? attacker.allianceId
            : targetDistrict.controllerAllianceId,
        heat: districtDestroyed ? 0 : targetDistrict.heat,
        influence: districtDestroyed ? 0 : targetDistrict.influence,
        buildingIds: districtDestroyed ? [] : targetDistrict.buildingIds,
        defenseLoadout: districtDestroyed ? {} : targetDistrict.defenseLoadout,
        status: districtDestroyed
          ? "destroyed"
          : attackSucceeded
          ? "claimed"
          : trapResolution.blocked
            ? targetDistrict.status
            : "contested",
        version: targetDistrict.version + 1
      }
    },
    buildingsById: nextBuildingsById,
    cooldownStatesById: {
      ...state.cooldownStatesById,
      [currentCooldownState.id]: {
        ...currentCooldownState,
        cooldowns: {
          ...currentCooldownState.cooldowns,
          [attackCooldownKey]:
            state.root.tick + (context.config.balance.conflict?.attackCooldownTicks ?? 2)
        },
        version: currentCooldownState.version + (state.cooldownStatesById[currentCooldownState.id] ? 1 : 0)
      }
    },
    trapsById: activeTrap
      ? {
          ...state.trapsById,
          [activeTrap.id]: {
            ...activeTrap,
            status: "triggered",
            triggeredAtTick: state.root.tick,
            version: activeTrap.version + 1
          }
        }
      : state.trapsById,
    notificationsById: notificationEntries.reduce<CoreGameState["notificationsById"]>(
      (collection, notification) => ({
        ...collection,
        [notification.id]: notification
      }),
      state.notificationsById
    ),
    root: {
      ...state.root,
      notificationIds: [...state.root.notificationIds, ...notificationIds],
      version: state.root.version + 1
    }
  };

  const events: CoreEvent[] = [
    createEvent(CORE_EVENT_TYPES.districtAttacked, {
      attackerPlayerId: command.playerId,
      districtId: targetDistrict.id,
      attackPower: baseAttackPower,
      attackPowerAfterTrap: trapAdjustedAttackPower,
      attackPowerAfterTowers: effectiveAttackPower,
      defensePower,
      defensePowerAfterGrenades: effectiveDefensePower,
      smgComboBonus: calculateSmgComboBonus(effectiveLoadout),
      grenadeDefenseIgnorePercent: calculateGrenadeDefenseIgnorePercent(grenadeCount),
      towerAttackReductionPercent: calculateTowerAttackReductionPercent(towerCount),
      bazookaTotalDestructionBonusPercent: calculateBazookaTotalDestructionBonusPercent(bazookaCount),
      attackSucceeded,
      districtDestroyed,
      catastropheRoll,
      trapTriggered: Boolean(activeTrap),
      attackerLosses: trapResolution.losses
    }),
    createEvent(CORE_EVENT_TYPES.notificationCreated, {
      notificationId: attackerReport.id,
      recipientId: attackerReport.recipientId,
      category: attackerReport.category
    })
  ];

  if (defenderReport) {
    events.push(
      createEvent(CORE_EVENT_TYPES.notificationCreated, {
        notificationId: defenderReport.id,
        recipientId: defenderReport.recipientId,
        category: defenderReport.category
      })
    );
  }

  if (activeTrap) {
    events.push(
      createEvent(CORE_EVENT_TYPES.trapTriggered, {
        trapId: activeTrap.id,
        districtId: targetDistrict.id,
        attackerPlayerId: attacker.id
      })
    );
  }

  if (attackSucceeded) {
    events.push(
      createEvent(CORE_EVENT_TYPES.districtCaptured, {
        attackerPlayerId: command.playerId,
        districtId: targetDistrict.id,
        previousOwnerPlayerId: targetDistrict.ownerPlayerId
      })
    );
  }

  return {
    nextState,
    events,
    errors: []
  };
};
