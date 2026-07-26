const scopesByRoot = new WeakMap();

const normalizeOwner = (owner) => String(owner || "legacy-runtime");
const captureOption = (options) => (
  typeof options === "boolean" ? options : Boolean(options?.capture)
);

const getScopeMap = (root, create = false) => {
  let scopes = scopesByRoot.get(root);
  if (!scopes && create) {
    scopes = new Map();
    scopesByRoot.set(root, scopes);
  }
  return scopes || null;
};

const getScope = (root, owner, create = false) => {
  const scopes = getScopeMap(root, create);
  const key = normalizeOwner(owner);
  if (!scopes) return null;
  let scope = scopes.get(key);
  if (!scope && create) {
    const documentRef = root?.ownerDocument || null;
    const windowRef = documentRef?.defaultView || null;
    scope = {
      owner: key,
      root,
      windowRef,
      destroyed: false,
      captureDepth: 0,
      eventListeners: [],
      timeouts: new Set(),
      intervals: new Set(),
      animationFrames: new Set()
    };
    scopes.set(key, scope);
  }
  return scope || null;
};

const findListenerRegistration = (scope, target, type, listener, options) => (
  scope.eventListeners.find((registration) => (
    registration.target === target
    && registration.type === type
    && registration.listener === listener
    && registration.capture === captureOption(options)
  )) || null
);

const invokeEventListener = (scope, listener, target, event) => {
  if (scope.destroyed) return undefined;
  return runCaptured(scope, () => (
    typeof listener === "function"
      ? listener.call(target, event)
      : listener?.handleEvent?.call(listener, event)
  ));
};

const installEventTargetCapture = (scope, restorers) => {
  const prototype = scope.windowRef?.EventTarget?.prototype;
  if (!prototype) return;
  const addDescriptor = Object.getOwnPropertyDescriptor(prototype, "addEventListener");
  const removeDescriptor = Object.getOwnPropertyDescriptor(prototype, "removeEventListener");
  const originalAdd = addDescriptor?.value;
  const originalRemove = removeDescriptor?.value;
  if (typeof originalAdd !== "function" || typeof originalRemove !== "function") return;

  Object.defineProperty(prototype, "addEventListener", {
    ...addDescriptor,
    value(type, listener, options) {
      if (!listener || scope.destroyed) return undefined;
      let registration = findListenerRegistration(scope, this, type, listener, options);
      if (!registration) {
        registration = {
          target: this,
          type,
          listener,
          options,
          capture: captureOption(options),
          wrapped: null
        };
        registration.wrapped = (event) => invokeEventListener(scope, listener, this, event);
        scope.eventListeners.push(registration);
      }
      return originalAdd.call(this, type, registration.wrapped, options);
    }
  });
  Object.defineProperty(prototype, "removeEventListener", {
    ...removeDescriptor,
    value(type, listener, options) {
      const registration = findListenerRegistration(scope, this, type, listener, options);
      if (!registration) return originalRemove.call(this, type, listener, options);
      scope.eventListeners.splice(scope.eventListeners.indexOf(registration), 1);
      return originalRemove.call(this, type, registration.wrapped, options);
    }
  });
  restorers.push(() => {
    Object.defineProperty(prototype, "addEventListener", addDescriptor);
    Object.defineProperty(prototype, "removeEventListener", removeDescriptor);
  });
};

const installTimerCapture = (scope, restorers) => {
  const windowRef = scope.windowRef;
  if (!windowRef) return;
  const originalSetTimeout = windowRef.setTimeout;
  const originalClearTimeout = windowRef.clearTimeout;
  const originalSetInterval = windowRef.setInterval;
  const originalClearInterval = windowRef.clearInterval;
  const originalRequestAnimationFrame = windowRef.requestAnimationFrame;
  const originalCancelAnimationFrame = windowRef.cancelAnimationFrame;

  if (typeof originalSetTimeout === "function" && typeof originalClearTimeout === "function") {
    windowRef.setTimeout = (callback, delay, ...args) => {
      let timerId = null;
      const wrapped = (...callbackArgs) => {
        scope.timeouts.delete(timerId);
        if (!scope.destroyed && typeof callback === "function") {
          return runCaptured(scope, () => callback(...callbackArgs));
        }
        return undefined;
      };
      timerId = originalSetTimeout.call(windowRef, wrapped, delay, ...args);
      scope.timeouts.add(timerId);
      return timerId;
    };
    windowRef.clearTimeout = (timerId) => {
      scope.timeouts.delete(timerId);
      return originalClearTimeout.call(windowRef, timerId);
    };
    restorers.push(() => {
      windowRef.setTimeout = originalSetTimeout;
      windowRef.clearTimeout = originalClearTimeout;
    });
  }

  if (typeof originalSetInterval === "function" && typeof originalClearInterval === "function") {
    windowRef.setInterval = (callback, delay, ...args) => {
      const wrapped = (...callbackArgs) => (
        !scope.destroyed && typeof callback === "function"
          ? runCaptured(scope, () => callback(...callbackArgs))
          : undefined
      );
      const timerId = originalSetInterval.call(windowRef, wrapped, delay, ...args);
      scope.intervals.add(timerId);
      return timerId;
    };
    windowRef.clearInterval = (timerId) => {
      scope.intervals.delete(timerId);
      return originalClearInterval.call(windowRef, timerId);
    };
    restorers.push(() => {
      windowRef.setInterval = originalSetInterval;
      windowRef.clearInterval = originalClearInterval;
    });
  }

  if (
    typeof originalRequestAnimationFrame === "function"
    && typeof originalCancelAnimationFrame === "function"
  ) {
    windowRef.requestAnimationFrame = (callback) => {
      let frameId = null;
      const wrapped = (time) => {
        scope.animationFrames.delete(frameId);
        if (!scope.destroyed && typeof callback === "function") {
          return runCaptured(scope, () => callback(time));
        }
        return undefined;
      };
      frameId = originalRequestAnimationFrame.call(windowRef, wrapped);
      scope.animationFrames.add(frameId);
      return frameId;
    };
    windowRef.cancelAnimationFrame = (frameId) => {
      scope.animationFrames.delete(frameId);
      return originalCancelAnimationFrame.call(windowRef, frameId);
    };
    restorers.push(() => {
      windowRef.requestAnimationFrame = originalRequestAnimationFrame;
      windowRef.cancelAnimationFrame = originalCancelAnimationFrame;
    });
  }
};

function runCaptured(scope, callback) {
  if (scope.destroyed || typeof callback !== "function") return undefined;
  if (scope.captureDepth > 0) return callback();
  scope.captureDepth += 1;
  const restorers = [];
  try {
    installEventTargetCapture(scope, restorers);
    installTimerCapture(scope, restorers);
    return callback();
  } finally {
    while (restorers.length > 0) restorers.pop()();
    scope.captureDepth -= 1;
  }
}

export function captureLegacyRuntimeLifecycle(root, owner, callback) {
  if (!root || typeof callback !== "function") {
    return typeof callback === "function" ? callback() : undefined;
  }
  const scope = getScope(root, owner, true);
  return runCaptured(scope, callback);
}

export function destroyLegacyRuntimeLifecycle(root, owner) {
  const scope = getScope(root, owner);
  if (!scope || scope.destroyed) return false;
  scope.destroyed = true;
  const windowRef = scope.windowRef;

  for (const registration of [...scope.eventListeners].reverse()) {
    registration.target?.removeEventListener?.(
      registration.type,
      registration.wrapped,
      registration.options
    );
  }
  scope.eventListeners.length = 0;
  for (const timerId of scope.timeouts) windowRef?.clearTimeout?.(timerId);
  for (const timerId of scope.intervals) windowRef?.clearInterval?.(timerId);
  for (const frameId of scope.animationFrames) windowRef?.cancelAnimationFrame?.(frameId);
  scope.timeouts.clear();
  scope.intervals.clear();
  scope.animationFrames.clear();

  const scopes = getScopeMap(root);
  scopes?.delete(normalizeOwner(owner));
  if (scopes?.size === 0) scopesByRoot.delete(root);
  return true;
}

export function getLegacyRuntimeLifecycleDiagnostics(root, owner) {
  const scope = getScope(root, owner);
  return {
    mounted: Boolean(scope && !scope.destroyed),
    listenerCount: scope?.eventListeners.length || 0,
    timeoutCount: scope?.timeouts.size || 0,
    intervalCount: scope?.intervals.size || 0,
    animationFrameCount: scope?.animationFrames.size || 0
  };
}
