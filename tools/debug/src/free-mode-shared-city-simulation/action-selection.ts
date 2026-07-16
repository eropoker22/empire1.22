import type { CoreGameState } from "@empire/game-core";
import type {
  AttackDistrictCommand,
  CollectProductionCommand,
  CraftItemCommand,
  DistrictId,
  GameplaySliceView,
  OccupyDistrictCommand,
  PlayerId,
  SpyDistrictCommand
} from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../../../../apps/server/src/runtime/instance/server-instance-runtime";
import { createAttackCommand, createCollectCommand, createCraftCommand, createOccupyCommand, createSpyCommand } from "./commands";
import { createActionPolicy } from "./bot-profiles";
import type { SimulationActionType, SimulationBotProfile } from "./types";

export interface SelectedSimulationAction {
  command: SpyDistrictCommand | OccupyDistrictCommand | AttackDistrictCommand | CollectProductionCommand | CraftItemCommand;
  focusDistrictId: DistrictId;
  routeKey?: string;
}

export const selectSimulationAction = async (
  runtime: ServerInstanceRuntime,
  playerId: PlayerId,
  round: number,
  playerIndex: number,
  spiedRoutes: Set<string>,
  profile: SimulationBotProfile,
  loadView: (districtId: DistrictId) => GameplaySliceView | null | Promise<GameplaySliceView | null>
): Promise<SelectedSimulationAction | null> => {
  const views = (await Promise.all(
    getOwnedDistrictIds(runtime.state, playerId).map((districtId) => loadView(districtId))
  )).filter((view): view is GameplaySliceView => Boolean(view));
  for (const actionType of createActionPolicy(profile, round, playerIndex)) {
    const action = findActionByType(runtime, playerId, views, round, playerIndex, spiedRoutes, actionType);
    if (action) return action;
  }
  return null;
};

const getOwnedDistrictIds = (state: CoreGameState, playerId: PlayerId): DistrictId[] =>
  state.root.districtIds.filter((districtId) => state.districtsById[districtId]?.ownerPlayerId === playerId);

const findActionByType = (
  runtime: ServerInstanceRuntime,
  playerId: PlayerId,
  views: GameplaySliceView[],
  round: number,
  playerIndex: number,
  spiedRoutes: Set<string>,
  actionType: SimulationActionType
): SelectedSimulationAction | null => {
  if (actionType === "attack-district") {
    return findAttackAction(runtime, playerId, views, round, playerIndex);
  }
  if (actionType === "occupy-district") {
    return findOccupyAction(runtime, playerId, views, round, playerIndex);
  }
  if (actionType === "collect-production") {
    return findCollectProductionAction(runtime, playerId, views, round, playerIndex);
  }
  if (actionType === "craft-item") {
    return findCraftAction(runtime, playerId, views, round, playerIndex);
  }
  return findSpyAction(runtime, playerId, views, round, playerIndex, spiedRoutes);
};

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

const findOccupyAction = (
  runtime: ServerInstanceRuntime,
  playerId: PlayerId,
  views: GameplaySliceView[],
  round: number,
  playerIndex: number
): SelectedSimulationAction | null => {
  for (const view of views) {
    const sourceDistrictId = view.district?.districtId;
    const target = view.district?.occupyTargets?.find((entry) => entry.enabled);
    if (sourceDistrictId && target) {
      return {
        focusDistrictId: sourceDistrictId,
        command: createOccupyCommand(
          runtime.record.id,
          playerId,
          sourceDistrictId,
          target.districtId,
          round,
          playerIndex,
          target.expectedConflictRevision
        )
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
        command: createAttackCommand(
          runtime.record.id,
          playerId,
          sourceDistrictId,
          target.districtId,
          round,
          playerIndex,
          target.expectedConflictRevision
        )
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

const findCraftAction = (
  runtime: ServerInstanceRuntime,
  playerId: PlayerId,
  views: GameplaySliceView[],
  round: number,
  playerIndex: number
): SelectedSimulationAction | null => {
  for (const view of views) {
    const sourceDistrictId = view.district?.districtId;
    const slot = view.district?.slots.find((entry) => entry.buildingId && entry.craftOptions.some((option) => option.canCraft));
    const craftOption = slot?.craftOptions.find((option) => option.canCraft);
    if (sourceDistrictId && slot?.buildingId && craftOption) {
      return {
        focusDistrictId: sourceDistrictId,
        command: createCraftCommand(runtime.record.id, playerId, sourceDistrictId, slot.buildingId, craftOption.recipeId, round, playerIndex)
      };
    }
  }
  return null;
};

export const createRouteKey = (playerId: PlayerId, sourceDistrictId: DistrictId, targetDistrictId: DistrictId): string =>
  `${playerId}:${sourceDistrictId}:${targetDistrictId}`;
