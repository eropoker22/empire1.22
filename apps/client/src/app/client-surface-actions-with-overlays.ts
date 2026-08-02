import { isOverlayOpen } from "../modals/overlay-state";
import { createControllerSurfaceActionRouter } from "./client-surface-actions";
import type {
  ClientSurfaceActionRouter,
  CreateClientSurfaceActionRouterOptions
} from "./client-surface-action-types";

export const createClientSurfaceActionRouter = (
  options: CreateClientSurfaceActionRouterOptions
): ClientSurfaceActionRouter => createControllerSurfaceActionRouter({
  ...options,
  isDistrictSelectionBlocked: options.isDistrictSelectionBlocked ?? isOverlayOpen
});
