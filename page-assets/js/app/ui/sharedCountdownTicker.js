const bindings = new Set();
const bindingByElement = new WeakMap();
let intervalId = null;
let timerApi = null;
let visibilityDocument = null;

function stopTicker() {
  if (intervalId === null) return;
  timerApi?.clearInterval?.(intervalId);
  intervalId = null;
}

function removeVisibilityListener() {
  visibilityDocument?.removeEventListener?.("visibilitychange", handleVisibilityChange);
  visibilityDocument = null;
}

function stopIfIdle() {
  if (bindings.size > 0) return;
  stopTicker();
  timerApi = null;
  removeVisibilityListener();
}

function startTicker() {
  if (
    intervalId !== null
    || bindings.size === 0
    || visibilityDocument?.hidden
    || typeof timerApi?.setInterval !== "function"
  ) return;
  intervalId = timerApi.setInterval(tick, 1000);
}

function handleVisibilityChange() {
  if (visibilityDocument?.hidden) {
    stopTicker();
    return;
  }
  tick();
  startTicker();
}

function tick() {
  if (visibilityDocument?.hidden) return;
  for (const binding of [...bindings]) {
    if (binding.element?.isConnected === false || binding.element?.closest?.("[hidden]")) {
      bindings.delete(binding);
      bindingByElement.delete(binding.element);
      continue;
    }
    binding.render(binding.getValue());
  }
  stopIfIdle();
}

export function bindSharedCountdown(element, getValue, options = {}) {
  if (!element || Number.isFinite(Number(options.now))) return () => {};
  const elementTimerApi = element?.ownerDocument?.defaultView || (typeof window !== "undefined" ? window : null);
  const documentRef = elementTimerApi?.document || element?.ownerDocument || null;
  if (typeof elementTimerApi?.setInterval !== "function" || typeof elementTimerApi?.clearInterval !== "function") return () => {};
  const previous = bindingByElement.get(element);
  if (previous) bindings.delete(previous);
  const binding = {
    element,
    getValue,
    render: typeof options.render === "function"
      ? options.render
      : (value) => { element.textContent = value; }
  };
  bindings.add(binding);
  bindingByElement.set(element, binding);
  if (visibilityDocument !== documentRef) {
    removeVisibilityListener();
    visibilityDocument = documentRef;
    visibilityDocument?.addEventListener?.("visibilitychange", handleVisibilityChange);
  }
  timerApi = elementTimerApi;
  if (!documentRef?.hidden) binding.render(binding.getValue());
  startTicker();
  return () => {
    if (bindingByElement.get(element) !== binding) return;
    bindingByElement.delete(element);
    bindings.delete(binding);
    stopIfIdle();
  };
}

export function getSharedCountdownDiagnostics() {
  return {
    bindingCount: bindings.size,
    hasActiveTicker: intervalId !== null
  };
}
