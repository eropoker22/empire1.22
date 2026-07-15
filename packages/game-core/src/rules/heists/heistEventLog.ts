import { deterministicToken, type HeistExecutionContext } from "./heistDeterminism";

type AnyRecord = Record<string, any>;

export const addHeistRumor = (
  gameState: AnyRecord,
  message: string,
  payload: AnyRecord,
  context: HeistExecutionContext
): void => {
  const rumor = {
    id: `rumor:heist:${context.nowMs}:${deterministicToken(context.seed)}`,
    message,
    payload,
    createdAt: context.nowMs
  };

  if (Array.isArray(gameState.rumors)) {
    gameState.rumors.push(rumor);
    return;
  }
  appendHeistGameLog(gameState, "rumor", message, payload, context);
};

export const appendHeistGameLog = (
  gameState: AnyRecord,
  type: string,
  message: string,
  payload: AnyRecord,
  context: HeistExecutionContext
): void => {
  const entry = { type, message, payload, createdAt: context.nowMs };
  if (Array.isArray(gameState.eventLog)) gameState.eventLog.push(entry);
  else gameState.eventLog = [entry];

  if (!gameState.eventsById || !gameState.root) return;
  const tick = Math.max(0, Math.floor(Number(gameState.root.tick) || 0));
  const eventIds = Array.isArray(gameState.root.eventIds) ? gameState.root.eventIds : [];
  const id = `event:heist:${tick}:${eventIds.length}:${deterministicToken(`${context.seed}:${type}:${eventIds.length}`)}`;
  eventIds.push(id);
  gameState.root.eventIds = eventIds;
  gameState.eventsById[id] = {
    id,
    serverInstanceId: gameState.serverInstance?.id ?? "local",
    eventTypeId: type,
    status: "resolved",
    scope: "player",
    targetIds: [payload.attackerPlayerId, payload.targetPlayerId, payload.districtId, payload.targetDistrictId].filter(Boolean),
    startTick: tick,
    endTick: tick,
    payload: { message, ...payload },
    version: 1
  };
};
