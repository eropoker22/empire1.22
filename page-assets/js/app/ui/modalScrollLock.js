function getModalScrollLock() {
  return typeof window !== "undefined" ? window.EmpireModalScrollLock ?? null : null;
}

export function lockModalScroll(owner) {
  return Boolean(getModalScrollLock()?.lock?.(owner));
}

export function unlockModalScroll(owner) {
  return Boolean(getModalScrollLock()?.unlock?.(owner));
}

export function isModalScrollLocked(owner) {
  return Boolean(getModalScrollLock()?.isLocked?.(owner));
}
