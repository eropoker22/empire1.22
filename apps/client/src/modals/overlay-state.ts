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
const LOCKED_BODY_CLASS = "game-modal-scroll-locked";
const DEFAULT_GHOST_CLICK_SUPPRESSION_MS = 250;
let suppressMapInputUntil = 0;
let lockedPageScroll: { x: number; y: number } | null = null;
let lockedBodyStyles: {
  left: string;
  overflow: string;
  overscrollBehavior: string;
  paddingRight: string;
  position: string;
  right: string;
  top: string;
  width: string;
} | null = null;
let lockedRootStyles: {
  overflow: string;
  overscrollBehavior: string;
  scrollbarGutter: string;
} | null = null;

const getBody = (): HTMLElement | null => {
  if (typeof document === "undefined") {
    return null;
  }

  return document.body;
}

const getScrollPosition = (): { x: number; y: number } => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { x: 0, y: 0 };
  }

  return {
    x: Math.max(0, Math.floor(window.scrollX || window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0)),
    y: Math.max(0, Math.floor(window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0))
  };
};

const restorePageScroll = (scrollPosition: { x: number; y: number }): void => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const scrollX = Math.max(0, Math.floor(scrollPosition.x || 0));
  const scrollY = Math.max(0, Math.floor(scrollPosition.y || 0));
  document.documentElement.scrollLeft = scrollX;
  document.documentElement.scrollTop = scrollY;
  document.body.scrollLeft = scrollX;
  document.body.scrollTop = scrollY;
  try {
    window.scrollTo({ top: scrollY, left: scrollX, behavior: "auto" });
  } catch {
    window.scrollTo(scrollX, scrollY);
  }
  if (Math.abs(getScrollPosition().y - scrollY) > 1) {
    try {
      window.scrollTo(scrollX, scrollY);
    } catch {
      // Older embedded browsers can reject scrollTo while layout is settling.
    }
  }
};

const schedulePageScrollRestore = (scrollPosition: { x: number; y: number }): void => {
  const restore = (): void => restorePageScroll(scrollPosition);
  restore();
  window.requestAnimationFrame?.(restore);
  window.setTimeout?.(restore, 80);
};

const lockBodyScroll = (): void => {
  const body = getBody();
  if (!body || typeof window === "undefined") {
    return;
  }

  if (body.dataset[LOCKED_BODY_DATA_ATTRIBUTE] === "true") {
    return;
  }

  const root = document.documentElement;
  const scrollPosition = getScrollPosition();
  const bodyComputed = window.getComputedStyle?.(body);
  const scrollbarWidth = Math.max(0, Math.floor((window.innerWidth || root.clientWidth || 0) - (root.clientWidth || 0)));
  const currentPaddingRight = Number.parseFloat(bodyComputed?.paddingRight || "0") || 0;
  lockedPageScroll = scrollPosition;
  lockedBodyStyles = {
    left: body.style.left,
    overflow: body.style.overflow,
    overscrollBehavior: body.style.overscrollBehavior,
    paddingRight: body.style.paddingRight,
    position: body.style.position,
    right: body.style.right,
    top: body.style.top,
    width: body.style.width
  };
  lockedRootStyles = {
    overflow: root.style.overflow,
    overscrollBehavior: root.style.overscrollBehavior,
    scrollbarGutter: root.style.getPropertyValue("scrollbar-gutter")
  };
  root.classList.add(LOCKED_BODY_CLASS);
  body.classList.add(LOCKED_BODY_CLASS);
  root.style.overflow = "hidden";
  root.style.overscrollBehavior = "none";
  root.style.setProperty("scrollbar-gutter", "stable");
  body.style.position = "fixed";
  body.style.top = `-${scrollPosition.y}px`;
  body.style.left = `-${scrollPosition.x}px`;
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  body.style.overscrollBehavior = "none";
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
  }
  body.dataset[LOCKED_BODY_DATA_ATTRIBUTE] = "true";
};

const unlockBodyScroll = (): void => {
  const body = getBody();
  if (!body || typeof window === "undefined") {
    return;
  }

  if (body.dataset[LOCKED_BODY_DATA_ATTRIBUTE] !== "true") {
    return;
  }

  const root = document.documentElement;
  const scrollPosition = lockedPageScroll ?? getScrollPosition();
  if (lockedRootStyles) {
    root.style.overflow = lockedRootStyles.overflow;
    root.style.overscrollBehavior = lockedRootStyles.overscrollBehavior;
    if (lockedRootStyles.scrollbarGutter) {
      root.style.setProperty("scrollbar-gutter", lockedRootStyles.scrollbarGutter);
    } else {
      root.style.removeProperty("scrollbar-gutter");
    }
  }
  if (lockedBodyStyles) {
    Object.assign(body.style, lockedBodyStyles);
  }
  root.classList.remove(LOCKED_BODY_CLASS);
  body.classList.remove(LOCKED_BODY_CLASS);
  body.dataset[LOCKED_BODY_DATA_ATTRIBUTE] = "";
  delete body.dataset[LOCKED_BODY_DATA_ATTRIBUTE];
  lockedPageScroll = null;
  lockedBodyStyles = null;
  lockedRootStyles = null;
  schedulePageScrollRestore(scrollPosition);
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

export const resetOverlayStateForTests = (): void => {
  unlockBodyScroll();
  overlayStack.splice(0, overlayStack.length);
  suppressMapInputUntil = 0;

  const body = getBody();
  if (!body) {
    return;
  }

  lockedPageScroll = null;
  lockedBodyStyles = null;
  lockedRootStyles = null;
  delete body.dataset[LOCKED_BODY_DATA_ATTRIBUTE];
};
