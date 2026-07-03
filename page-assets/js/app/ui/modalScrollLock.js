const LOCKED_BODY_CLASS = "game-modal-scroll-locked";
const DEFAULT_OWNER = Object.freeze({ id: "default-modal-scroll-lock-owner" });
const lockStateByDocument = new WeakMap();

function getDocument(owner) {
  if (owner?.nodeType === 9) {
    return owner;
  }
  return owner?.ownerDocument || (typeof document !== "undefined" ? document : null);
}

function getView(documentRef) {
  return documentRef?.defaultView || (typeof window !== "undefined" ? window : null);
}

function getScrollPosition(view, documentRef) {
  const root = documentRef?.documentElement;
  const body = documentRef?.body;
  return {
    x: Math.max(0, Math.floor(view?.scrollX || view?.pageXOffset || root?.scrollLeft || body?.scrollLeft || 0)),
    y: Math.max(0, Math.floor(view?.scrollY || view?.pageYOffset || root?.scrollTop || body?.scrollTop || 0))
  };
}

function restoreScroll(view, documentRef, position) {
  const root = documentRef?.documentElement;
  const body = documentRef?.body;
  if (root) {
    root.scrollLeft = position.x;
    root.scrollTop = position.y;
  }
  if (body) {
    body.scrollLeft = position.x;
    body.scrollTop = position.y;
  }
  if (typeof view?.scrollTo !== "function") {
    return;
  }
  try {
    view.scrollTo({ left: position.x, top: position.y, behavior: "auto" });
  } catch {
    view.scrollTo(position.x, position.y);
  }
}

function scheduleScrollRestore(view, documentRef, position) {
  const restore = () => restoreScroll(view, documentRef, position);
  restore();
  view?.requestAnimationFrame?.(restore);
  view?.setTimeout?.(restore, 80);
}

function getOwnerKey(owner) {
  return owner && (typeof owner === "object" || typeof owner === "function") ? owner : DEFAULT_OWNER;
}

function createState(documentRef, body, root, view) {
  const scrollPosition = getScrollPosition(view, documentRef);
  const bodyComputed = view.getComputedStyle?.(body);
  const scrollbarWidth = Math.max(0, Math.floor((view.innerWidth || root.clientWidth || 0) - (root.clientWidth || 0)));
  const currentPaddingRight = Number.parseFloat(bodyComputed?.paddingRight || "0") || 0;

  return {
    owners: new Set(),
    scrollPosition,
    bodyStyles: {
      left: body.style.left,
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
      paddingRight: body.style.paddingRight,
      position: body.style.position,
      right: body.style.right,
      top: body.style.top,
      width: body.style.width
    },
    rootStyles: {
      overflow: root.style.overflow,
      overscrollBehavior: root.style.overscrollBehavior,
      scrollbarGutter: root.style.scrollbarGutter
    },
    scrollbarWidth,
    nextPaddingRight: scrollbarWidth > 0 ? `${currentPaddingRight + scrollbarWidth}px` : ""
  };
}

function applyLock(documentRef, state) {
  const body = documentRef.body;
  const root = documentRef.documentElement;
  const { x, y } = state.scrollPosition;

  root.classList.add(LOCKED_BODY_CLASS);
  body.classList.add(LOCKED_BODY_CLASS);
  root.style.overflow = "hidden";
  root.style.overscrollBehavior = "none";
  root.style.scrollbarGutter = "stable";

  body.style.position = "fixed";
  body.style.top = `-${y}px`;
  body.style.left = `-${x}px`;
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  body.style.overscrollBehavior = "none";
  if (state.nextPaddingRight) {
    body.style.paddingRight = state.nextPaddingRight;
  }
}

function restoreLock(documentRef, state) {
  const body = documentRef.body;
  const root = documentRef.documentElement;
  const view = getView(documentRef);

  root.classList.remove(LOCKED_BODY_CLASS);
  body.classList.remove(LOCKED_BODY_CLASS);

  Object.assign(root.style, state.rootStyles);
  Object.assign(body.style, state.bodyStyles);
  scheduleScrollRestore(view, documentRef, state.scrollPosition);
}

export function lockModalScroll(owner = DEFAULT_OWNER) {
  const documentRef = getDocument(owner);
  const body = documentRef?.body;
  const root = documentRef?.documentElement;
  const view = getView(documentRef);
  if (!documentRef || !body || !root || !view) {
    return false;
  }

  const ownerKey = getOwnerKey(owner);
  let state = lockStateByDocument.get(documentRef);
  if (!state) {
    state = createState(documentRef, body, root, view);
    lockStateByDocument.set(documentRef, state);
    applyLock(documentRef, state);
  }
  state.owners.add(ownerKey);
  return true;
}

export function unlockModalScroll(owner = DEFAULT_OWNER) {
  const documentRef = getDocument(owner);
  const state = documentRef ? lockStateByDocument.get(documentRef) : null;
  if (!documentRef || !state) {
    return false;
  }

  state.owners.delete(getOwnerKey(owner));
  if (state.owners.size > 0) {
    return true;
  }

  lockStateByDocument.delete(documentRef);
  restoreLock(documentRef, state);
  return true;
}

export function isModalScrollLocked(owner = DEFAULT_OWNER) {
  const documentRef = getDocument(owner);
  const state = documentRef ? lockStateByDocument.get(documentRef) : null;
  return Boolean(state && state.owners.size > 0);
}

if (typeof window !== "undefined") {
  window.EmpireModalScrollLock = {
    isLocked: isModalScrollLocked,
    lock: lockModalScroll,
    unlock: unlockModalScroll
  };
}
