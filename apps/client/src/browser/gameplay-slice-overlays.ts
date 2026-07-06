import type { ClientRenderState } from "../app";
import { closeOverlay, getTopOverlay, openOverlay } from "../modals/overlay-state";

export interface DistrictSheetOverlayController {
  syncFromState(state: ClientRenderState): void;
  closeFromExternal(reason: string): void;
  closeOnDestroy(): void;
  isOpen(): boolean;
  markClosedByBackdrop(): void;
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

  const closeFromExternal = (reason: string): void => {
    if (getTopOverlay() === "district_sheet") {
      closeOverlay(reason);
    }

    isDistrictSheetOpen = false;
  };

  return {
    syncFromState,
    closeFromExternal,
    closeOnDestroy,
    isOpen: () => isDistrictSheetOpen,
    markClosedByBackdrop: () => {
      isDistrictSheetOpen = false;
    }
  };
};
