import type { GameCommand, GameModeId, GameplaySliceView } from "@empire/shared-types";
import { createCollectProductionCommand } from "../features/building-panel/collect-command";
import { createCraftItemCommand } from "../features/building-panel/craft-command";
import { createRunBuildingActionCommand } from "../features/building-panel/run-building-action-command";
import { createCancelProductionCommand } from "../features/building-panel/cancel-production-command";
import { canUseOwnedDistrictBuilding } from "./client-surface-authority-guards";
import type {
  ClientSurfaceAction,
  CreateClientSurfaceActionRouterOptions
} from "./client-surface-action-types";

type BuildingSurfaceAction = Extract<
  ClientSurfaceAction,
  { kind: "building-action" | "collect" | "craft" | "cancel-production" }
>;

interface CreateBuildingSurfaceCommandOptions {
  action: BuildingSurfaceAction;
  slice: GameplaySliceView;
  districtId: string;
  mode: GameModeId;
  issuedAt: string;
  createCommandId: CreateClientSurfaceActionRouterOptions["createCommandId"];
}

export const createBuildingSurfaceCommand = ({
  action,
  slice,
  districtId,
  mode,
  issuedAt,
  createCommandId
}: CreateBuildingSurfaceCommandOptions): GameCommand | null => {
  if (!canUseOwnedDistrictBuilding(slice, action.buildingId)) return null;

  switch (action.kind) {
    case "building-action":
      return createRunBuildingActionCommand({
        commandId: createCommandId("command:building-action"),
        slice,
        buildingId: action.buildingId,
        actionId: action.actionId,
        dealerSlotId: action.dealerSlotId,
        targetCategory: readStringValue(action, "targetCategory"),
        category: readStringValue(action, "category"),
        mode: readStringValue(action, "mode"),
        investmentCleanCash: readNumberValue(action, "investmentCleanCash"),
        investment: readNumberValue(action, "investment"),
        targetZone: readStringValue(action, "targetZone"),
        itemId: action.itemId,
        amount: action.amount,
        issuedAt
      });
    case "collect":
      return createCollectProductionCommand({
        commandId: createCommandId("command:collect"),
        serverInstanceId: slice.player.instanceId,
        playerId: slice.player.playerId,
        mode,
        districtId,
        buildingId: action.buildingId,
        resourceKey: action.resourceKey,
        issuedAt
      });
    case "craft":
      return createCraftItemCommand({
        commandId: createCommandId("command:craft"),
        slice,
        buildingId: action.buildingId,
        recipeId: action.recipeId,
        quantity: action.quantity,
        issuedAt
      });
    case "cancel-production":
      return createCancelProductionCommand({
        commandId: createCommandId("command:cancel-production"),
        slice,
        buildingId: action.buildingId,
        recipeId: action.recipeId,
        issuedAt
      });
  }
};

const readStringValue = (
  action: Extract<ClientSurfaceAction, { kind: "building-action" }>,
  key: "targetCategory" | "category" | "mode" | "targetZone"
): string | undefined => {
  const value = (action as unknown as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : undefined;
};

const readNumberValue = (
  action: Extract<ClientSurfaceAction, { kind: "building-action" }>,
  key: "investmentCleanCash" | "investment"
): number | undefined => {
  const value = (action as unknown as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
};
