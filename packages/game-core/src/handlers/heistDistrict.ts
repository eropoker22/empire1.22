import type { HeistDistrictCommand, Notification, ResourceState } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreError } from "../errors";
import type { CoreEvent } from "../events";
import { CORE_EVENT_TYPES, createEvent, createNotification } from "../events";
import { createHeistCooldownKey, createHeistSourceCooldownKey, resolveHeistCooldownTicks } from "../rules";
import { composeEntityId } from "../utils";
import { validateHeist } from "../validation";
import { createPlayerCooldownState } from "./attackDistrictHelpers";
import { resolveCityHallNightPatrolPressure } from "./cityHallBuildingActions";

const STYLE_MULTIPLIERS = Object.freeze({
  stealth: 0.5,
  balanced: 1,
  all_in: 1.5
});
const HEIST_HEAT_GAIN = 4;

export const handleHeistDistrict = (
  state: CoreGameState,
  command: HeistDistrictCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const errors = validateHeist(state, command, context.config.balance.conflict);
  if (errors.length > 0) return { nextState: state, events: [], errors };

  const player = state.playersById[command.playerId]!;
  const targetDistrict = state.districtsById[command.payload.targetDistrictId]!;
  const targetOwner = targetDistrict.ownerPlayerId ? state.playersById[targetDistrict.ownerPlayerId] : undefined;
  const sourceDistrictId = command.payload.sourceDistrictId ?? resolveSingleOwnedOrigin(state, player.id, targetDistrict.id)!;
  const cooldownState = state.cooldownStatesById[player.cooldownStateId] ?? createPlayerCooldownState(player.id, player.cooldownStateId);
  const cityHallNightPatrol = resolveCityHallNightPatrolPressure({
    state,
    context,
    targetDistrict,
    tick: state.root.tick
  });
  const cooldownTicks = Math.ceil(resolveHeistCooldownTicks(context.config.balance.conflict) * cityHallNightPatrol.cooldownMultiplier);
  const heatGain = Math.ceil(HEIST_HEAT_GAIN * cityHallNightPatrol.heatMultiplier);
  const attackerResource = state.resourceStatesById[player.resourceStateId] ?? createPlayerResourceState(player.resourceStateId, player.id, state.root.tick);
  const defenderResource = targetOwner
    ? state.resourceStatesById[targetOwner.resourceStateId] ?? createPlayerResourceState(targetOwner.resourceStateId, targetOwner.id, state.root.tick)
    : null;
  const multiplier = STYLE_MULTIPLIERS[command.payload.style];
  const cashLoot = Math.min(
    Math.max(0, Number(defenderResource?.balances.cash || 0)),
    Math.max(1, Math.floor(command.payload.gangMembersSent * multiplier))
  );
  const dirtyCashLoot = Math.min(
    Math.max(0, Number(defenderResource?.balances["dirty-cash"] || 0)),
    Math.max(0, Math.floor(command.payload.gangMembersSent * multiplier * 0.5))
  );
  const nextAttackerResource: ResourceState = {
    ...attackerResource,
    balances: {
      ...attackerResource.balances,
      cash: Math.max(0, Number(attackerResource.balances.cash || 0)) + cashLoot,
      "dirty-cash": Math.max(0, Number(attackerResource.balances["dirty-cash"] || 0)) + dirtyCashLoot
    },
    lastUpdatedTick: state.root.tick,
    version: attackerResource.version + (state.resourceStatesById[attackerResource.id] ? 1 : 0)
  };
  const nextDefenderResource = defenderResource
    ? {
        ...defenderResource,
        balances: {
          ...defenderResource.balances,
          cash: Math.max(0, Number(defenderResource.balances.cash || 0) - cashLoot),
          "dirty-cash": Math.max(0, Number(defenderResource.balances["dirty-cash"] || 0) - dirtyCashLoot)
        },
        lastUpdatedTick: state.root.tick,
        version: defenderResource.version + (state.resourceStatesById[defenderResource.id] ? 1 : 0)
      }
    : null;
  const report = createHeistReportNotification({
    command,
    playerId: player.id,
    sourceDistrictId,
    targetDistrictId: targetDistrict.id,
    targetOwnerPlayerId: targetDistrict.ownerPlayerId,
    cashLoot,
    dirtyCashLoot,
    heatGained: heatGain,
    cooldownTicks,
    tick: state.root.tick
  });

  return {
    nextState: {
      ...state,
      playersById: {
        ...state.playersById,
        [player.id]: {
          ...player,
          lastActionAt: command.issuedAt,
          version: player.version + 1
        }
      },
      districtsById: {
        ...state.districtsById,
        [targetDistrict.id]: {
          ...targetDistrict,
          heat: Math.max(0, Number(targetDistrict.heat || 0) + heatGain),
          lastHeatDecayTick: state.root.tick,
          version: targetDistrict.version + 1
        }
      },
      cooldownStatesById: {
        ...state.cooldownStatesById,
        [cooldownState.id]: {
          ...cooldownState,
          cooldowns: {
            ...cooldownState.cooldowns,
            [createHeistCooldownKey(targetDistrict.id)]: state.root.tick + cooldownTicks,
            [createHeistSourceCooldownKey(sourceDistrictId)]: state.root.tick + cooldownTicks
          },
          version: cooldownState.version + (state.cooldownStatesById[cooldownState.id] ? 1 : 0)
        }
      },
      resourceStatesById: {
        ...state.resourceStatesById,
        [nextAttackerResource.id]: nextAttackerResource,
        ...(nextDefenderResource ? { [nextDefenderResource.id]: nextDefenderResource } : {})
      },
      notificationsById: {
        ...state.notificationsById,
        [report.id]: report
      },
      root: {
        ...state.root,
        notificationIds: [...state.root.notificationIds, report.id],
        version: state.root.version + 1
      }
    },
    events: [
      createEvent(CORE_EVENT_TYPES.districtHeisted, {
        attackerPlayerId: player.id,
        targetOwnerPlayerId: targetDistrict.ownerPlayerId,
        sourceDistrictId,
        targetDistrictId: targetDistrict.id,
        style: command.payload.style,
        gangMembersSent: command.payload.gangMembersSent,
        loot: { cash: cashLoot, "dirty-cash": dirtyCashLoot },
        heatGained: heatGain,
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

const createHeistReportNotification = (input: {
  command: HeistDistrictCommand;
  playerId: string;
  sourceDistrictId: string;
  targetDistrictId: string;
  targetOwnerPlayerId: string | null;
  cashLoot: number;
  dirtyCashLoot: number;
  heatGained: number;
  cooldownTicks: number;
  tick: number;
}): Notification =>
  createNotification({
    id: composeEntityId("notification", `${input.command.id}:heist-report`),
    recipientType: "player",
    recipientId: input.playerId,
    category: "report.heist",
    title: `Heist report: ${input.targetDistrictId}`,
    bodyKey: "report.heist",
    payload: {
      reportId: composeEntityId("report", `${input.command.id}:heist`),
      reportType: "heist",
      actionType: "heist-district",
      playerId: input.playerId,
      sourceDistrictId: input.sourceDistrictId,
      targetDistrictId: input.targetDistrictId,
      targetOwnerPlayerId: input.targetOwnerPlayerId,
      style: input.command.payload.style,
      result: "success",
      loot: { cash: input.cashLoot, "dirty-cash": input.dirtyCashLoot },
      heatGained: input.heatGained,
      cooldownTicks: input.cooldownTicks,
      tick: input.tick,
      createdAt: new Date(0).toISOString()
    },
    createdAt: new Date(0).toISOString(),
    readAt: null
  });

const createPlayerResourceState = (id: string, playerId: string, tick: number): ResourceState => ({
  id,
  ownerType: "player",
  ownerId: playerId,
  balances: {},
  incomeModifiers: {},
  lastUpdatedTick: tick,
  version: 1
});

const resolveSingleOwnedOrigin = (
  state: CoreGameState,
  playerId: string,
  targetDistrictId: string
): string | undefined => {
  const target = state.districtsById[targetDistrictId];
  if (!target) return undefined;
  const origins = Object.values(state.districtsById).filter((district) =>
    district.ownerPlayerId === playerId
    && district.adjacentDistrictIds.includes(target.id)
    && target.adjacentDistrictIds.includes(district.id)
  );
  return origins.length === 1 ? origins[0].id : undefined;
};
