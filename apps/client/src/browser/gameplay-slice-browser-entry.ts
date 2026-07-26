import {
  getCurrentGameplaySliceReadModel,
  getCurrentGameplaySliceRenderState,
  handleGameplaySliceSurfaceAction,
  selectGameplaySliceDistrict,
  submitGameplaySliceCommand,
  type MountedGameplaySlicePage
} from "./gameplay-slice-page-api";
import { mountGameplaySlicePage } from "./gameplay-slice-page";

export * from "./gameplay-slice-page";

export const mount = mountGameplaySlicePage;
export const getCurrentReadModel = getCurrentGameplaySliceReadModel;
export const getCurrentRenderState = getCurrentGameplaySliceRenderState;
export const handleSurfaceAction = handleGameplaySliceSurfaceAction;
export const selectDistrict = selectGameplaySliceDistrict;
export const submitCommand = submitGameplaySliceCommand;
export const autoMount = (): MountedGameplaySlicePage[] =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-gameplay-slice-client]"))
    .map((root) => mountGameplaySlicePage({ root }))
    .filter((mounted): mounted is MountedGameplaySlicePage => mounted !== null);
