import type { CoreGameState } from "@empire/game-core";
import type {
  AttackDistrictCommand,
  CollectProductionCommand,
  DistrictId,
  GameplaySliceView,
  PlayerId,
  SpyDistrictCommand
} from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../../../../apps/server/src/runtime/instance/server-instance-runtime";
import { createAttackCommand, createCollectCommand, createSpyCommand } from "./commands";

export interface SelectedSimulationAction {
  command: SpyDistrictCommand | AttackDistrictCommand | CollectProductionCommand;
  focusDistrictId: DistrictId;
  routeKey?: string;
}

export const selectSimulationAction = (
  runtime: ServerInstanceRuntime,
  playerId: PlayerId,
  round: number,
  playerIndex: number,
  spiedRoutes: Set<string>,
  loadView: (districtId: DistrictId) => GameplaySliceView | null
): SelectedSimulationAction | null => {
  const views = getOwnedDistrictIds(runtime.state, playerId)
    .map((districtId) => loadView(districtId))
    .filter((view): view is GameplaySliceView => Boolean(view));
  return findSpyAction(runtime, playerId, views, round, playerIndex, spiedRoutes)
    ?? findAttackAction(runtime, playerId, views, round, playerIndex)
    ?? findCollectProductionAction(runtime, playerId, views, round, playerIndex);
};

const getOwnedDistrictIds = (state: CoreGameState, playerId: PlayerId): DistrictId[] =>
  state.root.districtIds.filter((districtId) => state.districtsById[districtId]?.ownerPlayerId === playerId);

const findSpyAction = (
  runtime: ServerInstanceRuntime,
  playerId: PlayerId,
  views: GameplaySliceView[],
  round: number,
  playerIndex: number,
  spiedRoutes: Set<string>
): SelectedSimulationAction | null => {
  for (const view of views) {
    const sourceDistrictId = view.district?.districtId;
    const target = view.district?.spyTargets.find((entry) =>
      entry.enabled && sourceDistrictId && !spiedRoutes.has(createRouteKey(playerId, sourceDistrictId, entry.districtId))
    );
    if (sourceDistrictId && target) {
      return {
        focusDistrictId: sourceDistrictId,
        routeKey: createRouteKey(playerId, sourceDistrictId, target.districtId),
        command: createSpyCommand(runtime.record.id, playerId, sourceDistrictId, target.districtId, round, playerIndex)
      };
    }
  }
  return null;
};

const findAttackAction = (
  runtime: ServerInstanceRuntime,
  playerId: PlayerId,
  views: GameplaySliceView[],
  round: number,
  playerIndex: number
): SelectedSimulationAction | null => {
  for (const view of views) {
    const sourceDistrictId = view.district?.districtId;
    const target = view.district?.attackTargets.find((entry) => entry.enabled);
    if (sourceDistrictId && target) {
      return {
        focusDistrictId: sourceDistrictId,
        command: createAttackCommand(runtime.record.id, playerId, sourceDistrictId, target.districtId, round, playerIndex)
      };
    }
  }
  return null;
};

const findCollectProductionAction = (
  runtime: ServerInstanceRuntime,
  playerId: PlayerId,
  views: GameplaySliceView[],
  round: number,
  playerIndex: number
): SelectedSimulationAction | null => {
  for (const view of views) {
    const sourceDistrictId = view.district?.districtId;
    const slot = view.district?.slots.find((entry) => entry.buildingId && entry.production?.canCollect);
    if (sourceDistrictId && slot?.buildingId) {
      return {
        focusDistrictId: sourceDistrictId,
        command: createCollectCommand(runtime.record.id, playerId, sourceDistrictId, slot.buildingId, round, playerIndex)
      };
    }
  }
  return null;
};

export const createRouteKey = (playerId: PlayerId, sourceDistrictId: DistrictId, targetDistrictId: DistrictId): string =>
  `${playerId}:${sourceDistrictId}:${targetDistrictId}`;
