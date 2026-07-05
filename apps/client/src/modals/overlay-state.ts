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
  owner?: symbol;
};

const overlayStack: OverlayEntry[] = [];
const LOCKED_BODY_DATA_ATTRIBUTE = "overlayScrollLocked";
const LOCKED_BODY_CLASS = "game-modal-scroll-locked";
const DEFAULT_GHOST_CLICK_SUPPRESSION_MS = 250;
const MODAL_SCROLL_LOCK_OWNER = Symbol("modal-scroll-lock-compat");
const MOBILE_SCROLL_LOCK_MEDIA = "(max-width: 720px), (hover: none) and (pointer: coarse), (any-hover: none), (any-pointer: coarse)";
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

type ModalScrollLockBridge = {
  isLocked(owner?: unknown): boolean;
  lock(owner?: unknown): boolean;
  unlock(owner?: unknown): boolean;
};

declare global {
  interface Window {
    EmpireModalScrollLock?: ModalScrollLockBridge;
  }
}

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

const shouldUseViewportWidthLock = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(window.matchMedia?.(MOBILE_SCROLL_LOCK_MEDIA).matches);
};

const getCurrentLayoutLockWidth = (body: HTMLElement, root: HTMLElement): number => Math.max(
  0,
  Math.ceil(
    body.getBoundingClientRect?.().width
    || body.offsetWidth
    || root.clientWidth
    || window.visualViewport?.width
    || window.innerWidth
    || 0
  )
);

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
  const isViewportWidthScrollLock = shouldUseViewportWidthLock();
  const lockedLayoutWidth = isViewportWidthScrollLock ? getCurrentLayoutLockWidth(body, root) : 0;
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
  if (!isViewportWidthScrollLock) {
    root.style.setProperty("scrollbar-gutter", "stable");
  }
  body.style.position = "fixed";
  body.style.top = `-${scrollPosition.y}px`;
  body.style.left = `-${scrollPosition.x}px`;
  body.style.right = "0";
  body.style.width = isViewportWidthScrollLock && lockedLayoutWidth > 0
    ? `${lockedLayoutWidth}px`
    : "100%";
  body.style.overflow = "hidden";
  body.style.overscrollBehavior = "none";
  if (!isViewportWidthScrollLock && scrollbarWidth > 0) {
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

const openOverlayEntry = (type: OverlayType, owner?: symbol): void => {
  if (overlayStack.length === 0) {
    lockBodyScroll();
  }

  overlayStack.push({ type, owner });
};

const findOverlayEntryIndexByOwner = (owner: symbol): number => {
  for (let index = overlayStack.length - 1; index >= 0; index -= 1) {
    if (overlayStack[index]?.owner === owner) {
      return index;
    }
  }

  return -1;
};

const closeOverlayEntry = (_reason: string, owner?: symbol): boolean => {
  const closeIndex = owner
    ? findOverlayEntryIndexByOwner(owner)
    : overlayStack.length - 1;
  const hadEntry = closeIndex >= 0;

  if (hadEntry) {
    overlayStack.splice(closeIndex, 1);
  }
  suppressMapInputFor();
  if (overlayStack.length === 0) {
    unlockBodyScroll();
  }

  return hadEntry;
};

export const openOverlay = (type: OverlayType): void => {
  openOverlayEntry(type);
};

export const closeOverlay = (_reason: string): void => {
  closeOverlayEntry(_reason);
};

export const isOverlayOpen = (): boolean => overlayStack.length > 0;

export const getTopOverlay = (): OverlayType | null => overlayStack.at(-1)?.type ?? null;

export const lockModalScroll = (_owner?: unknown): boolean => {
  if (overlayStack.some((entry) => entry.owner === MODAL_SCROLL_LOCK_OWNER)) {
    return true;
  }

  openOverlayEntry("generic", MODAL_SCROLL_LOCK_OWNER);
  return true;
};

export const unlockModalScroll = (_owner?: unknown): boolean =>
  closeOverlayEntry("modal scroll lock released", MODAL_SCROLL_LOCK_OWNER);

export const isModalScrollLocked = (_owner?: unknown): boolean => isOverlayOpen();

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

if (typeof window !== "undefined") {
  window.EmpireModalScrollLock = {
    isLocked: isModalScrollLocked,
    lock: lockModalScroll,
    unlock: unlockModalScroll
  };
}
