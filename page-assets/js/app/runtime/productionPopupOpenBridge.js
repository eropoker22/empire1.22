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
      } else {
        invokeSafely(callbacks.onOpened, opened);
      }
    },
    (error) => {
      invokeSafely(callbacks.onRejected, error);
    }
  );
  return true;
}
