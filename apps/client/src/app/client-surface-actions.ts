import type { GameModeId } from "@empire/shared-types";
import type { ClientRenderState } from "./client-render-state";
import type { ClientAppShell } from "./client-app-shell";
import {
  createAttackDistrictCommand,
  createCollectProductionCommand,
  createCraftItemCommand,
  createPlaceTrapCommand,
  createRunBuildingActionCommand,
  createSpyDistrictCommand
} from "../features";

export interface ClientSurfaceActionElement {
  dataset: Record<string, string | undefined>;
  closest<T extends ClientSurfaceActionElement = ClientSurfaceActionElement>(selector: string): T | null;
}

export type ClientSurfaceAction =
  | { kind: "select-district"; districtId: string }
  | { kind: "attack"; targetDistrictId: string }
  | { kind: "spy"; targetDistrictId: string }
  | { kind: "place-trap" }
  | { kind: "open-building"; buildingId: string }
  | { kind: "building-action"; buildingId: string; actionId: string }
  | { kind: "collect"; buildingId: string }
  | { kind: "craft"; buildingId: string; recipeId: string };

export interface CreateClientSurfaceActionRouterOptions {
  client: ClientAppShell;
  createCommandId(prefix: string): string;
  getIssuedAt?: () => string;
}

export interface ClientSurfaceActionRouter {
  handleTarget(target: ClientSurfaceActionElement | null): Promise<ClientRenderState | null>;
}

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
      return options.client.selectDistrict(action.districtId);
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
      case "attack":
        return options.client.dispatch(
          createAttackDistrictCommand({
            commandId: options.createCommandId("command:attack"),
            serverInstanceId: slice.player.instanceId,
            playerId: slice.player.playerId,
            mode,
            sourceDistrictId: district.districtId,
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
      case "place-trap":
        return options.client.dispatch(
          createPlaceTrapCommand({
            commandId: options.createCommandId("command:trap"),
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

export const resolveClientSurfaceAction = (
  target: ClientSurfaceActionElement | null
): ClientSurfaceAction | null => {
  if (!target) {
    return null;
  }

  const districtButton = target.closest<ClientSurfaceActionElement>("button[data-district-id]");
  if (districtButton?.dataset.districtId) {
    return {
      kind: "select-district",
      districtId: districtButton.dataset.districtId
    };
  }

  const attackButton = target.closest<ClientSurfaceActionElement>("button[data-attack-target-id]");
  if (attackButton?.dataset.attackTargetId) {
    return {
      kind: "attack",
      targetDistrictId: attackButton.dataset.attackTargetId
    };
  }

  const spyButton = target.closest<ClientSurfaceActionElement>("button[data-spy-target-id]");
  if (spyButton?.dataset.spyTargetId) {
    return {
      kind: "spy",
      targetDistrictId: spyButton.dataset.spyTargetId
    };
  }

  const trapButton = target.closest<ClientSurfaceActionElement>("button[data-place-trap]");
  if (trapButton) {
    return {
      kind: "place-trap"
    };
  }

  const collectButton = target.closest<ClientSurfaceActionElement>("button[data-collect-building-id]");
  if (collectButton?.dataset.collectBuildingId) {
    return {
      kind: "collect",
      buildingId: collectButton.dataset.collectBuildingId
    };
  }

  const buildingActionButton = target.closest<ClientSurfaceActionElement>(
    "button[data-building-action-building-id][data-building-action-id]"
  );
  if (buildingActionButton?.dataset.buildingActionBuildingId && buildingActionButton?.dataset.buildingActionId) {
    return {
      kind: "building-action",
      buildingId: buildingActionButton.dataset.buildingActionBuildingId,
      actionId: buildingActionButton.dataset.buildingActionId
    };
  }

  const craftButton = target.closest<ClientSurfaceActionElement>(
    "button[data-craft-building-id][data-craft-recipe-id]"
  );
  if (craftButton?.dataset.craftBuildingId && craftButton?.dataset.craftRecipeId) {
    return {
      kind: "craft",
      buildingId: craftButton.dataset.craftBuildingId,
      recipeId: craftButton.dataset.craftRecipeId
    };
  }

  const buildingCard = target.closest<ClientSurfaceActionElement>("article[data-building-id][data-building-type]");
  if (buildingCard?.dataset.buildingId) {
    return {
      kind: "open-building",
      buildingId: buildingCard.dataset.buildingId
    };
  }

  return null;
};
