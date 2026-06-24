import type { ClientRenderState } from "../app";
import { closeOverlay, getTopOverlay, openOverlay } from "../modals/overlay-state";

export interface DistrictSheetOverlayController {
  syncFromState(state: ClientRenderState): void;
  closeOnDestroy(): void;
  isOpen(): boolean;
}

export const createDistrictSheetOverlayController = (): DistrictSheetOverlayController => {
  let isDistrictSheetOpen = false;

  const syncFromState = (state: ClientRenderState): void => {
    const shouldShowDistrictSheet = Boolean(state.districtPanel?.districtId);

    if (shouldShowDistrictSheet && !isDistrictSheetOpen) {
      openOverlay("district_sheet");
      isDistrictSheetOpen = true;
      return;
    }

    if (!shouldShowDistrictSheet && isDistrictSheetOpen && getTopOverlay() === "district_sheet") {
      closeOverlay("district panel cleared");
      isDistrictSheetOpen = false;
    }
  };

  const closeOnDestroy = (): void => {
    if (isDistrictSheetOpen && getTopOverlay() === "district_sheet") {
      closeOverlay("mountpoint destroy");
    }

    isDistrictSheetOpen = false;
  };

  return { syncFromState, closeOnDestroy, isOpen: () => isDistrictSheetOpen };
};

