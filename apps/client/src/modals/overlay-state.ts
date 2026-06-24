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
const LOCKED_BODY_DATA_ATTRIBUTE = "overlayScrollLocked";
const DEFAULT_GHOST_CLICK_SUPPRESSION_MS = 250;
let suppressMapInputUntil = 0;

interface BodyStyleSnapshot {
  scrollY: number;
  left: string;
  position: string;
  right: string;
  top: string;
  width: string;
}

const bodyStyleSnapshot = new WeakMap<HTMLElement, BodyStyleSnapshot | null>();

const getBody = (): HTMLElement | null => {
  if (typeof document === "undefined") {
    return null;
  }

  return document.body;
}

const lockBodyScroll = (): void => {
  const body = getBody();
  if (!body || typeof window === "undefined") {
    return;
  }

  if (body.dataset[LOCKED_BODY_DATA_ATTRIBUTE] === "true") {
    return;
  }

  bodyStyleSnapshot.set(body, {
    scrollY: window.scrollY ?? 0,
    left: body.style.left,
    position: body.style.position,
    right: body.style.right,
    top: body.style.top,
    width: body.style.width
  });

  const scrollY = window.scrollY ?? 0;
  body.dataset[LOCKED_BODY_DATA_ATTRIBUTE] = "true";
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
};

const unlockBodyScroll = (): void => {
  const body = getBody();
  if (!body || typeof window === "undefined") {
    return;
  }

  if (body.dataset[LOCKED_BODY_DATA_ATTRIBUTE] !== "true") {
    return;
  }

  const savedStyles = bodyStyleSnapshot.get(body);
  if (!savedStyles) {
    return;
  }

  const { scrollY, left, position, right, top, width } = savedStyles;
  body.style.left = left;
  body.style.position = position;
  body.style.right = right;
  body.style.top = top;
  body.style.width = width;
  body.dataset[LOCKED_BODY_DATA_ATTRIBUTE] = "";
  delete body.dataset[LOCKED_BODY_DATA_ATTRIBUTE];
  bodyStyleSnapshot.delete(body);
  window.scrollTo(0, scrollY);
};

const now = (): number =>
  typeof window !== "undefined" && window.performance?.now
    ? window.performance.now()
    : Date.now();

export const suppressMapInputFor = (ms = DEFAULT_GHOST_CLICK_SUPPRESSION_MS): void => {
  suppressMapInputUntil = Math.max(suppressMapInputUntil, now() + ms);
};

export const shouldSuppressMapInput = (event?: Event | null): boolean => {
  const suppressed = isOverlayOpen() || now() < suppressMapInputUntil;
  if (suppressed) {
    event?.preventDefault();
    event?.stopPropagation();
    event?.stopImmediatePropagation();
  }
  return suppressed;
};

export const openOverlay = (type: OverlayType): void => {
  if (overlayStack.length === 0) {
    lockBodyScroll();
  }

  overlayStack.push({ type });
};

export const closeOverlay = (_reason: string): void => {
  if (overlayStack.length > 0) {
    overlayStack.pop();
  }
  suppressMapInputFor();
  if (overlayStack.length === 0) {
    unlockBodyScroll();
  }
};

export const isOverlayOpen = (): boolean => overlayStack.length > 0;

export const getTopOverlay = (): OverlayType | null => overlayStack.at(-1)?.type ?? null;
