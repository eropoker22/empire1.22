const productionPopupOpeners = new WeakMap();

export function registerProductionPopupOpener(trigger, opener) {
  if ((typeof trigger !== "object" && typeof trigger !== "function") || trigger === null) {
    return false;
  }
  if (typeof opener !== "function") {
    return false;
  }

  productionPopupOpeners.set(trigger, opener);
  return true;
}

export function openProductionPopupFromTrigger(trigger) {
  if ((typeof trigger !== "object" && typeof trigger !== "function") || trigger === null) {
    return null;
  }

  const opener = productionPopupOpeners.get(trigger);
  return typeof opener === "function" ? opener() : null;
}

function invokeSafely(callback, value) {
  if (typeof callback !== "function") {
    return;
  }
  try {
    callback(value);
  } catch {}
}

export function observeProductionPopupOpening(opening, callbacks = {}) {
  if (opening === null) {
    return false;
  }

  void Promise.resolve(opening).then(
    (opened) => {
      if (opened === false) {
        invokeSafely(callbacks.onDeclined);
      }
    },
    (error) => {
      invokeSafely(callbacks.onRejected, error);
    }
  );
  return true;
}
