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

const getScrollY = (): number => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0)
  );
};

const restorePageScroll = (scrollY: number): void => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  document.documentElement.scrollTop = scrollY;
  document.body.scrollTop = scrollY;
  try {
    window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
  } catch {
    window.scrollTo(0, scrollY);
  }
  if (Math.abs(getScrollY() - scrollY) > 1) {
    try {
      window.scrollTo(0, scrollY);
    } catch {
      // Older embedded browsers can reject scrollTo while layout is settling.
    }
  }
};

const schedulePageScrollRestore = (scrollY: number): void => {
  const restore = (): void => restorePageScroll(scrollY);
  restore();
  window.requestAnimationFrame?.(restore);
  window.requestAnimationFrame?.(() => window.requestAnimationFrame?.(restore));
  window.setTimeout?.(restore, 80);
  window.setTimeout?.(restore, 180);
};

const lockBodyScroll = (): void => {
  const body = getBody();
  if (!body || typeof window === "undefined") {
    return;
  }

  if (body.dataset[LOCKED_BODY_DATA_ATTRIBUTE] === "true") {
    return;
  }

  bodyStyleSnapshot.set(body, {
    scrollY: getScrollY(),
    left: body.style.left,
    position: body.style.position,
    right: body.style.right,
    top: body.style.top,
    width: body.style.width
  });

  const scrollY = getScrollY();
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

  const savedStyles = bodyStyleSnapshot.get(body) ?? {
    scrollY: Math.abs(Number.parseFloat(body.style.top || "0")) || getScrollY(),
    left: "",
    position: "",
    right: "",
    top: "",
    width: ""
  };

  const { scrollY, left, position, right, top, width } = savedStyles;
  body.style.left = left;
  body.style.position = position;
  body.style.right = right;
  body.style.top = top;
  body.style.width = width;
  body.dataset[LOCKED_BODY_DATA_ATTRIBUTE] = "";
  delete body.dataset[LOCKED_BODY_DATA_ATTRIBUTE];
  bodyStyleSnapshot.delete(body);
  schedulePageScrollRestore(scrollY);
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
  overlayStack.splice(0, overlayStack.length);
  suppressMapInputUntil = 0;

  const body = getBody();
  if (!body) {
    return;
  }

  const savedStyles = bodyStyleSnapshot.get(body);
  if (savedStyles) {
    body.style.left = savedStyles.left;
    body.style.position = savedStyles.position;
    body.style.right = savedStyles.right;
    body.style.top = savedStyles.top;
    body.style.width = savedStyles.width;
    bodyStyleSnapshot.delete(body);
  }

  delete body.dataset[LOCKED_BODY_DATA_ATTRIBUTE];
};
