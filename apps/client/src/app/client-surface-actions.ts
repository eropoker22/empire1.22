import type { GameModeId } from "@empire/shared-types";
import {
  createPlaceDefenseCommand,
  createRemoveDefenseCommand
} from "../features/district-panel/defense-command";
import { createAttackDistrictCommand } from "../features/district-panel/attack-command";
import { createHeistDistrictCommand } from "../features/district-panel/heist-command";
import { createOccupyDistrictCommand } from "../features/district-panel/occupy-command";
import { createRobDistrictCommand } from "../features/district-panel/rob-command";
import { createSelectSpawnDistrictCommand } from "../features/district-panel/select-spawn-command";
import { createSpyDistrictCommand } from "../features/district-panel/spy-command";
import { createPlaceTrapCommand } from "../features/district-panel/trap-command";
import { createBuildingSurfaceCommand } from "./client-surface-building-command";
import { resolveClientSurfaceAction } from "./client-surface-action-resolver";
import { canUseOwnedDistrictBuilding } from "./client-surface-authority-guards";
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
export const createControllerSurfaceActionRouter = (
  options: CreateClientSurfaceActionRouterOptions
): ClientSurfaceActionRouter => ({
  handleTarget: async (target) => {
    const action = resolveClientSurfaceAction(target);

    if (!action) {
      return null;
    }

    if (action.kind === "select-district") {
      if (options.isDistrictSelectionBlocked?.()) {
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
      const slice = options.client.getGameplaySlice();
      if (!canUseOwnedDistrictBuilding(slice, action.buildingId)) return null;
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
        const target = district.targetActions?.attackTargets.find((candidate) => candidate.districtId === action.targetDistrictId)
          ?? district.attackTargets.find((candidate) => candidate.districtId === action.targetDistrictId);
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
      case "rob": {
        const target = district.targetActions?.robTargets.find((candidate) => candidate.districtId === action.targetDistrictId)
          ?? district.robTargets?.find((candidate) => candidate.districtId === action.targetDistrictId);
        if (!target?.enabled) return null;
        return options.client.dispatch(
          createRobDistrictCommand({
            commandId: options.createCommandId("command:rob"),
            slice,
            targetDistrictId: action.targetDistrictId,
            issuedAt
          })
        );
      }
      case "heist": {
        const target = district.targetActions?.heistTargets.find((candidate) => candidate.districtId === action.targetDistrictId)
          ?? district.heistTargets?.find((candidate) => candidate.districtId === action.targetDistrictId);
        if (!target?.enabled) return null;
        return options.client.dispatch(
          createHeistDistrictCommand({
            commandId: options.createCommandId("command:heist"),
            slice,
            targetDistrictId: action.targetDistrictId,
            issuedAt
          })
        );
      }
      case "spy": {
        const target = district.targetActions?.spyTargets.find((candidate) => candidate.districtId === action.targetDistrictId)
          ?? district.spyTargets.find((candidate) => candidate.districtId === action.targetDistrictId);
        if (!target?.enabled) return null;
        return options.client.dispatch(
          createSpyDistrictCommand({
            commandId: options.createCommandId("command:spy"),
            slice,
            targetDistrictId: action.targetDistrictId,
            issuedAt
          })
        );
      }
      case "occupy": {
        const target = district.targetActions?.occupyTargets.find((candidate) => candidate.districtId === action.targetDistrictId)
          ?? district.occupyTargets.find((candidate) => candidate.districtId === action.targetDistrictId);
        if (!target?.enabled) return null;
        return options.client.dispatch(
          createOccupyDistrictCommand({
            commandId: options.createCommandId("command:occupy"),
            slice,
            targetDistrictId: action.targetDistrictId,
            issuedAt
          })
        );
      }
      case "place-trap":
        if (!district.isOwnedByPlayer || !district.trap?.enabled) return null;
        return options.client.dispatch(
          createPlaceTrapCommand({
            commandId: options.createCommandId("command:trap"),
            slice,
            issuedAt
          })
        );
      case "place-defense":
        if (!district.placeDefense?.enabled) return null;
        return options.client.dispatch(
          createPlaceDefenseCommand({
            commandId: options.createCommandId("command:place-defense"),
            slice,
            issuedAt
          })
        );
      case "remove-defense":
        if (!district.removeDefense?.enabled) return null;
        return options.client.dispatch(
          createRemoveDefenseCommand({
            commandId: options.createCommandId("command:remove-defense"),
            slice,
            issuedAt
          })
        );
      case "building-action":
      case "collect":
      case "craft":
      case "cancel-production": {
        const command = createBuildingSurfaceCommand({
          action,
          slice,
          districtId: district.districtId,
          mode,
          issuedAt,
          createCommandId: options.createCommandId
        });
        return command ? options.client.dispatch(command) : null;
      }
      default:
        return null;
    }
  }
});
