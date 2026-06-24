/**
 * Responsibility: Minimal mobile overlay state for suppressing map interactions.
 * Belongs here: UI-only overlay coordination shared across surfaces.
 * Does not belong here: gameplay rules or server authority decisions.
 */

export type OverlayType =
  | "district_sheet"
  | "confirmation_modal"
  | "spawn_modal"
  | "action_sheet"
  | "generic";

type OverlayEntry = {
  type: OverlayType;
};

const overlayStack: OverlayEntry[] = [];

export const openOverlay = (type: OverlayType): void => {
  overlayStack.push({ type });
};

export const closeOverlay = (_reason: string): void => {
  if (overlayStack.length > 0) {
    overlayStack.pop();
  }
};

export const isOverlayOpen = (): boolean => overlayStack.length > 0;

export const getTopOverlay = (): OverlayType | null => overlayStack.at(-1)?.type ?? null;
