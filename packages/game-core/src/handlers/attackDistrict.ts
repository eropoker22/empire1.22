import type { AttackDistrictCommand, AttackWeaponId } from "@empire/shared-types";
import type { GameCoreContext } from "../engine/context";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import {
  calculateBaseDefensePower,
  calculateAttackWeaponPower,
  calculateBazookaTotalDestructionBonusPercent,
  calculateGrenadeDefenseIgnorePercent,
  calculateSmgComboBonus,
  calculateTotalAttackPower,
  calculateTowerAttackReductionPercent,
  applyDayNightAttackDurationTicks,
  applyDayNightHeatGain,
  resolveAttackDurationGuardrailTicks,
  resolveAttackDurationTicks,
  resolveCombat,
  resolveTrap
} from "../rules";
import { createDefaultDistrictEffectModifiers, resolveActiveDistrictEffectModifiers } from "../rules/economy/calculateIncome";
import { resolveActiveAlliancePenaltyStatModifiers } from "../rules/alliances/alliancePenaltyModifiers";
import {
  applyFactionAggressiveHeatGain,
  applyFactionCooldownTicks,
  applyFactionEquipmentLosses,
  applyFactionMultiplier,
  getFactionPassiveModifiers,
  resolveFactionAlarmEffectivenessMultiplier,
  resolveFactionBaseDefensePowerMultiplier,
  resolveFactionCameraEffectivenessMultiplier
} from "../rules/factions/factionRules";
import { resolveAttackWeaponLoadout, validateAttack } from "../validation";
import {
  createBattleReportNotifications, createPlayerCooldownState, markDestroyedDistrictBuildings, reassignCapturedDistrictBuildings
} from "./attackDistrictHelpers";
import { createDistrictAttackEvents } from "./attackDistrictEvents";
import { deterministicUnitInterval } from "../utils/math";
import { increasePlayerPoliceHeat } from "./playerPoliceState";
import { appendRecoveryPoolEntries, createRecoveryEntriesFromLosses } from "./clinicBuildingActions";
import { appendSalvagePoolEntries, createSalvageEntriesFromLosses } from "./recyclingCenterBuildingActions";
import { resolveAirportEvacuationSupport } from "./airportBuildingActions";
import { resolveAttackEscapeMitigation } from "./attackEscapeMitigation";
import { resolveBountyClaims } from "./bountyCommands";
import { applyCarDealerCooldownReductionTicks, resolveCarDealerEscapeChanceBonusPct } from "./carDealerBuildingActions";
import { resolveCityHallNightPatrolPressure } from "./cityHallBuildingActions";
import { resolveCombinedCameraAlarmBonuses, resolveRecruitmentCenterSupportBonuses } from "./recruitmentCenterBuildingActions";
import { resolveFitnessAttackWeaponModifiers, resolveFitnessDefenseItemModifiers } from "./fitnessClubBuildingActions";
import { applyAttackWeaponLosses, writeAttackWeaponInventory } from "./attackWeaponInventory";
import { consumeTacticalGridCombat, resolveTacticalGridCombat } from "./tacticalGridCombat";

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
  const errors = validateAttack(state, command, context);

  if (errors.length > 0) {
    return {
      nextState: state,
      events: [],
      errors
    };
  }

  const attacker = state.playersById[command.playerId];
  const attackSelection = resolveAttackWeaponLoadout(state, attacker, command);
  const selectedLoadout = attackSelection.loadout;
  const weaponInventory = attackSelection.inventory;
  const targetDistrict = state.districtsById[command.payload.districtId];
  const sourceDistrict = command.payload.sourceDistrictId
    ? state.districtsById[command.payload.sourceDistrictId]
    : null;
  const activeTrap = Object.values(state.trapsById).find(
    (trap) => trap.districtId === targetDistrict.id && trap.status === "active"
  );
  const trapResolution = activeTrap
    ? resolveTrap({
        attackLoadout: selectedLoadout,
        trapAttackLosses: context.config.balance.conflict?.trapAttackLosses ?? 1
      })
    : {
        losses: {} as Partial<Record<AttackWeaponId, number>>,
        nextLoadout: { ...selectedLoadout },
        blocked: false,
        trapType: "toxic" as const,
        report: ""
      };
  const effectiveLoadout = trapResolution.nextLoadout;
  const grenadeCount = effectiveLoadout.grenade ?? 0;
  const bazookaCount = effectiveLoadout.bazooka ?? 0;
  const towerCount = targetDistrict.defenseLoadout["defense-tower"] ?? 0;
  const attackerDistrictModifiers = sourceDistrict?.ownerPlayerId === attacker.id
    ? resolveActiveDistrictEffectModifiers(state, sourceDistrict.id)
    : createDefaultDistrictEffectModifiers();
  const targetDistrictModifiers = resolveActiveDistrictEffectModifiers(state, targetDistrict.id);
  const nowIso = context.clock?.nowIso?.() ?? context.clock?.now?.().toISOString() ?? new Date().toISOString();
  const attackerPenaltyModifiers = resolveActiveAlliancePenaltyStatModifiers(state, attacker.id, nowIso);
  const defenderPenaltyModifiers = resolveActiveAlliancePenaltyStatModifiers(state, targetDistrict.ownerPlayerId, nowIso);
  const attackerFactionModifiers = getFactionPassiveModifiers(state, attacker.id, context);
  const defenderFactionModifiers = getFactionPassiveModifiers(state, targetDistrict.ownerPlayerId, context);
  const cityHallNightPatrol = resolveCityHallNightPatrolPressure({
    state,
    context,
    targetDistrict,
    tick: state.root.tick
  });
  const combinedCameraAlarmBonuses = resolveCombinedCameraAlarmBonuses({
    state,
    playerId: targetDistrict.ownerPlayerId,
    recruitmentCenterConfig: context.config.balance.recruitmentCenter,
    powerStationConfig: context.config.balance.powerStation,
    tick: state.root.tick
  });
  const attackerRecruitmentBonuses = resolveRecruitmentCenterSupportBonuses({
    state,
    playerId: attacker.id,
    config: context.config.balance.recruitmentCenter
  });
  const defenderRecruitmentBonuses = resolveRecruitmentCenterSupportBonuses({
    state,
    playerId: targetDistrict.ownerPlayerId,
    config: context.config.balance.recruitmentCenter
  });
  const attackWeaponModifiers = resolveFitnessAttackWeaponModifiers({
    state,
    playerId: attacker.id,
    fitnessConfig: context.config.balance.fitnessClub,
    recruitmentCenterConfig: context.config.balance.recruitmentCenter
  });
  const defenseItemModifiers = resolveFitnessDefenseItemModifiers({
    state,
    playerId: targetDistrict.ownerPlayerId,
    fitnessConfig: context.config.balance.fitnessClub,
    recruitmentCenterConfig: context.config.balance.recruitmentCenter,
    baseModifiers: {
      vest: resolveFactionBaseDefensePowerMultiplier(defenderFactionModifiers),
      barricades: resolveFactionBaseDefensePowerMultiplier(defenderFactionModifiers),
      "defense-tower": resolveFactionBaseDefensePowerMultiplier(defenderFactionModifiers),
      cameras: (1 + combinedCameraAlarmBonuses.cameraStrengthBonusPct / 100) * resolveFactionCameraEffectivenessMultiplier(defenderFactionModifiers),
      alarm: (1 + combinedCameraAlarmBonuses.alarmStrengthBonusPct / 100) * resolveFactionAlarmEffectivenessMultiplier(defenderFactionModifiers)
    }
  });
  const attackWeapons = context.config.balance.attackWeapons!;
  const baseAttackPower = calculateAttackWeaponPower(selectedLoadout, attackWeapons);
  const trapAdjustedAttackPower = calculateTotalAttackPower(effectiveLoadout, attackWeapons, 1, attackWeaponModifiers);
  const effectAdjustedAttackPower = applyFactionMultiplier(
    trapAdjustedAttackPower * attackerDistrictModifiers.attackMultiplier * attackerPenaltyModifiers.attackMultiplier,
    attackerFactionModifiers.attackPowerMultiplier
  );
  const defensePower = calculateBaseDefensePower(targetDistrict.defenseLoadout, defenseItemModifiers);
  const effectAdjustedDefensePower = applyFactionMultiplier(
    defensePower * targetDistrictModifiers.defenseMultiplier * defenderPenaltyModifiers.defenseMultiplier,
    defenderFactionModifiers.defensePowerMultiplier
  );
  const didResolveActualPvpCombat = !trapResolution.blocked;
  const tacticalGrid = resolveTacticalGridCombat(
    state,
    attacker.id,
    targetDistrict.ownerPlayerId,
    effectAdjustedAttackPower,
    effectAdjustedDefensePower,
    towerCount,
    grenadeCount,
    didResolveActualPvpCombat
  );
  const { effectiveAttackPower, effectiveDefensePower } = tacticalGrid;
  const catastropheRoll = deterministicUnitInterval(
    `${state.serverInstance.worldSeed}:attack:catastrophe:${command.playerId}:${targetDistrict.id}:${state.root.tick}`
  );
  const catastropheChance = Math.max(0, Math.min(1, Number(context.config.balance.conflict?.catastropheChance ?? 0)));
  const districtDestroyed = !trapResolution.blocked && catastropheRoll < catastropheChance;
  const combatResolution = resolveCombat({
    attackLoadoutAfterTrap: effectiveLoadout,
    defenseLoadout: targetDistrict.defenseLoadout,
    trapBlocked: trapResolution.blocked,
    districtDestroyed,
    effectiveAttackPower,
    effectiveDefensePower,
    trapLosses: trapResolution.losses,
    heatGain: applyFactionAggressiveHeatGain(
      Math.ceil(
        applyDayNightHeatGain(context.config.balance.conflict?.attackHeatGain ?? 6, state, context)
        * cityHallNightPatrol.heatMultiplier
      ),
      attackerFactionModifiers
    )
  });
  const attackSucceeded = combatResolution.districtCaptured;
  const battleResult = combatResolution.legacyResult;
  const escapeChanceBonusPct = resolveCarDealerEscapeChanceBonusPct({
    state,
    playerId: attacker.id,
    config: context.config.balance.carDealer
  });
  const airportEvacuation = resolveAirportEvacuationSupport({
    state,
    playerId: attacker.id,
    config: context.config.balance.airport,
    tick: state.root.tick
  });
  const escapeRoll = deterministicUnitInterval(
    `${state.serverInstance.worldSeed}:attack:escape:${command.playerId}:${targetDistrict.id}:${state.root.tick}`
  );
  const factionAdjustedAttackerLosses = applyFactionEquipmentLosses(combatResolution.attackerLosses, attackerFactionModifiers);
  const escapeMitigation = resolveAttackEscapeMitigation({
    losses: factionAdjustedAttackerLosses,
    nextLoadout: applyAttackWeaponLosses(effectiveLoadout, factionAdjustedAttackerLosses),
    heatGained: combatResolution.heatGained,
    enabled: !attackSucceeded,
    bonusPct: escapeChanceBonusPct + airportEvacuation.escapeChanceBonusPct,
    equipmentLossReductionPct: airportEvacuation.equipmentLossReductionPct,
    roll: escapeRoll
  });
  const currentCooldownState = state.cooldownStatesById[attacker.cooldownStateId] ?? createPlayerCooldownState(attacker.id, attacker.cooldownStateId);
  const attackCooldownKey = `attack:${targetDistrict.id}`;
  const attackDurationTicks = Math.max(
    resolveAttackDurationGuardrailTicks(context),
    Math.ceil(applyFactionCooldownTicks(
      applyDayNightAttackDurationTicks(applyCarDealerCooldownReductionTicks({
        baseTicks: resolveAttackDurationTicks(context),
        state,
        playerId: attacker.id,
        config: context.config.balance.carDealer,
        garageConfig: context.config.balance.garage,
        category: "attackPreparation"
      }), state, context),
      "attack",
      attackerFactionModifiers
    ) * cityHallNightPatrol.durationMultiplier)
  );
  const nextPoliceState = increasePlayerPoliceHeat(state, attacker, escapeMitigation.heatGained, state.root.tick);
  const notificationEntries = createBattleReportNotifications({
    command,
    attackerPlayerId: attacker.id,
    defenderPlayerId: targetDistrict.ownerPlayerId,
    targetDistrict,
    result: battleResult,
    outcomeTier: combatResolution.outcomeTier,
    districtCaptured: attackSucceeded,
    districtDestroyed,
    districtDamaged: combatResolution.districtDamaged,
    trapTriggered: Boolean(activeTrap),
    trapType: activeTrap ? trapResolution.trapType : null,
    trapReport: activeTrap ? trapResolution.report : null,
    attackerLosses: escapeMitigation.losses,
    defenderLosses: combatResolution.defenderLosses,
    heatGained: escapeMitigation.heatGained,
    reportForAttacker: combatResolution.reportForAttacker,
    reportForDefender: combatResolution.reportForDefender,
    attackDurationTicks,
    tacticalGrid: tacticalGrid.report,
    tick: state.root.tick
  });
  const attackerReport = notificationEntries[0];
  const defenderReport = notificationEntries[1] ?? null;
  const notificationIds = notificationEntries.map((notification) => notification.id);
  const nextWeaponInventory = applyAttackWeaponLosses(weaponInventory, escapeMitigation.losses);
  const nextResourceStatesById = writeAttackWeaponInventory(state, attacker, nextWeaponInventory);
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
        attackLoadout: nextWeaponInventory,
        lastActionAt: command.issuedAt,
        version: attacker.version + 1
      }
    },
    resourceStatesById: nextResourceStatesById,
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
        heat: districtDestroyed ? 0 : Math.max(0, Number(targetDistrict.heat || 0) + escapeMitigation.heatGained),
        lastHeatDecayTick: districtDestroyed || attackSucceeded ? state.root.tick : targetDistrict.lastHeatDecayTick,
        influence: districtDestroyed ? 0 : targetDistrict.influence,
        buildingIds: districtDestroyed ? [] : targetDistrict.buildingIds,
        defenseLoadout: districtDestroyed ? {} : combatResolution.nextDefenseLoadout,
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
          [attackCooldownKey]: state.root.tick + attackDurationTicks
        },
        version: currentCooldownState.version + (state.cooldownStatesById[currentCooldownState.id] ? 1 : 0)
      }
    },
    policeStatesById: {
      ...state.policeStatesById,
      [nextPoliceState.id]: nextPoliceState
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

  const recoveryState = appendSalvagePoolEntries(
    appendSalvagePoolEntries(
      appendRecoveryPoolEntries(
        appendRecoveryPoolEntries(
          nextState,
          attacker.id,
          createRecoveryEntriesFromLosses(
            escapeMitigation.losses,
            activeTrap && trapResolution.trapType === "toxic" ? "toxic_trap" : "attack"
          ),
          `${command.id}:attacker`
        ),
        targetDistrict.ownerPlayerId,
        createRecoveryEntriesFromLosses(combatResolution.defenderLosses, "defense"),
        `${command.id}:defender`
      ),
      attacker.id,
      createSalvageEntriesFromLosses(
        escapeMitigation.losses,
        activeTrap && trapResolution.trapType === "toxic" ? "toxic_trap" : "attack",
        context.config.balance.recyclingCenter
      ),
      `${command.id}:attacker`
    ),
    targetDistrict.ownerPlayerId,
    createSalvageEntriesFromLosses(combatResolution.defenderLosses, "defense", context.config.balance.recyclingCenter),
    `${command.id}:defender`
  );
  const events = createDistrictAttackEvents({
    command,
    attackerReport,
    defenderReport,
    targetDistrictId: targetDistrict.id,
    previousOwnerPlayerId: targetDistrict.ownerPlayerId,
    activeTrapId: activeTrap?.id ?? null,
    trapType: activeTrap ? trapResolution.trapType : null,
    trapLosses: trapResolution.losses,
    trapReport: activeTrap ? trapResolution.report : null,
    attackSucceeded,
    attackPayload: {
      attackPower: baseAttackPower,
      attackPowerAfterTrap: trapAdjustedAttackPower,
      attackMultiplier: attackerDistrictModifiers.attackMultiplier * attackerPenaltyModifiers.attackMultiplier,
      attackPowerAfterEffects: effectAdjustedAttackPower,
      ...tacticalGrid.attackPayload,
      attackPowerAfterTowers: effectiveAttackPower,
      defensePower,
      defenseMultiplier: targetDistrictModifiers.defenseMultiplier * defenderPenaltyModifiers.defenseMultiplier,
      cameraStrengthBonusPct: combinedCameraAlarmBonuses.cameraStrengthBonusPct,
      alarmStrengthBonusPct: combinedCameraAlarmBonuses.alarmStrengthBonusPct,
      recruitmentAttackWeaponStrengthBonusPct: attackerRecruitmentBonuses.attackWeaponStrengthBonusPct,
      recruitmentDefenseItemStrengthBonusPct: defenderRecruitmentBonuses.defenseItemStrengthBonusPct,
      defensePowerAfterEffects: effectAdjustedDefensePower,
      defensePowerAfterGrenades: effectiveDefensePower,
      smgComboBonus: calculateSmgComboBonus(effectiveLoadout),
      grenadeDefenseIgnorePercent: calculateGrenadeDefenseIgnorePercent(grenadeCount),
      towerAttackReductionPercent: calculateTowerAttackReductionPercent(towerCount),
      bazookaTotalDestructionBonusPercent: calculateBazookaTotalDestructionBonusPercent(bazookaCount),
      attackSucceeded,
      outcomeTier: combatResolution.outcomeTier,
      districtDestroyed,
      districtCaptured: combatResolution.districtCaptured,
      districtDamaged: combatResolution.districtDamaged,
      catastropheRoll,
      trapTriggered: Boolean(activeTrap),
      trapType: activeTrap ? trapResolution.trapType : null,
      attackerLosses: escapeMitigation.losses,
      defenderLosses: combatResolution.defenderLosses,
      heatGained: escapeMitigation.heatGained,
      carDealerEscapeChanceBonusPct: escapeChanceBonusPct,
      airportEvacuationEscapeChanceBonusPct: airportEvacuation.escapeChanceBonusPct,
      airportEvacuationEquipmentLossReductionPct: airportEvacuation.equipmentLossReductionPct,
      carDealerEscapeMitigated: escapeMitigation.mitigated,
      attackDurationTicks,
      attackDurationMs: attackDurationTicks * context.config.tickRateMs,
      reportForAttacker: combatResolution.reportForAttacker,
      reportForDefender: combatResolution.reportForDefender,
      ...tacticalGrid.eventPayload
    }
  });

  const bountyResult = resolveBountyClaims(recoveryState, { actorPlayerId: attacker.id, targetPlayerId: targetDistrict.ownerPlayerId, targetDistrictId: targetDistrict.id, actionType: districtDestroyed ? "destroy-district" : "attack-district", successfulAttack: attackSucceeded || districtDestroyed, capturesDistrict: attackSucceeded, destroysDistrict: districtDestroyed, commandId: command.id });
  const boostResult = consumeTacticalGridCombat(bountyResult.nextState, tacticalGrid, command.id, context);
  return { nextState: boostResult.nextState, events: [...events, ...bountyResult.events, ...boostResult.events], errors: [] };
};
