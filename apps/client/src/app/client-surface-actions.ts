import type { GameModeId } from "@empire/shared-types";
import {
  createAttackDistrictCommand,
  createCollectProductionCommand,
  createCraftItemCommand,
  createHeistDistrictCommand,
  createOccupyDistrictCommand,
  createPlaceDefenseCommand,
  createPlaceTrapCommand,
  createRemoveDefenseCommand,
  createRobDistrictCommand,
  createRunBuildingActionCommand,
  createSelectSpawnDistrictCommand,
  createSpyDistrictCommand
} from "../features";
import {
  resolveClientSurfaceAction
} from "./client-surface-action-resolver";
import { isOverlayOpen } from "../modals";
import type {
  ClientSurfaceAction,
  ClientSurfaceActionElement,
  ClientSurfaceActionRouter,
  CreateClientSurfaceActionRouterOptions
} from "./client-surface-action-types";

export type {
  ClientSurfaceAction,
  ClientSurfaceActionElement,
  ClientSurfaceActionRouter,
  CreateClientSurfaceActionRouterOptions
} from "./client-surface-action-types";
export { resolveClientSurfaceAction } from "./client-surface-action-resolver";

/**
 * Responsibility: Maps interactive client surface clicks into migrated client-shell actions.
 * Belongs here: client-side event-to-command wiring over server-fed state.
 * Does not belong here: gameplay resolution or legacy runtime integration.
 */
export const createClientSurfaceActionRouter = (
  options: CreateClientSurfaceActionRouterOptions
): ClientSurfaceActionRouter => ({
  handleTarget: async (target) => {
    const action = resolveClientSurfaceAction(target);

    if (!action) {
      return null;
    }

    if (action.kind === "select-district") {
      if (isOverlayOpen()) {
        return null;
      }

      return options.client.selectDistrict(action.districtId);
    }

    if (action.kind === "select-spawn") {
      const slice = options.client.getGameplaySlice();
      if (!slice) return null;
      const issuedAt = (options.getIssuedAt ?? (() => new Date().toISOString()))();
      return options.client.dispatch(
        createSelectSpawnDistrictCommand({
          commandId: options.createCommandId("command:select-spawn"),
          slice,
          districtId: action.districtId,
          issuedAt
        })
      );
    }

    if (action.kind === "open-building") {
      return options.client.selectBuilding(action.buildingId);
    }

    const slice = options.client.getGameplaySlice();
    const district = slice?.district;

    if (!slice || !district) {
      return null;
    }

    const issuedAt = (options.getIssuedAt ?? (() => new Date().toISOString()))();
    const mode: GameModeId = slice.mode.mode;

    switch (action.kind) {
      case "attack": {
        const target = district.attackTargets.find((candidate) => candidate.districtId === action.targetDistrictId);
        const weapons = target?.selectedLoadout ?? {};
        const hasSelectedWeapon = Object.values(weapons).some((amount) => Number(amount) > 0);
        if (!target?.enabled || !hasSelectedWeapon) return null;
        return options.client.dispatch(
          createAttackDistrictCommand({
            commandId: options.createCommandId("command:attack"),
            slice,
            targetDistrictId: action.targetDistrictId,
            issuedAt,
            weapons,
            expectedSourceVersion: target.expectedSourceVersion,
            expectedTargetVersion: target.expectedTargetVersion
          })
        );
      }
      case "rob":
        return options.client.dispatch(
          createRobDistrictCommand({
            commandId: options.createCommandId("command:rob"),
            slice,
            targetDistrictId: action.targetDistrictId,
            issuedAt
          })
        );
      case "heist":
        return options.client.dispatch(
          createHeistDistrictCommand({
            commandId: options.createCommandId("command:heist"),
            slice,
            targetDistrictId: action.targetDistrictId,
            issuedAt
          })
        );
      case "spy":
        return options.client.dispatch(
          createSpyDistrictCommand({
            commandId: options.createCommandId("command:spy"),
            slice,
            targetDistrictId: action.targetDistrictId,
            issuedAt
          })
        );
      case "occupy":
        return options.client.dispatch(
          createOccupyDistrictCommand({
            commandId: options.createCommandId("command:occupy"),
            slice,
            targetDistrictId: action.targetDistrictId,
            issuedAt
          })
        );
      case "place-trap":
        return options.client.dispatch(
          createPlaceTrapCommand({
            commandId: options.createCommandId("command:trap"),
            slice,
            issuedAt
          })
        );
      case "place-defense":
        return options.client.dispatch(
          createPlaceDefenseCommand({
            commandId: options.createCommandId("command:place-defense"),
            slice,
            issuedAt
          })
        );
      case "remove-defense":
        return options.client.dispatch(
          createRemoveDefenseCommand({
            commandId: options.createCommandId("command:remove-defense"),
            slice,
            issuedAt
          })
        );
      case "building-action":
        return options.client.dispatch(
          createRunBuildingActionCommand({
            commandId: options.createCommandId("command:building-action"),
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
          })
        );
      case "collect":
        return options.client.dispatch(
          createCollectProductionCommand({
            commandId: options.createCommandId("command:collect"),
            serverInstanceId: slice.player.instanceId,
            playerId: slice.player.playerId,
            mode,
            districtId: district.districtId,
            buildingId: action.buildingId,
            issuedAt
          })
        );
      case "craft":
        return options.client.dispatch(
          createCraftItemCommand({
            commandId: options.createCommandId("command:craft"),
            slice,
            buildingId: action.buildingId,
            recipeId: action.recipeId,
            issuedAt
          })
        );
      default:
        return null;
    }
  }
});

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
