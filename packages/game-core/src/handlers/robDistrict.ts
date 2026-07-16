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
  regenerateNeutralDistrictLootPool,
  resolveNeutralRobbery,
  resolveRobCooldownTicks,
  seedNeutralDistrictLootPool
} from "../rules";
import { validateRob } from "../validation";
import { createPlayerCooldownState } from "./attackDistrictHelpers";
import { applyCarDealerCooldownReductionTicks } from "./carDealerBuildingActions";
import { resolveCityHallNightPatrolPressure } from "./cityHallBuildingActions";
import { increasePlayerPoliceHeat } from "./playerPoliceState";
import { calculateReceivableResourceAmount } from "./storageCapacityCredit";
import { createPlayerResourceState, createRobReportNotification, resolveSingleOwnedOrigin } from "./conflictReportNotifications";
import { bumpDistrictConflictRevision } from "../state";

const ROB_LOOT_KEYS = ["cash", "dirty-cash", "chemicals", "biomass", "metal-parts"] as const;

export const handleRobDistrict = (
  state: CoreGameState,
  command: RobDistrictCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const errors = validateRob(state, command, context.config.balance.conflict);
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
  const cityDayLength = Math.max(
    1,
    Number(context.config.balance.dayLengthTicks ?? 0)
    + Number(context.config.balance.nightLengthTicks ?? 0)
  );
  const cityDay = Math.floor(state.root.tick / cityDayLength);
  const seededPool = targetDistrict.neutralLootPool
    ?? seedNeutralDistrictLootPool(state.serverInstance.worldSeed, targetDistrict, cityDay, config);
  const currentPool = regenerateNeutralDistrictLootPool(
    seededPool,
    cityDay,
    config.cityDayRegenerationFraction
  );
  const resolution = resolveNeutralRobbery(
    state.serverInstance.worldSeed,
    command.id,
    targetDistrict.id,
    currentPool
  );
  const resourceState = state.resourceStatesById[player.resourceStateId]
    ?? createPlayerResourceState(player.resourceStateId, player.id, state.root.tick);
  const acceptedLoot: Record<string, number> = {};
  for (const resourceKey of ROB_LOOT_KEYS) {
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
  for (const resourceKey of ROB_LOOT_KEYS) {
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
  const report = createRobReportNotification({
    command,
    sourceDistrictId,
    result: resolution.outcome,
    loot: acceptedLoot,
    playerHeat,
    districtHeat,
    cooldownTicks,
    tick: state.root.tick
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
            [createRobCooldownKey(targetDistrict.id)]: state.root.tick + cooldownTicks,
            [createRobSourceCooldownKey(sourceDistrictId)]: state.root.tick + cooldownTicks
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
    resources: {
      ...pool.resources,
      chemicals: Number(pool.resources.chemicals ?? 0) + rejected("chemicals"),
      biomass: Number(pool.resources.biomass ?? 0) + rejected("biomass"),
      "metal-parts": Number(pool.resources["metal-parts"] ?? 0) + rejected("metal-parts")
    }
  };
};
