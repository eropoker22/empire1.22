import { closeOverlay, isOverlayOpen } from "./overlay-state";

const OVERLAY_BACKDROP_ATTRIBUTE = "overlayBackdrop";

export interface OverlayBackdrop {
  readonly element: HTMLDivElement;
  sync(): void;
  destroy(): void;
}

export interface CreateOverlayBackdropOptions {
  mount?: HTMLElement;
}

/**
 * Responsibility: Full-screen backdrop used by modal/sheet overlays.
 * Belongs here: event interception and overlay close coordination.
 * Does not belong here: gameplay rules or server-authoritative command flow.
 */
export const createOverlayBackdrop = (
  options: CreateOverlayBackdropOptions = {}
): OverlayBackdrop => {
  const mount = options.mount ?? document.body;

  const backdrop = document.createElement("div");
  backdrop.className = "gameplay-slice-backdrop";
  backdrop.dataset[OVERLAY_BACKDROP_ATTRIBUTE] = "true";

  const handlePointerInteraction = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  const handleClick = (event: Event): void => {
    handlePointerInteraction(event);

    if (isOverlayOpen()) {
      closeOverlay("backdrop click");
      sync();
    }
  };

  backdrop.addEventListener("pointerdown", handlePointerInteraction);
  backdrop.addEventListener("pointerup", handlePointerInteraction);
  backdrop.addEventListener("click", handleClick);

  const sync = (): void => {
    backdrop.hidden = !isOverlayOpen();
  };

  sync();
  mount.appendChild(backdrop);

  return {
    element: backdrop,
    sync,
    destroy: (): void => {
      backdrop.removeEventListener("pointerdown", handlePointerInteraction);
      backdrop.removeEventListener("pointerup", handlePointerInteraction);
      backdrop.removeEventListener("click", handleClick);
      backdrop.remove();
      backdrop.hidden = true;
    }
  };
};
