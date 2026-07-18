import type { HeistDistrictCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreError } from "../errors";
import type { CoreEvent } from "../events";
import { CORE_EVENT_TYPES, createEvent } from "../events";
import {
  createHeistAttackerTargetCooldownKey,
  createHeistGlobalCooldownKey,
  applyDistrictOperationLock,
  applyMajorOperationCooldowns,
  resolveImmediateHeist
} from "../rules";
import { validateHeist } from "../validation";
import { createPlayerCooldownState } from "./attackDistrictHelpers";
import { appendRecoveryPoolEntries, createRecoveryEntriesFromLosses } from "./clinicBuildingActions";
import { increasePlayerPoliceHeat } from "./playerPoliceState";
import { calculateReceivableResourceAmount } from "./storageCapacityCredit";
import { createHeistReportNotification, createPlayerResourceState, resolveSingleOwnedOrigin } from "./conflictReportNotifications";
import { bumpDistrictConflictRevision, bumpDistrictSecurityRevision } from "../state";

const HEISTABLE_RESOURCES = [
  "cash",
  "dirty-cash",
  "chemicals",
  "biomass",
  "metal-parts",
  "tech-core"
] as const;
const MAX_LOOT_FRACTIONS: Record<typeof HEISTABLE_RESOURCES[number], number> = {
  cash: 0.12,
  "dirty-cash": 0.12,
  chemicals: 0.10,
  biomass: 0.10,
  "metal-parts": 0.10,
  "tech-core": 0.10
};

export const handleHeistDistrict = (
  state: CoreGameState,
  command: HeistDistrictCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const errors = validateHeist(state, command, context.config.balance.conflict);
  if (errors.length > 0) return { nextState: state, events: [], errors };

  const config = context.config.balance.conflict?.heist;
  if (!config) {
    return {
      nextState: state,
      events: [],
      errors: [{ code: "HEIST_CONFIG_MISSING", message: "Canonical heist config is unavailable." }]
    };
  }
  const player = state.playersById[command.playerId]!;
  const targetDistrict = state.districtsById[command.payload.targetDistrictId]!;
  const targetOwner = state.playersById[targetDistrict.ownerPlayerId!]!;
  const sourceDistrictId = command.payload.sourceDistrictId
    ?? resolveSingleOwnedOrigin(state, player.id, targetDistrict.id)!;
  const resolution = resolveImmediateHeist(state, command, sourceDistrictId, config);
  const attackerResource = state.resourceStatesById[player.resourceStateId]
    ?? createPlayerResourceState(player.resourceStateId, player.id, state.root.tick);
  const defenderResource = state.resourceStatesById[targetOwner.resourceStateId]
    ?? createPlayerResourceState(targetOwner.resourceStateId, targetOwner.id, state.root.tick);
  const loot: Record<string, number> = {};
  for (const resourceKey of HEISTABLE_RESOURCES) {
    const available = Math.max(0, Math.floor(Number(defenderResource.balances[resourceKey] ?? 0)));
    const requested = Math.min(
      available,
      Math.floor(
        available
        * MAX_LOOT_FRACTIONS[resourceKey]
        * resolution.lootMultiplier
        * (0.75 + resolution.lootRoll * 0.25)
      )
    );
    loot[resourceKey] = calculateReceivableResourceAmount(
      state,
      player.id,
      resourceKey,
      requested,
      context.config.balance.warehouse!
    );
  }
  const attackerBalances = { ...attackerResource.balances };
  const defenderBalances = { ...defenderResource.balances };
  for (const resourceKey of HEISTABLE_RESOURCES) {
    const amount = loot[resourceKey] ?? 0;
    attackerBalances[resourceKey] = Math.max(0, Number(attackerBalances[resourceKey] ?? 0)) + amount;
    defenderBalances[resourceKey] = Math.max(0, Number(defenderBalances[resourceKey] ?? 0) - amount);
  }
  const currentPopulation = Math.max(0, Math.floor(Number(
    player.population ?? attackerBalances.population ?? 0
  )));
  const nextPopulation = Math.max(0, currentPopulation - resolution.gangLosses);
  if ("population" in attackerBalances) attackerBalances.population = nextPopulation;
  const nextPoliceState = increasePlayerPoliceHeat(
    state,
    player,
    resolution.heatGain,
    state.root.tick
  );
  const cooldownState = state.cooldownStatesById[player.cooldownStateId]
    ?? createPlayerCooldownState(player.id, player.cooldownStateId);
  const report = createHeistReportNotification({
    command,
    sourceDistrictId,
    targetOwnerPlayerId: targetOwner.id,
    outcome: resolution.outcome,
    loot,
    gangLosses: resolution.gangLosses,
    heatGained: resolution.heatGain,
    successChance: resolution.successChance,
    detectionChance: resolution.detectionChance,
    attackerIdentified: resolution.attackerIdentified,
    tick: state.root.tick
  });
  const bumpTargetRevision = resolution.trapId
    ? bumpDistrictSecurityRevision
    : bumpDistrictConflictRevision;
  const nextState: CoreGameState = {
    ...state,
    playersById: {
      ...state.playersById,
      [player.id]: {
        ...player,
        population: nextPopulation,
        lastActionAt: command.issuedAt,
        version: player.version + 1
      }
    },
    districtsById: {
      ...state.districtsById,
      [targetDistrict.id]: bumpTargetRevision(applyDistrictOperationLock({
        ...targetDistrict,
        heat: Math.max(0, targetDistrict.heat + resolution.heatGain),
        heistProtectedUntilTick: state.root.tick + config.victimProtectionTicks,
        lastHeatDecayTick: state.root.tick,
        version: targetDistrict.version + 1
      }, "heist", state.root.tick + config.sameTargetCooldownTicks))
    },
    resourceStatesById: {
      ...state.resourceStatesById,
      [attackerResource.id]: {
        ...attackerResource,
        balances: attackerBalances,
        lastUpdatedTick: state.root.tick,
        version: attackerResource.version + (state.resourceStatesById[attackerResource.id] ? 1 : 0)
      },
      [defenderResource.id]: {
        ...defenderResource,
        balances: defenderBalances,
        lastUpdatedTick: state.root.tick,
        version: defenderResource.version + (state.resourceStatesById[defenderResource.id] ? 1 : 0)
      }
    },
    cooldownStatesById: {
      ...state.cooldownStatesById,
      [cooldownState.id]: {
        ...cooldownState,
        cooldowns: applyMajorOperationCooldowns({
          ...cooldownState.cooldowns,
          [createHeistGlobalCooldownKey()]: state.root.tick + config.globalCooldownTicks,
          [createHeistAttackerTargetCooldownKey(targetDistrict.id)]:
            state.root.tick + config.sameTargetCooldownTicks,
        }, sourceDistrictId, state.root.tick, context.config.balance.conflict),
        version: cooldownState.version + (state.cooldownStatesById[cooldownState.id] ? 1 : 0)
      }
    },
    policeStatesById: { ...state.policeStatesById, [nextPoliceState.id]: nextPoliceState },
    trapsById: resolution.trapId
      ? {
          ...state.trapsById,
          [resolution.trapId]: {
            ...state.trapsById[resolution.trapId],
            status: "triggered",
            triggeredAtTick: state.root.tick,
            version: state.trapsById[resolution.trapId].version + 1
          }
        }
      : state.trapsById,
    notificationsById: { ...state.notificationsById, [report.id]: report },
    root: {
      ...state.root,
      notificationIds: [...state.root.notificationIds, report.id],
      version: state.root.version + 1
    }
  };
  const recoveredState = appendRecoveryPoolEntries(
    nextState,
    player.id,
    createRecoveryEntriesFromLosses({ population: resolution.gangLosses }, "heist"),
    command.id
  );

  return {
    nextState: recoveredState,
    events: [
      createEvent(CORE_EVENT_TYPES.districtHeisted, {
        attackerPlayerId: player.id,
        targetOwnerPlayerId: targetOwner.id,
        sourceDistrictId,
        targetDistrictId: targetDistrict.id,
        style: command.payload.style,
        gangMembersSent: command.payload.gangMembersSent,
        outcome: resolution.outcome,
        loot,
        gangLosses: resolution.gangLosses,
        heatGained: resolution.heatGain,
        cooldownTicks: config.globalCooldownTicks
      }),
      createEvent(CORE_EVENT_TYPES.notificationCreated, {
        notificationId: report.id,
        recipientId: player.id,
        category: report.category
      })
    ],
    errors: []
  };
};
