import type { RobDistrictCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreError } from "../errors";
import type { CoreEvent } from "../events";
import { CORE_EVENT_TYPES, createEvent } from "../events";
import {
  applyDayNightHeatGain,
  applyFactionAggressiveHeatGain,
  createRobCooldownKey,
  createRobSourceCooldownKey,
  getFactionPassiveModifiers,
  hasNeutralDistrictRobberyLoot,
  NEUTRAL_ROBBERY_LOOT_KEYS,
  NEUTRAL_ROBBERY_MATERIAL_KEYS,
  resolveCurrentNeutralDistrictLootPool,
  resolveNeutralRobbery,
  resolveRobCooldownTicks
} from "../rules";
import { validateRob } from "../validation";
import { createPlayerCooldownState } from "./attackDistrictHelpers";
import { applyCarDealerCooldownReductionTicks } from "./carDealerBuildingActions";
import { resolveCityHallNightPatrolPressure } from "./cityHallBuildingActions";
import { increasePlayerPoliceHeat } from "./playerPoliceState";
import { calculateReceivableResourceAmount } from "./storageCapacityCredit";
import { createPlayerResourceState, createRobReportNotification, resolveSingleOwnedOrigin } from "./conflictReportNotifications";
import { bumpDistrictConflictRevision } from "../state";
export { handleRobDistrict } from "./startPendingRobDistrict";

export const resolvePendingRobDistrict = (
  state: CoreGameState,
  command: RobDistrictCommand,
  context: GameCoreContext,
  skipValidation = false
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const errors = skipValidation ? [] : validateRob(state, command, context.config.balance.conflict, {
    dayLengthTicks: context.config.balance.dayLengthTicks,
    nightLengthTicks: context.config.balance.nightLengthTicks
  });
  if (errors.length > 0) return { nextState: state, events: [], errors };
  const config = context.config.balance.conflict?.robbery;
  if (!config) {
    return {
      nextState: state,
      events: [],
      errors: [{ code: "ROBBERY_CONFIG_MISSING", message: "Canonical robbery config is unavailable." }]
    };
  }

  const player = state.playersById[command.playerId]!;
  const targetDistrict = state.districtsById[command.payload.targetDistrictId]!;
  const sourceDistrictId = command.payload.sourceDistrictId
    ?? resolveSingleOwnedOrigin(state, player.id, targetDistrict.id)!;
  const currentPool = resolveCurrentNeutralDistrictLootPool(
    state.serverInstance.worldSeed,
    targetDistrict,
    state.root.tick,
    config,
    {
      dayLengthTicks: context.config.balance.dayLengthTicks,
      nightLengthTicks: context.config.balance.nightLengthTicks
    }
  );
  if (!hasNeutralDistrictRobberyLoot(currentPool)) {
    return {
      nextState: state,
      events: [],
      errors: [{
        code: "TARGET_LOOT_EXHAUSTED",
        message: "Někdo byl rychlejší. V districtu už nezbyl použitelný loot."
      }]
    };
  }
  const resolution = resolveNeutralRobbery(
    state.serverInstance.worldSeed,
    command.id,
    targetDistrict.id,
    currentPool
  );
  const resourceState = state.resourceStatesById[player.resourceStateId]
    ?? createPlayerResourceState(player.resourceStateId, player.id, state.root.tick);
  const acceptedLoot: Record<string, number> = {};
  for (const resourceKey of NEUTRAL_ROBBERY_LOOT_KEYS) {
    acceptedLoot[resourceKey] = calculateReceivableResourceAmount(
      state,
      player.id,
      resourceKey,
      resolution.loot[resourceKey] ?? 0,
      context.config.balance.warehouse!
    );
  }
  const nextPool = restoreUnacceptedLoot(
    resolution.nextPool,
    resolution.loot,
    acceptedLoot
  );
  const nextBalances = { ...resourceState.balances };
  for (const resourceKey of NEUTRAL_ROBBERY_LOOT_KEYS) {
    nextBalances[resourceKey] = Math.max(0, Number(nextBalances[resourceKey] ?? 0))
      + Number(acceptedLoot[resourceKey] ?? 0);
  }
  const cityHallNightPatrol = resolveCityHallNightPatrolPressure({
    state,
    context,
    targetDistrict,
    tick: state.root.tick
  });
  const factionModifiers = getFactionPassiveModifiers(state, player.id, context);
  const playerHeat = Math.max(1, applyFactionAggressiveHeatGain(
    Math.ceil(
      applyDayNightHeatGain(resolution.playerHeat, state, context)
      * cityHallNightPatrol.heatMultiplier
    ),
    factionModifiers
  ));
  const districtHeat = Math.ceil(
    applyDayNightHeatGain(resolution.districtHeat, state, context)
    * cityHallNightPatrol.heatMultiplier
  );
  const nextPoliceState = increasePlayerPoliceHeat(state, player, playerHeat, state.root.tick);
  const cooldownState = state.cooldownStatesById[player.cooldownStateId]
    ?? createPlayerCooldownState(player.id, player.cooldownStateId);
  const cooldownTicks = Math.ceil(applyCarDealerCooldownReductionTicks({
    baseTicks: resolveRobCooldownTicks(context.config.balance.conflict),
    state,
    playerId: player.id,
    config: context.config.balance.carDealer,
    garageConfig: context.config.balance.garage,
    category: "districtRobbery"
  }) * cityHallNightPatrol.cooldownMultiplier);
  const cooldownEndsAtTick = state.root.tick + cooldownTicks;
  const report = createRobReportNotification({
    command,
    sourceDistrictId,
    result: resolution.outcome,
    loot: acceptedLoot,
    playerHeat,
    districtHeat,
    cooldownTicks,
    poolChangedBeforeResolution: command.payload.expectedLootPoolRevision !== undefined
      && command.payload.expectedLootPoolRevision !== currentPool.version,
    resolvedLootPoolRevision: currentPool.version,
    tick: state.root.tick,
    resolveAtTick: skipValidation ? state.root.tick : cooldownEndsAtTick,
    resolveAt: command.issuedAt,
    cooldownEndsAtTick
  });

  return {
    nextState: {
      ...state,
      playersById: {
        ...state.playersById,
        [player.id]: { ...player, lastActionAt: command.issuedAt, version: player.version + 1 }
      },
      districtsById: {
        ...state.districtsById,
        [targetDistrict.id]: bumpDistrictConflictRevision({
          ...targetDistrict,
          neutralLootPool: nextPool,
          heat: Math.max(0, targetDistrict.heat + districtHeat),
          lastHeatDecayTick: state.root.tick,
          version: targetDistrict.version + 1
        })
      },
      resourceStatesById: {
        ...state.resourceStatesById,
        [resourceState.id]: {
          ...resourceState,
          balances: nextBalances,
          lastUpdatedTick: state.root.tick,
          version: resourceState.version + (state.resourceStatesById[resourceState.id] ? 1 : 0)
        }
      },
      cooldownStatesById: {
        ...state.cooldownStatesById,
        [cooldownState.id]: {
          ...cooldownState,
          cooldowns: {
            ...cooldownState.cooldowns,
            [createRobCooldownKey(targetDistrict.id)]: cooldownEndsAtTick,
            [createRobSourceCooldownKey(sourceDistrictId)]: cooldownEndsAtTick
          },
          version: cooldownState.version + (state.cooldownStatesById[cooldownState.id] ? 1 : 0)
        }
      },
      policeStatesById: { ...state.policeStatesById, [nextPoliceState.id]: nextPoliceState },
      notificationsById: { ...state.notificationsById, [report.id]: report },
      root: {
        ...state.root,
        notificationIds: [...state.root.notificationIds, report.id],
        version: state.root.version + 1
      }
    },
    events: [
      createEvent(CORE_EVENT_TYPES.districtRobbed, {
        attackerPlayerId: player.id,
        sourceDistrictId,
        targetDistrictId: targetDistrict.id,
        result: resolution.outcome,
        loot: acceptedLoot,
        playerHeat,
        districtHeat,
        cooldownTicks
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

const restoreUnacceptedLoot = (
  pool: NonNullable<CoreGameState["districtsById"][string]["neutralLootPool"]>,
  planned: Record<string, number>,
  accepted: Record<string, number>
) => {
  const rejected = (key: string) => Math.max(0, Number(planned[key] ?? 0) - Number(accepted[key] ?? 0));
  return {
    ...pool,
    cash: pool.cash + rejected("cash"),
    dirtyCash: pool.dirtyCash + rejected("dirty-cash"),
    resources: Object.fromEntries(Object.entries(pool.resources).map(([key, amount]) => [
      key,
      Number(amount ?? 0) + (NEUTRAL_ROBBERY_MATERIAL_KEYS.includes(key as never) ? rejected(key) : 0)
    ]))
  };
};
