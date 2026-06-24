import type { Notification, ResourceState, RobDistrictCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreError } from "../errors";
import type { CoreEvent } from "../events";
import { CORE_EVENT_TYPES, createEvent, createNotification } from "../events";
import { composeEntityId } from "../utils";
import { validateRob } from "../validation";

const ROB_LOOT = Object.freeze({ cash: 25, "dirty-cash": 10 });
const ROB_HEAT_GAIN = 2;

export const handleRobDistrict = (
  state: CoreGameState,
  command: RobDistrictCommand,
  _context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const errors = validateRob(state, command);
  if (errors.length > 0) return { nextState: state, events: [], errors };

  const player = state.playersById[command.playerId]!;
  const targetDistrict = state.districtsById[command.payload.targetDistrictId]!;
  const sourceDistrictId = command.payload.sourceDistrictId ?? resolveSingleOwnedOrigin(state, player.id, targetDistrict.id)!;
  const resourceState = state.resourceStatesById[player.resourceStateId] ?? createPlayerResourceState(player.resourceStateId, player.id, state.root.tick);
  const nextResourceState: ResourceState = {
    ...resourceState,
    balances: {
      ...resourceState.balances,
      cash: Math.max(0, Number(resourceState.balances.cash || 0)) + ROB_LOOT.cash,
      "dirty-cash": Math.max(0, Number(resourceState.balances["dirty-cash"] || 0)) + ROB_LOOT["dirty-cash"]
    },
    lastUpdatedTick: state.root.tick,
    version: resourceState.version + (state.resourceStatesById[resourceState.id] ? 1 : 0)
  };
  const report = createRobReportNotification({
    command,
    playerId: player.id,
    sourceDistrictId,
    targetDistrictId: targetDistrict.id,
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
          heat: Math.max(0, Number(targetDistrict.heat || 0) + ROB_HEAT_GAIN),
          lastHeatDecayTick: state.root.tick,
          version: targetDistrict.version + 1
        }
      },
      resourceStatesById: {
        ...state.resourceStatesById,
        [nextResourceState.id]: nextResourceState
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
      createEvent(CORE_EVENT_TYPES.districtRobbed, {
        attackerPlayerId: player.id,
        sourceDistrictId,
        targetDistrictId: targetDistrict.id,
        loot: ROB_LOOT,
        heatGained: ROB_HEAT_GAIN
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

const createRobReportNotification = (input: {
  command: RobDistrictCommand;
  playerId: string;
  sourceDistrictId: string;
  targetDistrictId: string;
  tick: number;
}): Notification =>
  createNotification({
    id: composeEntityId("notification", `${input.command.id}:rob-report`),
    recipientType: "player",
    recipientId: input.playerId,
    category: "report.rob",
    title: `Rob report: ${input.targetDistrictId}`,
    bodyKey: "report.rob",
    payload: {
      reportId: composeEntityId("report", `${input.command.id}:rob`),
      reportType: "rob",
      actionType: "rob-district",
      playerId: input.playerId,
      sourceDistrictId: input.sourceDistrictId,
      targetDistrictId: input.targetDistrictId,
      result: "success",
      loot: ROB_LOOT,
      heatGained: ROB_HEAT_GAIN,
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
