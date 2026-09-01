import type { PendingDistrictActionOperation, RobDistrictCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreError } from "../errors";
import type { CoreEvent } from "../events";
import { createRobCooldownKey, createRobSourceCooldownKey, resolveRobCooldownTicks } from "../rules";
import { validateRob } from "../validation";
import { applyCarDealerCooldownReductionTicks } from "./carDealerBuildingActions";
import { resolveCityHallNightPatrolPressure } from "./cityHallBuildingActions";
import { resolveSingleOwnedOrigin } from "./conflictReportNotifications";
import { startPendingDistrictAction } from "./pendingDistrictActionShared";

export const handleRobDistrict = (
  state: CoreGameState,
  command: RobDistrictCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const errors = validateRob(state, command, context.config.balance.conflict, {
    dayLengthTicks: context.config.balance.dayLengthTicks,
    nightLengthTicks: context.config.balance.nightLengthTicks
  });
  if (errors.length > 0) return { nextState: state, events: [], errors };
  const config = context.config.balance.conflict?.robbery;
  if (!config) return { nextState: state, events: [], errors: [{ code: "ROBBERY_CONFIG_MISSING", message: "Canonical robbery config is unavailable." }] };
  const player = state.playersById[command.playerId]!;
  const targetDistrict = state.districtsById[command.payload.targetDistrictId]!;
  const sourceDistrictId = command.payload.sourceDistrictId
    ?? resolveSingleOwnedOrigin(state, player.id, targetDistrict.id)!;
  const cityHallNightPatrol = resolveCityHallNightPatrolPressure({ state, context, targetDistrict, tick: state.root.tick });
  const durationTicks = Math.max(1, Math.ceil(applyCarDealerCooldownReductionTicks({
    baseTicks: resolveRobCooldownTicks(context.config.balance.conflict),
    state,
    playerId: player.id,
    config: context.config.balance.carDealer,
    garageConfig: context.config.balance.garage,
    category: "districtRobbery"
  }) * cityHallNightPatrol.cooldownMultiplier));
  const operation: PendingDistrictActionOperation = {
    id: `district-action-operation:${command.id}`,
    operationType: "rob",
    command,
    playerId: player.id,
    sourceDistrictId,
    targetDistrictId: targetDistrict.id,
    targetOwnerPlayerId: targetDistrict.ownerPlayerId ?? null,
    issuedAtTick: state.root.tick,
    resolveAtTick: state.root.tick + durationTicks,
    cooldownKeys: [createRobCooldownKey(targetDistrict.id), createRobSourceCooldownKey(sourceDistrictId)],
    version: 1
  };
  return { nextState: startPendingDistrictAction(state, operation), events: [], errors: [] };
};
